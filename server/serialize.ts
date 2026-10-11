import type { AutomationRow, DeviceEventRow, DeviceRow, RoomRow, ScenarioRow } from "../shared/schema";
import { deriveStatus } from "../shared/status";
import type { Automation, Device, DeviceEvent, Room, Scenario } from "../shared/types";

export const toRoom = (r: RoomRow): Room => ({
  id: r.id,
  name: r.name,
  positionX: r.positionX,
  positionY: r.positionY,
  width: r.width,
  height: r.height,
  createdAt: r.createdAt.toISOString(),
});

export const toDevice = (d: DeviceRow, roomName: string): Device => ({
  id: d.id,
  name: d.name,
  type: d.type,
  roomId: d.roomId,
  isOn: d.isOn,
  isOnline: d.isOnline,
  hasError: d.hasError,
  errorMessage: d.errorMessage,
  errorFixable: d.errorFixable,
  brightness: d.brightness,
  targetTempF: d.targetTempF,
  manufacturer: d.manufacturer,
  model: d.model,
  firmwareVersion: d.firmwareVersion,
  lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
  status: deriveStatus(d),
  roomName,
});

export const toEvent = (e: DeviceEventRow): DeviceEvent => ({
  id: e.id,
  deviceId: e.deviceId,
  type: e.type,
  detail: e.detail,
  createdAt: e.createdAt.toISOString(),
});

export const toScenario = (s: ScenarioRow): Scenario => ({
  id: s.id,
  name: s.name,
  icon: s.icon,
  createdAt: s.createdAt.toISOString(),
});

export const toAutomation = (a: AutomationRow): Automation => ({
  id: a.id,
  name: a.name,
  description: a.description,
  icon: a.icon,
  isActive: a.isActive,
  createdAt: a.createdAt.toISOString(),
});
