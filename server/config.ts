import "dotenv/config";

export interface ServerConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string | undefined;
  openaiApiKey: string | undefined;
  openaiModel: string;
  aiRateLimitPerMin: number;
  enableDemoEndpoints: boolean;
  seedOnStart: boolean;
}

function flag(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    nodeEnv: env.NODE_ENV ?? "development",
    port: positiveInt(env.PORT, 5000),
    databaseUrl: env.DATABASE_URL?.trim() || undefined,
    openaiApiKey: env.OPENAI_API_KEY?.trim() || undefined,
    openaiModel: env.OPENAI_MODEL?.trim() || "gpt-4o",
    aiRateLimitPerMin: positiveInt(env.AI_RATE_LIMIT_PER_MIN, 20),
    enableDemoEndpoints: flag(env.ENABLE_DEMO_ENDPOINTS, false),
    seedOnStart: flag(env.SEED_ON_START, true),
  };
}
