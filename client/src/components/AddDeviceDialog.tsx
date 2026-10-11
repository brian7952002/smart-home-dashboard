import { useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { DEVICE_TYPES, DEVICE_TYPE_LABELS, LIMITS, type DeviceType } from "@shared/constants";
import { createDeviceSchema } from "@shared/validation";
import { ApiError, errorMessage } from "@/lib/api";
import { useCreateDevice, useRoomsWithDevices } from "@/lib/queries";
import { Dialog } from "./Dialog";
import { Button, Field, Select, TextInput } from "./ui";

type Errors = Record<string, string>;

export function AddDeviceDialog({
  open,
  onOpenChange,
  defaultRoomId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRoomId?: number;
}) {
  const id = useId();
  const rooms = useRoomsWithDevices();
  const create = useCreateDevice();
  const [name, setName] = useState("");
  const [type, setType] = useState<DeviceType>("light");
  const [roomId, setRoomId] = useState<string>("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (open) {
      setName("");
      setType("light");
      setRoomId(defaultRoomId ? String(defaultRoomId) : "");
      setManufacturer("");
      setModel("");
      setErrors({});
    }
  }, [open, defaultRoomId]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = createDeviceSchema.safeParse({
      name,
      type,
      roomId: roomId ? Number(roomId) : undefined,
      manufacturer,
      model,
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    create.mutate(parsed.data, {
      onSuccess: (device) => {
        toast.success(`${device.name} added to ${device.roomName}`);
        onOpenChange(false);
      },
      onError: (err) => {
        if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
        else setErrors({ _: errorMessage(err) });
      },
    });
  }

  const roomList = rooms.data ?? [];
  const noRooms = rooms.isSuccess && roomList.length === 0;
  const formId = `${id}-form`;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !create.isPending && onOpenChange(o)}
      title="Add New Device"
      description="Adds a simulated device. Nothing is paired with real hardware."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} pending={create.isPending} disabled={noRooms}>
            Add Device
          </Button>
        </>
      }
    >
      {noRooms ? (
        <p className="text-sm">
          There are no rooms yet. Add a room from the floor plan on{" "}
          <Link href="/" className="font-semibold text-primary underline" onClick={() => onOpenChange(false)}>
            Home
          </Link>{" "}
          first.
        </p>
      ) : (
        <form id={formId} onSubmit={submit} noValidate className="space-y-4">
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
              required
              autoComplete="off"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? `${id}-name-error` : undefined}
            />
          </Field>
          <Field label="Device type" htmlFor={`${id}-type`} error={errors.type}>
            <Select id={`${id}-type`} value={type} onChange={(e) => setType(e.target.value as DeviceType)}>
              {DEVICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DEVICE_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Room" htmlFor={`${id}-room`} error={errors.roomId}>
            <Select
              id={`${id}-room`}
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              required
              aria-invalid={!!errors.roomId}
              aria-describedby={errors.roomId ? `${id}-room-error` : undefined}
            >
              <option value="">{rooms.isLoading ? "Loading rooms…" : "Choose a room"}</option>
              {roomList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <details className="rounded-xl bg-page px-3 py-2">
            <summary className="min-h-9 cursor-pointer py-2 text-sm font-semibold">More details (optional)</summary>
            <div className="space-y-3 pb-2">
              <Field label="Manufacturer" htmlFor={`${id}-mfr`} error={errors.manufacturer}>
                <TextInput id={`${id}-mfr`} value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} maxLength={LIMITS.manufacturer} />
              </Field>
              <Field label="Model" htmlFor={`${id}-model`} error={errors.model}>
                <TextInput id={`${id}-model`} value={model} onChange={(e) => setModel(e.target.value)} maxLength={LIMITS.model} />
              </Field>
            </div>
          </details>
        </form>
      )}
    </Dialog>
  );
}
