import { eq } from "drizzle-orm";
import type { Db } from "../db/types";
import {
  attachments,
  followups,
  leadMerges,
  leadNotes,
  leads,
} from "../db/schema";
import { errors } from "../lib/errors";
import { audit } from "./audit";
import { getLeadDetail } from "./leads";

/**
 * Betroffenenrechte (DSGVO). Alle Aktionen werden auditiert.
 *
 * - `subjectAccess`  → vollständige Kopie aller zu einem Lead gespeicherten Daten
 * - `anonymizeLead`  → PII entfernen, aggregierte Kennzahlen behalten
 *                      (`legal_basis` / `consent_status` bleiben für die
 *                      Nachweisbarkeit erhalten — an den anonymen Datensatz)
 * - `eraseLead`      → harte Löschung inkl. abhängiger Daten (FK-Cascade)
 */

export async function subjectAccess(db: Db, leadId: string) {
  const detail = await getLeadDetail(db, leadId);
  const fu = await db
    .select()
    .from(followups)
    .where(eq(followups.leadId, leadId));
  const files = await db
    .select({
      id: attachments.id,
      originalFilename: attachments.originalFilename,
      mimeType: attachments.mimeType,
      byteSize: attachments.byteSize,
      createdAt: attachments.createdAt,
    })
    .from(attachments)
    .where(eq(attachments.leadId, leadId));
  const merges = await db
    .select()
    .from(leadMerges)
    .where(eq(leadMerges.mergedLeadId, leadId));
  return { ...detail, followups: fu, attachments: files, merges };
}

/** Anonymisierungs-Werte gemäß docs/retention.md. */
export const ANONYMIZED_LEAD_FIELDS = {
  firstName: null,
  lastName: null,
  email: null,
  phone: null,
  website: null,
  linkedin: null,
  position: null,
  company: "anonymisiert",
} as const;

export async function anonymizeLead(
  db: Db,
  params: { actorId: string; leadId: string; eventId: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const current = (
      await tx
        .select({ version: leads.version })
        .from(leads)
        .where(eq(leads.id, params.leadId))
        .limit(1)
    )[0];
    if (!current) throw errors.notFound("lead_not_found");

    await tx
      .update(leads)
      .set({
        ...ANONYMIZED_LEAD_FIELDS,
        anonymizedAt: new Date(),
        version: current.version + 1,
      })
      .where(eq(leads.id, params.leadId));
    await tx.delete(leadNotes).where(eq(leadNotes.leadId, params.leadId));
    await audit(tx, {
      actorId: params.actorId,
      action: "dsgvo.anonymize",
      entityType: "lead",
      entityId: params.leadId,
      eventId: params.eventId,
    });
  });
}

export async function eraseLead(
  db: Db,
  params: { actorId: string; leadId: string; eventId: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    // Audit VOR dem Löschen schreiben (danach ist die entityId verwaist).
    await audit(tx, {
      actorId: params.actorId,
      action: "dsgvo.erase",
      entityType: "lead",
      entityId: params.leadId,
      eventId: params.eventId,
    });
    const deleted = await tx
      .delete(leads)
      .where(eq(leads.id, params.leadId))
      .returning({ id: leads.id });
    if (deleted.length === 0) throw errors.notFound("lead_not_found");
  });
}
