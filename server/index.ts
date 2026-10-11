import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { assertDatabaseReady, createDb } from "./db";
import { seedIfEmpty } from "./seed";

async function main() {
  const config = loadConfig();
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env, or set it in the environment.");
  }
  const { pool, db } = createDb(config.databaseUrl);
  await assertDatabaseReady(pool);
  if (config.seedOnStart && (await seedIfEmpty(db))) console.log("[db] seeded demo data");

  const app = createApp({ db, config });
  // Create the HTTP server first (Vite's HMR needs it), but only listen once every route is attached.
  const server = http.createServer(app);
  server.on("error", (err) => {
    console.error(`[server] ${err.message}`);
    process.exit(1);
  });

  if (config.nodeEnv === "development") {
    // Imported lazily so the production bundle never loads Vite.
    const { attachVite } = await import("./vite");
    await attachVite(app, server);
  } else {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const publicDir = path.resolve(here, "public");
    if (!fs.existsSync(path.join(publicDir, "index.html"))) {
      throw new Error(`Client build not found at ${publicDir}. Run "npm run build" first.`);
    }
    app.use(express.static(publicDir, { index: false, maxAge: "1h" }));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(publicDir, "index.html"));
    });
  }

  server.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port} (${config.nodeEnv})`);
    console.log(
      `[server] AI: ${config.openaiApiKey ? `OpenAI ${config.openaiModel}` : "offline guidance only"}; demo endpoints: ${config.enableDemoEndpoints ? "on" : "off"}`,
    );
  });

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(() => void pool.end().finally(() => process.exit(0)));
    // Keep-alive and HMR sockets would otherwise hold the process open (and block tsx watch restarts).
    server.closeAllConnections();
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(`[server] startup failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
