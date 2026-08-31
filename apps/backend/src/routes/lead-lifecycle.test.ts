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

async function makeLead(
  cookie: string,
  eventId: string,
  body: Record<string, unknown>,
) {
  const res = await client.req(`/api/events/${eventId}/leads`, cookie, {
    method: "POST",
    json: { clientLocalId: uuid(), ...body },
  });
  return ((await res.json()) as { lead: { id: string } }).lead.id;
}

describe("merge", () => {
  it("absorbs notes and tags into the surviving lead and hides the merged one", async () => {
    const { mgr, eventId } = await client.setupEvent();
    const survivor = await makeLead(mgr, eventId, {
      lastName: "Keep",
      tags: ["A"],
      note: "n1",
    });
    const dupe = await makeLead(mgr, eventId, {
      lastName: "Drop",
      company: "DupCo",
      tags: ["B"],
      note: "n2",
    });

    const res = await client.req(`/api/leads/${survivor}/merge`, mgr, {
      method: "POST",
      json: { mergedLeadId: dupe, takeFields: ["company"] },
    });
    expect(res.status).toBe(200);

    const detail = (await (
      await client.req(`/api/leads/${survivor}`, mgr)
    ).json()) as {
      lead: { company: string };
      notes: unknown[];
      tags: string[];
    };
    expect(detail.lead.company).toBe("DupCo");
    expect(detail.notes).toHaveLength(2);
    expect(detail.tags.sort()).toEqual(["A", "B"]);

    expect((await client.req(`/api/leads/${dupe}`, mgr)).status).toBe(404);
  });

  it("a member cannot merge", async () => {
    const { mgr, member, eventId } = await client.setupEvent();
    const a = await makeLead(member, eventId, { lastName: "A" });
    const b = await makeLead(mgr, eventId, { lastName: "B" });
    const res = await client.req(`/api/leads/${a}/merge`, member, {
      method: "POST",
      json: { mergedLeadId: b },
    });
    expect(res.status).toBe(403);
  });
});

describe("export", () => {
  it("returns a CSV with a formula-injection guard; members are denied", async () => {
    const { mgr, member, eventId } = await client.setupEvent();
    await makeLead(mgr, eventId, { lastName: "Norm", company: "OK GmbH" });
    await makeLead(mgr, eventId, { lastName: "Evil", company: "=cmd()" });

    const denied = await client.req(`/api/events/${eventId}/exports`, member, {
      method: "POST",
      json: { format: "csv" },
    });
    expect(denied.status).toBe(403);

    const res = await client.req(`/api/events/${eventId}/exports`, mgr, {
      method: "POST",
      json: { format: "csv", fields: ["lastName", "company"] },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const text = await res.text();
    expect(text.split("\r\n")[0]).toBe("lastName,company");
    expect(text).toContain("'=cmd()");
  });

  it("returns JSON when requested", async () => {
    const { mgr, eventId } = await client.setupEvent();
    await makeLead(mgr, eventId, { lastName: "J" });
    const res = await client.req(`/api/events/${eventId}/exports`, mgr, {
      method: "POST",
      json: { format: "json", fields: ["lastName"] },
    });
    const data = (await res.json()) as Array<{ lastName: string }>;
    expect(data[0]!.lastName).toBe("J");
  });
});

describe("GDPR subject rights", () => {
  it("returns the full data set, then anonymizes, then erases", async () => {
    const { mgr, eventId } = await client.setupEvent();
    const leadId = await makeLead(mgr, eventId, {
      firstName: "Erika",
      lastName: "Mustermann",
      email: "erika@x.test",
      note: "vertraulich",
      legalBasis: "consent",
    });

    const data = (await (
      await client.req(`/api/leads/${leadId}/data`, mgr)
    ).json()) as { lead: { email: string }; notes: unknown[] };
    expect(data.lead.email).toBe("erika@x.test");
    expect(data.notes).toHaveLength(1);

    expect(
      (
        await client.req(`/api/leads/${leadId}/delete`, mgr, {
          method: "POST",
          json: { mode: "anonymize" },
        })
      ).status,
    ).toBe(204);

    const anon = (await (
      await client.req(`/api/leads/${leadId}`, mgr)
    ).json()) as {
      lead: {
        firstName: string | null;
        company: string;
        legalBasis: string;
        anonymizedAt: string | null;
      };
      notes: unknown[];
    };
    expect(anon.lead.firstName).toBeNull();
    expect(anon.lead.company).toBe("anonymisiert");
    expect(anon.lead.legalBasis).toBe("consent"); // Nachweis bleibt
    expect(anon.lead.anonymizedAt).not.toBeNull();
    expect(anon.notes).toHaveLength(0);

    expect(
      (
        await client.req(`/api/leads/${leadId}/delete`, mgr, {
          method: "POST",
          json: { mode: "erase" },
        })
      ).status,
    ).toBe(204);
    expect((await client.req(`/api/leads/${leadId}`, mgr)).status).toBe(404);
  });
});

describe("event stats", () => {
  it("aggregates lead and follow-up counts", async () => {
    const { mgr, eventId } = await client.setupEvent();
    await makeLead(mgr, eventId, { lastName: "A", priority: "hot" });
    await makeLead(mgr, eventId, { lastName: "B", priority: "warm" });
    await makeLead(mgr, eventId, { lastName: "C" });

    const stats = (await (
      await client.req(`/api/events/${eventId}/stats`, mgr)
    ).json()) as {
      leads: { total: number; hot: number; qualified: number };
      byDay: unknown[];
    };
    expect(stats.leads.total).toBe(3);
    expect(stats.leads.hot).toBe(1);
    expect(stats.leads.qualified).toBe(2);
    expect(stats.byDay.length).toBeGreaterThanOrEqual(1);
  });
});
