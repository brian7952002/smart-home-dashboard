import express, { type ErrorRequestHandler, type Express } from "express";
import type { ApiErrorBody } from "../shared/types";
import { AiService } from "./ai/service";
import { createOpenAiProvider, type AiProvider } from "./ai/provider";
import type { ServerConfig } from "./config";
import type { Db } from "./db";
import { HttpError, pgErrorCode } from "./errors";
import { apiRouter } from "./routes";

export interface AppOptions {
  db: Db;
  config: ServerConfig;
  /** Overrides the OpenAI provider (tests). `null` forces fallback mode. */
  aiProvider?: AiProvider | null;
  quiet?: boolean;
}

export function createApp({ db, config, aiProvider, quiet }: AppOptions): Express {
  const provider =
    aiProvider !== undefined
      ? aiProvider
      : config.openaiApiKey
        ? createOpenAiProvider(config.openaiApiKey, config.openaiModel)
        : null;
  const ai = new AiService(provider);

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));

  // Request log: method, path, status, duration (and AI source). Never bodies.
  if (!quiet) {
    app.use("/api", (req, res, next) => {
      const start = performance.now();
      res.on("finish", () => {
        const ms = Math.round(performance.now() - start);
        const src = res.locals.aiSource ? ` source=${res.locals.aiSource}` : "";
        console.log(`${req.method} ${req.baseUrl}${req.path} ${res.statusCode} ${ms}ms${src}`);
      });
      next();
    });
  }

  app.use("/api", apiRouter({ db, config, ai }));

  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "Not found", code: "NOT_FOUND" } satisfies ApiErrorBody);
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) {
      const body: ApiErrorBody = { message: err.message };
      if (err.code) body.code = err.code;
      if (err.fieldErrors) body.fieldErrors = err.fieldErrors;
      res.status(err.status).json(body);
      return;
    }
    if (err?.type === "entity.parse.failed") {
      res.status(400).json({ message: "Request body must be valid JSON", code: "VALIDATION_ERROR" });
      return;
    }
    if (err?.type === "entity.too.large") {
      res.status(413).json({ message: "Request body is too large", code: "PAYLOAD_TOO_LARGE" });
      return;
    }
    const pg = pgErrorCode(err);
    if (pg === "23514" || pg === "23503" || pg === "22003") {
      res.status(400).json({ message: "The request violates a data rule", code: "VALIDATION_ERROR" });
      return;
    }
    console.error(`[server] unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  };
  app.use(onError);

  return app;
}
