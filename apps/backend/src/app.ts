import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { logger as log } from "@humatter-leads/shared/logger";
import { corsOrigins, env } from "./env";
import type { Db } from "./db/types";
import type { AppEnv } from "./types";
import { sessionMiddleware } from "./auth/middleware";
import { auth } from "./routes/auth";
import { eventsRoutes } from "./routes/events";
import { leadRoutes } from "./routes/leads";
import { followupRoutes } from "./routes/followups";
import { syncRoutes } from "./routes/sync";
import { createHealthRoutes } from "./routes/health";
import { ApiError, errors, toErrorResponse } from "./lib/errors";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Baut die Hono-App. Alle Routen liegen unter `/api`, sodass das Frontend
 * `/api/*` unverändert an das Backend weiterreichen kann.
 */
export function createApp(deps: {
  /** Lazy: erst beim ersten Bedarf aufgerufen — der Server startet ohne DB. */
  getDb: () => Db;
}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", secureHeaders());

  // Liveness: vor allem anderen, kein DB-/Session-Zugriff (Docker HEALTHCHECK).
  app.route("/api/health", createHealthRoutes(deps.getDb));

  const origins = corsOrigins();
  if (origins.length > 0) {
    app.use(
      "/api/*",
      cors({
        origin: origins,
        credentials: true,
        allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      }),
    );
  }

  // CSRF-Schutz: state-changing Requests aus dem Browser müssen von einer
  // erlaubten Origin kommen. Requests ohne Origin-Header (Server-zu-Server,
  // CLI) tragen keine ambient Cookies aus einem fremden Kontext.
  const allowedOrigins = new Set([env.APP_ORIGIN, ...origins]);
  app.use("/api/*", async (c, next) => {
    if (UNSAFE_METHODS.has(c.req.method)) {
      const origin = c.req.header("origin");
      if (origin && !allowedOrigins.has(origin)) {
        throw errors.forbidden("bad_origin", "Ungültige Herkunft der Anfrage.");
      }
    }
    await next();
  });

  // Ab hier ist die DB erforderlich. Fällt sie aus → 503 statt 500.
  app.use("/api/*", async (c, next) => {
    try {
      c.set("db", deps.getDb());
    } catch {
      log.error("db_unavailable", { path: c.req.path });
      return c.json({ error: { code: "service_unavailable" } }, 503);
    }
    await next();
  });

  app.use("/api/*", sessionMiddleware());

  const api = new Hono<AppEnv>();
  api.route("/auth", auth);
  api.route("/events", eventsRoutes);
  api.route("/leads", leadRoutes);
  api.route("/followups", followupRoutes);
  api.route("/sync", syncRoutes);
  app.route("/api", api);

  app.notFound((c) => c.json({ error: { code: "not_found" } }, 404));

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return toErrorResponse(c, err);
    }
    // Keine Stacktraces/Secrets an den Client. Serverseitig ohne PII loggen.
    log.error("unhandled_error", { path: c.req.path, method: c.req.method });
    return c.json({ error: { code: "internal_error" } }, 500);
  });

  return app;
}
