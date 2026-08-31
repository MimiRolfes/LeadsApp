import type { SyncOperation, SyncResult } from "@humatter-leads/shared";
import type { Db } from "../db/types";
import type { AuthCtx } from "../authz";
import { assertCanCaptureLead, assertCanEditLead } from "../authz";
import { ApiError } from "../lib/errors";
import { createLead, getLeadDetail, getLeadRef, updateLead } from "./leads";

/**
 * Batch-Sync (ADR 0003). Operationen werden sequentiell abgearbeitet; jede
 * Operation liefert ein eigenes Ergebnis zurück. Fehler einer Operation
 * brechen den Rest NICHT ab — kein stiller Verlust.
 */
export async function processSync(
  db: Db,
  ctx: AuthCtx,
  operations: SyncOperation[],
  ip?: string | null,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const op of operations) {
    try {
      if (op.kind === "lead.create") {
        assertCanCaptureLead(ctx, op.eventId);
        const res = await createLead(db, {
          actorId: ctx.userId,
          eventId: op.eventId,
          input: op.payload,
          ip,
        });
        if (res.status === "duplicate") {
          results.push({
            localId: op.localId,
            status: "conflict",
            server: { candidates: res.candidates },
          });
        } else {
          results.push({
            localId: op.localId,
            status: "synced",
            serverId: res.lead.id,
            version: res.lead.version,
          });
        }
        continue;
      }

      // lead.update
      const ref = await getLeadRef(db, op.leadId);
      if (!ref || ref.eventId !== op.eventId) {
        results.push({
          localId: op.localId,
          status: "failed",
          error: "lead_not_found",
        });
        continue;
      }
      assertCanEditLead(ctx, ref.eventId, ref.ownerId);
      try {
        const lead = await updateLead(db, {
          actorId: ctx.userId,
          leadId: ref.id,
          eventId: ref.eventId,
          patch: op.payload,
        });
        results.push({
          localId: op.localId,
          status: "synced",
          serverId: lead.id,
          version: lead.version,
        });
      } catch (err) {
        if (err instanceof ApiError && err.code === "version_conflict") {
          results.push({
            localId: op.localId,
            status: "conflict",
            server: await getLeadDetail(db, ref.id),
          });
        } else {
          throw err;
        }
      }
    } catch (err) {
      results.push({
        localId: op.localId,
        status: "failed",
        error: err instanceof ApiError ? err.code : "internal_error",
      });
    }
  }

  return results;
}
