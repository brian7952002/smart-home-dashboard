import { asc, desc, eq, sql } from "drizzle-orm";
import type { DeviceEventType } from "../../shared/constants";
import { deviceEvents, devices, rooms, type DeviceRow } from "../../shared/schema";
import type { Device, DeviceEvent, ReconnectResult } from "../../shared/types";
import type { Db, DbLike, Tx } from "../db";
import { badRequest, notFound } from "../errors";
import { toDevice, toEvent } from "../serialize";

async function withRoomName(db: DbLike, row: DeviceRow): Promise<Device> {
  const [room] = await db.select({ name: rooms.name }).from(rooms).where(eq(rooms.id, row.roomId));
  return toDevice(row, room?.name ?? "Unknown room");
}

async function logEvent(tx: DbLike, deviceId: number, type: DeviceEventType, detail?: string) {
  await tx.insert(deviceEvents).values({ deviceId, type, detail: detail?.slice(0, 200) ?? null });
}

async function lockDevice(tx: Tx, id: number): Promise<DeviceRow> {
  const [row] = await tx.select().from(devices).where(eq(devices.id, id)).for("update");
  if (!row) throw notFound("Device");
  return row;
}

async function assertRoomExists(db: DbLike, roomId: number): Promise<string> {
  const [room] = await db.select({ name: rooms.name }).from(rooms).where(eq(rooms.id, roomId));
  if (!room) throw badRequest("Room not found", "VALIDATION_ERROR", { roomId: "Choose an existing room" });
  return room.name;
}

function unavailableReason(row: DeviceRow): string | null {
  if (row.hasError) return "Unavailable while the device has an error";
  if (!row.isOnline) return "Unavailable while offline";
  return null;
}

export async function listDevices(db: DbLike): Promise<Device[]> {
  const rows = await db
    .select({ device: devices, roomName: rooms.name })
    .from(devices)
    .innerJoin(rooms, eq(devices.roomId, rooms.id))
    .orderBy(asc(sql`lower(${rooms.name})`), asc(sql`lower(${devices.name})`), asc(devices.id));
  return rows.map((r) => toDevice(r.device, r.roomName));
}

export async function getDevice(db: DbLike, id: number): Promise<Device> {
  const [row] = await db.select().from(devices).where(eq(devices.id, id));
  if (!row) throw notFound("Device");
  return withRoomName(db, row);
}

export async function createDevice(
  db: Db,
  input: { name: string; type: DeviceRow["type"]; roomId: number; manufacturer?: string; model?: string },
): Promise<Device> {
  return db.transaction(async (tx) => {
    await assertRoomExists(tx, input.roomId);
    const [row] = await tx
      .insert(devices)
      .values({
        name: input.name,
        type: input.type,
        roomId: input.roomId,
        manufacturer: input.manufacturer ?? null,
        model: input.model ?? null,
        brightness: input.type === "light" ? 100 : null,
        targetTempF: input.type === "climate" ? 72 : null,
        lastSeenAt: new Date(),
      })
      .returning();
    await logEvent(tx, row.id, "created");
    return withRoomName(tx, row);
  });
}

export async function updateDevice(
  db: Db,
  id: number,
  input: { name?: string; roomId?: number; brightness?: number; targetTempF?: number },
): Promise<Device> {
  if (Object.values(input).every((v) => v === undefined)) throw badRequest("Nothing to update");
  return db.transaction(async (tx) => {
    const row = await lockDevice(tx, id);
    const patch: Partial<DeviceRow> = {};
    const updated: string[] = [];
    const settings: string[] = [];

    if (input.name !== undefined && input.name !== row.name) {
      patch.name = input.name;
      updated.push(`Renamed from "${row.name}" to "${input.name}"`);
    }
    if (input.roomId !== undefined && input.roomId !== row.roomId) {
      const [from] = await tx.select({ name: rooms.name }).from(rooms).where(eq(rooms.id, row.roomId));
      const toName = await assertRoomExists(tx, input.roomId);
      patch.roomId = input.roomId;
      updated.push(`Moved from ${from?.name ?? "another room"} to ${toName}`);
    }

    const settingChange = input.brightness !== undefined || input.targetTempF !== undefined;
    if (settingChange) {
      if (input.brightness !== undefined && row.type !== "light") {
        throw badRequest("Only lights have brightness", "VALIDATION_ERROR", { brightness: "Only lights have brightness" });
      }
      if (input.targetTempF !== undefined && row.type !== "climate") {
        throw badRequest("Only climate devices have a target temperature", "VALIDATION_ERROR", {
          targetTempF: "Only climate devices have a target temperature",
        });
      }
      const reason = unavailableReason(row) ?? (row.isOn ? null : "Turn the device on to change this setting");
      if (reason) throw badRequest(reason, "DEVICE_UNAVAILABLE");
      if (input.brightness !== undefined && input.brightness !== row.brightness) {
        patch.brightness = input.brightness;
        settings.push(`Brightness ${row.brightness ?? "—"}% → ${input.brightness}%`);
      }
      if (input.targetTempF !== undefined && input.targetTempF !== row.targetTempF) {
        patch.targetTempF = input.targetTempF;
        settings.push(`Target temperature ${row.targetTempF ?? "—"}°F → ${input.targetTempF}°F`);
      }
    }

    if (Object.keys(patch).length === 0) return withRoomName(tx, row);

    const now = new Date();
    const [next] = await tx
      .update(devices)
      .set({ ...patch, updatedAt: now, ...(settings.length ? { lastSeenAt: now } : {}) })
      .where(eq(devices.id, id))
      .returning();
    if (updated.length) await logEvent(tx, id, "updated", updated.join("; "));
    if (settings.length) await logEvent(tx, id, "setting_changed", settings.join("; "));
    return withRoomName(tx, next);
  });
}

export async function setPower(db: Db, id: number, isOn: boolean): Promise<Device> {
  return db.transaction(async (tx) => {
    const row = await lockDevice(tx, id);
    const reason = unavailableReason(row);
    if (reason) throw badRequest(reason, "DEVICE_UNAVAILABLE");
    if (row.isOn === isOn) return withRoomName(tx, row);
    const now = new Date();
    const [next] = await tx
      .update(devices)
      .set({ isOn, lastSeenAt: now, updatedAt: now })
      .where(eq(devices.id, id))
      .returning();
    await logEvent(tx, id, isOn ? "power_on" : "power_off");
    return withRoomName(tx, next);
  });
}

export async function reconnect(db: Db, id: number): Promise<ReconnectResult> {
  return db.transaction(async (tx) => {
    const row = await lockDevice(tx, id);
    const now = new Date();
    if (row.hasError) {
      if (!row.errorFixable) {
        throw badRequest(
          "This error can't be cleared remotely. Follow the Support Guide steps, then power-cycle the device.",
          "MANUAL_FIX_REQUIRED",
        );
      }
      const [next] = await tx
        .update(devices)
        .set({ hasError: false, errorMessage: null, errorFixable: false, isOnline: true, lastSeenAt: now, updatedAt: now })
        .where(eq(devices.id, id))
        .returning();
      await logEvent(tx, id, "error_cleared", `Cleared "${row.errorMessage}" with a simulated remote reconnect`);
      return { device: await withRoomName(tx, next), message: "Error cleared by a simulated remote reconnect." };
    }
    if (!row.isOnline) {
      const [next] = await tx
        .update(devices)
        .set({ isOnline: true, lastSeenAt: now, updatedAt: now })
        .where(eq(devices.id, id))
        .returning();
      await logEvent(tx, id, "reconnected", "Back online after a simulated reconnect");
      return { device: await withRoomName(tx, next), message: "Reconnected (simulated). The device is back online." };
    }
    throw badRequest("This device is already online with no errors.", "ALREADY_CONNECTED");
  });
}

export async function simulateError(
  db: Db,
  id: number,
  input: { errorMessage: string; fixable: boolean },
): Promise<Device> {
  return db.transaction(async (tx) => {
    await lockDevice(tx, id);
    const [next] = await tx
      .update(devices)
      .set({ hasError: true, errorMessage: input.errorMessage, errorFixable: input.fixable, updatedAt: new Date() })
      .where(eq(devices.id, id))
      .returning();
    await logEvent(tx, id, "error_set", input.errorMessage);
    return withRoomName(tx, next);
  });
}

export async function deleteDevice(db: Db, id: number): Promise<void> {
  const deleted = await db.delete(devices).where(eq(devices.id, id)).returning({ id: devices.id });
  if (deleted.length === 0) throw notFound("Device");
}

export async function listEvents(db: DbLike, id: number, limit: number): Promise<DeviceEvent[]> {
  const [exists] = await db.select({ id: devices.id }).from(devices).where(eq(devices.id, id));
  if (!exists) throw notFound("Device");
  const rows = await db
    .select()
    .from(deviceEvents)
    .where(eq(deviceEvents.deviceId, id))
    .orderBy(desc(deviceEvents.createdAt), desc(deviceEvents.id))
    .limit(limit);
  return rows.map(toEvent);
}

