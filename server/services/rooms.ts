import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { ROOM_SIZES, type RoomSize } from "../../shared/constants";
import { findFreeSpot, isWithinPlan, rectsOverlap } from "../../shared/geometry";
import { devices, rooms } from "../../shared/schema";
import type { Room, RoomWithDevices } from "../../shared/types";
import type { Db, DbLike } from "../db";
import { HttpError, badRequest, notFound, pgErrorCode } from "../errors";
import { toDevice, toRoom } from "../serialize";

const duplicateNameError = () =>
  new HttpError(409, "A room with that name already exists", "DUPLICATE_NAME", {
    name: "A room with that name already exists",
  });

/** The unique index is the backstop; this check reports duplicates before other rules. */
async function assertNameFree(tx: DbLike, name: string, exceptId?: number) {
  const sameName = sql`lower(${rooms.name}) = lower(${name})`;
  const [hit] = await tx
    .select({ id: rooms.id })
    .from(rooms)
    .where(exceptId ? and(sameName, ne(rooms.id, exceptId)) : sameName);
  if (hit) throw duplicateNameError();
}

function duplicateName(err: unknown): never {
  if (pgErrorCode(err) === "23505") throw duplicateNameError();
  throw err;
}

/** Serializes writes that depend on the full set of room rectangles. */
async function lockRooms(tx: DbLike) {
  await tx.execute(sql`LOCK TABLE rooms IN SHARE ROW EXCLUSIVE MODE`);
}

export async function listRooms(db: DbLike): Promise<Room[]> {
  const rows = await db.select().from(rooms).orderBy(asc(rooms.name));
  return rows.map(toRoom);
}

export async function getRoom(db: DbLike, id: number): Promise<Room> {
  const [row] = await db.select().from(rooms).where(eq(rooms.id, id));
  if (!row) throw notFound("Room");
  return toRoom(row);
}

export async function listRoomsWithDevices(db: DbLike): Promise<RoomWithDevices[]> {
  const roomRows = await db.select().from(rooms).orderBy(asc(rooms.name));
  const deviceRows = await db.select().from(devices).orderBy(asc(devices.id));
  return roomRows.map((r) => ({
    ...toRoom(r),
    devices: deviceRows.filter((d) => d.roomId === r.id).map((d) => toDevice(d, r.name)),
  }));
}

export async function createRoom(db: Db, input: { name: string; size: RoomSize }): Promise<Room> {
  const size = ROOM_SIZES[input.size];
  try {
    return await db.transaction(async (tx) => {
      await lockRooms(tx);
      await assertNameFree(tx, input.name);
      const existing = await tx.select().from(rooms);
      const spot = findFreeSpot(existing, size);
      if (!spot) {
        throw badRequest(
          "There's no free space on the floor plan. Move rooms or choose a smaller size.",
          "NO_SPACE",
        );
      }
      const [row] = await tx
        .insert(rooms)
        .values({ name: input.name, ...size, ...spot })
        .returning();
      return toRoom(row);
    });
  } catch (err) {
    return duplicateName(err);
  }
}

export async function renameRoom(db: Db, id: number, input: { name?: string }): Promise<Room> {
  if (input.name === undefined) throw badRequest("Nothing to update");
  try {
    const [row] = await db.update(rooms).set({ name: input.name }).where(eq(rooms.id, id)).returning();
    if (!row) throw notFound("Room");
    return toRoom(row);
  } catch (err) {
    return duplicateName(err);
  }
}

/** All-or-nothing position update, validated against the final layout. */
export async function updateLayout(
  db: Db,
  changes: Array<{ id: number; positionX: number; positionY: number }>,
): Promise<Room[]> {
  const ids = new Set<number>();
  for (const c of changes) {
    if (ids.has(c.id)) throw badRequest(`Room ${c.id} appears more than once`);
    ids.add(c.id);
  }
  return db.transaction(async (tx) => {
    await lockRooms(tx);
    const current = await tx.select().from(rooms);
    const byId = new Map(current.map((r) => [r.id, r]));
    for (const c of changes) {
      if (!byId.has(c.id)) throw badRequest(`Room ${c.id} not found`, "VALIDATION_ERROR");
    }
    const final = current.map((r) => {
      const c = changes.find((x) => x.id === r.id);
      return c ? { ...r, positionX: c.positionX, positionY: c.positionY } : r;
    });
    for (const r of final) {
      if (!isWithinPlan(r)) throw badRequest(`${r.name} would be outside the floor plan`);
    }
    for (let i = 0; i < final.length; i++) {
      for (let j = i + 1; j < final.length; j++) {
        if (rectsOverlap(final[i], final[j])) {
          throw badRequest(`${final[i].name} would overlap ${final[j].name}`, "ROOM_OVERLAP");
        }
      }
    }
    for (const c of changes) {
      await tx
        .update(rooms)
        .set({ positionX: c.positionX, positionY: c.positionY })
        .where(eq(rooms.id, c.id));
    }
    const rows = await tx.select().from(rooms).orderBy(asc(rooms.name));
    return rows.map(toRoom);
  });
}

export async function deleteRoom(db: Db, id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(rooms).where(eq(rooms.id, id)).for("update");
    if (!row) throw notFound("Room");
    const [{ n }] = await tx.select({ n: count() }).from(devices).where(eq(devices.roomId, id));
    if (n > 0) {
      throw new HttpError(
        409,
        `Move or delete this room's ${n} device${n === 1 ? "" : "s"} first`,
        "ROOM_NOT_EMPTY",
      );
    }
    await tx.delete(rooms).where(eq(rooms.id, id));
  });
}
