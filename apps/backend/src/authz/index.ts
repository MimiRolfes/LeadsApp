import { eq } from "drizzle-orm";
import type { EventRole } from "@humatter-leads/shared";
import type { Db } from "../db/types";
import { eventMembers } from "../db/schema";
import type { UserRow } from "../auth/session";
import { errors } from "../lib/errors";

/**
 * Zentrale Autorisierungs-Schicht (CLAUDE.md: „zentrale Policy/Permission-
 * Schicht statt verteilter Rollenchecks"). Route-Handler rufen ausschließlich
 * die `assert*`-Funktionen — keine `if (role === …)`-Prüfungen sonst irgendwo.
 */
export interface AuthCtx {
  userId: string;
  isAdmin: boolean;
  /** Event-Rolle des Nutzers oder undefined, wenn kein Mitglied. */
  eventRole(eventId: string): EventRole | undefined;
}

/** Einmal pro Request: lädt die Event-Mitgliedschaften des Nutzers. */
export async function buildAuthCtx(db: Db, user: UserRow): Promise<AuthCtx> {
  const rows = await db
    .select({
      eventId: eventMembers.eventId,
      role: eventMembers.eventRole,
    })
    .from(eventMembers)
    .where(eq(eventMembers.userId, user.id));
  const byEvent = new Map<string, EventRole>(
    rows.map((r) => [r.eventId, r.role as EventRole]),
  );
  return {
    userId: user.id,
    isAdmin: user.globalRole === "admin",
    eventRole: (eventId) => byEvent.get(eventId),
  };
}

// --- reine Prädikate ---------------------------------------------------

export function isEventMember(ctx: AuthCtx, eventId: string): boolean {
  return ctx.isAdmin || ctx.eventRole(eventId) !== undefined;
}

export function isEventManager(ctx: AuthCtx, eventId: string): boolean {
  return ctx.isAdmin || ctx.eventRole(eventId) === "manager";
}

export function canCaptureLead(ctx: AuthCtx, eventId: string): boolean {
  const r = ctx.eventRole(eventId);
  return ctx.isAdmin || r === "manager" || r === "member";
}

export function canEditLead(
  ctx: AuthCtx,
  eventId: string,
  ownerId: string | null,
): boolean {
  if (isEventManager(ctx, eventId)) return true;
  return ctx.eventRole(eventId) === "member" && ownerId === ctx.userId;
}

// --- assert-Helfer (werfen 403) --------------------------------------

function deny(code: string, message?: string): never {
  throw errors.forbidden(code, message ?? "Keine Berechtigung.");
}

export function assertPlatformAdmin(ctx: AuthCtx): void {
  if (!ctx.isAdmin) deny("admin_required");
}

export function assertCanViewEvent(ctx: AuthCtx, eventId: string): void {
  if (!isEventMember(ctx, eventId)) deny("event_access_denied");
}

export function assertCanManageEvent(ctx: AuthCtx, eventId: string): void {
  if (!isEventManager(ctx, eventId)) deny("event_manage_denied");
}

export function assertCanCaptureLead(ctx: AuthCtx, eventId: string): void {
  if (!canCaptureLead(ctx, eventId)) deny("lead_capture_denied");
}

export function assertCanEditLead(
  ctx: AuthCtx,
  eventId: string,
  ownerId: string | null,
): void {
  if (!canEditLead(ctx, eventId, ownerId)) deny("lead_edit_denied");
}

/** Merge, Export, DSGVO-Aktionen, Fragenkatalog: Event-Manager/Admin. */
export const assertCanMergeLeads = assertCanManageEvent;
export const assertCanExport = assertCanManageEvent;
export const assertCanManageQuestions = assertCanManageEvent;
export const assertCanRunDsgvoAction = assertCanManageEvent;
