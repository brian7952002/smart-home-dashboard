import { useState, type ReactNode } from "react";
import {
  Bell,
  Bot,
  ChevronRight,
  CircleHelp,
  House,
  LayoutGrid,
  Lock,
  RotateCcw,
  Router,
  Server,
  User,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { ConfirmDialog, NoticeDialog } from "@/components/Dialog";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Card, Switch } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { useConfig, useResetDemo } from "@/lib/queries";

const NOTIFY_KEY = "shd.notifications";

function readNotify(): boolean {
  try {
    return window.localStorage.getItem(NOTIFY_KEY) === "1";
  } catch {
    return false;
  }
}
function writeNotify(v: boolean) {
  try {
    window.localStorage.setItem(NOTIFY_KEY, v ? "1" : "0");
  } catch {
    // Storage may be unavailable (private mode); the switch still works for this visit.
  }
}

const rowClass = "flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-[15px] hover:bg-page";

function RowIcon({ icon: Icon, color = "bg-primary" }: { icon: LucideIcon; color?: string }) {
  return (
    <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-white ${color}`} aria-hidden>
      <Icon className="size-[18px]" />
    </span>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-1 px-1 text-xs font-semibold tracking-wide text-ink-2 uppercase">{title}</h2>
      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-line">{children}</ul>
      </Card>
    </section>
  );
}

export default function Settings() {
  const config = useConfig();
  const reset = useResetDemo();
  const [, navigate] = useLocation();
  const [notice, setNotice] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [notify, setNotify] = useState(readNotify);

  const placeholder = (label: string, icon: LucideIcon, color?: string) => (
    <li>
      <button type="button" className={rowClass} onClick={() => setNotice(label)}>
        <RowIcon icon={icon} color={color} />
        <span className="flex-1">{label}</span>
        <span className="text-xs text-ink-2">Not available</span>
        <ChevronRight className="size-4 text-ink-2" aria-hidden />
      </button>
    </li>
  );

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-5">
        <Card className="flex items-center gap-3">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden>
            <User className="size-7" />
          </span>
          <div>
            <p className="text-lg font-semibold">Home Owner</p>
            <p className="text-sm text-ink-2">Smart Home Account (demo)</p>
          </div>
        </Card>

        <Group title="Account">
          {placeholder("Personal Information", User)}
          {placeholder("Home Settings", House, "bg-type-security")}
          {placeholder("Security & Privacy", Lock, "bg-[#636366]")}
          <li className={rowClass}>
            <RowIcon icon={Bell} color="bg-error" />
            <span className="flex-1">
              <span id="notify-label" className="block">
                Notifications
              </span>
              <span className="block text-xs text-ink-2">Saved on this device only. No notifications are sent.</span>
            </span>
            <Switch
              checked={notify}
              label="Notifications"
              onCheckedChange={(v) => {
                setNotify(v);
                writeNotify(v);
              }}
            />
          </li>
        </Group>

        <Group title="System">
          {placeholder("Connectivity", Wifi, "bg-type-climate")}
          <li>
            <Link href="/devices" className={rowClass}>
              <RowIcon icon={LayoutGrid} color="bg-type-light" />
              <span className="flex-1">Devices</span>
              <ChevronRight className="size-4 text-ink-2" aria-hidden />
            </Link>
          </li>
          {placeholder("Hub Status", Router, "bg-type-media")}
          <li className={rowClass}>
            <RowIcon icon={Bot} />
            <span className="flex-1">AI assistant</span>
            {config.isPending ? (
              <span className="text-xs text-ink-2">Checking…</span>
            ) : config.data?.aiAvailable ? (
              <Badge tone="success">Connected</Badge>
            ) : (
              <Badge>Offline guidance only</Badge>
            )}
          </li>
        </Group>

        {config.data?.demoEndpointsEnabled ? (
          <Group title="Demo tools">
            <li>
              <button type="button" className={rowClass} onClick={() => setResetOpen(true)}>
                <RowIcon icon={RotateCcw} color="bg-[#636366]" />
                <span className="flex-1">
                  <span className="block">Reset demo data</span>
                  <span className="block text-xs text-ink-2">Restores the original rooms, devices, and records.</span>
                </span>
              </button>
            </li>
          </Group>
        ) : null}

        <Group title="Support">
          <li>
            <button type="button" className={rowClass} onClick={() => setHelpOpen(true)}>
              <RowIcon icon={CircleHelp} />
              <span className="flex-1">Help & Support</span>
              <ChevronRight className="size-4 text-ink-2" aria-hidden />
            </button>
          </li>
        </Group>
        <p className="flex items-center justify-center gap-1 text-center text-xs text-ink-2">
          <Server className="size-3" aria-hidden /> Simulated home. No real devices are connected.
        </p>
      </div>

      <NoticeDialog
        open={notice !== null}
        onOpenChange={(o) => !o && setNotice(null)}
        title={notice ?? ""}
        body="Not available in this demo. There are no accounts or saved settings."
      />
      <NoticeDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        title="Help & Support"
        body={
          <>
            This is a demo smart-home dashboard. Rooms, devices, scenes, and automations are simulated records stored by the
            app. Power, brightness, temperature, and reconnect change the simulated state only. The AI assistant gives
            general guidance and can't see or repair devices.
          </>
        }
      />
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset demo data?"
        body="All rooms, devices, scenarios, and automations go back to the original demo set. Your changes are lost."
        confirmLabel="Reset"
        pending={reset.isPending}
        onConfirm={() =>
          reset.mutate(undefined, {
            onSuccess: () => {
              toast.success("Demo data restored");
              setResetOpen(false);
              navigate("/");
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </>
  );
}
