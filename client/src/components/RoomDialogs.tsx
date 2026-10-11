import { useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { LIMITS, ROOM_SIZES, ROOM_SIZE_KEYS, type RoomSize } from "@shared/constants";
import { createRoomSchema } from "@shared/validation";
import { ApiError, errorMessage } from "@/lib/api";
import { useCreateRoom, useRenameRoom } from "@/lib/queries";
import { Dialog } from "./Dialog";
import { Button, Field, TextInput } from "./ui";

const SIZE_LABELS: Record<RoomSize, string> = { small: "Small", medium: "Medium", large: "Large" };

export function AddRoomDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const id = useId();
  const create = useCreateRoom();
  const [name, setName] = useState("");
  const [size, setSize] = useState<RoomSize>("medium");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      setName("");
      setSize("medium");
      setError(undefined);
      setFormError(undefined);
    }
  }, [open]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = createRoomSchema.safeParse({ name, size });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    setFormError(undefined);
    create.mutate(parsed.data, {
      onSuccess: (room) => {
        toast.success(`${room.name} added to the floor plan`);
        onOpenChange(false);
      },
      onError: (err) => {
        if (err instanceof ApiError && err.fieldErrors?.name) setError(err.fieldErrors.name);
        else setFormError(errorMessage(err));
      },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !create.isPending && onOpenChange(o)}
      title="Add Room"
      description="The room is placed in the first free spot on the plan. You can move it afterwards."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={`${id}-form`} pending={create.isPending}>
            Add Room
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={submit} noValidate className="space-y-4">
        {formError ? (
          <p role="alert" className="rounded-lg bg-error/10 p-2 text-sm text-[#d70015]">
            {formError}
          </p>
        ) : null}
        <Field label="Room name" htmlFor={`${id}-name`} error={error}>
          <TextInput
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={LIMITS.roomName}
            autoComplete="off"
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-name-error` : undefined}
          />
        </Field>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Size</legend>
          <div className="grid grid-cols-3 gap-2">
            {ROOM_SIZE_KEYS.map((key) => (
              <label
                key={key}
                className="flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-xl border border-line text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary"
              >
                <input type="radio" name="size" value={key} checked={size === key} onChange={() => setSize(key)} className="sr-only" />
                <span className="font-semibold">{SIZE_LABELS[key]}</span>
                <span className="text-xs text-ink-2">
                  {ROOM_SIZES[key].width}×{ROOM_SIZES[key].height}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}

export function RenameRoomDialog({
  open,
  onOpenChange,
  roomId,
  currentName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roomId: number;
  currentName: string;
}) {
  const id = useId();
  const rename = useRenameRoom();
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      setName(currentName);
      setError(undefined);
    }
  }, [open, currentName]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = createRoomSchema.shape.name.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    rename.mutate(
      { id: roomId, name: parsed.data },
      {
        onSuccess: (room) => {
          toast.success(`Renamed to ${room.name}`);
          onOpenChange(false);
        },
        onError: (err) => setError(err instanceof ApiError && err.fieldErrors?.name ? err.fieldErrors.name : errorMessage(err)),
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !rename.isPending && onOpenChange(o)}
      title="Rename room"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={rename.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={`${id}-form`} pending={rename.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={submit} noValidate>
        <Field label="Room name" htmlFor={`${id}-name`} error={error}>
          <TextInput
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={LIMITS.roomName}
            autoComplete="off"
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-name-error` : undefined}
          />
        </Field>
      </form>
    </Dialog>
  );
}
