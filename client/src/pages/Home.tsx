import { useState } from "react";
import { CircleCheck, Plus } from "lucide-react";
import { Link } from "wouter";
import { AddDeviceDialog } from "@/components/AddDeviceDialog";
import { DeviceList, Legend } from "@/components/devices";
import { FloorPlan } from "@/components/FloorPlan";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Badge, Button, Card, CardHeader, IconButton, Skeleton } from "@/components/ui";
import { healthCounts, sortByAttention } from "@/lib/deviceMeta";
import { plural } from "@/lib/format";
import { useRoomsWithDevices } from "@/lib/queries";

const OVERVIEW_LIMIT = 5;

export default function Home() {
  const rooms = useRoomsWithDevices();
  const [addOpen, setAddOpen] = useState(false);
  const devices = (rooms.data ?? []).flatMap((r) => r.devices.map((d) => ({ ...d, roomName: r.name })));
  const { errors, offline } = healthCounts(devices);
  const top = sortByAttention(devices).slice(0, OVERVIEW_LIMIT);

  return (
    <>
      <PageHeader title="Smart Home Dashboard" badge={<Badge tone="primary">Demo</Badge>} />
      <div className="space-y-4">
        {rooms.isPending ? (
          <Card>
            <Skeleton className="mb-3 h-5 w-40" />
            <Skeleton className="aspect-[350/450] w-full" />
          </Card>
        ) : rooms.isError ? (
          <Card>
            <ErrorState error={rooms.error} onRetry={() => rooms.refetch()} title="Couldn't load your home" />
          </Card>
        ) : (
          <FloorPlan rooms={rooms.data} />
        )}

        <Card aria-label="Legend" className="py-3">
          <Legend />
        </Card>

        <Card aria-labelledby="overview-title">
          <CardHeader
            id="overview-title"
            title="Devices"
            action={
              <IconButton label="Add device" onClick={() => setAddOpen(true)} className="-mt-2 -mr-2">
                <Plus className="size-6" aria-hidden />
              </IconButton>
            }
          />
          {rooms.isPending ? (
            <LoadingRows rows={3} label="Loading devices" />
          ) : rooms.isError ? (
            <ErrorState error={rooms.error} onRetry={() => rooms.refetch()} />
          ) : devices.length === 0 ? (
            <EmptyState
              title="No devices yet"
              action={
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  Add Device
                </Button>
              }
            />
          ) : (
            <>
              <div className="mb-1 flex flex-wrap gap-2">
                {errors > 0 ? (
                  <Link href="/devices?filter=errors" className="rounded-full bg-error/10 px-3 py-1.5 text-sm font-semibold text-[#d70015]">
                    {plural(errors, "error")}
                  </Link>
                ) : null}
                {offline > 0 ? (
                  <Link href="/devices?filter=offline" className="rounded-full bg-offline/15 px-3 py-1.5 text-sm font-semibold text-[#636366]">
                    {offline} offline
                  </Link>
                ) : null}
                {errors === 0 && offline === 0 ? (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-[#248a3d]">
                    <CircleCheck className="size-4" aria-hidden /> All devices healthy
                  </span>
                ) : null}
              </div>
              <DeviceList devices={top} showRoom />
              <Link href="/devices" className="mt-1 flex min-h-11 items-center justify-center rounded-xl text-[15px] font-semibold text-primary hover:bg-primary/5">
                See all {plural(devices.length, "device")}
              </Link>
            </>
          )}
        </Card>
      </div>
      <AddDeviceDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
