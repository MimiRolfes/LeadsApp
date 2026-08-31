import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { LeadNoteCreateSchema, LeadUpdateSchema } from "@humatter-leads/shared";
import type { AppEnv } from "../types";
import { requireAuthz } from "../auth/middleware";
import { assertCanEditLead, assertCanViewLead } from "../authz";
import {
  addLeadNote,
  getLeadDetail,
  getLeadRef,
  softDeleteLead,
  updateLead,
} from "../domain/leads";
import { errors } from "../lib/errors";
import { onInvalid } from "../lib/validation";

/**
 * Lead-Detail-Operationen (by id). Event-gescoptes Erfassen/Listen liegt
 * unter `/api/events/:eventId/leads` (routes/events.ts).
 */
export const leadRoutes = new Hono<AppEnv>();

leadRoutes.use("*", requireAuthz);

async function loadRef(c: Context<AppEnv>) {
  const leadId = c.req.param("leadId");
  if (!leadId) throw errors.notFound("lead_not_found");
  const ref = await getLeadRef(c.get("db"), leadId);
  if (!ref) throw errors.notFound("lead_not_found");
  return ref;
}

leadRoutes.get("/:leadId", async (c) => {
  const ref = await loadRef(c);
  assertCanViewLead(c.get("authz")!, ref.eventId, ref.ownerId);
  return c.json(await getLeadDetail(c.get("db"), ref.id));
});

leadRoutes.patch(
  "/:leadId",
  zValidator("json", LeadUpdateSchema, onInvalid),
  async (c) => {
    const ref = await loadRef(c);
    assertCanEditLead(c.get("authz")!, ref.eventId, ref.ownerId);
    const lead = await updateLead(c.get("db"), {
      actorId: c.get("user")!.id,
      leadId: ref.id,
      eventId: ref.eventId,
      patch: c.req.valid("json"),
    });
    return c.json({ lead });
  },
);

leadRoutes.delete("/:leadId", async (c) => {
  const ref = await loadRef(c);
  assertCanEditLead(c.get("authz")!, ref.eventId, ref.ownerId);
  await softDeleteLead(c.get("db"), {
    actorId: c.get("user")!.id,
    leadId: ref.id,
    eventId: ref.eventId,
  });
  return c.body(null, 204);
});

leadRoutes.post(
  "/:leadId/notes",
  zValidator("json", LeadNoteCreateSchema, onInvalid),
  async (c) => {
    const ref = await loadRef(c);
    assertCanEditLead(c.get("authz")!, ref.eventId, ref.ownerId);
    const note = await addLeadNote(c.get("db"), {
      actorId: c.get("user")!.id,
      leadId: ref.id,
      eventId: ref.eventId,
      input: c.req.valid("json"),
    });
    return c.json({ note }, 201);
  },
);
