import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { AddDeviceDialog } from "@/components/AddDeviceDialog";
import { DeviceList, FilterChip } from "@/components/devices";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Button, Card, IconButton, TextInput } from "@/components/ui";
import { TYPE_META, healthCounts } from "@/lib/deviceMeta";
import { useDevices } from "@/lib/queries";

type Filter = "all" | "errors" | "offline";

export default function Devices() {
  const devices = useDevices();
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const q = params.get("q") ?? "";
  const rawFilter = params.get("filter");
  const filter: Filter = rawFilter === "errors" || rawFilter === "offline" ? rawFilter : "all";
  const [addOpen, setAddOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  function setParams(next: { q?: string; filter?: Filter }) {
    const p = new URLSearchParams(search);
    const nq = next.q ?? q;
    const nf = next.filter ?? filter;
    if (nq) p.set("q", nq);
    else p.delete("q");
    if (nf !== "all") p.set("filter", nf);
    else p.delete("filter");
    const s = p.toString();
    navigate(`/devices${s ? `?${s}` : ""}`, { replace: true });
  }

  const list = devices.data ?? [];
  const counts = healthCounts(list);

  // If the active filter empties (e.g. the last error was fixed), fall back to All and say so.
  useEffect(() => {
    if (!devices.isSuccess) return;
    if (filter === "errors" && counts.errors === 0) {
      setAnnouncement("No errors remaining");
      setParams({ filter: "all" });
    } else if (filter === "offline" && counts.offline === 0) {
      setAnnouncement("No offline devices remaining");
      setParams({ filter: "all" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices.isSuccess, filter, counts.errors, counts.offline]);

  const needle = q.trim().toLowerCase();
  const filtered = list.filter((d) => {
    if (filter === "errors" && !d.hasError) return false;
    if (filter === "offline" && d.isOnline) return false;
    if (!needle) return true;
    return [d.name, TYPE_META[d.type].label, d.roomName, d.errorMessage ?? ""].some((s) => s.toLowerCase().includes(needle));
  });

  return (
    <>
      <PageHeader
        title="Devices"
        actions={
          <IconButton label="Add device" onClick={() => setAddOpen(true)}>
            <Plus className="size-6" aria-hidden />
          </IconButton>
        }
      />
      <div className="relative mb-3">
        <label htmlFor="device-search" className="sr-only">
          Search devices
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-2" aria-hidden />
        <TextInput
          id="device-search"
          type="search"
          placeholder="Search by name, type, room, or error"
          value={q}
          onChange={(e) => setParams({ q: e.target.value })}
          className="pr-10 pl-9"
        />
        {q ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setParams({ q: "" })}
            className="absolute top-1/2 right-1 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-2 hover:bg-page"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter devices">
        <FilterChip active={filter === "all"} onClick={() => setParams({ filter: "all" })}>
          All
        </FilterChip>
        {counts.errors > 0 ? (
          <FilterChip active={filter === "errors"} onClick={() => setParams({ filter: "errors" })}>
            Errors ({counts.errors})
          </FilterChip>
        ) : null}
        {counts.offline > 0 ? (
          <FilterChip active={filter === "offline"} onClick={() => setParams({ filter: "offline" })}>
            Offline ({counts.offline})
          </FilterChip>
        ) : null}
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <Card className="py-2">
        {devices.isPending ? (
          <div className="py-2">
            <LoadingRows label="Loading devices" />
          </div>
        ) : devices.isError ? (
          <ErrorState error={devices.error} onRetry={() => devices.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState title="No devices yet" action={<Button size="sm" onClick={() => setAddOpen(true)}>Add Device</Button>} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={needle ? `No devices match “${q.trim()}”` : "No devices in this filter"}
            action={
              needle ? (
                <Button size="sm" variant="secondary" onClick={() => setParams({ q: "" })}>
                  Clear search
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <p className="sr-only" aria-live="polite">
              {filtered.length} of {list.length} devices shown
            </p>
            <DeviceList devices={filtered} showRoom />
          </>
        )}
      </Card>
      <AddDeviceDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
