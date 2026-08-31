import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type {
  LeadCreate,
  LeadNoteCreate,
  LeadUpdate,
} from "@humatter-leads/shared";
import type { Db } from "../db/types";
import {
  leadAnswers,
  leadNotes,
  leadTags,
  leads,
  questions,
  tags,
} from "../db/schema";
import { errors } from "../lib/errors";
import { audit } from "./audit";

export type LeadRow = typeof leads.$inferSelect;

const CONTACT_KEYS = [
  "firstName",
  "lastName",
  "company",
  "position",
  "email",
  "phone",
  "website",
  "linkedin",
  "country",
  "language",
  "source",
] as const;

export interface DuplicateCandidate {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}

/** Referenz für die Autorisierung, ohne den ganzen Lead zu laden. */
export async function getLeadRef(
  db: Db,
  leadId: string,
): Promise<{ id: string; eventId: string; ownerId: string | null } | null> {
  const rows = await db
    .select({
      id: leads.id,
      eventId: leads.eventId,
      ownerId: leads.ownerId,
      deletedAt: leads.deletedAt,
    })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  const row = rows[0];
  if (!row || row.deletedAt) return null;
  return { id: row.id, eventId: row.eventId, ownerId: row.ownerId };
}

export async function findDuplicates(
  db: Db,
  eventId: string,
  email: string,
): Promise<DuplicateCandidate[]> {
  return db
    .select({
      id: leads.id,
      firstName: leads.firstName,
      lastName: leads.lastName,
      company: leads.company,
      email: leads.email,
    })
    .from(leads)
    .where(
      and(
        eq(leads.eventId, eventId),
        isNull(leads.deletedAt),
        sql`lower(${leads.email}) = ${email}`,
      ),
    )
    .limit(10);
}

async function upsertTagIds(
  db: Db,
  eventId: string,
  labels: string[],
): Promise<string[]> {
  const unique = [...new Set(labels.map((l) => l.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const ids: string[] = [];
  for (const label of unique) {
    const existing = await db
      .select({ id: tags.id })
      .from(tags)
      .where(
        and(
          eq(tags.eventId, eventId),
          sql`lower(${tags.label}) = ${label.toLowerCase()}`,
        ),
      )
      .limit(1);
    if (existing[0]) {
      ids.push(existing[0].id);
    } else {
      const [row] = await db
        .insert(tags)
        .values({ eventId, label })
        .returning({ id: tags.id });
      ids.push(row!.id);
    }
  }
  return ids;
}

async function writeAnswers(
  db: Db,
  leadId: string,
  eventId: string,
  answers: Record<string, unknown>,
): Promise<void> {
  const ids = Object.keys(answers);
  if (ids.length === 0) return;
  const valid = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.eventId, eventId), inArray(questions.id, ids)));
  const validIds = new Set(valid.map((q) => q.id));
  for (const [questionId, value] of Object.entries(answers)) {
    if (!validIds.has(questionId)) continue;
    await db
      .insert(leadAnswers)
      .values({ leadId, questionId, value: value ?? null })
      .onConflictDoUpdate({
        target: [leadAnswers.leadId, leadAnswers.questionId],
        set: { value: value ?? null },
      });
  }
}

function contactFrom(input: Partial<LeadCreate>) {
  const out: Record<string, string | null> = {};
  for (const key of CONTACT_KEYS) {
    const v = input[key];
    if (v !== undefined) out[key] = v === "" ? null : (v as string);
  }
  return out;
}

export type CreateLeadResult =
  | { status: "created" | "replayed"; lead: LeadRow }
  | { status: "duplicate"; candidates: DuplicateCandidate[] };

export async function createLead(
  db: Db,
  params: {
    actorId: string;
    eventId: string;
    input: LeadCreate;
    ip?: string | null;
  },
): Promise<CreateLeadResult> {
  const { actorId, eventId, input } = params;

  // Idempotenz: gleicher clientLocalId → vorhandenen Lead zurückgeben.
  const replay = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.eventId, eventId),
        eq(leads.clientLocalId, input.clientLocalId),
      ),
    )
    .limit(1);
  if (replay[0]) {
    return { status: "replayed", lead: replay[0] };
  }

  // Duplikatprüfung über E-Mail (nur wenn nicht bewusst übersprungen).
  if (input.email && !input.allowDuplicate) {
    const candidates = await findDuplicates(db, eventId, input.email);
    if (candidates.length > 0) {
      return { status: "duplicate", candidates };
    }
  }

  const lead = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(leads)
      .values({
        eventId,
        ownerId: actorId,
        clientLocalId: input.clientLocalId,
        ...contactFrom(input),
        priority: input.priority ?? null,
        leadScore: input.leadScore ?? null,
        legalBasis: input.legalBasis ?? "not_set",
        consentStatus: input.consentStatus ?? "not_asked",
        consentRecordedAt:
          input.consentStatus && input.consentStatus !== "not_asked"
            ? new Date()
            : null,
        syncedAt: new Date(),
      })
      .returning();
    const created = row!;

    if (input.answers) {
      await writeAnswers(tx, created.id, eventId, input.answers);
    }
    if (input.tags?.length) {
      const tagIds = await upsertTagIds(tx, eventId, input.tags);
      if (tagIds.length) {
        await tx
          .insert(leadTags)
          .values(tagIds.map((tagId) => ({ leadId: created.id, tagId })))
          .onConflictDoNothing();
      }
    }
    if (input.note) {
      await tx.insert(leadNotes).values({
        leadId: created.id,
        authorId: actorId,
        body: input.note,
      });
    }
    await audit(tx, {
      actorId,
      action: "lead.create",
      entityType: "lead",
      entityId: created.id,
      eventId,
      ip: params.ip,
    });
    return created;
  });

  return { status: "created", lead };
}

export async function listLeads(
  db: Db,
  params: {
    eventId: string;
    scope: "mine" | "all";
    userId: string;
    priority?: string;
    ownerId?: string;
    q?: string;
    tag?: string;
    limit: number;
    offset: number;
  },
): Promise<{ items: LeadRow[]; total: number }> {
  const where = [eq(leads.eventId, params.eventId), isNull(leads.deletedAt)];
  if (params.scope === "mine") where.push(eq(leads.ownerId, params.userId));
  if (params.ownerId) where.push(eq(leads.ownerId, params.ownerId));
  if (params.priority)
    where.push(
      eq(leads.priority, params.priority as LeadRow["priority"] & string),
    );
  if (params.q) {
    const like = `%${params.q.toLowerCase()}%`;
    where.push(
      or(
        sql`lower(coalesce(${leads.firstName},'')) like ${like}`,
        sql`lower(coalesce(${leads.lastName},'')) like ${like}`,
        sql`lower(coalesce(${leads.company},'')) like ${like}`,
        sql`lower(coalesce(${leads.email},'')) like ${like}`,
      )!,
    );
  }
  if (params.tag) {
    where.push(
      sql`exists (select 1 from ${leadTags} lt join ${tags} t on t.id = lt.tag_id
           where lt.lead_id = ${leads.id} and lower(t.label) = ${params.tag.toLowerCase()})`,
    );
  }

  const items = await db
    .select()
    .from(leads)
    .where(and(...where))
    .orderBy(desc(leads.createdAt))
    .limit(params.limit)
    .offset(params.offset);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(...where));

  return { items, total: countRows[0]?.count ?? 0 };
}

export async function getLeadDetail(db: Db, leadId: string) {
  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1);
  const lead = rows[0];
  if (!lead) throw errors.notFound("lead_not_found");

  const [answers, notes, tagRows] = await Promise.all([
    db
      .select({ questionId: leadAnswers.questionId, value: leadAnswers.value })
      .from(leadAnswers)
      .where(eq(leadAnswers.leadId, leadId)),
    db
      .select({
        id: leadNotes.id,
        body: leadNotes.body,
        authorId: leadNotes.authorId,
        createdAt: leadNotes.createdAt,
      })
      .from(leadNotes)
      .where(eq(leadNotes.leadId, leadId))
      .orderBy(desc(leadNotes.createdAt)),
    db
      .select({ label: tags.label })
      .from(leadTags)
      .innerJoin(tags, eq(tags.id, leadTags.tagId))
      .where(eq(leadTags.leadId, leadId)),
  ]);

  return { lead, answers, notes, tags: tagRows.map((t) => t.label) };
}

export async function updateLead(
  db: Db,
  params: {
    actorId: string;
    leadId: string;
    eventId: string;
    patch: LeadUpdate;
  },
): Promise<LeadRow> {
  const { actorId, leadId, eventId, patch } = params;

  return db.transaction(async (tx) => {
    const current = (
      await tx
        .select()
        .from(leads)
        .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
        .limit(1)
    )[0];
    if (!current) throw errors.notFound("lead_not_found");
    if (current.version !== patch.expectedVersion) {
      throw errors.conflict(
        "version_conflict",
        "Der Lead wurde zwischenzeitlich geändert.",
      );
    }

    const set: Record<string, unknown> = { ...contactFrom(patch) };
    if (patch.priority !== undefined) set.priority = patch.priority ?? null;
    if (patch.leadScore !== undefined) set.leadScore = patch.leadScore ?? null;
    if (patch.legalBasis !== undefined) set.legalBasis = patch.legalBasis;
    if (patch.consentStatus !== undefined) {
      set.consentStatus = patch.consentStatus;
      set.consentRecordedAt =
        patch.consentStatus !== "not_asked" ? new Date() : null;
    }
    if (patch.ownerId !== undefined) set.ownerId = patch.ownerId ?? null;
    set.version = current.version + 1;

    const [row] = await tx
      .update(leads)
      .set(set)
      .where(eq(leads.id, leadId))
      .returning();

    if (patch.answers) await writeAnswers(tx, leadId, eventId, patch.answers);
    if (patch.tags) {
      await tx.delete(leadTags).where(eq(leadTags.leadId, leadId));
      const tagIds = await upsertTagIds(tx, eventId, patch.tags);
      if (tagIds.length) {
        await tx
          .insert(leadTags)
          .values(tagIds.map((tagId) => ({ leadId, tagId })));
      }
    }

    await audit(tx, {
      actorId,
      action: "lead.update",
      entityType: "lead",
      entityId: leadId,
      eventId,
      metadata: { fields: Object.keys(set).filter((k) => k !== "version") },
    });
    return row!;
  });
}

export async function softDeleteLead(
  db: Db,
  params: { actorId: string; leadId: string; eventId: string },
): Promise<void> {
  const [row] = await db
    .update(leads)
    .set({ deletedAt: new Date() })
    .where(and(eq(leads.id, params.leadId), isNull(leads.deletedAt)))
    .returning({ id: leads.id });
  if (!row) throw errors.notFound("lead_not_found");
  await audit(db, {
    actorId: params.actorId,
    action: "lead.delete",
    entityType: "lead",
    entityId: params.leadId,
    eventId: params.eventId,
  });
}

export async function addLeadNote(
  db: Db,
  params: {
    actorId: string;
    leadId: string;
    eventId: string;
    input: LeadNoteCreate;
  },
) {
  const [note] = await db
    .insert(leadNotes)
    .values({
      leadId: params.leadId,
      authorId: params.actorId,
      body: params.input.body,
    })
    .returning();
  await audit(db, {
    actorId: params.actorId,
    action: "lead.note_add",
    entityType: "lead",
    entityId: params.leadId,
    eventId: params.eventId,
  });
  return note!;
}
