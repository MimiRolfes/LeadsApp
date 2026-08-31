import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import { seed } from "./seed-data";

/**
 * CLI-Wrapper für den Entwicklungs-Seed.
 *
 *   npm run db:seed
 *
 * Nutzt ausschließlich fiktive Daten (siehe seed-data.ts). In Produktion
 * nur mit SEED_ALLOW=true.
 */
async function main() {
  if (env.NODE_ENV === "production" && !env.SEED_ALLOW) {
    throw new Error(
      "Seed in Produktion blockiert. Setze SEED_ALLOW=true, wenn wirklich gewollt.",
    );
  }

  if (env.DB_DRIVER === "pglite") {
    const { initDevDb } = await import("./dev");
    await seed(await initDevDb());
    // eslint-disable-next-line no-console
    console.log("Seed complete (PGlite, fictional data).");
    return;
  }

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
    await seed(drizzle(sql));
    // eslint-disable-next-line no-console
    console.log("Seed complete (fictional data).");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(
    "Seed failed:",
    err instanceof Error ? err.message : String(err),
  );
  process.exitCode = 1;
});
