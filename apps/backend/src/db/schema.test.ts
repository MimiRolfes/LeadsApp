import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./testing/pglite";
import { auditLog, eventMembers, events, leads, users } from "./schema";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.$close();
});

async function seedGraph() {
  const [user] = await db
    .insert(users)
    .values({
      email: `owner-${crypto.randomUUID()}@example.test`,
      passwordHash: "x",
      displayName: "Test Owner",
    })
    .returning();
  const [event] = await db
    .insert(events)
    .values({ name: "Test Messe", createdBy: user!.id })
    .returning();
  await db
    .insert(eventMembers)
    .values({ eventId: event!.id, userId: user!.id, eventRole: "manager" });
  return { user: user!, event: event! };
}

describe("database migrations + schema (PGlite)", () => {
  it("creates all 18 expected tables", async () => {
    const rows = await db.execute<{ table_name: string }>(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const names = rows.rows.map((r) => r.table_name).sort();
    expect(names).toEqual(
      [
        "attachments",
        "audit_log",
        "event_members",
        "events",
        "exports",
        "followup_templates",
        "followups",
        "lead_answers",
        "lead_merges",
        "lead_notes",
        "lead_tags",
        "leads",
        "password_reset_tokens",
        "questions",
        "sessions",
        "sync_receipts",
        "tags",
        "users",
      ].sort(),
    );
  });

  it("rejects a second user with the same email in different case", async () => {
    await db.insert(users).values({
      email: "Case@Example.Test",
      passwordHash: "x",
      displayName: "A",
    });
    await expect(
      db.insert(users).values({
        email: "case@example.test",
        passwordHash: "x",
        displayName: "B",
      }),
    ).rejects.toThrow();
  });

  it("applies column defaults (status, version, legal_basis, consent)", async () => {
    const { user, event } = await seedGraph();
    const [lead] = await db
      .insert(leads)
      .values({
        eventId: event.id,
        ownerId: user.id,
        clientLocalId: crypto.randomUUID(),
        lastName: "Mustermann",
      })
      .returning();

    expect(lead!.version).toBe(1);
    expect(lead!.legalBasis).toBe("not_set");
    expect(lead!.consentStatus).toBe("not_asked");
    expect(lead!.createdAt).toBeInstanceOf(Date);
  });

  it("enforces UNIQUE (event_id, client_local_id) on leads", async () => {
    const { event } = await seedGraph();
    const localId = crypto.randomUUID();
    await db
      .insert(leads)
      .values({ eventId: event.id, clientLocalId: localId });

    await expect(
      db.insert(leads).values({ eventId: event.id, clientLocalId: localId }),
    ).rejects.toThrow();
  });

  it("cascades lead deletion when its event is removed", async () => {
    const { event } = await seedGraph();
    await db
      .insert(leads)
      .values({ eventId: event.id, clientLocalId: crypto.randomUUID() });
    await db.delete(events).where(sql`${events.id} = ${event.id}`);

    const remaining = await db
      .select()
      .from(leads)
      .where(sql`${leads.eventId} = ${event.id}`);
    expect(remaining).toHaveLength(0);
  });

  it("keeps audit_log append-only (UPDATE and DELETE are rejected)", async () => {
    const [entry] = await db
      .insert(auditLog)
      .values({
        action: "test.event",
        entityType: "lead",
        entityId: "abc",
      })
      .returning();

    await expect(
      db
        .update(auditLog)
        .set({ action: "tampered" })
        .where(sql`${auditLog.id} = ${entry!.id}`),
    ).rejects.toThrow();

    await expect(
      db.delete(auditLog).where(sql`${auditLog.id} = ${entry!.id}`),
    ).rejects.toThrow();
  });
});
