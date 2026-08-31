import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { env } from "../env";
import type { AppEnv } from "../types";
import { errors } from "../lib/errors";
import { buildAuthCtx } from "../authz";
import { validateSession } from "./session";

/**
 * Liest das Session-Cookie und hängt `user`/`session` an den Kontext, wenn
 * gültig. Lehnt nichts ab — dafür ist `requireAuth` zuständig.
 * Erwartet, dass `db` bereits im Kontext gesetzt ist (siehe app.ts).
 */
export function sessionMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = getCookie(c, env.SESSION_COOKIE_NAME);
    if (token) {
      const result = await validateSession(c.get("db"), token);
      if (result) {
        c.set("user", result.user);
        c.set("session", result.session);
      }
    }
    await next();
  };
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("user")) {
    throw errors.unauthorized("auth_required", "Anmeldung erforderlich.");
  }
  await next();
};

/**
 * `requireAuth` + baut den Autorisierungs-Kontext (Event-Mitgliedschaften)
 * und legt ihn als `c.get("authz")` ab. Für alle fachlichen Routen.
 */
export const requireAuthz: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user");
  if (!user) {
    throw errors.unauthorized("auth_required", "Anmeldung erforderlich.");
  }
  c.set("authz", await buildAuthCtx(c.get("db"), user));
  await next();
};
