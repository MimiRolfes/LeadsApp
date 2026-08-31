import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../schema";

const MIGRATIONS_FOLDER = new URL("../migrations", import.meta.url).pathname;

export type TestDb = ReturnType<typeof drizzle<typeof schema>> & {
  $close: () => Promise<void>;
};

/**
 * Erzeugt eine frische, migrierte In-Memory-Postgres-Instanz (PGlite, WASM).
 * Verwendet dieselben versionierten SQL-Migrationen wie in Produktion.
 * Kein Docker, kein Daemon — nur für Tests.
 */
export async function createTestDb(): Promise<TestDb> {
  const pg = new PGlite();
  const db = drizzle(pg, { schema }) as TestDb;
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  db.$close = () => pg.close();
  return db;
}
