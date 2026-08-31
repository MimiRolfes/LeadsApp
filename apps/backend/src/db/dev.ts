import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { logger as log } from "@humatter-leads/shared/logger";
import { env } from "../env";
import { __setDevDb } from "./client";
import type { Db } from "./types";
import * as schema from "./schema";

/**
 * Eingebettete Datei-Datenbank für lokale Entwicklung ohne Docker/Postgres
 * (`DB_DRIVER=pglite`). Persistiert nach `PGLITE_DIR`, wendet dieselben
 * versionierten Migrationen an wie die echte DB. Niemals in Produktion.
 *
 * Dieses Modul wird nur dynamisch importiert (server.ts / seed.ts), damit
 * PGlite nicht im Produktions-Bundle-Pfad landet.
 */
const MIGRATIONS = new URL("./migrations", import.meta.url).pathname;

let devDb: Db | undefined;

export async function initDevDb(): Promise<Db> {
  if (devDb) return devDb;
  mkdirSync(env.PGLITE_DIR, { recursive: true });
  const pg = new PGlite(env.PGLITE_DIR);
  const db = drizzle(pg, { schema }) as unknown as Db;
  await migrate(db as never, { migrationsFolder: MIGRATIONS });
  log.warn("dev_db_pglite", { dir: env.PGLITE_DIR });
  devDb = db;
  __setDevDb(db);
  return db;
}
