import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { ExternalLink, FlaskConical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { LIMITS } from "@shared/constants";
import { supportLinkFor } from "@shared/supportLinks";
import type { Device } from "@shared/types";
import { updateDeviceSchema } from "@shared/validation";
import { ApiError, errorMessage } from "@/lib/api";
import { TYPE_META, capabilities } from "@/lib/deviceMeta";
import { EVENT_LABELS, absoluteTime, relativeTime } from "@/lib/format";
import { useConfig, useDeleteDevice, useDeviceEvents, useRoomsWithDevices, useSimulateError, useUpdateDevice } from "@/lib/queries";
import { ConfirmDialog, Dialog } from "../Dialog";
import { ErrorState } from "../states";
import { Button, Field, Select, Skeleton, TextInput } from "../ui";

const NOT_SPECIFIED = <span className="text-ink-2">Not specified</span>;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-2">
      <dt className="text-ink-2">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{children}</dd>
    </div>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="mt-5 mb-1 text-[15px] font-semibold first:mt-0">{children}</h3>;
}

export function InfoTab({ device }: { device: Device }) {
  const config = useConfig();
  const events = useDeviceEvents(device.id);
  const support = supportLinkFor(device.manufacturer);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const del = useDeleteDevice();
  const [, navigate] = useLocation();
  const state = [device.isOn ? "On" : "Off", device.isOnline ? "online" : "offline", device.hasError ? "error" : "no errors"].join(", ");

  return (
    <div className="text-sm">
      <SubHeading>Details</SubHeading>
      <dl className="divide-y divide-line">
        <Row label="Type">{TYPE_META[device.type].label}</Row>
        <Row label="State">{state}</Row>
        <Row label="Manufacturer">{device.manufacturer ?? NOT_SPECIFIED}</Row>
        <Row label="Model">{device.model ?? NOT_SPECIFIED}</Row>
        <Row label="Firmware">{device.firmwareVersion ?? NOT_SPECIFIED}</Row>
        <Row label="Room">{device.roomName}</Row>
        <Row label="Last seen">
          {device.lastSeenAt ? (
            <span title={absoluteTime(device.lastSeenAt)}>{relativeTime(device.lastSeenAt)} (simulated)</span>
          ) : (
            NOT_SPECIFIED
          )}
        </Row>
        <Row label="Added">{absoluteTime(device.createdAt)}</Row>
        <Row label="Device ID">{device.id}</Row>
      </dl>

      <SubHeading>Simulated capabilities</SubHeading>
      <ul className="list-disc space-y-0.5 pl-5">
        {capabilities(device.type).map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>

      {support ? (
        <>
          <SubHeading>Support</SubHeading>
          <a
            href={support.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary underline-offset-2 hover:underline"
          >
            Manufacturer support: {support.label}
            <ExternalLink className="size-4" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </>
      ) : null}

      <SubHeading>Recent activity</SubHeading>
      {events.isPending ? (
        <div className="space-y-2" role="status">
          <span className="sr-only">Loading activity…</span>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : events.isError ? (
        <ErrorState error={events.error} onRetry={() => events.refetch()} title="Couldn't load activity" />
      ) : events.data.length === 0 ? (
        <p className="text-ink-2">No activity yet</p>
      ) : (
        <ol className="space-y-2">
          {events.data.map((e) => (
            <li key={e.id} className="flex justify-between gap-3">
              <span>
                <span className="font-medium">{EVENT_LABELS[e.type]}</span>
                {e.detail ? <span className="block text-xs text-ink-2">{e.detail}</span> : null}
              </span>
              <time dateTime={e.createdAt} title={absoluteTime(e.createdAt)} className="shrink-0 text-xs text-ink-2">
                {relativeTime(e.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}

      <SubHeading>Manage</SubHeading>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
          <Pencil className="size-4" aria-hidden /> Edit device
        </Button>
        <Button size="sm" variant="secondary" className="text-[#d70015]" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="size-4" aria-hidden /> Delete device
        </Button>
      </div>

      {config.data?.demoEndpointsEnabled ? (
        <>
          <SubHeading>Demo tools</SubHeading>
          <Button size="sm" variant="secondary" onClick={() => setErrorOpen(true)}>
            <FlaskConical className="size-4" aria-hidden /> Simulate error
          </Button>
        </>
      ) : null}

      <EditDeviceDialog open={editOpen} onOpenChange={setEditOpen} device={device} />
      <SimulateErrorDialog open={errorOpen} onOpenChange={setErrorOpen} device={device} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${device.name}?`}
        body="The device and its activity history are removed. This can't be undone."
        confirmLabel="Delete device"
        pending={del.isPending}
        onConfirm={() =>
          del.mutate(device.id, {
            onSuccess: () => {
              toast.success(`${device.name} deleted`);
              setDeleteOpen(false);
              navigate("/devices", { replace: true });
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </div>
  );
}

function EditDeviceDialog({ open, onOpenChange, device }: { open: boolean; onOpenChange: (o: boolean) => void; device: Device }) {
  const id = useId();
  const rooms = useRoomsWithDevices();
  const update = useUpdateDevice();
  const [name, setName] = useState(device.name);
  const [roomId, setRoomId] = useState(String(device.roomId));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(device.name);
      setRoomId(String(device.roomId));
      setErrors({});
    }
  }, [open, device.name, device.roomId]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = updateDeviceSchema.safeParse({ name, roomId: Number(roomId) });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message;
      setErrors(next);
      return;
    }
    update.mutate(
      { id: device.id, ...parsed.data },
      {
        onSuccess: () => {
          toast.success("Device updated");
          onOpenChange(false);
        },
        onError: (err) => setErrors(err instanceof ApiError && err.fieldErrors ? err.fieldErrors : { _: errorMessage(err) }),
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !update.isPending && onOpenChange(o)}
      title="Edit device"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={`${id}-form`} pending={update.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={submit} noValidate className="space-y-4">
        {errors._ ? (
          <p role="alert" className="rounded-lg bg-error/10 p-2 text-sm text-[#d70015]">
            {errors._}
          </p>
        ) : null}
        <Field label="Device name" htmlFor={`${id}-name`} error={errors.name}>
          <TextInput
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={LIMITS.deviceName}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? `${id}-name-error` : undefined}
          />
        </Field>
        <Field label="Room" htmlFor={`${id}-room`} error={errors.roomId}>
          <Select id={`${id}-room`} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            {(rooms.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Dialog>
  );
}

function SimulateErrorDialog({ open, onOpenChange, device }: { open: boolean; onOpenChange: (o: boolean) => void; device: Device }) {
  const id = useId();
  const sim = useSimulateError();
  const [message, setMessage] = useState("Connection lost");
  const [fixable, setFixable] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      setMessage("Connection lost");
      setFixable(true);
      setError(undefined);
    }
  }, [open]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Error message is required");
      return;
    }
    sim.mutate(
      { id: device.id, errorMessage: trimmed, fixable },
      {
        onSuccess: () => {
          toast.success(`Simulated error set on ${device.name}`);
          onOpenChange(false);
        },
        onError: (err) => setError(errorMessage(err)),
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !sim.isPending && onOpenChange(o)}
      title="Simulate error"
      description="Demo tool: marks this simulated device as having an error."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={sim.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={`${id}-form`} pending={sim.isPending}>
            Set error
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={submit} noValidate className="space-y-4">
        <Field label="Error message" htmlFor={`${id}-msg`} error={error}>
          <TextInput
            id={`${id}-msg`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={LIMITS.errorMessage}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-msg-error` : undefined}
          />
        </Field>
        <label className="flex min-h-11 items-center gap-3 text-[15px]">
          <input type="checkbox" checked={fixable} onChange={(e) => setFixable(e.target.checked)} className="size-5 accent-[var(--primary)]" />
          Can be fixed remotely
        </label>
      </form>
    </Dialog>
  );
}
