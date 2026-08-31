import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * Strukturierter API-Fehler. Kein Stacktrace, kein SQL, keine Secrets im
 * Client-Body. `message` ist bewusst allgemein gehalten.
 */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message?: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

export const errors = {
  badRequest: (code = "bad_request", message?: string) =>
    new ApiError(400, code, message),
  unauthorized: (code = "unauthorized", message?: string) =>
    new ApiError(401, code, message),
  forbidden: (code = "forbidden", message?: string) =>
    new ApiError(403, code, message),
  notFound: (code = "not_found", message?: string) =>
    new ApiError(404, code, message),
  conflict: (code = "conflict", message?: string) =>
    new ApiError(409, code, message),
  tooManyRequests: (message?: string) =>
    new ApiError(429, "rate_limited", message),
  validation: (fields: Record<string, string[]>) =>
    new ApiError(422, "validation_error", "Eingabe ungültig.", fields),
};

export function toErrorResponse(c: Context, err: unknown): Response {
  if (err instanceof ApiError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.fields ? { fields: err.fields } : {}),
        },
      },
      err.status,
    );
  }
  return c.json({ error: { code: "internal_error" } }, 500);
}
