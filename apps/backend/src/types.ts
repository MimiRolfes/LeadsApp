import type { HttpBindings } from "@hono/node-server";
import type { Db } from "./db/types";
import type { SessionRow, UserRow } from "./auth/session";
import type { AuthCtx } from "./authz";

/**
 * Hono-Umgebungstyp der App. `Bindings` = node-server (für Client-IP),
 * `Variables` = pro Request injizierter DB-Handle + optionaler Auth-Kontext.
 */
export type AppEnv = {
  Bindings: HttpBindings;
  Variables: {
    db: Db;
    user?: UserRow;
    session?: SessionRow;
    /** Autorisierungs-Kontext, von `requireAuthz` gesetzt. */
    authz?: AuthCtx;
  };
};
