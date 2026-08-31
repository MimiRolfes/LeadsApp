import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { FollowupUpdateSchema } from "@humatter-leads/shared";
import type { AppEnv } from "../types";
import { requireAuthz } from "../auth/middleware";
import { assertCanEditFollowup } from "../authz";
import { getFollowupRef, updateFollowup } from "../domain/followups";
import { getLeadRef } from "../domain/leads";
import { errors } from "../lib/errors";
import { onInvalid } from "../lib/validation";

/** Follow-up-Bearbeitung (by id). Erstellen/Listen liegt event-/lead-gescopt. */
export const followupRoutes = new Hono<AppEnv>();

followupRoutes.use("*", requireAuthz);

async function loadRefs(c: Context<AppEnv>) {
  const followupId = c.req.param("followupId");
  if (!followupId) throw errors.notFound("followup_not_found");
  const fu = await getFollowupRef(c.get("db"), followupId);
  if (!fu) throw errors.notFound("followup_not_found");
  const lead = await getLeadRef(c.get("db"), fu.leadId);
  if (!lead) throw errors.notFound("lead_not_found");
  return { fu, lead };
}

followupRoutes.patch(
  "/:followupId",
  zValidator("json", FollowupUpdateSchema, onInvalid),
  async (c) => {
    const { fu, lead } = await loadRefs(c);
    assertCanEditFollowup(
      c.get("authz")!,
      lead.eventId,
      lead.ownerId,
      fu.assigneeId,
    );
    const followup = await updateFollowup(c.get("db"), {
      actorId: c.get("user")!.id,
      followupId: fu.id,
      eventId: lead.eventId,
      patch: c.req.valid("json"),
    });
    return c.json({ followup });
  },
);
