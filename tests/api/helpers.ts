import "dotenv/config";
import supertest from "supertest";
import { afterAll, beforeEach } from "vitest";
import type { Device } from "../../shared/types";
import type { AiProvider } from "../../server/ai/provider";
import { createApp } from "../../server/app";
import { loadConfig, type ServerConfig } from "../../server/config";
import { createDb } from "../../server/db";
import { resetDemoData } from "../../server/seed";

const url = process.env.TEST_DATABASE_URL!;
export const { pool, db } = createDb(url);

export function makeApp(overrides: Partial<ServerConfig> = {}, aiProvider: AiProvider | null = null) {
  const config: ServerConfig = {
    ...loadConfig({}),
    databaseUrl: url,
    openaiApiKey: undefined,
    enableDemoEndpoints: true,
    aiRateLimitPerMin: 1000,
    ...overrides,
  };
  return supertest(createApp({ db, config, aiProvider, quiet: true }));
}

/** Every test starts from the exact seed state. */
export function useFreshDatabase() {
  beforeEach(async () => {
    await resetDemoData(db);
  });
  afterAll(async () => {
    await pool.end();
  });
}

export async function deviceByName(api: ReturnType<typeof makeApp>, name: string): Promise<Device> {
  const res = await api.get("/api/devices").expect(200);
  const device = (res.body as Device[]).find((d) => d.name === name);
  if (!device) throw new Error(`Seed device "${name}" not found`);
  return device;
}
