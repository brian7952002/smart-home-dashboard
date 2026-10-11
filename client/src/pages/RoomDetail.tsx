import { useContext, useState, type ReactNode } from "react";
import { Ellipsis, Pencil, Plus, Trash2 } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import { AddDeviceDialog } from "@/components/AddDeviceDialog";
import { ConfirmDialog, PortalContainerContext } from "@/components/Dialog";
import { DeviceRow, FilterChip, Legend } from "@/components/devices";
import { PageHeader } from "@/components/PageHeader";
import { RenameRoomDialog } from "@/components/RoomDialogs";
import { RoomDiagram } from "@/components/RoomDiagram";
import { EmptyState, ErrorState, LoadingRows, NotFoundState } from "@/components/states";
import { Button, Card, CardHeader, IconButton, Skeleton } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { plural } from "@/lib/format";
import { useDeleteRoom, useRoomsWithDevices } from "@/lib/queries";
import { parseRouteId } from "@/lib/navigation";

export default function RoomDetail() {
  const params = useParams<{ id: string }>();
  const id = parseRouteId(params.id);
  const rooms = useRoomsWithDevices();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<"all" | "errors">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const del = useDeleteRoom();
  const portal = useContext(PortalContainerContext);

  if (id === null) return <Shell title="Room"><NotFoundState what="Room" /></Shell>;
  if (rooms.isPending) {
    return (
      <Shell title="Room">
        <Card>
          <Skeleton className="mx-auto aspect-square w-full max-w-[350px]" />
        </Card>
        <Card className="mt-4">
          <LoadingRows rows={3} />
        </Card>
      </Shell>
    );
  }
  if (rooms.isError) {
    return (
      <Shell title="Room">
        <Card>
          <ErrorState error={rooms.error} onRetry={() => rooms.refetch()} />
        </Card>
      </Shell>
    );
  }
  const room = rooms.data.find((r) => r.id === id);
  if (!room) return <Shell title="Room"><NotFoundState what="Room" /></Shell>;

  const devices = [...room.devices].sort((a, b) => a.id - b.id);
  const errorCount = devices.filter((d) => d.hasError).length;
  const activeFilter = filter === "errors" && errorCount > 0 ? "errors" : "all";
  const shown = activeFilter === "errors" ? devices.filter((d) => d.hasError) : devices;
  const hasDevices = devices.length > 0;

  function confirmDelete() {
    del.mutate(room!.id, {
      onSuccess: () => {
        toast.success(`${room!.name} deleted`);
        setDeleteOpen(false);
        navigate("/", { replace: true });
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  }

  return (
    <Shell
      title={room.name}
      actions={
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <IconButton label="Room options">
              <Ellipsis className="size-6" aria-hidden />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal container={portal ?? undefined}>
            <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-56 rounded-xl border border-line bg-white p-1 shadow-lg">
              <DropdownMenu.Item
                onSelect={() => setRenameOpen(true)}
                className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-[15px] outline-none data-[highlighted]:bg-page"
              >
                <Pencil className="size-4" aria-hidden /> Rename room
              </DropdownMenu.Item>
              <DropdownMenu.Item
                disabled={hasDevices}
                onSelect={() => setDeleteOpen(true)}
                className="flex min-h-11 flex-col items-start justify-center rounded-lg px-3 py-1.5 text-[15px] text-[#d70015] outline-none data-[disabled]:text-ink-2 data-[highlighted]:bg-page"
              >
                <span className="flex items-center gap-2">
                  <Trash2 className="size-4" aria-hidden /> Delete room
                </span>
                {hasDevices ? (
                  <span className="text-xs text-ink-2">Move or delete this room's {plural(devices.length, "device")} first</span>
                ) : null}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      }
    >
      <div className="space-y-4">
        <Card aria-labelledby="layout-title">
          <CardHeader id="layout-title" title="Room Layout" sub="Numbered markers match the device list below." />
          <RoomDiagram name={room.name} devices={devices} />
          {hasDevices ? (
            <div className="mt-3">
              <Legend
                only={{
                  types: new Set(devices.map((d) => d.type)),
                  offline: devices.some((d) => !d.isOnline),
                  error: errorCount > 0,
                }}
              />
            </div>
          ) : null}
        </Card>

        <Card aria-labelledby="room-devices-title">
          <CardHeader
            id="room-devices-title"
            title="Devices"
            action={
              <IconButton label={`Add device to ${room.name}`} onClick={() => setAddOpen(true)} className="-mt-2 -mr-2">
                <Plus className="size-6" aria-hidden />
              </IconButton>
            }
          />
          {hasDevices ? (
            <>
              <div className="mb-1 flex gap-2" role="group" aria-label="Filter devices">
                <FilterChip active={activeFilter === "all"} onClick={() => setFilter("all")}>
                  All
                </FilterChip>
                {errorCount > 0 ? (
                  <FilterChip active={activeFilter === "errors"} onClick={() => setFilter("errors")}>
                    Errors ({errorCount})
                  </FilterChip>
                ) : null}
              </div>
              <ul className="divide-y divide-line">
                {/* Marker numbers stay stable when the list is filtered. */}
                {shown.map((d) => (
                  <DeviceRow key={d.id} device={d} number={devices.indexOf(d) + 1} />
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              title="No devices in this room yet"
              action={
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  Add Device
                </Button>
              }
            />
          )}
        </Card>
      </div>

      <AddDeviceDialog open={addOpen} onOpenChange={setAddOpen} defaultRoomId={room.id} />
      <RenameRoomDialog open={renameOpen} onOpenChange={setRenameOpen} roomId={room.id} currentName={room.name} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${room.name}?`}
        body="The room is removed from the floor plan. This can't be undone."
        confirmLabel="Delete room"
        onConfirm={confirmDelete}
        pending={del.isPending}
      />
    </Shell>
  );
}

function Shell({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <PageHeader title={title} back="/" actions={actions} />
      {children}
    </>
  );
}
