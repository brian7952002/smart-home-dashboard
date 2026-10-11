import type { DeviceEventType } from "@shared/constants";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  if (abs < 45_000) return "just now";
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "minute") return rtf.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

export function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export const EVENT_LABELS: Record<DeviceEventType, string> = {
  created: "Added to the app",
  updated: "Details updated",
  power_on: "Turned on",
  power_off: "Turned off",
  setting_changed: "Setting changed",
  error_set: "Error reported",
  error_cleared: "Error cleared",
  reconnected: "Reconnected",
  went_offline: "Went offline",
};

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
