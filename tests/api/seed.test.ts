import { describe, expect, it } from "vitest";
import type { Device, RoomWithDevices } from "../../shared/types";
import { seedIfEmpty } from "../../server/seed";
import { db, makeApp, useFreshDatabase } from "./helpers";

useFreshDatabase();
const api = makeApp();

describe("seed and demo data", () => {
  it("produces the documented inventory and health summary", async () => {
    const [rooms, devices, scenarios, automations] = await Promise.all([
      api.get("/api/rooms").expect(200),
      api.get("/api/devices").expect(200),
      api.get("/api/scenarios").expect(200),
      api.get("/api/automations").expect(200),
    ]);
    expect(rooms.body).toHaveLength(4);
    expect(devices.body).toHaveLength(10);
    expect(scenarios.body).toHaveLength(3);
    expect(automations.body).toHaveLength(2);

    const list = devices.body as Device[];
    const errors = list.filter((d) => d.hasError);
    expect(errors).toHaveLength(3);
    expect(errors.filter((d) => d.errorFixable)).toHaveLength(2);
    expect(list.filter((d) => !d.isOnline)).toHaveLength(2);
  });

  it("seeds the prototype firmware versions and derives status", async () => {
    const list = (await api.get("/api/devices").expect(200)).body as Device[];
    const byName = Object.fromEntries(list.map((d) => [d.name, d]));
    expect(byName["Living Room Light"].firmwareVersion).toBe("1.65.11");
    expect(byName["Bedroom TV"].firmwareVersion).toBe("04.30.75");
    expect(byName["Living Room Light"].status).toBe("On · 80% brightness");
    expect(byName["Bedroom AC"].status).toBe("On · 72°F");
    expect(byName["Kitchen Light"].status).toBe("Offline");
    expect(byName["Living Room TV"].status).toBe("Smart Hub not responding");
    expect(byName["Living Room Camera"].status).toBe("Monitoring");
  });

  it("is idempotent", async () => {
    expect(await seedIfEmpty(db)).toBe(false);
    const rooms = await api.get("/api/rooms").expect(200);
    expect(rooms.body).toHaveLength(4);
  });

  it("returns rooms with nested devices", async () => {
    const res = await api.get("/api/rooms-with-devices").expect(200);
    const rooms = res.body as RoomWithDevices[];
    const living = rooms.find((r) => r.name === "Living Room")!;
    expect(living.devices).toHaveLength(4);
    expect(living).toMatchObject({ positionX: 40, positionY: 60, width: 140, height: 150 });
  });

  it("demo reset restores the seed state", async () => {
    const tv = (await api.get("/api/devices").expect(200)).body.find((d: Device) => d.name === "Bedroom TV");
    await api.delete(`/api/devices/${tv.id}`).expect(204);
    await api.post("/api/demo/reset").expect(200);
    expect((await api.get("/api/devices").expect(200)).body).toHaveLength(10);
  });

  it("does not register demo routes when disabled", async () => {
    const locked = makeApp({ enableDemoEndpoints: false });
    await locked.post("/api/demo/reset").expect(404);
    await locked.post("/api/devices/1/simulate-error").send({ errorMessage: "x", fixable: true }).expect(404);
    const config = await locked.get("/api/config").expect(200);
    expect(config.body).toEqual({ aiAvailable: false, demoEndpointsEnabled: false });
  });

  it("returns JSON 404 for unknown API routes and rejects malformed JSON", async () => {
    const res = await api.get("/api/nope").expect(404);
    expect(res.body).toEqual({ message: "Not found", code: "NOT_FOUND" });
    const bad = await api.post("/api/scenarios").set("Content-Type", "application/json").send("{oops").expect(400);
    expect(bad.body.code).toBe("VALIDATION_ERROR");
  });
});
