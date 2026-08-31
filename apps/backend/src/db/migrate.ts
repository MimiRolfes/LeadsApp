import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "../env";

/**
 * Migrations-Runner. Wird lokal (Host/Container) und in Produktion identisch aufgerufen:
 *
 *   npm run db:migrate
 *
 * Wendet alle noch nicht angewendeten SQL-Migrationen aus
 * `src/server/db/migrations` an. Idempotent — bereits angewendete
 * Migrationen werden übersprungen (drizzle führt eine Journal-Tabelle).
 */
const MIGRATIONS_FOLDER = new URL("./migrations", import.meta.url).pathname;

async function main() {
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL ist nicht gesetzt. Siehe .env.example / docs/HETZNER_DEPLOYMENT.md.",
    );
  }

  const ssl =
    env.DATABASE_SSL === "require"
      ? "require"
      : env.DATABASE_SSL === "no-verify"
        ? { rejectUnauthorized: false }
        : false;

  const sql = postgres(env.DATABASE_URL, { max: 1, ssl });
  try {
    const db = drizzle(sql);
    // eslint-disable-next-line no-console
    console.log("Applying database migrations …");
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    // eslint-disable-next-line no-console
    console.log("Migrations up to date.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(
    "Migration failed:",
    err instanceof Error ? err.message : String(err),
  );
  process.exitCode = 1;
});
