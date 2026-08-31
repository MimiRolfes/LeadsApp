import { and, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "../db/types";
import {
  events,
  leadNotes,
  leads,
  passwordResetTokens,
  sessions,
} from "../db/schema";
import { audit } from "./audit";
import { ANONYMIZED_LEAD_FIELDS } from "./dsgvo";

export interface RetentionSummary {
  anonymized: number;
  deleted: number;
  eventsProcessed: number;
  sessionsPurged: number;
  resetTokensPurged: number;
}

/**
 * Retention-Lauf (docs/retention.md). Idempotent — bereits behandelte Leads
 * werden übersprungen. Läuft mit einer DB-Rolle, die DELETE auf operativen
 * Tabellen darf (nicht die reine App-Rolle).
 *
 * Aufruf: `npm run db:retention` (CLI-Wrapper) — als Cron / Compose-Job.
 */
export async function runRetention(db: Db): Promise<RetentionSummary> {
  const summary: RetentionSummary = {
    anonymized: 0,
    deleted: 0,
    eventsProcessed: 0,
    sessionsPurged: 0,
    resetTokensPurged: 0,
  };

  const dueEvents = await db
    .select()
    .from(events)
    .where(and(isNotNull(events.retentionDays), isNotNull(events.endsOn)));

  const today = new Date();
  for (const ev of dueEvents) {
    const cutoff = new Date(ev.endsOn + "T00:00:00Z");
    cutoff.setUTCDate(cutoff.getUTCDate() + (ev.retentionDays ?? 0));
    if (today < cutoff) continue;
    summary.eventsProcessed += 1;

    const targets = await db
      .select({ id: leads.id, version: leads.version })
      .from(leads)
      .where(
        and(
          eq(leads.eventId, ev.id),
          isNull(leads.deletedAt),
          isNull(leads.anonymizedAt),
        ),
      );

    for (const lead of targets) {
      await db.transaction(async (tx) => {
        if (ev.retentionMode === "hard_delete") {
          await audit(tx, {
            action: "retention.erase",
            entityType: "lead",
            entityId: lead.id,
            eventId: ev.id,
          });
          await tx.delete(leads).where(eq(leads.id, lead.id));
          summary.deleted += 1;
        } else {
          await tx
            .update(leads)
            .set({
              ...ANONYMIZED_LEAD_FIELDS,
              anonymizedAt: new Date(),
              version: lead.version + 1,
            })
            .where(eq(leads.id, lead.id));
          await tx.delete(leadNotes).where(eq(leadNotes.leadId, lead.id));
          await audit(tx, {
            action: "retention.anonymize",
            entityType: "lead",
            entityId: lead.id,
            eventId: ev.id,
          });
          summary.anonymized += 1;
        }
      });
    }
  }

  // Abgelaufene / zurückgezogene Sessions und Reset-Token entfernen.
  const purgedSessions = await db
    .delete(sessions)
    .where(
      sql`${sessions.expiresAt} < now() or ${sessions.revokedAt} is not null`,
    )
    .returning({ id: sessions.id });
  summary.sessionsPurged = purgedSessions.length;

  const purgedTokens = await db
    .delete(passwordResetTokens)
    .where(lt(passwordResetTokens.expiresAt, new Date()))
    .returning({ id: passwordResetTokens.id });
  summary.resetTokensPurged = purgedTokens.length;

  await audit(db, {
    action: "retention.run",
    entityType: "system",
    metadata: { ...summary },
  });

  return summary;
}
