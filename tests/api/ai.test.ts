import { describe, expect, it, vi } from "vitest";
import type { AiProvider, ChatMessage } from "../../server/ai/provider";
import { deviceByName, makeApp, useFreshDatabase } from "./helpers";

useFreshDatabase();

describe("AI without a key (fallback)", () => {
  const api = makeApp();

  it("returns labeled fallback guidance for every device type, without a success rate", async () => {
    for (const name of ["Living Room Light", "Bedroom AC", "Living Room Camera", "Bedroom TV"]) {
      const d = await deviceByName(api, name);
      const res = await api.post(`/api/ai/devices/${d.id}/guide`).expect(200);
      expect(res.body.source).toBe("fallback");
      expect(res.body.overview).toBeTruthy();
      expect(res.body.commonIssues.length).toBeGreaterThan(0);
      expect(res.body).not.toHaveProperty("estimatedSuccessRate");

      const chat = await api.post("/api/ai/chat").send({ deviceId: d.id, question: "How do I reset it?" }).expect(200);
      expect(chat.body.source).toBe("fallback");
      expect(chat.body.answer.length).toBeGreaterThan(10);
    }
  });

  it("diagnoses errored devices only", async () => {
    const ac = await deviceByName(api, "Living Room AC");
    const res = await api.post(`/api/ai/devices/${ac.id}/diagnosis`).expect(200);
    expect(res.body).toMatchObject({ source: "fallback" });
    expect(res.body.steps.length).toBeGreaterThan(0);
    expect(res.body).not.toHaveProperty("estimatedSuccessRate");
    const light = await deviceByName(api, "Living Room Light");
    expect((await api.post(`/api/ai/devices/${light.id}/diagnosis`).expect(400)).body.code).toBe("DEVICE_HAS_NO_ERROR");
  });

  it("rejects GET and validates chat input", async () => {
    const ac = await deviceByName(api, "Living Room AC");
    await api.get(`/api/ai/devices/${ac.id}/guide`).expect(404);
    await api.post("/api/ai/chat").send({ deviceId: ac.id, question: "" }).expect(400);
    await api.post("/api/ai/chat").send({ deviceId: ac.id, question: "x".repeat(501) }).expect(400);
    await api.post("/api/ai/chat").send({ deviceId: 99999, question: "hi" }).expect(404);
    const history = Array.from({ length: 7 }, () => ({ role: "user", content: "hi" }));
    await api.post("/api/ai/chat").send({ deviceId: ac.id, question: "hi", history }).expect(400);
  });
});

describe("AI with a provider", () => {
  function fakeProvider(json: unknown, text = "Try restarting the router.") {
    const calls: ChatMessage[][] = [];
    const provider: AiProvider = {
      completeJson: vi.fn(async (messages: ChatMessage[]) => {
        calls.push(messages);
        return json;
      }),
      completeText: vi.fn(async (messages: ChatMessage[]) => {
        calls.push(messages);
        return text;
      }),
    };
    return { provider, calls };
  }

  it("returns validated AI output, drops a null success rate, and caches by device state", async () => {
    const { provider } = fakeProvider({
      diagnosis: "Likely a Wi-Fi drop.",
      steps: ["Restart router"],
      possibleCauses: ["Router reboot"],
      estimatedSuccessRate: null,
    });
    const api = makeApp({}, provider);
    const ac = await deviceByName(api, "Living Room AC");
    const res = await api.post(`/api/ai/devices/${ac.id}/diagnosis`).expect(200);
    expect(res.body).toEqual({
      source: "ai",
      diagnosis: "Likely a Wi-Fi drop.",
      steps: ["Restart router"],
      possibleCauses: ["Router reboot"],
    });
    await api.post(`/api/ai/devices/${ac.id}/diagnosis`).expect(200);
    expect(provider.completeJson).toHaveBeenCalledTimes(1);
  });

  it("falls back when the model output fails validation or the provider throws", async () => {
    const { provider } = fakeProvider({ diagnosis: "", steps: "not a list" });
    const api = makeApp({}, provider);
    const ac = await deviceByName(api, "Living Room AC");
    expect((await api.post(`/api/ai/devices/${ac.id}/diagnosis`).expect(200)).body.source).toBe("fallback");

    const failing: AiProvider = {
      completeJson: async () => {
        throw new Error("network down");
      },
      completeText: async () => {
        throw new Error("network down");
      },
    };
    const api2 = makeApp({}, failing);
    expect((await api2.post(`/api/ai/devices/${ac.id}/guide`).expect(200)).body.source).toBe("fallback");
    expect((await api2.post("/api/ai/chat").send({ deviceId: ac.id, question: "Why?" }).expect(200)).body.source).toBe(
      "fallback",
    );
  });

  it("never sends device or room names to the provider, but sends chat history", async () => {
    const { provider, calls } = fakeProvider({});
    const api = makeApp({}, provider);
    const ac = await deviceByName(api, "Living Room AC");
    await api
      .post("/api/ai/chat")
      .send({ deviceId: ac.id, question: "What next?", history: [{ role: "user", content: "It is offline" }] })
      .expect(200);
    const sent = JSON.stringify(calls);
    expect(sent).not.toContain("Living Room");
    expect(sent).toContain("Ecobee");
    expect(sent).toContain("It is offline");
  });

  it("rate-limits AI routes with a 429", async () => {
    const api = makeApp({ aiRateLimitPerMin: 2 });
    const ac = await deviceByName(api, "Living Room AC");
    await api.post(`/api/ai/devices/${ac.id}/guide`).expect(200);
    await api.post(`/api/ai/devices/${ac.id}/guide`).expect(200);
    const res = await api.post(`/api/ai/devices/${ac.id}/guide`).expect(429);
    expect(res.body.code).toBe("RATE_LIMITED");
  });
});
