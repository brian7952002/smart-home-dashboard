import clsx from "clsx";
import { TriangleAlert, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import type { DeviceType } from "@shared/constants";
import type { Device } from "@shared/types";
import { ApiError, errorMessage } from "@/lib/api";
import { TYPE_META } from "@/lib/deviceMeta";
import { usePower, useReconnect } from "@/lib/queries";
import { Button, Switch } from "./ui";

export function DeviceIcon({ device, size = "md" }: { device: Pick<Device, "type" | "isOnline" | "hasError">; size?: "md" | "lg" }) {
  const meta = TYPE_META[device.type];
  const Icon = meta.icon;
  const dim = !device.isOnline;
  return (
    <span
      aria-hidden
      className={clsx(
        "relative inline-flex shrink-0 items-center justify-center rounded-full",
        size === "md" ? "size-10" : "size-14",
        dim ? "bg-offline/15 text-offline" : "",
      )}
      style={dim ? undefined : { backgroundColor: `color-mix(in srgb, ${meta.color} 16%, white)`, color: meta.color }}
    >
      <Icon className={size === "md" ? "size-5" : "size-7"} strokeWidth={2.2} />
      {device.hasError ? (
        <span className="absolute -top-0.5 -right-0.5 inline-flex size-[18px] items-center justify-center rounded-full bg-error text-white ring-2 ring-white">
          <TriangleAlert className="size-[11px]" strokeWidth={3} />
        </span>
      ) : !device.isOnline ? (
        <span className="absolute -top-0.5 -right-0.5 inline-flex size-[18px] items-center justify-center rounded-full bg-offline text-white ring-2 ring-white">
          <WifiOff className="size-[10px]" strokeWidth={3} />
        </span>
      ) : null}
    </span>
  );
}

export function StatusText({ device, className }: { device: Device; className?: string }) {
  return (
    <span
      className={clsx(
        "line-clamp-2 text-[13px] leading-snug",
        device.hasError ? "font-medium text-[#d70015]" : "text-ink-2",
        className,
      )}
    >
      {device.hasError ? <span className="sr-only">Error: </span> : null}
      {device.status}
    </span>
  );
}

/** Power and reconnect with consistent toasts, shared by every device row and the detail page. */
export function useDeviceActions() {
  const power = usePower();
  const reconnect = useReconnect();
  const [, navigate] = useLocation();

  function setPower(device: Device, isOn: boolean) {
    power.mutate(
      { id: device.id, isOn },
      { onError: (err) => toast.error(`${device.name}: ${errorMessage(err)}`) },
    );
  }

  function tryReconnect(device: Device) {
    reconnect.mutate(device.id, {
      onSuccess: (res) => toast.success(`${device.name}: ${res.message}`),
      onError: (err) => {
        if (err instanceof ApiError && err.code === "MANUAL_FIX_REQUIRED") {
          toast.error(`${device.name}: ${err.message}`, {
            action: { label: "View steps", onClick: () => navigate(`/device/${device.id}?tab=guide`) },
            duration: 8000,
          });
        } else {
          toast.error(`${device.name}: ${errorMessage(err)}`);
        }
      },
    });
  }

  return {
    setPower,
    tryReconnect,
    powerPending: (id: number) => power.isPending && power.variables?.id === id,
    pendingPowerValue: (id: number) => (power.isPending && power.variables?.id === id ? power.variables.isOn : undefined),
    reconnectPending: (id: number) => reconnect.isPending && reconnect.variables === id,
  };
}

export function DeviceRow({ device, showRoom, number }: { device: Device; showRoom?: boolean; number?: number }) {
  const actions = useDeviceActions();
  const healthy = device.isOnline && !device.hasError;
  const pendingValue = actions.pendingPowerValue(device.id);
  return (
    <li className="flex items-center gap-2 py-2">
      <Link
        href={`/device/${device.id}`}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg"
      >
        {number !== undefined ? (
          <span className="w-5 shrink-0 text-center text-xs font-semibold text-ink-2" aria-label={`Marker ${number}`}>
            {number}
          </span>
        ) : null}
        <DeviceIcon device={device} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{device.name}</span>
          {showRoom ? <span className="block truncate text-xs text-ink-2">{device.roomName}</span> : null}
          <StatusText device={device} />
        </span>
      </Link>
      {healthy ? (
        <Switch
          checked={pendingValue ?? device.isOn}
          onCheckedChange={(v) => actions.setPower(device, v)}
          label={`Power for ${device.name}`}
          pending={actions.powerPending(device.id)}
        />
      ) : (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => actions.tryReconnect(device)}
          pending={actions.reconnectPending(device.id)}
          aria-label={`Reconnect ${device.name}`}
        >
          Reconnect
        </Button>
      )}
    </li>
  );
}

export function DeviceList({ devices, showRoom, numbered }: { devices: Device[]; showRoom?: boolean; numbered?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {devices.map((d, i) => (
        <DeviceRow key={d.id} device={d} showRoom={showRoom} number={numbered ? i + 1 : undefined} />
      ))}
    </ul>
  );
}

const ALL_TYPES: DeviceType[] = ["light", "climate", "security", "media"];

/** Legend of device/status symbols. Pass `only` to show just what's present. */
export function Legend({ only }: { only?: { types: Set<DeviceType>; offline: boolean; error: boolean } }) {
  const types = only ? ALL_TYPES.filter((t) => only.types.has(t)) : ALL_TYPES;
  const showOffline = only ? only.offline : true;
  const showError = only ? only.error : true;
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
      {types.map((t) => (
        <li key={t} className="flex items-center gap-1.5">
          <span className="size-3 rounded-full" style={{ backgroundColor: TYPE_META[t].color }} aria-hidden />
          {TYPE_META[t].plural}
        </li>
      ))}
      {showOffline ? (
        <li className="flex items-center gap-1.5">
          <WifiOff className="size-3.5 text-offline" aria-hidden />
          Offline
        </li>
      ) : null}
      {showError ? (
        <li className="flex items-center gap-1.5">
          <TriangleAlert className="size-3.5 text-error" aria-hidden />
          Error
        </li>
      ) : null}
    </ul>
  );
}

export function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        "min-h-9 rounded-full px-3.5 text-sm font-medium transition-colors",
        active ? "bg-primary text-white" : "bg-white text-ink ring-1 ring-line hover:bg-page",
      )}
    >
      {children}
    </button>
  );
}
