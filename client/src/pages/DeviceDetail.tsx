import { Tabs } from "radix-ui";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { AssistantCard } from "@/components/device/AssistantCard";
import { ChatTab } from "@/components/device/ChatTab";
import { ControlsCard } from "@/components/device/ControlsCard";
import { GuideTab } from "@/components/device/GuideTab";
import { InfoTab } from "@/components/device/InfoTab";
import { DeviceIcon, StatusText } from "@/components/devices";
import { PageHeader } from "@/components/PageHeader";
import { ErrorState, NotFoundState } from "@/components/states";
import { Badge, Card, Skeleton } from "@/components/ui";
import { isNotFound } from "@/lib/api";
import { parseRouteId } from "@/lib/navigation";
import { useDevice } from "@/lib/queries";

const TABS = [
  { value: "chat", label: "AI Chat" },
  { value: "guide", label: "Support Guide" },
  { value: "info", label: "Device Info" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export default function DeviceDetail() {
  const params = useParams<{ id: string }>();
  const id = parseRouteId(params.id);
  const device = useDevice(id);
  const search = useSearch();
  const [location, navigate] = useLocation();
  const rawTab = new URLSearchParams(search).get("tab");
  const tab: Tab = TABS.some((t) => t.value === rawTab) ? (rawTab as Tab) : "chat";

  const setTab = (t: string) => navigate(`${location}?tab=${t}`, { replace: true });

  const header = <PageHeader title="Device Details" back="/devices" />;
  if (id === null || (device.isError && isNotFound(device.error))) {
    return (
      <>
        {header}
        <NotFoundState what="Device" />
      </>
    );
  }
  if (device.isPending) {
    return (
      <>
        {header}
        <Card className="flex items-center gap-3">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </Card>
        <Card className="mt-4">
          <Skeleton className="h-24 w-full" />
        </Card>
      </>
    );
  }
  if (device.isError) {
    return (
      <>
        {header}
        <Card>
          <ErrorState error={device.error} onRetry={() => device.refetch()} />
        </Card>
      </>
    );
  }

  const d = device.data;
  return (
    <>
      {header}
      <div className="space-y-4">
        <Card className="flex items-center gap-3">
          <DeviceIcon device={d} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">{d.name}</h2>
            <Link href={`/room/${d.roomId}`} className="text-sm text-primary hover:underline">
              {d.roomName}
            </Link>
            <StatusText device={d} className="text-sm" />
            <p className="text-xs text-ink-2">Simulated device</p>
          </div>
          {d.hasError ? <Badge tone="error">Error</Badge> : !d.isOnline ? <Badge tone="offline">Offline</Badge> : <Badge tone="success">Online</Badge>}
        </Card>

        <AssistantCard device={d} onViewSteps={() => setTab("guide")} />
        <ControlsCard device={d} />

        <Card className="p-0">
          <Tabs.Root value={tab} onValueChange={setTab}>
            <Tabs.List aria-label="Device support" className="flex border-b border-line px-2">
              {TABS.map((t) => (
                <Tabs.Trigger
                  key={t.value}
                  value={t.value}
                  className="min-h-12 flex-1 border-b-2 border-transparent px-1 text-sm font-semibold text-ink-2 data-[state=active]:border-primary data-[state=active]:text-primary"
                >
                  {t.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            {/* Kept mounted so the conversation survives tab switches. */}
            <Tabs.Content value="chat" forceMount className="p-4 data-[state=inactive]:hidden">
              <ChatTab device={d} />
            </Tabs.Content>
            <Tabs.Content value="guide" className="p-4">
              <GuideTab device={d} />
            </Tabs.Content>
            <Tabs.Content value="info" className="p-4">
              <InfoTab device={d} />
            </Tabs.Content>
          </Tabs.Root>
        </Card>
      </div>
    </>
  );
}
