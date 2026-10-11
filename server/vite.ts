import fs from "node:fs/promises";
import type { Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Express } from "express";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Development only: serves the client through Vite middleware with HMR on the same port. */
export async function attachVite(app: Express, server: Server) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    configFile: path.join(root, "vite.config.ts"),
    server: { middlewareMode: true, hmr: { server } },
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.get("/{*splat}", async (req, res, next) => {
    try {
      const template = await fs.readFile(path.join(root, "client", "index.html"), "utf-8");
      const html = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (err) {
      vite.ssrFixStacktrace(err as Error);
      next(err);
    }
  });
}
