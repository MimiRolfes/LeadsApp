import { serve } from "@hono/node-server";
import { logger as log } from "@humatter-leads/shared/logger";
import { createApp } from "./app";
import { getDb } from "./db/client";
import { env } from "./env";

/**
 * Backend-Entry. Bindet an 0.0.0.0:$PORT. Alle Werte kommen aus der Umgebung
 * (src/env.ts). Mit `DB_DRIVER=pglite` wird die eingebettete Datei-DB vor
 * dem Start initialisiert (lokale Entwicklung ohne Docker/Postgres).
 */
async function main() {
  if (env.DB_DRIVER === "pglite") {
    const { initDevDb } = await import("./db/dev");
    await initDevDb();
  }

  const app = createApp({ getDb });

  const server = serve(
    { fetch: app.fetch, port: env.PORT, hostname: "0.0.0.0" },
    (info) => {
      log.info("backend_listening", { port: info.port, db: env.DB_DRIVER });
    },
  );

  const shutdown = (signal: string) => {
    log.info("backend_shutdown", { signal });
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  log.error("backend_start_failed", {
    reason: err instanceof Error ? err.message : String(err),
  });
  process.exitCode = 1;
});
