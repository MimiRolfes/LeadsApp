import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seed } from "./seed-data";
import { createTestDb, type TestDb } from "./testing/pglite";
import { events, followups, leads, users } from "./schema";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  await seed(db);
});

afterAll(async () => {
  await db.$close();
});

describe("development seed (fictional data)", () => {
  it("inserts users, one active event and leads", async () => {
    expect(await db.select().from(users)).toHaveLength(3);
    const evs = await db.select().from(events);
    expect(evs).toHaveLength(1);
    expect(evs[0]!.status).toBe("active");
    expect(await db.select().from(leads)).toHaveLength(2);
    expect(await db.select().from(followups)).toHaveLength(2);
  });

  it("keeps legal basis / consent independent of lead score", async () => {
    const rows = await db
      .select({
        score: leads.leadScore,
        legalBasis: leads.legalBasis,
        consent: leads.consentStatus,
      })
      .from(leads)
      .orderBy(sql`${leads.leadScore} desc`);
    expect(rows[0]).toMatchObject({
      score: 82,
      legalBasis: "legitimate_interest",
      consent: "not_asked",
    });
  });

  it("contains only obviously fictional contact data", async () => {
    const rows = await db.select({ email: leads.email }).from(leads);
    for (const { email } of rows) {
      expect(email).toMatch(/\.test$/);
    }
  });
});
