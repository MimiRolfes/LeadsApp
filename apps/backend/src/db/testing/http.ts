import { createApp } from "../../app";
import type { TestDb } from "./pglite";

/**
 * Test-Helfer für HTTP-Flows gegen die Hono-App (mit PGlite).
 */
const PW = "correct-horse-battery-staple";
export const uuid = () => crypto.randomUUID();

export function makeClient(db: TestDb) {
  const app = createApp({ getDb: () => db });

  async function login(email: string): Promise<string> {
    await app.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: PW }),
    });
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: PW }),
    });
    return (res.headers.get("set-cookie") ?? "").split(";")[0]!;
  }

  function req(
    path: string,
    cookie: string,
    init: RequestInit & { json?: unknown } = {},
  ) {
    const { json, ...rest } = init;
    return app.request(path, {
      ...rest,
      headers: {
        cookie,
        ...(json !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  }

  async function setupEvent() {
    const mgr = await login(`mgr-${uuid()}@mindsewn.de`);
    const memberEmail = `mem-${uuid()}@mindsewn.de`;
    const member = await login(memberEmail);
    const { event } = (await (
      await req("/api/events", mgr, { method: "POST", json: { name: "Messe" } })
    ).json()) as { event: { id: string } };
    await req(`/api/events/${event.id}/members`, mgr, {
      method: "POST",
      json: { email: memberEmail, eventRole: "member" },
    });
    return { app, mgr, member, memberEmail, eventId: event.id };
  }

  return { app, login, req, setupEvent };
}
