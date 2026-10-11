import { describe, expect, it } from "vitest";
import type { Room } from "../../shared/types";
import { makeApp, useFreshDatabase } from "./helpers";

useFreshDatabase();
const api = makeApp();

async function rooms(): Promise<Room[]> {
  return (await api.get("/api/rooms").expect(200)).body;
}
const byName = (list: Room[], name: string) => list.find((r) => r.name === name)!;

describe("rooms", () => {
  it("gets a room and handles bad or missing ids", async () => {
    const living = byName(await rooms(), "Living Room");
    expect((await api.get(`/api/rooms/${living.id}`).expect(200)).body.name).toBe("Living Room");
    await api.get("/api/rooms/99999").expect(404);
    expect((await api.get("/api/rooms/x").expect(400)).body.code).toBe("INVALID_ID");
  });

  it("creates a room in a free, in-bounds spot", async () => {
    const res = await api.post("/api/rooms").send({ name: "Office" }).expect(201);
    const office = res.body as Room;
    expect(office).toMatchObject({ name: "Office", width: 120, height: 90 });
    expect(office.positionY).toBeGreaterThanOrEqual(40);
    expect(office.positionX + office.width).toBeLessThanOrEqual(350);
    expect(office.positionY + office.height).toBeLessThanOrEqual(450);
    const small = await api.post("/api/rooms").send({ name: "Closet", size: "small" }).expect(201);
    expect(small.body).toMatchObject({ width: 90, height: 70 });
  });

  it("rejects duplicate names ignoring case and blank names", async () => {
    const dup = await api.post("/api/rooms").send({ name: "kitchen" }).expect(409);
    expect(dup.body.code).toBe("DUPLICATE_NAME");
    expect((await api.post("/api/rooms").send({ name: "  " }).expect(400)).body.fieldErrors).toHaveProperty("name");
    await api.post("/api/rooms").send({ name: "Den", size: "huge" }).expect(400);
  });

  it("returns NO_SPACE when the plan is full", async () => {
    let lastStatus = 201;
    for (let i = 0; i < 20 && lastStatus === 201; i++) {
      lastStatus = (await api.post("/api/rooms").send({ name: `Big ${i}`, size: "large" })).status;
    }
    const res = await api.post("/api/rooms").send({ name: "One more", size: "large" }).expect(400);
    expect(res.body.code).toBe("NO_SPACE");
  });

  it("renames a room", async () => {
    const bath = byName(await rooms(), "Bathroom");
    expect((await api.patch(`/api/rooms/${bath.id}`).send({ name: "Main Bath" }).expect(200)).body.name).toBe("Main Bath");
    await api.patch(`/api/rooms/${bath.id}`).send({ name: "Kitchen" }).expect(409);
    await api.patch("/api/rooms/99999").send({ name: "Nope" }).expect(404);
  });

  it("saves a layout atomically and persists it", async () => {
    const list = await rooms();
    const bath = byName(list, "Bathroom");
    const kitchen = byName(list, "Kitchen");
    await api
      .put("/api/rooms/layout")
      .send({ rooms: [{ id: bath.id, positionX: 220, positionY: 50 }, { id: kitchen.id, positionX: 220, positionY: 160 }] })
      .expect(200);
    const after = await rooms();
    expect(byName(after, "Bathroom")).toMatchObject({ positionX: 220, positionY: 50 });
    expect(byName(after, "Kitchen")).toMatchObject({ positionX: 220, positionY: 160 });
  });

  it("rejects overlap and out-of-bounds layouts without saving anything", async () => {
    const list = await rooms();
    const bath = byName(list, "Bathroom");
    const living = byName(list, "Living Room");
    const overlap = await api
      .put("/api/rooms/layout")
      .send({ rooms: [{ id: bath.id, positionX: 230, positionY: 50 }, { id: living.id, positionX: 150, positionY: 60 }] })
      .expect(400);
    expect(overlap.body.code).toBe("ROOM_OVERLAP");
    expect(byName(await rooms(), "Bathroom")).toMatchObject({ positionX: 210, positionY: 60 });

    const oob = await api.put("/api/rooms/layout").send({ rooms: [{ id: bath.id, positionX: 300, positionY: 60 }] }).expect(400);
    expect(oob.body.message).toMatch(/outside the floor plan/);
    await api.put("/api/rooms/layout").send({ rooms: [{ id: bath.id, positionX: 0, positionY: 10 }] }).expect(400);
    await api.put("/api/rooms/layout").send({ rooms: [{ id: 99999, positionX: 0, positionY: 40 }] }).expect(400);
    await api.put("/api/rooms/layout").send({ rooms: [] }).expect(400);
  });

  it("refuses to delete a room with devices, deletes an empty one", async () => {
    const kitchen = byName(await rooms(), "Kitchen");
    const res = await api.delete(`/api/rooms/${kitchen.id}`).expect(409);
    expect(res.body).toMatchObject({ code: "ROOM_NOT_EMPTY", message: "Move or delete this room's 2 devices first" });
    const office = (await api.post("/api/rooms").send({ name: "Office" }).expect(201)).body as Room;
    await api.delete(`/api/rooms/${office.id}`).expect(204);
    await api.delete(`/api/rooms/${office.id}`).expect(404);
  });
});
