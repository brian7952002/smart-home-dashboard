import { describe, expect, it } from "vitest";
import type { Device, DeviceEvent, RoomWithDevices } from "../../shared/types";
import { deviceByName, makeApp, useFreshDatabase } from "./helpers";

useFreshDatabase();
const api = makeApp();

async function roomId(name: string) {
  const rooms = (await api.get("/api/rooms-with-devices").expect(200)).body as RoomWithDevices[];
  return rooms.find((r) => r.name === name)!.id;
}

describe("device reads", () => {
  it("rejects invalid ids and 404s missing devices", async () => {
    expect((await api.get("/api/devices/abc").expect(400)).body.code).toBe("INVALID_ID");
    expect((await api.get("/api/devices/0").expect(400)).body.code).toBe("INVALID_ID");
    expect((await api.get("/api/devices/1.5").expect(400)).body.code).toBe("INVALID_ID");
    expect((await api.get("/api/devices/99999").expect(404)).body).toEqual({
      message: "Device not found",
      code: "NOT_FOUND",
    });
  });
});

describe("power", () => {
  it("turns a healthy device off and on, idempotently, with events", async () => {
    const light = await deviceByName(api, "Living Room Light");
    const off = await api.put(`/api/devices/${light.id}/power`).send({ isOn: false }).expect(200);
    expect(off.body).toMatchObject({ isOn: false, status: "Off" });
    await api.put(`/api/devices/${light.id}/power`).send({ isOn: false }).expect(200);
    const on = await api.put(`/api/devices/${light.id}/power`).send({ isOn: true }).expect(200);
    expect(on.body.status).toBe("On · 80% brightness");

    const events = (await api.get(`/api/devices/${light.id}/events`).expect(200)).body as DeviceEvent[];
    expect(events.map((e) => e.type).slice(0, 3)).toEqual(["power_on", "power_off", "created"]);
  });

  it("refuses offline and errored devices", async () => {
    const offline = await deviceByName(api, "Kitchen Light");
    const r1 = await api.put(`/api/devices/${offline.id}/power`).send({ isOn: true }).expect(400);
    expect(r1.body).toMatchObject({ code: "DEVICE_UNAVAILABLE", message: "Unavailable while offline" });
    const errored = await deviceByName(api, "Living Room AC");
    const r2 = await api.put(`/api/devices/${errored.id}/power`).send({ isOn: false }).expect(400);
    expect(r2.body.code).toBe("DEVICE_UNAVAILABLE");
  });

  it("validates the body and 404s missing devices", async () => {
    const light = await deviceByName(api, "Living Room Light");
    expect((await api.put(`/api/devices/${light.id}/power`).send({ isOn: "yes" }).expect(400)).body.code).toBe(
      "VALIDATION_ERROR",
    );
    await api.put("/api/devices/99999/power").send({ isOn: true }).expect(404);
  });
});

describe("reconnect", () => {
  it("brings an offline device back online", async () => {
    const tv = await deviceByName(api, "Bedroom TV");
    const res = await api.post(`/api/devices/${tv.id}/reconnect`).expect(200);
    expect(res.body.device).toMatchObject({ isOnline: true, status: "Off" });
    expect(res.body.message).toMatch(/simulated/i);
  });

  it("clears a fixable error", async () => {
    const ac = await deviceByName(api, "Living Room AC");
    const res = await api.post(`/api/devices/${ac.id}/reconnect`).expect(200);
    expect(res.body.device).toMatchObject({ hasError: false, errorMessage: null, errorFixable: false, isOnline: true });
    const events = (await api.get(`/api/devices/${ac.id}/events?limit=1`).expect(200)).body as DeviceEvent[];
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("error_cleared");
  });

  it("leaves a manual error unchanged", async () => {
    const tv = await deviceByName(api, "Living Room TV");
    const res = await api.post(`/api/devices/${tv.id}/reconnect`).expect(400);
    expect(res.body.code).toBe("MANUAL_FIX_REQUIRED");
    const after = (await api.get(`/api/devices/${tv.id}`).expect(200)).body as Device;
    expect(after).toMatchObject({ hasError: true, errorMessage: "Smart Hub not responding" });
  });

  it("rejects healthy devices", async () => {
    const light = await deviceByName(api, "Bathroom Light");
    expect((await api.post(`/api/devices/${light.id}/reconnect`).expect(400)).body.code).toBe("ALREADY_CONNECTED");
  });
});

describe("settings via PATCH", () => {
  it("updates brightness and target temperature within range", async () => {
    const light = await deviceByName(api, "Bedroom Light");
    const res = await api.patch(`/api/devices/${light.id}`).send({ brightness: 35 }).expect(200);
    expect(res.body).toMatchObject({ brightness: 35, status: "On · 35% brightness" });
    const ac = await deviceByName(api, "Bedroom AC");
    expect((await api.patch(`/api/devices/${ac.id}`).send({ targetTempF: 68 }).expect(200)).body.targetTempF).toBe(68);
    const events = (await api.get(`/api/devices/${light.id}/events?limit=1`).expect(200)).body as DeviceEvent[];
    expect(events[0]).toMatchObject({ type: "setting_changed", detail: "Brightness 60% → 35%" });
  });

  it("rejects out-of-range values and wrong device types", async () => {
    const light = await deviceByName(api, "Bedroom Light");
    expect((await api.patch(`/api/devices/${light.id}`).send({ brightness: 101 }).expect(400)).body.fieldErrors).toHaveProperty(
      "brightness",
    );
    expect((await api.patch(`/api/devices/${light.id}`).send({ targetTempF: 70 }).expect(400)).body.fieldErrors).toHaveProperty(
      "targetTempF",
    );
    const ac = await deviceByName(api, "Bedroom AC");
    await api.patch(`/api/devices/${ac.id}`).send({ targetTempF: 59 }).expect(400);
    await api.patch(`/api/devices/${ac.id}`).send({ targetTempF: 91 }).expect(400);
  });

  it("rejects setting changes when the device is off, offline, or errored", async () => {
    const off = await deviceByName(api, "Living Room Light");
    await api.put(`/api/devices/${off.id}/power`).send({ isOn: false }).expect(200);
    expect((await api.patch(`/api/devices/${off.id}`).send({ brightness: 10 }).expect(400)).body.code).toBe(
      "DEVICE_UNAVAILABLE",
    );
    const offline = await deviceByName(api, "Kitchen Light");
    expect((await api.patch(`/api/devices/${offline.id}`).send({ brightness: 10 }).expect(400)).body.message).toBe(
      "Unavailable while offline",
    );
    const errored = await deviceByName(api, "Living Room AC");
    await api.patch(`/api/devices/${errored.id}`).send({ targetTempF: 70 }).expect(400);
  });

  it("renames and moves a device, and rejects an unknown room", async () => {
    const cam = await deviceByName(api, "Living Room Camera");
    const kitchen = await roomId("Kitchen");
    const res = await api.patch(`/api/devices/${cam.id}`).send({ name: "Porch Camera", roomId: kitchen }).expect(200);
    expect(res.body).toMatchObject({ name: "Porch Camera", roomId: kitchen, roomName: "Kitchen" });
    const bad = await api.patch(`/api/devices/${cam.id}`).send({ roomId: 99999 }).expect(400);
    expect(bad.body.fieldErrors).toHaveProperty("roomId");
    await api.patch(`/api/devices/${cam.id}`).send({}).expect(400);
  });
});

describe("create and delete", () => {
  it("creates a device with defaults", async () => {
    const kitchen = await roomId("Kitchen");
    const res = await api
      .post("/api/devices")
      .send({ name: "  Pantry Light ", type: "light", roomId: kitchen, extra: "ignored" })
      .expect(201);
    expect(res.body).toMatchObject({
      name: "Pantry Light",
      isOn: false,
      isOnline: true,
      hasError: false,
      brightness: 100,
      firmwareVersion: null,
      manufacturer: null,
      roomName: "Kitchen",
      status: "Off",
    });
    expect(res.body).not.toHaveProperty("extra");
    const climate = await api.post("/api/devices").send({ name: "Fan", type: "climate", roomId: kitchen }).expect(201);
    expect(climate.body.targetTempF).toBe(72);
  });

  it("validates name, type, and room", async () => {
    const kitchen = await roomId("Kitchen");
    const r1 = await api.post("/api/devices").send({ name: "", type: "light", roomId: kitchen }).expect(400);
    expect(r1.body.fieldErrors).toHaveProperty("name");
    const r2 = await api.post("/api/devices").send({ name: "X", type: "toaster", roomId: kitchen }).expect(400);
    expect(r2.body.fieldErrors).toHaveProperty("type");
    const r3 = await api.post("/api/devices").send({ name: "X", type: "light", roomId: 99999 }).expect(400);
    expect(r3.body.fieldErrors).toHaveProperty("roomId");
    await api.post("/api/devices").send({ name: "x".repeat(61), type: "light", roomId: kitchen }).expect(400);
  });

  it("deletes a device and cascades its events", async () => {
    const tv = await deviceByName(api, "Bedroom TV");
    await api.delete(`/api/devices/${tv.id}`).expect(204);
    await api.get(`/api/devices/${tv.id}`).expect(404);
    await api.get(`/api/devices/${tv.id}/events`).expect(404);
    await api.delete(`/api/devices/${tv.id}`).expect(404);
  });
});

describe("simulate error (demo)", () => {
  it("sets a fixable error that reconnect can clear", async () => {
    const light = await deviceByName(api, "Bathroom Light");
    const res = await api
      .post(`/api/devices/${light.id}/simulate-error`)
      .send({ errorMessage: "Lost contact with bridge", fixable: true })
      .expect(200);
    expect(res.body).toMatchObject({ hasError: true, errorFixable: true, status: "Lost contact with bridge" });
    await api.post(`/api/devices/${light.id}/reconnect`).expect(200);
    await api.post(`/api/devices/${light.id}/simulate-error`).send({ errorMessage: "", fixable: true }).expect(400);
  });
});
