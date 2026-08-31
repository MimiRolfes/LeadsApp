import { and, eq, inArray, isNull } from "drizzle-orm";
import type { LeadMerge } from "@humatter-leads/shared";
import type { Db } from "../db/types";
import {
  attachments,
  followups,
  leadAnswers,
  leadMerges,
  leadNotes,
  leadTags,
  leads,
} from "../db/schema";
import { errors } from "../lib/errors";
import { audit } from "./audit";
import type { LeadRow } from "./leads";
import { getLeadDetail } from "./leads";

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

/**
 * Zwei Leads zusammenführen (nur innerhalb desselben Events).
 * `surviving` bleibt bestehen und übernimmt Notizen/Tags/Antworten/Follow-ups/
 * Anhänge des `merged`; `merged` wird per Snapshot in `lead_merges` gesichert
 * und danach weich gelöscht. Transaktional, mit Audit.
 */
export async function mergeLeads(
  db: Db,
  params: {
    actorId: string;
    survivingLeadId: string;
    eventId: string;
    input: LeadMerge;
  },
): Promise<LeadRow> {
  const { actorId, survivingLeadId, eventId, input } = params;
  if (survivingLeadId === input.mergedLeadId) {
    throw errors.badRequest(
      "merge_same_lead",
      "Ein Lead kann nicht mit sich selbst zusammengeführt werden.",
    );
  }

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(leads)
      .where(
        and(
          inArray(leads.id, [survivingLeadId, input.mergedLeadId]),
          eq(leads.eventId, eventId),
          isNull(leads.deletedAt),
        ),
      );
    const surviving = rows.find((r) => r.id === survivingLeadId);
    const merged = rows.find((r) => r.id === input.mergedLeadId);
    if (!surviving || !merged) throw errors.notFound("lead_not_found");

    const snapshot = await getLeadDetail(tx, merged.id);

    // Kontaktfelder ggf. vom merged übernehmen; ansonsten Lücken füllen.
    const take = new Set(input.takeFields ?? []);
    const set: Record<string, unknown> = {};
    for (const key of CONTACT_KEYS) {
      const survVal = surviving[key];
      const mergedVal = merged[key];
      if (take.has(key) && mergedVal != null) set[key] = mergedVal;
      else if (survVal == null && mergedVal != null) set[key] = mergedVal;
    }
    set.version = surviving.version + 1;

    // additive Daten umhängen
    await tx
      .update(leadNotes)
      .set({ leadId: survivingLeadId })
      .where(eq(leadNotes.leadId, merged.id));
    await tx
      .update(followups)
      .set({ leadId: survivingLeadId })
      .where(eq(followups.leadId, merged.id));
    await tx
      .update(attachments)
      .set({ leadId: survivingLeadId })
      .where(eq(attachments.leadId, merged.id));

    // Tags: nur die, die surviving noch nicht hat
    const survTagIds = new Set(
      (
        await tx
          .select({ tagId: leadTags.tagId })
          .from(leadTags)
          .where(eq(leadTags.leadId, survivingLeadId))
      ).map((r) => r.tagId),
    );
    const mergedTags = await tx
      .select({ tagId: leadTags.tagId })
      .from(leadTags)
      .where(eq(leadTags.leadId, merged.id));
    for (const { tagId } of mergedTags) {
      if (!survTagIds.has(tagId)) {
        await tx.insert(leadTags).values({ leadId: survivingLeadId, tagId });
      }
    }
    await tx.delete(leadTags).where(eq(leadTags.leadId, merged.id));

    // Antworten: nur für Fragen, die surviving noch nicht beantwortet hat
    const survQ = new Set(
      (
        await tx
          .select({ questionId: leadAnswers.questionId })
          .from(leadAnswers)
          .where(eq(leadAnswers.leadId, survivingLeadId))
      ).map((r) => r.questionId),
    );
    const mergedAnswers = await tx
      .select()
      .from(leadAnswers)
      .where(eq(leadAnswers.leadId, merged.id));
    for (const a of mergedAnswers) {
      if (!survQ.has(a.questionId)) {
        await tx
          .update(leadAnswers)
          .set({ leadId: survivingLeadId })
          .where(eq(leadAnswers.id, a.id));
      }
    }
    await tx.delete(leadAnswers).where(eq(leadAnswers.leadId, merged.id));

    const [updated] = await tx
      .update(leads)
      .set(set)
      .where(eq(leads.id, survivingLeadId))
      .returning();

    await tx
      .update(leads)
      .set({ deletedAt: new Date() })
      .where(eq(leads.id, merged.id));

    await tx.insert(leadMerges).values({
      eventId,
      survivingLeadId,
      mergedLeadId: merged.id,
      performedBy: actorId,
      snapshot: snapshot as unknown as Record<string, unknown>,
    });

    await audit(tx, {
      actorId,
      action: "lead.merge",
      entityType: "lead",
      entityId: survivingLeadId,
      eventId,
      metadata: { mergedLeadId: merged.id },
    });

    return updated!;
  });
}
