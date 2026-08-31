import { Hono, type Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { LoginInputSchema, RegisterInputSchema } from "@humatter-leads/shared";
import { env, sessionCookieSecure } from "../env";
import type { AppEnv } from "../types";
import { requireAuth } from "../auth/middleware";
import { authenticateUser, registerUser, toCurrentUser } from "../auth/service";
import {
  createSession,
  revokeAllSessionsForUser,
  revokeSession,
} from "../auth/session";
import { clientIp, rateLimit } from "../lib/rate-limit";
import { onInvalid } from "../lib/validation";

/**
 * Selbstregistrierung + Anmeldung.
 *   POST /api/auth/register   E-Mail (erlaubte Domain) + Passwort
 *   POST /api/auth/login      E-Mail + Passwort
 *   POST /api/auth/logout     aktuelle Session beenden
 *   POST /api/auth/logout-all von allen Geräten abmelden
 *   GET  /api/auth/me         aktueller Nutzer
 */
export const auth = new Hono<AppEnv>();

function setSessionCookie(c: Context<AppEnv>, token: string): void {
  setCookie(c, env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: sessionCookieSecure(),
    sameSite: "Lax",
    path: "/",
    maxAge: env.SESSION_ABSOLUTE_TTL_HOURS * 3600,
  });
}

auth.post(
  "/register",
  rateLimit({ name: "auth:register", windowSeconds: 3600, max: 10 }),
  zValidator("json", RegisterInputSchema, onInvalid),
  async (c) => {
    const db = c.get("db");
    const ip = clientIp(c);
    const user = await registerUser(db, c.req.valid("json"), { ip });
    const { token } = await createSession(db, {
      userId: user.id,
      ip,
      userAgent: c.req.header("user-agent") ?? null,
    });
    setSessionCookie(c, token);
    return c.json({ user: toCurrentUser(user) }, 201);
  },
);

auth.post(
  "/login",
  rateLimit({ name: "auth:login", windowSeconds: 900, max: 10 }),
  zValidator("json", LoginInputSchema, onInvalid),
  async (c) => {
    const db = c.get("db");
    const ip = clientIp(c);
    const user = await authenticateUser(db, c.req.valid("json"), { ip });
    const { token } = await createSession(db, {
      userId: user.id,
      ip,
      userAgent: c.req.header("user-agent") ?? null,
    });
    setSessionCookie(c, token);
    return c.json({ user: toCurrentUser(user) });
  },
);

auth.post("/logout", requireAuth, async (c) => {
  const session = c.get("session")!;
  await revokeSession(c.get("db"), session.id);
  deleteCookie(c, env.SESSION_COOKIE_NAME, { path: "/" });
  return c.body(null, 204);
});

auth.post("/logout-all", requireAuth, async (c) => {
  const user = c.get("user")!;
  await revokeAllSessionsForUser(c.get("db"), user.id);
  deleteCookie(c, env.SESSION_COOKIE_NAME, { path: "/" });
  return c.body(null, 204);
});

auth.get("/me", requireAuth, (c) => {
  return c.json({ user: toCurrentUser(c.get("user")!) });
});
