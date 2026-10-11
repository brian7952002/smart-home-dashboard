import OpenAI from "openai";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Narrow seam over the model API so tests can substitute a fake. */
export interface AiProvider {
  /** Returns parsed JSON conforming (per the provider) to `schema`; callers still validate it. */
  completeJson(messages: ChatMessage[], schemaName: string, schema: Record<string, unknown>): Promise<unknown>;
  completeText(messages: ChatMessage[]): Promise<string>;
}

const TIMEOUT_MS = 20_000;

export function createOpenAiProvider(apiKey: string, model: string): AiProvider {
  const client = new OpenAI({ apiKey, timeout: TIMEOUT_MS, maxRetries: 0 });
  return {
    async completeJson(messages, schemaName, schema) {
      const res = await client.chat.completions.create({
        model,
        messages,
        temperature: 0.3,
        response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } },
      });
      const content = res.choices[0]?.message?.content;
      if (!content) throw new EmptyResponseError();
      return JSON.parse(content);
    },
    async completeText(messages) {
      const res = await client.chat.completions.create({ model, messages, temperature: 0.4, max_completion_tokens: 400 });
      const content = res.choices[0]?.message?.content?.trim();
      if (!content) throw new EmptyResponseError();
      return content;
    },
  };
}

export class EmptyResponseError extends Error {
  constructor() {
    super("Model returned no content");
    this.name = "EmptyResponseError";
  }
}

const stringArray = { type: "array", items: { type: "string" } };
const successRate = {
  type: ["integer", "null"],
  description:
    "Rough percentage of similar cases these steps resolve. Use null unless you can justify an estimate.",
};

/** JSON Schemas for strict structured output. Optional fields are modeled as nullable. */
export const DIAGNOSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["diagnosis", "steps", "possibleCauses", "estimatedSuccessRate"],
  properties: {
    diagnosis: { type: "string" },
    steps: stringArray,
    possibleCauses: stringArray,
    estimatedSuccessRate: successRate,
  },
};

export const GUIDE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "overview",
    "quickFixes",
    "commonIssues",
    "maintenanceTips",
    "advancedTroubleshooting",
    "possibleCauses",
    "estimatedSuccessRate",
  ],
  properties: {
    overview: { type: "string" },
    quickFixes: stringArray,
    commonIssues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["issue", "solution"],
        properties: { issue: { type: "string" }, solution: { type: "string" } },
      },
    },
    maintenanceTips: stringArray,
    advancedTroubleshooting: stringArray,
    possibleCauses: stringArray,
    estimatedSuccessRate: successRate,
  },
};
