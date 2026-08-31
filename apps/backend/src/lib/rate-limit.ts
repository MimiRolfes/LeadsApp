import type { Context, MiddlewareHandler } from "hono";
import { env } from "../env";
import type { AppEnv } from "../types";
import { errors } from "./errors";

/**
 * Einfaches In-Memory-Fixed-Window-Rate-Limiting.
 *
 * Bewusste Grenzen (MVP, ein Backend-Container):
 * - Zähler leben im Prozess → Reset bei Neustart, nicht über Replikas geteilt.
 *   Für mehrere Instanzen später auf einen gemeinsamen Store (z. B. Redis)
 *   umstellen. Die Middleware-Schnittstelle bleibt gleich.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function clientIp(c: Context<AppEnv>): string {
  if (env.TRUST_PROXY) {
    const fwd = c.req.header("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    const real = c.req.header("x-real-ip");
    if (real) return real.trim();
  }
  return c.env?.incoming?.socket?.remoteAddress ?? "unknown";
}

export function rateLimit(options?: {
  windowSeconds?: number;
  max?: number;
  name?: string;
}): MiddlewareHandler<AppEnv> {
  const windowMs =
    (options?.windowSeconds ?? env.RATE_LIMIT_WINDOW_SECONDS) * 1000;
  const max = options?.max ?? env.RATE_LIMIT_MAX_REQUESTS;
  const name = options?.name ?? "default";

  return async (c, next) => {
    const key = `${name}:${clientIp(c)}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    c.header("RateLimit-Limit", String(max));
    c.header("RateLimit-Remaining", String(remaining));
    c.header(
      "RateLimit-Reset",
      String(Math.ceil((bucket.resetAt - now) / 1000)),
    );

    if (bucket.count > max) {
      throw errors.tooManyRequests("Zu viele Anfragen. Bitte später erneut.");
    }
    await next();
  };
}

/** Nur für Tests: alle Zähler zurücksetzen. */
export function __resetRateLimit(): void {
  buckets.clear();
}
