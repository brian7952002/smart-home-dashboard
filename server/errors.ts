import type { ZodError, ZodType, z } from "zod";
import { idParamSchema } from "../shared/validation";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`, "NOT_FOUND");

export const badRequest = (message: string, code = "VALIDATION_ERROR", fieldErrors?: Record<string, string>) =>
  new HttpError(400, message, code, fieldErrors);

function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    out[key] ??= issue.message;
  }
  return out;
}

export function parseBody<S extends ZodType>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const fieldErrors = fieldErrorsFrom(result.error);
    const first = Object.values(fieldErrors)[0] ?? "Invalid request";
    throw badRequest(first, "VALIDATION_ERROR", fieldErrors);
  }
  return result.data;
}

export function parseId(raw: unknown, label = "id"): number {
  const result = idParamSchema.safeParse(raw);
  if (!result.success || !/^\d+$/.test(String(raw))) {
    throw badRequest(`Invalid ${label}`, "INVALID_ID");
  }
  return result.data;
}

/** Postgres error codes we translate into client errors. */
export function pgErrorCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err && typeof err.code === "string") return err.code;
  const cause = err && typeof err === "object" && "cause" in err ? err.cause : undefined;
  if (cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string") return cause.code;
  return undefined;
}
