import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { createTestDb, type TestDb } from "../db/testing/pglite";
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

const PW = "correct-horse-battery-staple";

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

const uuid = () => crypto.randomUUID();

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
  return { mgr, member, memberEmail, eventId: event.id };
}

describe("leads", () => {
  it("captures a lead, then replays idempotently on the same clientLocalId", async () => {
    const { member, eventId } = await setupEvent();
    const clientLocalId = uuid();
    const payload = {
      clientLocalId,
      lastName: "Mustermann",
      company: "Beispiel GmbH",
      email: "erika@beispiel.test",
      priority: "hot",
      tags: ["Hiring"],
      note: "Demo gewünscht",
    };

    const first = await req(`/api/events/${eventId}/leads`, member, {
      method: "POST",
      json: payload,
    });
    expect(first.status).toBe(201);
    const a = (await first.json()) as { lead: { id: string } };

    const replay = await req(`/api/events/${eventId}/leads`, member, {
      method: "POST",
      json: payload,
    });
    expect(replay.status).toBe(200);
    const b = (await replay.json()) as { lead: { id: string } };
    expect(b.lead.id).toBe(a.lead.id);
  });

  it("flags a duplicate by email and accepts it when allowDuplicate is set", async () => {
    const { member, eventId } = await setupEvent();
    await req(`/api/events/${eventId}/leads`, member, {
      method: "POST",
      json: {
        clientLocalId: uuid(),
        email: "dup@beispiel.test",
        lastName: "A",
      },
    });

    const dup = await req(`/api/events/${eventId}/leads`, member, {
      method: "POST",
      json: {
        clientLocalId: uuid(),
        email: "dup@beispiel.test",
        lastName: "B",
      },
    });
    expect(dup.status).toBe(409);
    const body = (await dup.json()) as {
      error: { code: string };
      candidates: unknown[];
    };
    expect(body.error.code).toBe("duplicate_found");
    expect(body.candidates.length).toBe(1);

    const forced = await req(`/api/events/${eventId}/leads`, member, {
      method: "POST",
      json: {
        clientLocalId: uuid(),
        email: "dup@beispiel.test",
        lastName: "B",
        allowDuplicate: true,
      },
    });
    expect(forced.status).toBe(201);
  });

  it("members see only their own leads; the manager sees all", async () => {
    const { mgr, member, eventId } = await setupEvent();
    await req(`/api/events/${eventId}/leads`, member, {
      method: "POST",
      json: { clientLocalId: uuid(), lastName: "MemberLead" },
    });
    await req(`/api/events/${eventId}/leads`, mgr, {
      method: "POST",
      json: { clientLocalId: uuid(), lastName: "MgrLead" },
    });

    const memberList = (await (
      await req(`/api/events/${eventId}/leads`, member)
    ).json()) as { leads: { lastName: string }[]; total: number };
    expect(memberList.leads.map((l) => l.lastName)).toEqual(["MemberLead"]);

    const mgrList = (await (
      await req(`/api/events/${eventId}/leads`, mgr)
    ).json()) as { total: number };
    expect(mgrList.total).toBe(2);
  });

  it("optimistic locking: stale expectedVersion is rejected", async () => {
    const { member, eventId } = await setupEvent();
    const created = (await (
      await req(`/api/events/${eventId}/leads`, member, {
        method: "POST",
        json: { clientLocalId: uuid(), lastName: "Lock" },
      })
    ).json()) as { lead: { id: string; version: number } };

    const stale = await req(`/api/leads/${created.lead.id}`, member, {
      method: "PATCH",
      json: { expectedVersion: 99, priority: "warm" },
    });
    expect(stale.status).toBe(409);

    const ok = await req(`/api/leads/${created.lead.id}`, member, {
      method: "PATCH",
      json: { expectedVersion: 1, priority: "warm" },
    });
    expect(ok.status).toBe(200);
    expect(
      ((await ok.json()) as { lead: { version: number } }).lead.version,
    ).toBe(2);
  });

  it("a member cannot view a colleague's lead", async () => {
    const { mgr, eventId } = await setupEvent();
    const otherEmail = `other-${uuid()}@mindsewn.de`;
    const other = await login(otherEmail);
    await req(`/api/events/${eventId}/members`, mgr, {
      method: "POST",
      json: { email: otherEmail, eventRole: "member" },
    });

    const mgrLead = (await (
      await req(`/api/events/${eventId}/leads`, mgr, {
        method: "POST",
        json: { clientLocalId: uuid(), lastName: "Secret" },
      })
    ).json()) as { lead: { id: string } };

    const res = await req(`/api/leads/${mgrLead.lead.id}`, other);
    expect(res.status).toBe(403);
  });

  it("soft-deletes a lead", async () => {
    const { member, eventId } = await setupEvent();
    const created = (await (
      await req(`/api/events/${eventId}/leads`, member, {
        method: "POST",
        json: { clientLocalId: uuid(), lastName: "Bye" },
      })
    ).json()) as { lead: { id: string } };

    expect(
      (await req(`/api/leads/${created.lead.id}`, member, { method: "DELETE" }))
        .status,
    ).toBe(204);
    expect((await req(`/api/leads/${created.lead.id}`, member)).status).toBe(
      404,
    );
  });

  it("returns lead detail with notes and tags", async () => {
    const { member, eventId } = await setupEvent();
    const created = (await (
      await req(`/api/events/${eventId}/leads`, member, {
        method: "POST",
        json: {
          clientLocalId: uuid(),
          lastName: "Detail",
          tags: ["Enterprise", "Hiring"],
          note: "erste Notiz",
        },
      })
    ).json()) as { lead: { id: string } };

    const detail = (await (
      await req(`/api/leads/${created.lead.id}`, member)
    ).json()) as { tags: string[]; notes: unknown[] };
    expect(detail.tags.sort()).toEqual(["Enterprise", "Hiring"]);
    expect(detail.notes).toHaveLength(1);
  });
});
