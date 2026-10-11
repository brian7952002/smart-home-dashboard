import { count, sql } from "drizzle-orm";
import type { DeviceType } from "../shared/constants";
import { automations, deviceEvents, devices, rooms, scenarios } from "../shared/schema";
import type { Db, Tx } from "./db";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Serializes concurrent seed/reset calls (server start, CLI, demo endpoint). */
const SEED_LOCK_KEY = 72_410_001;

const SEED_ROOMS = [
  { name: "Living Room", positionX: 40, positionY: 60, width: 140, height: 150 },
  { name: "Bathroom", positionX: 210, positionY: 60, width: 120, height: 90 },
  { name: "Kitchen", positionX: 210, positionY: 170, width: 120, height: 110 },
  { name: "Bedroom", positionX: 40, positionY: 240, width: 140, height: 90 },
] as const;

interface SeedDevice {
  room: (typeof SEED_ROOMS)[number]["name"];
  name: string;
  type: DeviceType;
  isOn: boolean;
  isOnline: boolean;
  error?: { message: string; fixable: boolean };
  brightness?: number;
  targetTempF?: number;
  manufacturer: string;
  model: string;
  firmwareVersion: string;
  /** Milliseconds before "now". */
  lastSeenAgo: number;
}

/** Firmware versions are copied from the prototype seed data. */
const SEED_DEVICES: SeedDevice[] = [
  { room: "Living Room", name: "Living Room Light", type: "light", isOn: true, isOnline: true, brightness: 80, manufacturer: "Philips Hue", model: "White and Color Ambiance", firmwareVersion: "1.65.11", lastSeenAgo: 0 },
  { room: "Living Room", name: "Living Room AC", type: "climate", isOn: true, isOnline: true, error: { message: "Network connectivity error", fixable: true }, targetTempF: 70, manufacturer: "Ecobee", model: "Smart Thermostat Premium", firmwareVersion: "4.7.5.352", lastSeenAgo: 20 * MIN },
  { room: "Living Room", name: "Living Room TV", type: "media", isOn: false, isOnline: true, error: { message: "Smart Hub not responding", fixable: false }, manufacturer: "Samsung", model: "QN90B QLED Smart TV", firmwareVersion: "2301.0", lastSeenAgo: 45 * MIN },
  { room: "Living Room", name: "Living Room Camera", type: "security", isOn: true, isOnline: true, manufacturer: "Ring", model: "Indoor Cam", firmwareVersion: "2.6.1", lastSeenAgo: 0 },
  { room: "Kitchen", name: "Kitchen Light", type: "light", isOn: false, isOnline: false, brightness: 100, manufacturer: "LIFX", model: "A19 Color", firmwareVersion: "3.70", lastSeenAgo: 3 * HOUR },
  { room: "Kitchen", name: "Kitchen Motion Sensor", type: "security", isOn: false, isOnline: true, error: { message: "Connection error", fixable: true }, manufacturer: "Aqara", model: "FP2 Presence Sensor", firmwareVersion: "1.2.9", lastSeenAgo: 10 * MIN },
  { room: "Bedroom", name: "Bedroom Light", type: "light", isOn: true, isOnline: true, brightness: 60, manufacturer: "Nanoleaf", model: "Shapes Hexagons", firmwareVersion: "6.2.0", lastSeenAgo: 0 },
  { room: "Bedroom", name: "Bedroom AC", type: "climate", isOn: true, isOnline: true, targetTempF: 72, manufacturer: "Sensibo", model: "Sky", firmwareVersion: "1.5.4", lastSeenAgo: 0 },
  { room: "Bedroom", name: "Bedroom TV", type: "media", isOn: false, isOnline: false, manufacturer: "LG", model: "C2 OLED", firmwareVersion: "04.30.75", lastSeenAgo: 26 * HOUR },
  { room: "Bathroom", name: "Bathroom Light", type: "light", isOn: true, isOnline: true, brightness: 70, manufacturer: "GE", model: "C by GE Smart Switch", firmwareVersion: "2.8.0", lastSeenAgo: 0 },
];

const SEED_SCENARIOS = [
  { name: "Good Night", icon: "moon" },
  { name: "Good Morning", icon: "sun" },
  { name: "Movie Time", icon: "film" },
] as const;

const SEED_AUTOMATIONS = [
  { name: "Lights Off at 11 PM", description: "Daily", icon: "clock", isActive: true },
  { name: "Welcome Home", description: "When arriving home", icon: "home", isActive: true },
] as const;

async function insertSeed(tx: Tx): Promise<void> {
  const now = Date.now();
  const createdAt = new Date(now - 7 * DAY);

  const roomRows = await tx.insert(rooms).values(SEED_ROOMS.map((r) => ({ ...r }))).returning();
  const roomId = new Map(roomRows.map((r) => [r.name, r.id]));

  for (const d of SEED_DEVICES) {
    const lastSeenAt = new Date(now - d.lastSeenAgo);
    const [row] = await tx
      .insert(devices)
      .values({
        name: d.name,
        type: d.type,
        roomId: roomId.get(d.room)!,
        isOn: d.isOn,
        isOnline: d.isOnline,
        hasError: !!d.error,
        errorMessage: d.error?.message ?? null,
        errorFixable: d.error?.fixable ?? false,
        brightness: d.brightness ?? null,
        targetTempF: d.targetTempF ?? null,
        manufacturer: d.manufacturer,
        model: d.model,
        firmwareVersion: d.firmwareVersion,
        lastSeenAt,
        createdAt,
        updatedAt: lastSeenAt,
      })
      .returning({ id: devices.id });
    const events: Array<typeof deviceEvents.$inferInsert> = [{ deviceId: row.id, type: "created", createdAt }];
    if (d.error) events.push({ deviceId: row.id, type: "error_set", detail: d.error.message, createdAt: lastSeenAt });
    if (!d.isOnline) events.push({ deviceId: row.id, type: "went_offline", createdAt: lastSeenAt });
    await tx.insert(deviceEvents).values(events);
  }

  await tx.insert(scenarios).values(SEED_SCENARIOS.map((s) => ({ ...s })));
  await tx.insert(automations).values(SEED_AUTOMATIONS.map((a) => ({ ...a })));
}

/** Seeds demo data only when there are no rooms. Returns whether it seeded. */
export async function seedIfEmpty(db: Db): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${SEED_LOCK_KEY})`);
    const [{ n }] = await tx.select({ n: count() }).from(rooms);
    if (n > 0) return false;
    await insertSeed(tx);
    return true;
  });
}

/** Wipes every table and reseeds, in one transaction. */
export async function resetDemoData(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${SEED_LOCK_KEY})`);
    await tx.execute(
      sql`TRUNCATE TABLE device_events, devices, rooms, scenarios, automations RESTART IDENTITY CASCADE`,
    );
    await insertSeed(tx);
  });
}

export const SEED_COUNTS = {
  rooms: SEED_ROOMS.length,
  devices: SEED_DEVICES.length,
  scenarios: SEED_SCENARIOS.length,
  automations: SEED_AUTOMATIONS.length,
};

