import type { PgDatabase } from "drizzle-orm/pg-core";

/**
 * Loser Drizzle-DB-Typ, den sowohl der postgres-js-Client (Produktion) als
 * auch PGlite (Tests) erfüllen. Services nehmen `Db` als Parameter
 * (Dependency Injection) und sind so ohne echte DB testbar.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, any, any>;
