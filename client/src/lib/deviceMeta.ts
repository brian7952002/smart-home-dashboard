import {
  Calendar,
  Circle,
  Clock,
  Film,
  House,
  Lightbulb,
  MapPin,
  Moon,
  Shield,
  Sun,
  Thermometer,
  Tv,
  type LucideIcon,
} from "lucide-react";
import type { AutomationIcon, DeviceType, ScenarioIcon } from "@shared/constants";
import type { Device } from "@shared/types";

export const TYPE_META: Record<DeviceType, { label: string; plural: string; icon: LucideIcon; color: string; text: string; bg: string }> = {
  light: { label: "Light", plural: "Lights", icon: Lightbulb, color: "var(--type-light)", text: "text-type-light", bg: "bg-type-light" },
  climate: { label: "Climate", plural: "Climate", icon: Thermometer, color: "var(--type-climate)", text: "text-type-climate", bg: "bg-type-climate" },
  security: { label: "Security", plural: "Security", icon: Shield, color: "var(--type-security)", text: "text-type-security", bg: "bg-type-security" },
  media: { label: "Media", plural: "Media", icon: Tv, color: "var(--type-media)", text: "text-type-media", bg: "bg-type-media" },
};

export const SCENARIO_ICON_META: Record<ScenarioIcon, { label: string; icon: LucideIcon }> = {
  moon: { label: "Moon", icon: Moon },
  sun: { label: "Sun", icon: Sun },
  film: { label: "Film", icon: Film },
};

export const AUTOMATION_ICON_META: Record<AutomationIcon, { label: string; icon: LucideIcon }> = {
  clock: { label: "Clock", icon: Clock },
  home: { label: "Home", icon: House },
  calendar: { label: "Calendar", icon: Calendar },
  location: { label: "Location", icon: MapPin },
};

export const scenarioIcon = (key: string): LucideIcon => SCENARIO_ICON_META[key as ScenarioIcon]?.icon ?? Circle;
export const automationIcon = (key: string): LucideIcon => AUTOMATION_ICON_META[key as AutomationIcon]?.icon ?? Circle;

/** Problems first (errors, then offline), then by name. */
export function sortByAttention(devices: Device[]): Device[] {
  const rank = (d: Device) => (d.hasError ? 0 : !d.isOnline ? 1 : 2);
  return [...devices].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export function healthCounts(devices: Device[]) {
  return {
    errors: devices.filter((d) => d.hasError).length,
    offline: devices.filter((d) => !d.isOnline).length,
  };
}

export function capabilities(type: DeviceType): string[] {
  switch (type) {
    case "light":
      return ["Power on/off", "Dimmable 0–100%"];
    case "climate":
      return ["Power on/off", "Target temperature 60–90°F"];
    case "security":
      return ["Power on/off (monitoring)"];
    case "media":
      return ["Power on/off"];
  }
}
