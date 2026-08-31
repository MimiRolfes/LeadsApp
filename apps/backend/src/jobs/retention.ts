import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { logger as log } from "@humatter-leads/shared/logger";
import { env } from "../env";
import { runRetention } from "../domain/retention";

/**
 * CLI-Wrapper für den Retention-Lauf. Als Cron / Compose-Job aufrufen:
 *   npm run db:retention
 * Nutzt eine DB-Rolle mit DELETE-Rechten (nicht die reine App-Rolle).
 */
async function main() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL ist nicht gesetzt. Siehe .env.example.");
  }
  const ssl =
    env.DATABASE_SSL === "require"
      ? "require"
      : env.DATABASE_SSL === "no-verify"
        ? { rejectUnauthorized: false }
        : false;
  const sql = postgres(env.DATABASE_URL, { max: 1, ssl });
  try {
    const summary = await runRetention(drizzle(sql));
    log.info("retention_complete", { ...summary });
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  log.error("retention_failed", {
    reason: err instanceof Error ? err.message : String(err),
  });
  process.exitCode = 1;
});
