import type { PgDatabase } from "drizzle-orm/pg-core";
import {
  eventMembers,
  events,
  followups,
  leadAnswers,
  leadNotes,
  leadTags,
  leads,
  questions,
  tags,
  users,
} from "./schema";

/**
 * Entwicklungs-Seed mit AUSSCHLIESSLICH fiktiven Daten (keine echten PII —
 * CLAUDE.md Regel 4).
 *
 * Login funktioniert erst ab Phase 2 (Passwort-Hashing); die Nutzer hier
 * tragen einen klar erkennbaren Platzhalter-Hash.
 */
const PLACEHOLDER_HASH = "SEED_PLACEHOLDER__set_real_password_in_phase_2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seed(db: PgDatabase<any, any, any>): Promise<void> {
  await db.transaction(async (tx) => {
    const [, manager, member] = await tx
      .insert(users)
      .values([
        {
          email: "admin@example.test",
          passwordHash: PLACEHOLDER_HASH,
          displayName: "Alex Admin",
          globalRole: "admin" as const,
        },
        {
          email: "manager@example.test",
          passwordHash: PLACEHOLDER_HASH,
          displayName: "Mia Managerin",
        },
        {
          email: "scanner@example.test",
          passwordHash: PLACEHOLDER_HASH,
          displayName: "Sam Scanner",
        },
      ])
      .returning();

    const [event] = await tx
      .insert(events)
      .values({
        name: "Fiktive Recruiting-Messe 2026",
        location: "Musterstadt Messe, Halle 7",
        startsOn: "2026-09-15",
        endsOn: "2026-09-17",
        status: "active" as const,
        retentionDays: 365,
        retentionMode: "anonymize" as const,
        createdBy: manager!.id,
      })
      .returning();

    await tx.insert(eventMembers).values([
      {
        eventId: event!.id,
        userId: manager!.id,
        eventRole: "manager" as const,
      },
      { eventId: event!.id, userId: member!.id, eventRole: "member" as const },
    ]);

    const insertedQuestions = await tx
      .insert(questions)
      .values([
        {
          eventId: event!.id,
          prompt: "Aktuelles Recruiting-Problem?",
          type: "textarea" as const,
          position: 1,
        },
        {
          eventId: event!.id,
          prompt: "Unternehmensgröße",
          type: "single_select" as const,
          position: 2,
          options: [
            { value: "1-50", label: "1–50" },
            { value: "51-250", label: "51–250" },
            { value: "251+", label: "251+" },
          ],
        },
        {
          eventId: event!.id,
          prompt: "Zeithorizont",
          type: "single_select" as const,
          position: 3,
          options: [
            { value: "now", label: "Sofort" },
            { value: "q", label: "Dieses Quartal" },
            { value: "later", label: "Später" },
          ],
        },
      ])
      .returning();

    const [tagHiring, tagEnterprise] = await tx
      .insert(tags)
      .values([
        { eventId: event!.id, label: "Hiring" },
        { eventId: event!.id, label: "Enterprise" },
      ])
      .returning();

    const [lead1, lead2] = await tx
      .insert(leads)
      .values([
        {
          eventId: event!.id,
          ownerId: member!.id,
          clientLocalId: crypto.randomUUID(),
          firstName: "Erika",
          lastName: "Mustermann",
          company: "Beispiel GmbH",
          position: "Head of People",
          email: "erika.mustermann@beispiel.test",
          country: "DE",
          language: "de",
          source: "Standgespräch",
          priority: "hot" as const,
          leadScore: 82,
          legalBasis: "legitimate_interest" as const,
          consentStatus: "not_asked" as const,
          syncedAt: new Date(),
        },
        {
          eventId: event!.id,
          ownerId: manager!.id,
          clientLocalId: crypto.randomUUID(),
          firstName: "Max",
          lastName: "Beispiel",
          company: "Muster AG",
          position: "Recruiter",
          email: "max.beispiel@muster.test",
          country: "AT",
          language: "de",
          source: "QR-Scan",
          priority: "warm" as const,
          leadScore: 55,
          legalBasis: "consent" as const,
          consentStatus: "granted" as const,
          consentRecordedAt: new Date(),
          syncedAt: new Date(),
        },
      ])
      .returning();

    await tx.insert(leadAnswers).values([
      {
        leadId: lead1!.id,
        questionId: insertedQuestions[0]!.id,
        value: "Zu wenige qualifizierte Bewerbungen für IT-Rollen.",
      },
      {
        leadId: lead1!.id,
        questionId: insertedQuestions[1]!.id,
        value: "251+",
      },
    ]);

    await tx.insert(leadNotes).values({
      leadId: lead1!.id,
      authorId: member!.id,
      body: "Sehr interessiert an Active Sourcing. Demo-Termin gewünscht.",
    });

    await tx.insert(leadTags).values([
      { leadId: lead1!.id, tagId: tagHiring!.id },
      { leadId: lead1!.id, tagId: tagEnterprise!.id },
      { leadId: lead2!.id, tagId: tagHiring!.id },
    ]);

    await tx.insert(followups).values([
      {
        leadId: lead1!.id,
        assigneeId: member!.id,
        dueOn: "2026-09-20",
        status: "open" as const,
        note: "Demo-Termin abstimmen.",
      },
      {
        leadId: lead2!.id,
        assigneeId: manager!.id,
        dueOn: "2026-09-19",
        status: "open" as const,
      },
    ]);
  });
}
