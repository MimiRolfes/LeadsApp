import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { getDb } from "../db/client";

/**
 * Liveness + Readiness. Bewusst ohne Auth und ohne PII.
 * - GET /api/health        → Prozess läuft (für Docker HEALTHCHECK)
 * - GET /api/health/ready   → zusätzlich DB erreichbar (für Rollout-Gate)
 */
export const health = new Hono();

health.get("/", (c) => c.json({ status: "ok", ts: new Date().toISOString() }));

health.get("/ready", async (c) => {
  try {
    await getDb().execute(sql`select 1`);
    return c.json({ status: "ready", ts: new Date().toISOString() });
  } catch {
    return c.json({ status: "unavailable", reason: "database" }, 503);
  }
});
