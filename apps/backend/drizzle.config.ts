import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit erzeugt aus `src/db/schema` versionierte SQL-Migrationen unter
 * `src/db/migrations`. Ausgeführt werden sie vom Runner `src/db/migrate.ts`
 * (nicht von drizzle-kit) — derselbe Weg lokal wie in Produktion.
 *
 * `DATABASE_URL` wird nur für `drizzle-kit push`/`studio` benötigt und kommt
 * ausschließlich aus der Umgebung.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
