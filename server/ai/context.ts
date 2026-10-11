import type { DeviceType } from "../../shared/constants";
import type { Device } from "../../shared/types";

/**
 * The only device facts that leave the server. Names, room names, IDs and
 * timestamps are deliberately excluded (spec section 8.3).
 */
export interface AiDeviceContext {
  type: DeviceType;
  manufacturer: string | null;
  model: string | null;
  firmwareVersion: string | null;
  isOn: boolean;
  isOnline: boolean;
  hasError: boolean;
  errorMessage: string | null;
  errorFixable: boolean;
}

export function toAiContext(d: Device): AiDeviceContext {
  return {
    type: d.type,
    manufacturer: d.manufacturer,
    model: d.model,
    firmwareVersion: d.firmwareVersion,
    isOn: d.isOn,
    isOnline: d.isOnline,
    hasError: d.hasError,
    errorMessage: d.errorMessage,
    errorFixable: d.errorFixable,
  };
}

export function describeContext(c: AiDeviceContext): string {
  const lines = [
    `Device type: ${c.type}`,
    `Manufacturer: ${c.manufacturer ?? "unknown"}`,
    `Model: ${c.model ?? "unknown"}`,
    `Firmware: ${c.firmwareVersion ?? "unknown"}`,
    `Power: ${c.isOn ? "on" : "off"}`,
    `Online: ${c.isOnline ? "yes" : "no"}`,
    c.hasError
      ? `Error: ${c.errorMessage} (${c.errorFixable ? "may clear with a remote reconnect" : "needs manual troubleshooting"})`
      : "Error: none",
  ];
  return lines.join("\n");
}

export const SYSTEM_PROMPT = `You are a support assistant inside a smart-home demo app. The devices are simulated; you cannot see, control, or repair them.
Rules:
- Be concise and actionable. Give ordered steps, safest first.
- Be honest about uncertainty. Never claim you changed, fixed, or verified anything.
- Recommend the manufacturer's support, or a licensed electrician/HVAC technician, when wiring, mains power, or safety is involved.
- Don't invent firmware versions, URLs, or product facts you aren't sure of.`;
