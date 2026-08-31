import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import type { Db } from "./types";
import * as schema from "./schema";

/**
 * Wird von `initDevDb()` (src/db/dev.ts) gesetzt, wenn `DB_DRIVER=pglite`.
 * So bleibt PGlite ein reiner dynamischer Import (nicht im Prod-Bundle-Pfad).
 */
let devDb: Db | undefined;
export function __setDevDb(db: Db): void {
  devDb = db;
}

/**
 * Postgres-Verbindung + Drizzle-Query-Client.
 *
 * Alle Verbindungsparameter kommen aus der Umgebung (`DATABASE_URL`,
 * `DATABASE_SSL`). Nichts ist hier fest verdrahtet — dasselbe Modul läuft
 * lokal (Docker-Compose-Postgres) und später auf dem Hetzner-Server.
 *
 * Nur das Backend importiert dieses Modul. Lazy: die Verbindung wird erst
 * beim ersten Zugriff geöffnet.
 */

export type Database = ReturnType<typeof createDb>;

function resolveSsl(): postgres.Options<Record<string, never>>["ssl"] {
  switch (env.DATABASE_SSL) {
    case "require":
      return "require";
    case "no-verify":
      return { rejectUnauthorized: false };
    case "disable":
    default:
      return false;
  }
}

function createDb() {
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL ist nicht gesetzt. Siehe .env.example / docs/HETZNER_DEPLOYMENT.md.",
    );
  }
  const client = postgres(env.DATABASE_URL, {
    max: env.DATABASE_POOL_MAX,
    ssl: resolveSsl(),
    // keine Query-Parameter/Werte ins Log
    onnotice: () => {},
  });
  return drizzle(client, { schema });
}

let cached: Db | undefined;

export function getDb(): Db {
  if (env.DB_DRIVER === "pglite") {
    if (!devDb) {
      throw new Error(
        "PGlite-DB nicht initialisiert — initDevDb() muss vor dem ersten Request laufen.",
      );
    }
    return devDb;
  }
  if (!cached) {
    cached = createDb();
  }
  return cached;
}
