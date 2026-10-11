import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  chatRequestSchema,
  createAutomationSchema,
  createDeviceSchema,
  createRoomSchema,
  createScenarioSchema,
  eventsQuerySchema,
  powerSchema,
  roomLayoutSchema,
  simulateErrorSchema,
  updateAutomationSchema,
  updateDeviceSchema,
  updateRoomSchema,
} from "../shared/validation";
import type { AppConfig } from "../shared/types";
import type { AiService } from "./ai/service";
import type { ServerConfig } from "./config";
import type { Db } from "./db";
import { badRequest, parseBody, parseId } from "./errors";
import { resetDemoData } from "./seed";
import * as deviceSvc from "./services/devices";
import * as records from "./services/records";
import * as roomSvc from "./services/rooms";

export interface RouteDeps {
  db: Db;
  config: Pick<ServerConfig, "enableDemoEndpoints" | "aiRateLimitPerMin">;
  ai: AiService;
}

export function apiRouter({ db, config, ai }: RouteDeps): Router {
  const r = Router();

  r.get("/config", (_req, res) => {
    const body: AppConfig = { aiAvailable: ai.available, demoEndpointsEnabled: config.enableDemoEndpoints };
    res.json(body);
  });

  // Rooms
  r.get("/rooms-with-devices", async (_req, res) => {
    res.json(await roomSvc.listRoomsWithDevices(db));
  });
  r.get("/rooms", async (_req, res) => {
    res.json(await roomSvc.listRooms(db));
  });
  // Registered before /rooms/:id so "layout" isn't parsed as an id.
  r.put("/rooms/layout", async (req, res) => {
    const { rooms } = parseBody(roomLayoutSchema, req.body);
    res.json(await roomSvc.updateLayout(db, rooms));
  });
  r.get("/rooms/:id", async (req, res) => {
    res.json(await roomSvc.getRoom(db, parseId(req.params.id)));
  });
  r.post("/rooms", async (req, res) => {
    res.status(201).json(await roomSvc.createRoom(db, parseBody(createRoomSchema, req.body)));
  });
  r.patch("/rooms/:id", async (req, res) => {
    const id = parseId(req.params.id);
    res.json(await roomSvc.renameRoom(db, id, parseBody(updateRoomSchema, req.body)));
  });
  r.delete("/rooms/:id", async (req, res) => {
    await roomSvc.deleteRoom(db, parseId(req.params.id));
    res.status(204).end();
  });

  // Devices
  r.get("/devices", async (_req, res) => {
    res.json(await deviceSvc.listDevices(db));
  });
  r.get("/devices/:id", async (req, res) => {
    res.json(await deviceSvc.getDevice(db, parseId(req.params.id)));
  });
  r.get("/devices/:id/events", async (req, res) => {
    const id = parseId(req.params.id);
    const { limit } = parseBody(eventsQuerySchema, req.query);
    res.json(await deviceSvc.listEvents(db, id, limit));
  });
  r.post("/devices", async (req, res) => {
    res.status(201).json(await deviceSvc.createDevice(db, parseBody(createDeviceSchema, req.body)));
  });
  r.patch("/devices/:id", async (req, res) => {
    const id = parseId(req.params.id);
    res.json(await deviceSvc.updateDevice(db, id, parseBody(updateDeviceSchema, req.body)));
  });
  r.put("/devices/:id/power", async (req, res) => {
    const id = parseId(req.params.id);
    const { isOn } = parseBody(powerSchema, req.body);
    res.json(await deviceSvc.setPower(db, id, isOn));
  });
  r.post("/devices/:id/reconnect", async (req, res) => {
    res.json(await deviceSvc.reconnect(db, parseId(req.params.id)));
  });
  r.delete("/devices/:id", async (req, res) => {
    await deviceSvc.deleteDevice(db, parseId(req.params.id));
    res.status(204).end();
  });

  // Scenarios (records only; nothing runs)
  r.get("/scenarios", async (_req, res) => {
    res.json(await records.listScenarios(db));
  });
  r.get("/scenarios/:id", async (req, res) => {
    res.json(await records.getScenario(db, parseId(req.params.id)));
  });
  r.post("/scenarios", async (req, res) => {
    res.status(201).json(await records.createScenario(db, parseBody(createScenarioSchema, req.body)));
  });
  r.delete("/scenarios/:id", async (req, res) => {
    await records.deleteScenario(db, parseId(req.params.id));
    res.status(204).end();
  });

  // Automations (records only; nothing runs)
  r.get("/automations", async (_req, res) => {
    res.json(await records.listAutomations(db));
  });
  r.get("/automations/:id", async (req, res) => {
    res.json(await records.getAutomation(db, parseId(req.params.id)));
  });
  r.post("/automations", async (req, res) => {
    res.status(201).json(await records.createAutomation(db, parseBody(createAutomationSchema, req.body)));
  });
  r.patch("/automations/:id", async (req, res) => {
    const id = parseId(req.params.id);
    res.json(await records.updateAutomation(db, id, parseBody(updateAutomationSchema, req.body)));
  });
  r.delete("/automations/:id", async (req, res) => {
    await records.deleteAutomation(db, parseId(req.params.id));
    res.status(204).end();
  });

  // Demo-only routes are not registered at all unless explicitly enabled.
  if (config.enableDemoEndpoints) {
    r.post("/devices/:id/simulate-error", async (req, res) => {
      const id = parseId(req.params.id);
      res.json(await deviceSvc.simulateError(db, id, parseBody(simulateErrorSchema, req.body)));
    });
    r.post("/demo/reset", async (_req, res) => {
      await resetDemoData(db);
      res.json({ message: "Demo data restored." });
    });
  }

  // AI (POST only, rate-limited)
  const aiLimiter = rateLimit({
    windowMs: 60_000,
    limit: config.aiRateLimitPerMin,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ message: "Too many requests. Try again in a minute.", code: "RATE_LIMITED" });
    },
  });
  r.use("/ai", aiLimiter);
  r.post("/ai/devices/:id/diagnosis", async (req, res) => {
    const device = await deviceSvc.getDevice(db, parseId(req.params.id));
    if (!device.hasError) throw badRequest("This device has no error to diagnose.", "DEVICE_HAS_NO_ERROR");
    const result = await ai.diagnosis(device);
    res.locals.aiSource = result.source;
    res.json(result);
  });
  r.post("/ai/devices/:id/guide", async (req, res) => {
    const device = await deviceSvc.getDevice(db, parseId(req.params.id));
    const result = await ai.guide(device);
    res.locals.aiSource = result.source;
    res.json(result);
  });
  r.post("/ai/chat", async (req, res) => {
    const { deviceId, question, history } = parseBody(chatRequestSchema, req.body);
    const device = await deviceSvc.getDevice(db, deviceId);
    const result = await ai.chat(device, question, history);
    res.locals.aiSource = result.source;
    res.json(result);
  });

  return r;
}
