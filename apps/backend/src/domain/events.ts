import { and, asc, eq, sql } from "drizzle-orm";
import type {
  EventCreate,
  EventMemberAdd,
  EventUpdate,
  QuestionCreate,
  QuestionUpdate,
} from "@humatter-leads/shared";
import type { Db } from "../db/types";
import {
  attachments,
  eventMembers,
  events,
  leads,
  questions,
  users,
} from "../db/schema";
import type { AuthCtx } from "../authz";
import { errors } from "../lib/errors";
import { audit } from "./audit";
import { deleteObject } from "../lib/storage";

export type EventRow = typeof events.$inferSelect;
export type QuestionRow = typeof questions.$inferSelect;

export async function createEvent(
  db: Db,
  actorId: string,
  input: EventCreate,
): Promise<EventRow> {
  return db.transaction(async (tx) => {
    const [event] = await tx
      .insert(events)
      .values({
        name: input.name,
        location: input.location ?? null,
        startsOn: input.startsOn ?? null,
        endsOn: input.endsOn ?? null,
        retentionDays: input.retentionDays ?? null,
        retentionMode: input.retentionMode ?? "anonymize",
        createdBy: actorId,
      })
      .returning();
    await tx.insert(eventMembers).values({
      eventId: event!.id,
      userId: actorId,
      eventRole: "manager",
    });
    await audit(tx, {
      actorId,
      action: "event.create",
      entityType: "event",
      entityId: event!.id,
      eventId: event!.id,
    });
    return event!;
  });
}

/**
 * Erfasste Leads je Event — als korrelierte Unterabfrage, damit die Liste
 * ein einziger Request bleibt. Weich gelöschte zählen nicht mit;
 * anonymisierte schon, denn gescannt wurden sie.
 */
const leadCountSql = sql<number>`(
  select count(*)::int from ${leads}
  where ${leads.eventId} = ${events.id} and ${leads.deletedAt} is null
)`;

export async function listEventsForUser(
  db: Db,
  ctx: AuthCtx,
): Promise<Array<EventRow & { myRole: string | null; leadCount: number }>> {
  if (ctx.isAdmin) {
    const rows = await db
      .select({ event: events, leadCount: leadCountSql })
      .from(events)
      .orderBy(asc(events.name));
    return rows.map((r) => ({
      ...r.event,
      myRole: ctx.eventRole(r.event.id) ?? "admin",
      leadCount: r.leadCount,
    }));
  }
  const rows = await db
    .select({
      event: events,
      role: eventMembers.eventRole,
      leadCount: leadCountSql,
    })
    .from(eventMembers)
    .innerJoin(events, eq(events.id, eventMembers.eventId))
    .where(eq(eventMembers.userId, ctx.userId))
    .orderBy(asc(events.name));
  return rows.map((r) => ({
    ...r.event,
    myRole: r.role,
    leadCount: r.leadCount,
  }));
}

export async function getEvent(
  db: Db,
  eventId: string,
): Promise<EventRow | null> {
  const rows = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateEvent(
  db: Db,
  actorId: string,
  eventId: string,
  patch: EventUpdate,
): Promise<EventRow> {
  const set: Partial<typeof events.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.location !== undefined) set.location = patch.location ?? null;
  if (patch.startsOn !== undefined) set.startsOn = patch.startsOn ?? null;
  if (patch.endsOn !== undefined) set.endsOn = patch.endsOn ?? null;
  if (patch.retentionDays !== undefined)
    set.retentionDays = patch.retentionDays ?? null;
  if (patch.retentionMode !== undefined)
    set.retentionMode = patch.retentionMode;
  if (patch.status !== undefined) set.status = patch.status;

  if (Object.keys(set).length === 0) {
    const current = await getEvent(db, eventId);
    if (!current) throw errors.notFound("event_not_found");
    return current;
  }

  const [row] = await db
    .update(events)
    .set(set)
    .where(eq(events.id, eventId))
    .returning();
  if (!row) throw errors.notFound("event_not_found");
  await audit(db, {
    actorId,
    action: "event.update",
    entityType: "event",
    entityId: eventId,
    eventId,
    metadata: { fields: Object.keys(set) },
  });
  return row;
}

export async function listMembers(db: Db, eventId: string) {
  return db
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      eventRole: eventMembers.eventRole,
      addedAt: eventMembers.addedAt,
    })
    .from(eventMembers)
    .innerJoin(users, eq(users.id, eventMembers.userId))
    .where(eq(eventMembers.eventId, eventId))
    .orderBy(asc(users.displayName));
}

export async function addMember(
  db: Db,
  actorId: string,
  eventId: string,
  input: EventMemberAdd,
) {
  const target = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${input.email}`)
    .limit(1);
  if (target.length === 0) {
    throw errors.notFound(
      "user_not_registered",
      "Diese Person muss sich zuerst selbst registrieren.",
    );
  }
  const userId = target[0]!.id;

  await db
    .insert(eventMembers)
    .values({ eventId, userId, eventRole: input.eventRole })
    .onConflictDoUpdate({
      target: [eventMembers.eventId, eventMembers.userId],
      set: { eventRole: input.eventRole },
    });

  await audit(db, {
    actorId,
    action: "event.member_add",
    entityType: "event_member",
    entityId: userId,
    eventId,
    metadata: { eventRole: input.eventRole },
  });
  return listMembers(db, eventId);
}

export async function removeMember(
  db: Db,
  actorId: string,
  eventId: string,
  userId: string,
): Promise<void> {
  await db
    .delete(eventMembers)
    .where(
      and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId)),
    );
  await audit(db, {
    actorId,
    action: "event.member_remove",
    entityType: "event_member",
    entityId: userId,
    eventId,
  });
}

// --- Fragenkatalog ---------------------------------------------------

export async function listQuestions(
  db: Db,
  eventId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<QuestionRow[]> {
  const rows = await db
    .select()
    .from(questions)
    .where(eq(questions.eventId, eventId))
    .orderBy(asc(questions.position), asc(questions.createdAt));
  return opts.includeArchived
    ? rows
    : rows.filter((q) => q.archivedAt === null);
}

export async function createQuestion(
  db: Db,
  actorId: string,
  eventId: string,
  input: QuestionCreate,
): Promise<QuestionRow> {
  const [row] = await db
    .insert(questions)
    .values({
      eventId,
      prompt: input.prompt,
      type: input.type,
      options: input.options ?? null,
      position: input.position ?? 0,
      required: input.required ?? false,
    })
    .returning();
  await audit(db, {
    actorId,
    action: "question.create",
    entityType: "question",
    entityId: row!.id,
    eventId,
  });
  return row!;
}

export async function updateQuestion(
  db: Db,
  actorId: string,
  eventId: string,
  questionId: string,
  patch: QuestionUpdate,
): Promise<QuestionRow> {
  const set: Partial<typeof questions.$inferInsert> = {};
  if (patch.prompt !== undefined) set.prompt = patch.prompt;
  if (patch.options !== undefined) set.options = patch.options;
  if (patch.position !== undefined) set.position = patch.position;
  if (patch.required !== undefined) set.required = patch.required;

  const [row] = await db
    .update(questions)
    .set(set)
    .where(and(eq(questions.id, questionId), eq(questions.eventId, eventId)))
    .returning();
  if (!row) throw errors.notFound("question_not_found");
  await audit(db, {
    actorId,
    action: "question.update",
    entityType: "question",
    entityId: questionId,
    eventId,
  });
  return row;
}

export async function archiveQuestion(
  db: Db,
  actorId: string,
  eventId: string,
  questionId: string,
): Promise<void> {
  const [row] = await db
    .update(questions)
    .set({ archivedAt: new Date() })
    .where(and(eq(questions.id, questionId), eq(questions.eventId, eventId)))
    .returning();
  if (!row) throw errors.notFound("question_not_found");
  await audit(db, {
    actorId,
    action: "question.archive",
    entityType: "question",
    entityId: questionId,
    eventId,
  });
}

/**
 * Löscht ein Event mit ALLEN daran hängenden Daten.
 *
 * Die Tabellen (Leads, Antworten, Anhänge, Mitglieder, Fragen, Follow-ups)
 * hängen per `onDelete: cascade` am Event und verschwinden mit der einen
 * Zeile. Was die Datenbank NICHT mitnimmt, sind die abgelegten Dateien —
 * die werden deshalb vorher einzeln aus dem Speicher entfernt.
 *
 * Bewusst unumkehrbar: der Zweck ist die vollständige Entfernung der
 * Personendaten eines Events. Der Audit-Eintrag wird VOR dem Löschen
 * geschrieben (danach wäre die event_id nicht mehr referenzierbar) und
 * hält nur Zählwerte fest, keine Inhalte.
 */
export async function deleteEventCompletely(
  db: Db,
  actorId: string,
  eventId: string,
  ip?: string | null,
): Promise<{ deletedLeads: number; deletedAttachments: number }> {
  const attachmentRows = await db
    .select({ storageKey: attachments.storageKey })
    .from(attachments)
    .innerJoin(leads, eq(leads.id, attachments.leadId))
    .where(eq(leads.eventId, eventId));

  const leadRows = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.eventId, eventId));

  await audit(db, {
    actorId,
    action: "event.delete",
    entityType: "event",
    entityId: eventId,
    eventId,
    ip: ip ?? null,
    metadata: {
      leads: leadRows.length,
      attachments: attachmentRows.length,
    },
  });

  // Erst die Dateien: bleibt eine liegen, brechen wir ab und das Event
  // existiert noch — besser als verwaiste Dateien mit Personendaten.
  for (const row of attachmentRows) {
    await deleteObject(row.storageKey);
  }

  const [deleted] = await db
    .delete(events)
    .where(eq(events.id, eventId))
    .returning({ id: events.id });
  if (!deleted) throw errors.notFound("event_not_found");

  return {
    deletedLeads: leadRows.length,
    deletedAttachments: attachmentRows.length,
  };
}
