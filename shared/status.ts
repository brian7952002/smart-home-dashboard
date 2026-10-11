import type { DeviceType } from "./constants";

interface StatusInput {
  type: DeviceType;
  isOn: boolean;
  isOnline: boolean;
  hasError: boolean;
  errorMessage: string | null;
  brightness: number | null;
  targetTempF: number | null;
}

/** Human-readable status, derived from state so it can never go stale. */
export function deriveStatus(d: StatusInput): string {
  if (d.hasError) return d.errorMessage ?? "Error";
  if (!d.isOnline) return "Offline";
  if (!d.isOn) return "Off";
  switch (d.type) {
    case "light":
      return d.brightness == null ? "On" : `On · ${d.brightness}% brightness`;
    case "climate":
      return d.targetTempF == null ? "On" : `On · ${d.targetTempF}°F`;
    case "security":
      return "Monitoring";
    case "media":
      return "On";
  }
}

export type Health = "healthy" | "offline" | "error";

export function deviceHealth(d: { hasError: boolean; isOnline: boolean }): Health {
  if (d.hasError) return "error";
  if (!d.isOnline) return "offline";
  return "healthy";
}
