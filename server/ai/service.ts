import {
  diagnosisBodySchema,
  guideBodySchema,
  type ChatResponse,
  type DiagnosisResponse,
  type GuideResponse,
} from "../../shared/ai";
import type { Device } from "../../shared/types";
import type { ChatTurn } from "../../shared/validation";
import { SYSTEM_PROMPT, describeContext, toAiContext } from "./context";
import { fallbackChat, fallbackDiagnosis, fallbackGuide } from "./fallback";
import { DIAGNOSIS_JSON_SCHEMA, GUIDE_JSON_SCHEMA, type AiProvider } from "./provider";

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 200;

/** Small TTL + insertion-order LRU cache. Only successful AI responses are stored. */
class TtlCache<V> {
  private map = new Map<string, { value: V; expires: number }>();
  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }
  set(key: string, value: V) {
    this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
    while (this.map.size > CACHE_MAX) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }
}

function logFallback(kind: string, err: unknown) {
  // Log only the error class: never prompts, questions, or model output.
  const name = err instanceof Error ? err.constructor.name : typeof err;
  console.warn(`[ai] ${kind} fell back to local guidance (${name})`);
}

/** Strips nulls the strict schema forces, then validates with the shared Zod schema. */
function normalizeRate<T extends { estimatedSuccessRate?: unknown }>(raw: T): T {
  if (raw && typeof raw === "object" && raw.estimatedSuccessRate == null) {
    const { estimatedSuccessRate: _drop, ...rest } = raw;
    return rest as T;
  }
  return raw;
}

export class AiService {
  private diagnosisCache = new TtlCache<DiagnosisResponse>();
  private guideCache = new TtlCache<GuideResponse>();

  constructor(private provider: AiProvider | null) {}

  get available(): boolean {
    return this.provider !== null;
  }

  private key(d: Device) {
    return `${d.id}:${d.updatedAt}`;
  }

  async diagnosis(device: Device): Promise<DiagnosisResponse> {
    const ctx = toAiContext(device);
    if (!this.provider) return fallbackDiagnosis(ctx);
    const cached = this.diagnosisCache.get(this.key(device));
    if (cached) return cached;
    try {
      const raw = await this.provider.completeJson(
        [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Diagnose this device's error and give 3-6 ordered, safe troubleshooting steps.\n${describeContext(ctx)}`,
          },
        ],
        "device_diagnosis",
        DIAGNOSIS_JSON_SCHEMA,
      );
      const body = diagnosisBodySchema.parse(normalizeRate(raw as { estimatedSuccessRate?: unknown }));
      const result: DiagnosisResponse = { source: "ai", ...body };
      this.diagnosisCache.set(this.key(device), result);
      return result;
    } catch (err) {
      logFallback("diagnosis", err);
      return fallbackDiagnosis(ctx);
    }
  }

  async guide(device: Device): Promise<GuideResponse> {
    const ctx = toAiContext(device);
    if (!this.provider) return fallbackGuide(ctx);
    const cached = this.guideCache.get(this.key(device));
    if (cached) return cached;
    try {
      const raw = await this.provider.completeJson(
        [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Write a concise support guide for this device: overview, 2-4 quick fixes, up to 4 common issues with solutions, maintenance tips, advanced troubleshooting, and possible causes of its current state.\n${describeContext(ctx)}`,
          },
        ],
        "device_guide",
        GUIDE_JSON_SCHEMA,
      );
      const body = guideBodySchema.parse(normalizeRate(raw as { estimatedSuccessRate?: unknown }));
      const result: GuideResponse = { source: "ai", ...body };
      this.guideCache.set(this.key(device), result);
      return result;
    } catch (err) {
      logFallback("guide", err);
      return fallbackGuide(ctx);
    }
  }

  async chat(device: Device, question: string, history: ChatTurn[]): Promise<ChatResponse> {
    const ctx = toAiContext(device);
    if (!this.provider) return { source: "fallback", answer: fallbackChat(ctx, question, history) };
    try {
      const answer = await this.provider.completeText([
        {
          role: "system",
          content: `${SYSTEM_PROMPT}\nAnswer in plain text, about 120 words or fewer.\nCurrent device:\n${describeContext(ctx)}`,
        },
        ...history.map((t) => ({ role: t.role, content: t.content })),
        { role: "user", content: question },
      ]);
      return { source: "ai", answer: answer.slice(0, 2000) };
    } catch (err) {
      logFallback("chat", err);
      return { source: "fallback", answer: fallbackChat(ctx, question, history) };
    }
  }
}
