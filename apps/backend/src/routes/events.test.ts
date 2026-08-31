import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { createTestDb, type TestDb } from "../db/testing/pglite";
import { users } from "../db/schema";
import { __resetRateLimit } from "../lib/rate-limit";

let db: TestDb;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  db = await createTestDb();
  app = createApp({ getDb: () => db });
});
afterAll(async () => {
  await db.$close();
});
beforeEach(() => __resetRateLimit());

const PW = "horse-staple-7";

async function registerAndLogin(email: string): Promise<string> {
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
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
}

describe("events & authz", () => {
  it("creator becomes manager; non-members cannot see the event", async () => {
    const mgr = await registerAndLogin("mgr1@mindsewn.de");
    const outsider = await registerAndLogin("out1@mindsewn.de");

    const created = await req("/api/events", mgr, {
      method: "POST",
      json: { name: "Messe A" },
    });
    expect(created.status).toBe(201);
    const { event } = (await created.json()) as { event: { id: string } };

    const mine = await req(`/api/events/${event.id}`, mgr);
    expect(mine.status).toBe(200);

    const denied = await req(`/api/events/${event.id}`, outsider);
    expect(denied.status).toBe(403);

    const list = await req("/api/events", outsider);
    expect(((await list.json()) as { events: unknown[] }).events).toHaveLength(
      0,
    );
  });

  it("only a manager can update the event or manage the team", async () => {
    const mgr = await registerAndLogin("mgr2@mindsewn.de");
    const member = await registerAndLogin("mem2@mindsewn.de");

    const { event } = (await (
      await req("/api/events", mgr, {
        method: "POST",
        json: { name: "Messe B" },
      })
    ).json()) as { event: { id: string } };

    // Mitglied hinzufügen
    const add = await req(`/api/events/${event.id}/members`, mgr, {
      method: "POST",
      json: { email: "mem2@mindsewn.de", eventRole: "member" },
    });
    expect(add.status).toBe(200);

    // Mitglied darf lesen, aber nicht verwalten
    expect((await req(`/api/events/${event.id}`, member)).status).toBe(200);
    const patch = await req(`/api/events/${event.id}`, member, {
      method: "PATCH",
      json: { status: "active" },
    });
    expect(patch.status).toBe(403);
    const addByMember = await req(`/api/events/${event.id}/members`, member, {
      method: "POST",
      json: { email: "x@mindsewn.de", eventRole: "member" },
    });
    expect(addByMember.status).toBe(403);

    // Manager darf
    const ok = await req(`/api/events/${event.id}`, mgr, {
      method: "PATCH",
      json: { status: "active" },
    });
    expect(ok.status).toBe(200);
    expect(
      ((await ok.json()) as { event: { status: string } }).event.status,
    ).toBe("active");
  });

  it("adding an unregistered person returns 404", async () => {
    const mgr = await registerAndLogin("mgr3@mindsewn.de");
    const { event } = (await (
      await req("/api/events", mgr, {
        method: "POST",
        json: { name: "Messe C" },
      })
    ).json()) as { event: { id: string } };
    const res = await req(`/api/events/${event.id}/members`, mgr, {
      method: "POST",
      json: { email: "ghost@mindsewn.de", eventRole: "member" },
    });
    expect(res.status).toBe(404);
  });

  it("question catalogue: select needs options, members can read", async () => {
    const mgr = await registerAndLogin("mgr4@mindsewn.de");
    const { event } = (await (
      await req("/api/events", mgr, {
        method: "POST",
        json: { name: "Messe D" },
      })
    ).json()) as { event: { id: string } };

    const bad = await req(`/api/events/${event.id}/questions`, mgr, {
      method: "POST",
      json: { prompt: "Größe?", type: "single_select" },
    });
    expect(bad.status).toBe(422);

    const good = await req(`/api/events/${event.id}/questions`, mgr, {
      method: "POST",
      json: {
        prompt: "Größe?",
        type: "single_select",
        options: [{ value: "s", label: "Klein" }],
        position: 1,
      },
    });
    expect(good.status).toBe(201);

    const list = await req(`/api/events/${event.id}/questions`, mgr);
    expect(
      ((await list.json()) as { questions: unknown[] }).questions,
    ).toHaveLength(1);
  });

  it("a platform admin sees every event", async () => {
    await registerAndLogin("boss@mindsewn.de");
    await db
      .update(users)
      .set({ globalRole: "admin" })
      .where(sql`lower(${users.email}) = 'boss@mindsewn.de'`);
    // neue Session nach Rollenwechsel
    const adminCookie = (
      (await app.request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "boss@mindsewn.de", password: PW }),
      })) as Response
    ).headers
      .get("set-cookie")!
      .split(";")[0]!;

    const other = await registerAndLogin("someone@mindsewn.de");
    await req("/api/events", other, {
      method: "POST",
      json: { name: "Fremdes Event" },
    });

    const list = await req("/api/events", adminCookie);
    const names = (
      (await list.json()) as { events: { name: string }[] }
    ).events.map((e) => e.name);
    expect(names).toContain("Fremdes Event");
  });
});
