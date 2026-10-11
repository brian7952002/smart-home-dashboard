import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import clsx from "clsx";
import { Pencil, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { PLAN, type DeviceType } from "@shared/constants";
import { clampToPlan, findOverlaps } from "@shared/geometry";
import type { RoomWithDevices } from "@shared/types";
import { errorMessage } from "@/lib/api";
import { TYPE_META } from "@/lib/deviceMeta";
import { plural } from "@/lib/format";
import { setNavigationGuard } from "@/lib/navigation";
import { useSaveLayout } from "@/lib/queries";
import { AddRoomDialog } from "./RoomDialogs";
import { Button, Card, CardHeader } from "./ui";

type Pos = { positionX: number; positionY: number };

const pct = (v: number, total: number) => `${(v / total) * 100}%`;
const snap = (v: number) => Math.round(v / 5) * 5;

function roomSummary(room: RoomWithDevices) {
  const n = room.devices.length;
  const errors = room.devices.filter((d) => d.hasError).length;
  const offline = room.devices.filter((d) => !d.isOnline).length;
  const parts = [plural(n, "device")];
  if (errors) parts.push(plural(errors, "error"));
  if (offline) parts.push(`${offline} offline`);
  return { text: parts.join(" · "), errors, offline, allOffline: n > 0 && offline === n };
}

function typeCounts(room: RoomWithDevices) {
  const counts = new Map<DeviceType, number>();
  for (const d of room.devices) counts.set(d.type, (counts.get(d.type) ?? 0) + 1);
  return [...counts.entries()];
}

export function FloorPlan({ rooms }: { rooms: RoomWithDevices[] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<number, Pos>>({});
  const [addOpen, setAddOpen] = useState(false);
  const planRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; startX: number; startY: number; origin: Pos; unitsPerPx: number } | null>(null);
  const save = useSaveLayout();

  const placed = useMemo(
    () => rooms.map((r) => ({ ...r, ...(draft[r.id] ?? {}) })),
    [rooms, draft],
  );
  const changed = placed.filter((r) => {
    const orig = rooms.find((o) => o.id === r.id)!;
    return orig.positionX !== r.positionX || orig.positionY !== r.positionY;
  });
  const dirty = changed.length > 0;
  const overlapPairs = findOverlaps(placed);
  const overlapping = new Map<number, string>();
  for (const [a, b] of overlapPairs) {
    overlapping.set(a, placed.find((r) => r.id === b)!.name);
    overlapping.set(b, placed.find((r) => r.id === a)!.name);
  }

  useEffect(() => {
    setNavigationGuard(editing && dirty ? "You have unsaved floor plan changes. Leave without saving?" : null);
    const onUnload = (e: BeforeUnloadEvent) => {
      if (editing && dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      setNavigationGuard(null);
    };
  }, [editing, dirty]);

  function move(id: number, next: Pos) {
    const room = placed.find((r) => r.id === id)!;
    const clamped = clampToPlan({ ...room, ...next });
    setDraft((d) => ({ ...d, [id]: { positionX: clamped.positionX, positionY: clamped.positionY } }));
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>, id: number) {
    if (!editing || !planRef.current) return;
    const rect = planRef.current.getBoundingClientRect();
    const room = placed.find((r) => r.id === id)!;
    drag.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origin: { positionX: room.positionX, positionY: room.positionY },
      unitsPerPx: PLAN.width / rect.width,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    move(d.id, {
      positionX: snap(d.origin.positionX + (e.clientX - d.startX) * d.unitsPerPx),
      positionY: snap(d.origin.positionY + (e.clientY - d.startY) * d.unitsPerPx),
    });
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (drag.current) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>, id: number) {
    const step = e.shiftKey ? 20 : 5;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const dir = delta[e.key];
    if (!dir) return;
    e.preventDefault();
    const room = placed.find((r) => r.id === id)!;
    move(id, { positionX: room.positionX + dir[0], positionY: room.positionY + dir[1] });
  }

  function cancel() {
    setDraft({});
    setEditing(false);
  }

  function saveLayout() {
    save.mutate(
      changed.map((r) => ({ id: r.id, positionX: r.positionX, positionY: r.positionY })),
      {
        onSuccess: () => {
          toast.success("Floor plan saved");
          setDraft({});
          setEditing(false);
        },
        onError: (err) => toast.error(`Couldn't save the floor plan: ${errorMessage(err)}`),
      },
    );
  }

  const saveBlockedReason = overlapPairs.length ? "Rooms can't overlap" : !dirty ? "Move a room to enable saving" : null;

  return (
    <Card aria-labelledby="floorplan-title">
      <CardHeader
        id="floorplan-title"
        title="Home Floor Plan"
        action={
          editing ? null : (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden />
              Edit layout
            </Button>
          )
        }
      />

      {editing ? (
        <div className="mb-3 rounded-xl bg-primary/10 p-3">
          <p className="text-sm font-medium text-ink" role="status">
            Editing layout: drag rooms, or select one and use the arrow keys (Shift for bigger steps).
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={cancel} disabled={save.isPending}>
              Cancel
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)} disabled={save.isPending}>
              <Plus className="size-4" aria-hidden />
              Add Room
            </Button>
            <Button
              size="sm"
              onClick={saveLayout}
              pending={save.isPending}
              disabled={!!saveBlockedReason}
              aria-describedby="floorplan-save-reason"
            >
              Save
            </Button>
          </div>
          {saveBlockedReason ? (
            <p id="floorplan-save-reason" className={clsx("mt-1.5 text-xs", overlapPairs.length ? "font-medium text-[#d70015]" : "text-ink-2")}>
              {saveBlockedReason}
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        ref={planRef}
        className={clsx(
          "relative w-full overflow-hidden rounded-2xl border-2 bg-[#f2f2f5]",
          editing ? "border-dashed border-primary/60" : "border-[#d8d8de]",
        )}
        style={{ aspectRatio: `${PLAN.width} / ${PLAN.height}` }}
      >
        {/* Entrance marker */}
        <div
          aria-hidden
          className="absolute top-0 left-1/2 flex -translate-x-1/2 flex-col items-center"
          style={{ height: pct(PLAN.entranceBand, PLAN.height) }}
        >
          <span className="h-1 w-14 rounded-b bg-white" />
          <span className="mt-0.5 text-[10px] font-semibold tracking-wide text-ink-2 uppercase">Entrance</span>
        </div>
        <span className="sr-only">Entrance at the top of the plan.</span>

        {rooms.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink-2">
            No rooms yet. Choose Edit layout, then Add Room.
          </div>
        ) : null}

        {placed.map((room) => {
          const summary = roomSummary(room);
          const overlapWith = overlapping.get(room.id);
          const style = {
            left: pct(room.positionX, PLAN.width),
            top: pct(room.positionY, PLAN.height),
            width: pct(room.width, PLAN.width),
            height: pct(room.height, PLAN.height),
          };
          const body = (
            <>
              <span className="block truncate text-[13px] leading-tight font-semibold">{room.name}</span>
              <span className={clsx("line-clamp-2 text-[11px] leading-tight", summary.errors ? "text-[#d70015]" : "text-ink-2")}>
                {summary.text}
              </span>
              <span className="mt-1 flex flex-wrap gap-1" aria-hidden>
                {typeCounts(room).map(([t, n]) => (
                  <span key={t} className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-ink-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: TYPE_META[t].color }} />
                    {n > 1 ? n : null}
                  </span>
                ))}
              </span>
              {summary.errors ? (
                <span className="absolute top-1 right-1 inline-flex size-[18px] items-center justify-center rounded-full bg-error text-white" aria-hidden>
                  <TriangleAlert className="size-[11px]" strokeWidth={3} />
                </span>
              ) : null}
              {overlapWith ? (
                <span className="absolute inset-x-1 bottom-1 truncate rounded bg-error px-1 text-[10px] font-semibold text-white">
                  Overlaps {overlapWith}
                </span>
              ) : null}
            </>
          );
          const tileClass = clsx(
            "absolute overflow-hidden rounded-lg border bg-white p-1.5 text-left shadow-sm",
            summary.allOffline && "opacity-60",
            overlapWith ? "border-2 border-error" : "border-[#d1d1d6]",
          );
          const label = `${room.name}: ${summary.text}`;
          return editing ? (
            <div
              key={room.id}
              role="button"
              tabIndex={0}
              aria-roledescription="movable room"
              aria-label={`${label}. Position ${room.positionX}, ${room.positionY}. Use arrow keys to move.${overlapWith ? ` Overlaps ${overlapWith}.` : ""}`}
              className={clsx(tileClass, "cursor-grab touch-none select-none active:cursor-grabbing", "ring-primary focus-visible:ring-2")}
              style={style}
              onPointerDown={(e) => onPointerDown(e, room.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={(e) => onKeyDown(e, room.id)}
            >
              {body}
            </div>
          ) : (
            <Link key={room.id} href={`/room/${room.id}`} aria-label={label} className={clsx(tileClass, "hover:border-primary")} style={style}>
              {body}
            </Link>
          );
        })}
      </div>

      <AddRoomDialog open={addOpen} onOpenChange={setAddOpen} />
    </Card>
  );
}
