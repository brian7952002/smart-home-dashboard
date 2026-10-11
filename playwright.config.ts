import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const PORT = 5055;
const testDb = process.env.TEST_DATABASE_URL;
if (!testDb) throw new Error("TEST_DATABASE_URL is not set. See .env.example.");

/** Runs against the production build (`npm run test:e2e` builds first) on the test database. */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1, // one shared database
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "node dist/index.js",
    url: `http://localhost:${PORT}/api/config`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NODE_ENV: "production",
      PORT: String(PORT),
      DATABASE_URL: testDb,
      OPENAI_API_KEY: "",
      ENABLE_DEMO_ENDPOINTS: "true",
      SEED_ON_START: "true",
      AI_RATE_LIMIT_PER_MIN: "1000",
    },
  },
});
