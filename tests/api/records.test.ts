import { describe, expect, it } from "vitest";
import { makeApp, useFreshDatabase } from "./helpers";

useFreshDatabase();
const api = makeApp();

describe("scenarios", () => {
  it("lists seeded scenarios without a device count", async () => {
    const res = await api.get("/api/scenarios").expect(200);
    expect(res.body.map((s: { name: string }) => s.name)).toEqual(["Good Night", "Good Morning", "Movie Time"]);
    expect(res.body[0]).not.toHaveProperty("deviceCount");
  });

  it("creates, reads and deletes", async () => {
    const created = await api.post("/api/scenarios").send({ name: "Reading", icon: "sun" }).expect(201);
    await api.get(`/api/scenarios/${created.body.id}`).expect(200);
    await api.delete(`/api/scenarios/${created.body.id}`).expect(204);
    await api.get(`/api/scenarios/${created.body.id}`).expect(404);
  });

  it("validates name and icon", async () => {
    expect((await api.post("/api/scenarios").send({ name: "", icon: "sun" }).expect(400)).body.fieldErrors).toHaveProperty("name");
    expect((await api.post("/api/scenarios").send({ name: "X", icon: "Sun" }).expect(400)).body.fieldErrors).toHaveProperty("icon");
  });
});

describe("automations", () => {
  it("creates active by default and persists the enabled state", async () => {
    const created = await api
      .post("/api/automations")
      .send({ name: "Porch light", description: "At sunset", icon: "location" })
      .expect(201);
    expect(created.body.isActive).toBe(true);
    await api.patch(`/api/automations/${created.body.id}`).send({ isActive: false }).expect(200);
    expect((await api.get(`/api/automations/${created.body.id}`).expect(200)).body.isActive).toBe(false);
  });

  it("validates updates and creation", async () => {
    const [first] = (await api.get("/api/automations").expect(200)).body;
    await api.patch(`/api/automations/${first.id}`).send({ isActive: "no" }).expect(400);
    await api.patch(`/api/automations/${first.id}`).send({}).expect(400);
    await api.patch("/api/automations/99999").send({ isActive: true }).expect(404);
    const bad = await api.post("/api/automations").send({ name: "X", icon: "clock" }).expect(400);
    expect(bad.body.fieldErrors).toHaveProperty("description");
  });

  it("deletes", async () => {
    const [first] = (await api.get("/api/automations").expect(200)).body;
    await api.delete(`/api/automations/${first.id}`).expect(204);
    expect((await api.get("/api/automations").expect(200)).body).toHaveLength(1);
  });
});
