import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { SyncPushSchema } from "@humatter-leads/shared";
import type { AppEnv } from "../types";
import { requireAuthz } from "../auth/middleware";
import { processSync } from "../domain/sync";
import { clientIp, rateLimit } from "../lib/rate-limit";
import { onInvalid } from "../lib/validation";

/**
 * Offline-Sync-Warteschlange (ADR 0003).
 *   POST /api/sync   { operations: [...] }  → { results: [...] }
 * Idempotent auf Operationsebene (lead.create über clientLocalId).
 */
export const syncRoutes = new Hono<AppEnv>();

syncRoutes.use("*", requireAuthz);

syncRoutes.post(
  "/",
  rateLimit({ name: "sync", windowSeconds: 60, max: 30 }),
  zValidator("json", SyncPushSchema, onInvalid),
  async (c) => {
    const results = await processSync(
      c.get("db"),
      c.get("authz")!,
      c.req.valid("json").operations,
      clientIp(c),
    );
    return c.json({ results });
  },
);
