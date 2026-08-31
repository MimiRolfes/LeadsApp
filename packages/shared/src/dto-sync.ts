import { z } from "zod";
import { LeadCreateSchema, LeadUpdateSchema } from "./dto-leads";

/**
 * Batch-Sync für die Offline-Warteschlange (ADR 0003). Operationen werden
 * server-seitig sequentiell abgearbeitet; die Antwort enthält pro Operation
 * ein Ergebnis (`synced` / `conflict` / `failed`) — nie ein stiller Verlust.
 */
export const SyncOperationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("lead.create"),
    localId: z.string().uuid(),
    eventId: z.string().uuid(),
    payload: LeadCreateSchema,
  }),
  z.object({
    kind: z.literal("lead.update"),
    localId: z.string().uuid(),
    eventId: z.string().uuid(),
    leadId: z.string().uuid(),
    payload: LeadUpdateSchema,
  }),
]);
export type SyncOperation = z.infer<typeof SyncOperationSchema>;

export const SyncPushSchema = z.object({
  operations: z.array(SyncOperationSchema).min(1).max(200),
});
export type SyncPush = z.infer<typeof SyncPushSchema>;

export type SyncResult = {
  localId: string;
  status: "synced" | "conflict" | "failed";
  serverId?: string;
  version?: number;
  /** bei "conflict": aktueller Serverstand bzw. Duplikat-Kandidaten */
  server?: unknown;
  error?: string;
};
