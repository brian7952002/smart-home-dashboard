import type { AutomationIcon, DeviceEventType, DeviceType, ScenarioIcon } from "./constants";

/** API shapes. Timestamps are ISO-8601 strings. */
export interface Room {
  id: number;
  name: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  createdAt: string;
}

export interface Device {
  id: number;
  name: string;
  type: DeviceType;
  roomId: number;
  isOn: boolean;
  isOnline: boolean;
  hasError: boolean;
  errorMessage: string | null;
  errorFixable: boolean;
  brightness: number | null;
  targetTempF: number | null;
  manufacturer: string | null;
  model: string | null;
  firmwareVersion: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Derived server-side from state; never stored. */
  status: string;
  roomName: string;
}

export interface RoomWithDevices extends Room {
  devices: Device[];
}

export interface DeviceEvent {
  id: number;
  deviceId: number;
  type: DeviceEventType;
  detail: string | null;
  createdAt: string;
}

export interface Scenario {
  id: number;
  name: string;
  icon: ScenarioIcon;
  createdAt: string;
}

export interface Automation {
  id: number;
  name: string;
  description: string;
  icon: AutomationIcon;
  isActive: boolean;
  createdAt: string;
}

export interface AppConfig {
  aiAvailable: boolean;
  demoEndpointsEnabled: boolean;
}

export interface ReconnectResult {
  device: Device;
  message: string;
}

export interface ApiErrorBody {
  message: string;
  code?: string;
  fieldErrors?: Record<string, string>;
}
