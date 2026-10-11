export const DEVICE_TYPES = ["light", "climate", "security", "media"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  light: "Light",
  climate: "Climate",
  security: "Security",
  media: "Media",
};

export const SCENARIO_ICONS = ["moon", "sun", "film"] as const;
export type ScenarioIcon = (typeof SCENARIO_ICONS)[number];

export const AUTOMATION_ICONS = ["clock", "home", "calendar", "location"] as const;
export type AutomationIcon = (typeof AUTOMATION_ICONS)[number];

export const DEVICE_EVENT_TYPES = [
  "created",
  "updated",
  "power_on",
  "power_off",
  "setting_changed",
  "error_set",
  "error_cleared",
  "reconnected",
  "went_offline",
] as const;
export type DeviceEventType = (typeof DEVICE_EVENT_TYPES)[number];

/**
 * The floor plan is a fixed logical plane; the client scales it to fit.
 * The seeded rooms occupy the top 350 units; the space below is free for new rooms.
 */
export const PLAN = {
  width: 350,
  height: 450,
  entranceBand: 40,
  minWidth: 60,
  maxWidth: 350,
  minHeight: 50,
  maxHeight: 310,
  placementStep: 10,
  placementGap: 10,
} as const;

export const ROOM_SIZES = {
  small: { width: 90, height: 70 },
  medium: { width: 120, height: 90 },
  large: { width: 140, height: 110 },
} as const;
export type RoomSize = keyof typeof ROOM_SIZES;
export const ROOM_SIZE_KEYS = ["small", "medium", "large"] as const;

export const BRIGHTNESS_RANGE = { min: 0, max: 100 } as const;
export const TEMP_RANGE_F = { min: 60, max: 90 } as const;

export const LIMITS = {
  roomName: 40,
  deviceName: 60,
  manufacturer: 60,
  model: 60,
  errorMessage: 200,
  scenarioName: 40,
  automationName: 60,
  automationDescription: 120,
  chatQuestion: 500,
  chatTurn: 1000,
  chatHistoryTurns: 6,
} as const;
