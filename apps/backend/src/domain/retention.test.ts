import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../db/testing/pglite";
import { events, eventMembers, leads, users } from "../db/schema";
import { runRetention } from "./retention";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.$close();
});

async function seedExpiredEvent(mode: "anonymize" | "hard_delete") {
  const [user] = await db
    .insert(users)
    .values({
      email: `r-${crypto.randomUUID()}@mindsewn.de`,
      passwordHash: "x",
      displayName: "R",
    })
    .returning();
  const [event] = await db
    .insert(events)
    .values({
      name: "Alt",
      endsOn: "2020-01-01",
      retentionDays: 30,
      retentionMode: mode,
      createdBy: user!.id,
    })
    .returning();
  await db
    .insert(eventMembers)
    .values({ eventId: event!.id, userId: user!.id, eventRole: "manager" });
  const [lead] = await db
    .insert(leads)
    .values({
      eventId: event!.id,
      ownerId: user!.id,
      clientLocalId: crypto.randomUUID(),
      firstName: "Max",
      lastName: "Mustermann",
      email: "max@x.test",
    })
    .returning();
  return { eventId: event!.id, leadId: lead!.id };
}

describe("retention job", () => {
  it("anonymizes leads of an expired event and is idempotent", async () => {
    const { leadId } = await seedExpiredEvent("anonymize");

    const first = await runRetention(db);
    expect(first.anonymized).toBeGreaterThanOrEqual(1);

    const [row] = await db.select().from(leads).where(eq(leads.id, leadId));
    expect(row!.firstName).toBeNull();
    expect(row!.company).toBe("anonymisiert");
    expect(row!.anonymizedAt).not.toBeNull();

    const second = await runRetention(db);
    // dieser Lead wird nicht erneut angefasst
    const [again] = await db.select().from(leads).where(eq(leads.id, leadId));
    expect(again!.version).toBe(row!.version);
    expect(second).toBeTruthy();
  });

  it("hard-deletes leads when the event retention mode says so", async () => {
    const { leadId } = await seedExpiredEvent("hard_delete");
    await runRetention(db);
    const rows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.id, leadId));
    expect(rows[0]!.c).toBe(0);
  });

  it("does not touch events that are still within their retention window", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: `keep-${crypto.randomUUID()}@mindsewn.de`,
        passwordHash: "x",
        displayName: "K",
      })
      .returning();
    const future = new Date(Date.now() + 86_400_000 * 10)
      .toISOString()
      .slice(0, 10);
    const [event] = await db
      .insert(events)
      .values({
        name: "Aktuell",
        endsOn: future,
        retentionDays: 30,
        createdBy: user!.id,
      })
      .returning();
    const [lead] = await db
      .insert(leads)
      .values({
        eventId: event!.id,
        ownerId: user!.id,
        clientLocalId: crypto.randomUUID(),
        firstName: "Bleibt",
      })
      .returning();

    await runRetention(db);
    const [row] = await db.select().from(leads).where(eq(leads.id, lead!.id));
    expect(row!.firstName).toBe("Bleibt");
  });
});
