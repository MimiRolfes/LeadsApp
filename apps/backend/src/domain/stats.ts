import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/types";
import { eventMembers, followups, leads, users } from "../db/schema";

/**
 * Aggregierte Event-Kennzahlen fürs Dashboard. Keine Einzel-PII — nur Zählungen.
 */
export async function eventStats(db: Db, eventId: string) {
  const activeLead = and(eq(leads.eventId, eventId), isNull(leads.deletedAt));

  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      hot: sql<number>`count(*) filter (where ${leads.priority} = 'hot')::int`,
      warm: sql<number>`count(*) filter (where ${leads.priority} = 'warm')::int`,
      cold: sql<number>`count(*) filter (where ${leads.priority} = 'cold')::int`,
      unrated: sql<number>`count(*) filter (where ${leads.priority} is null)::int`,
      qualified: sql<number>`count(*) filter (where ${leads.priority} is not null)::int`,
      withConsent: sql<number>`count(*) filter (where ${leads.consentStatus} = 'granted')::int`,
      anonymized: sql<number>`count(*) filter (where ${leads.anonymizedAt} is not null)::int`,
    })
    .from(leads)
    .where(activeLead);

  const byOwner = await db
    .select({
      userId: leads.ownerId,
      displayName: users.displayName,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .leftJoin(users, eq(users.id, leads.ownerId))
    .where(activeLead)
    .groupBy(leads.ownerId, users.displayName)
    .orderBy(sql`count(*) desc`);

  const byDay = await db
    .select({
      day: sql<string>`to_char(${leads.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(activeLead)
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const [fu] = await db
    .select({
      open: sql<number>`count(*) filter (where ${followups.status} = 'open')::int`,
      done: sql<number>`count(*) filter (where ${followups.status} = 'done')::int`,
      overdue: sql<number>`count(*) filter (where ${followups.status} = 'open' and ${followups.dueOn} < current_date)::int`,
    })
    .from(followups)
    .where(
      sql`${followups.leadId} in (select id from leads where event_id = ${eventId} and deleted_at is null)`,
    );

  const [team] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventMembers)
    .where(eq(eventMembers.eventId, eventId));

  return {
    leads: totals ?? {
      total: 0,
      hot: 0,
      warm: 0,
      cold: 0,
      unrated: 0,
      qualified: 0,
      withConsent: 0,
      anonymized: 0,
    },
    followups: fu ?? { open: 0, done: 0, overdue: 0 },
    teamSize: team?.count ?? 0,
    byOwner,
    byDay,
  };
}
