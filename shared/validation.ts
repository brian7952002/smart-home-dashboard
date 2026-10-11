import { z } from "zod";
import {
  AUTOMATION_ICONS,
  BRIGHTNESS_RANGE,
  DEVICE_TYPES,
  LIMITS,
  PLAN,
  ROOM_SIZE_KEYS,
  SCENARIO_ICONS,
  TEMP_RANGE_F,
} from "./constants";

/** Request-body schemas shared by client forms and server validation. Unknown keys are stripped. */

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, { error: `${label} is required` })
    .max(max, { error: `${label} must be ${max} characters or fewer` });

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} must be ${max} characters or fewer` })
    .optional()
    .transform((v) => (v ? v : undefined));

export const idParamSchema = z.coerce.number().int().positive().max(2_147_483_647);

export const createRoomSchema = z.object({
  name: requiredText("Room name", LIMITS.roomName),
  size: z.enum(ROOM_SIZE_KEYS).default("medium"),
});
export type CreateRoomInput = z.input<typeof createRoomSchema>;

export const updateRoomSchema = z.object({
  name: requiredText("Room name", LIMITS.roomName).optional(),
});

const coord = z.number({ error: "Must be a number" }).int({ error: "Must be a whole number" });

export const roomLayoutSchema = z.object({
  rooms: z
    .array(
      z.object({
        id: idParamSchema,
        positionX: coord.min(0).max(PLAN.width),
        positionY: coord.min(PLAN.entranceBand).max(PLAN.height),
      }),
    )
    .min(1, { error: "At least one room is required" })
    .max(50),
});
export type RoomLayoutInput = z.input<typeof roomLayoutSchema>;

export const createDeviceSchema = z.object({
  name: requiredText("Device name", LIMITS.deviceName),
  type: z.enum(DEVICE_TYPES, { error: "Choose a device type" }),
  roomId: z.number({ error: "Choose a room" }).int().positive({ error: "Choose a room" }),
  manufacturer: optionalText("Manufacturer", LIMITS.manufacturer),
  model: optionalText("Model", LIMITS.model),
});
export type CreateDeviceInput = z.input<typeof createDeviceSchema>;

export const updateDeviceSchema = z.object({
  name: requiredText("Device name", LIMITS.deviceName).optional(),
  roomId: z.number().int().positive().optional(),
  brightness: z
    .number()
    .int()
    .min(BRIGHTNESS_RANGE.min, { error: "Brightness must be 0–100%" })
    .max(BRIGHTNESS_RANGE.max, { error: "Brightness must be 0–100%" })
    .optional(),
  targetTempF: z
    .number()
    .int()
    .min(TEMP_RANGE_F.min, { error: "Target temperature must be 60–90°F" })
    .max(TEMP_RANGE_F.max, { error: "Target temperature must be 60–90°F" })
    .optional(),
});
export type UpdateDeviceInput = z.input<typeof updateDeviceSchema>;

export const powerSchema = z.object({
  isOn: z.boolean({ error: "isOn must be true or false" }),
});

export const simulateErrorSchema = z.object({
  errorMessage: requiredText("Error message", LIMITS.errorMessage),
  fixable: z.boolean({ error: "fixable must be true or false" }),
});

export const createScenarioSchema = z.object({
  name: requiredText("Scenario name", LIMITS.scenarioName),
  icon: z.enum(SCENARIO_ICONS, { error: "Choose an icon" }),
});
export type CreateScenarioInput = z.input<typeof createScenarioSchema>;

export const createAutomationSchema = z.object({
  name: requiredText("Automation name", LIMITS.automationName),
  description: requiredText("Description", LIMITS.automationDescription),
  icon: z.enum(AUTOMATION_ICONS, { error: "Choose an icon" }),
});
export type CreateAutomationInput = z.input<typeof createAutomationSchema>;

export const updateAutomationSchema = z.object({
  isActive: z.boolean({ error: "isActive must be true or false" }).optional(),
  name: requiredText("Automation name", LIMITS.automationName).optional(),
  description: requiredText("Description", LIMITS.automationDescription).optional(),
  icon: z.enum(AUTOMATION_ICONS).optional(),
});

export const chatRequestSchema = z.object({
  deviceId: z.number({ error: "deviceId is required" }).int().positive(),
  question: requiredText("Question", LIMITS.chatQuestion),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(LIMITS.chatTurn),
      }),
    )
    .max(LIMITS.chatHistoryTurns, { error: `Send at most ${LIMITS.chatHistoryTurns} history turns` })
    .optional()
    .default([]),
});
export type ChatRequest = z.input<typeof chatRequestSchema>;
export type ChatTurn = { role: "user" | "assistant"; content: string };

export const eventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
