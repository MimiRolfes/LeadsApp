import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { logger as log } from "@humatter-leads/shared/logger";
import { corsOrigins } from "./env";
import { health } from "./routes/health";

/**
 * Baut die Hono-App. Alle Routen liegen unter `/api`, sodass das Frontend
 * `/api/*` unverändert an das Backend weiterreichen kann.
 *
 * Fachliche Endpunkte (Auth, Events, Leads, Sync, Export, …) kommen in
 * Phase 2. Bis dahin nur Health/Readiness.
 */
export function createApp(): Hono {
  const app = new Hono();

  app.use("*", secureHeaders());

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

  const api = new Hono();
  api.route("/health", health);
  app.route("/api", api);

  app.notFound((c) => c.json({ error: { code: "not_found" } }, 404));

  app.onError((err, c) => {
    // Keine Stacktraces/Secrets an den Client. Serverseitig ohne PII loggen.
    log.error("unhandled_error", { path: c.req.path, method: c.req.method });
    return c.json({ error: { code: "internal_error" } }, 500);
  });

  return app;
}
