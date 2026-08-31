import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../db/testing/pglite";
import { makeClient, uuid } from "../db/testing/http";
import { __resetRateLimit } from "../lib/rate-limit";

let db: TestDb;
let client: ReturnType<typeof makeClient>;

beforeAll(async () => {
  db = await createTestDb();
  client = makeClient(db);
});
afterAll(async () => {
  await db.$close();
});
beforeEach(() => __resetRateLimit());

async function makeLead(cookie: string, eventId: string) {
  const res = await client.req(`/api/events/${eventId}/leads`, cookie, {
    method: "POST",
    json: { clientLocalId: uuid(), lastName: "L" },
  });
  return ((await res.json()) as { lead: { id: string } }).lead.id;
}

const yesterday = () =>
  new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

describe("follow-ups", () => {
  it("creates a follow-up on a lead and lists it", async () => {
    const { member, eventId } = await client.setupEvent();
    const leadId = await makeLead(member, eventId);

    const created = await client.req(`/api/leads/${leadId}/followups`, member, {
      method: "POST",
      json: { dueOn: yesterday(), note: "nachfassen" },
    });
    expect(created.status).toBe(201);

    const list = await client.req(
      `/api/events/${eventId}/followups?due=overdue`,
      member,
    );
    const body = (await list.json()) as { followups: unknown[] };
    expect(body.followups).toHaveLength(1);
  });

  it("marking a follow-up done sets completedAt", async () => {
    const { member, eventId } = await client.setupEvent();
    const leadId = await makeLead(member, eventId);
    const fu = (await (
      await client.req(`/api/leads/${leadId}/followups`, member, {
        method: "POST",
        json: {},
      })
    ).json()) as { followup: { id: string } };

    const done = await client.req(`/api/followups/${fu.followup.id}`, member, {
      method: "PATCH",
      json: { status: "done" },
    });
    expect(done.status).toBe(200);
    const body = (await done.json()) as {
      followup: { status: string; completedAt: string | null };
    };
    expect(body.followup.status).toBe("done");
    expect(body.followup.completedAt).not.toBeNull();
  });

  it("members only see their own follow-ups; managers see all", async () => {
    const { mgr, member, eventId } = await client.setupEvent();
    const memberLead = await makeLead(member, eventId);
    await client.req(`/api/leads/${memberLead}/followups`, member, {
      method: "POST",
      json: {},
    });
    const mgrLead = await makeLead(mgr, eventId);
    await client.req(`/api/leads/${mgrLead}/followups`, mgr, {
      method: "POST",
      json: {},
    });

    const asMember = (await (
      await client.req(`/api/events/${eventId}/followups`, member)
    ).json()) as { followups: unknown[] };
    expect(asMember.followups).toHaveLength(1);

    const asMgr = (await (
      await client.req(`/api/events/${eventId}/followups`, mgr)
    ).json()) as { followups: unknown[] };
    expect(asMgr.followups).toHaveLength(2);
  });

  it("only a manager can create follow-up templates", async () => {
    const { mgr, member, eventId } = await client.setupEvent();
    const denied = await client.req(
      `/api/events/${eventId}/followup-templates`,
      member,
      { method: "POST", json: { name: "Danke", body: "Text" } },
    );
    expect(denied.status).toBe(403);

    const ok = await client.req(
      `/api/events/${eventId}/followup-templates`,
      mgr,
      { method: "POST", json: { name: "Danke", body: "Text" } },
    );
    expect(ok.status).toBe(201);

    const list = (await (
      await client.req(`/api/events/${eventId}/followup-templates`, member)
    ).json()) as { templates: unknown[] };
    expect(list.templates).toHaveLength(1);
  });
});
