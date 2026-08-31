import { and, asc, eq, lt, sql } from "drizzle-orm";
import type {
  FollowupCreate,
  FollowupTemplateCreate,
  FollowupUpdate,
} from "@humatter-leads/shared";
import type { Db } from "../db/types";
import { followupTemplates, followups } from "../db/schema";
import { errors } from "../lib/errors";
import { audit } from "./audit";

export type FollowupRow = typeof followups.$inferSelect;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getFollowupRef(db: Db, id: string) {
  const rows = await db
    .select({
      id: followups.id,
      leadId: followups.leadId,
      assigneeId: followups.assigneeId,
    })
    .from(followups)
    .where(eq(followups.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createFollowup(
  db: Db,
  params: {
    actorId: string;
    leadId: string;
    eventId: string;
    input: FollowupCreate;
  },
): Promise<FollowupRow> {
  const [row] = await db
    .insert(followups)
    .values({
      leadId: params.leadId,
      assigneeId: params.input.assigneeId ?? params.actorId,
      dueOn: params.input.dueOn ?? null,
      note: params.input.note ?? null,
      templateId: params.input.templateId ?? null,
    })
    .returning();
  await audit(db, {
    actorId: params.actorId,
    action: "followup.create",
    entityType: "followup",
    entityId: row!.id,
    eventId: params.eventId,
  });
  return row!;
}

export async function listEventFollowups(
  db: Db,
  params: {
    eventId: string;
    assigneeId?: string;
    status?: string;
    due?: "today" | "overdue" | "upcoming";
  },
) {
  const where = [
    sql`${followups.leadId} in (select id from leads where event_id = ${params.eventId})`,
  ];
  if (params.assigneeId)
    where.push(eq(followups.assigneeId, params.assigneeId));
  if (params.status)
    where.push(eq(followups.status, params.status as FollowupRow["status"]));
  if (params.due === "today") where.push(eq(followups.dueOn, today()));
  if (params.due === "overdue") {
    where.push(lt(followups.dueOn, today()));
    where.push(eq(followups.status, "open"));
  }
  if (params.due === "upcoming") {
    where.push(sql`${followups.dueOn} >= ${today()}`);
    where.push(eq(followups.status, "open"));
  }

  return db
    .select()
    .from(followups)
    .where(and(...where))
    .orderBy(asc(followups.dueOn), asc(followups.createdAt));
}

export async function updateFollowup(
  db: Db,
  params: {
    actorId: string;
    followupId: string;
    eventId: string;
    patch: FollowupUpdate;
  },
): Promise<FollowupRow> {
  const set: Record<string, unknown> = {};
  if (params.patch.dueOn !== undefined) set.dueOn = params.patch.dueOn ?? null;
  if (params.patch.assigneeId !== undefined)
    set.assigneeId = params.patch.assigneeId ?? null;
  if (params.patch.note !== undefined) set.note = params.patch.note ?? null;
  if (params.patch.status !== undefined) {
    set.status = params.patch.status;
    set.completedAt = params.patch.status === "done" ? new Date() : null;
  }

  const [row] = await db
    .update(followups)
    .set(set)
    .where(eq(followups.id, params.followupId))
    .returning();
  if (!row) throw errors.notFound("followup_not_found");
  await audit(db, {
    actorId: params.actorId,
    action: "followup.update",
    entityType: "followup",
    entityId: params.followupId,
    eventId: params.eventId,
  });
  return row;
}

// --- Vorlagen -------------------------------------------------------

export async function listTemplates(db: Db, eventId: string) {
  return db
    .select()
    .from(followupTemplates)
    .where(eq(followupTemplates.eventId, eventId))
    .orderBy(asc(followupTemplates.name));
}

export async function createTemplate(
  db: Db,
  params: { actorId: string; eventId: string; input: FollowupTemplateCreate },
) {
  const [row] = await db
    .insert(followupTemplates)
    .values({
      eventId: params.eventId,
      name: params.input.name,
      body: params.input.body,
    })
    .returning();
  await audit(db, {
    actorId: params.actorId,
    action: "followup_template.create",
    entityType: "followup_template",
    entityId: row!.id,
    eventId: params.eventId,
  });
  return row!;
}
