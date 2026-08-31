import { z } from "zod";
import { FOLLOWUP_STATUSES } from "./constants";

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format YYYY-MM-DD.");

export const FollowupCreateSchema = z.object({
  dueOn: dateField.optional(),
  assigneeId: z.string().uuid().optional(),
  note: z.string().trim().max(2000).optional(),
  templateId: z.string().uuid().optional(),
});
export type FollowupCreate = z.infer<typeof FollowupCreateSchema>;

export const FollowupUpdateSchema = z.object({
  status: z.enum(FOLLOWUP_STATUSES).optional(),
  dueOn: dateField.nullish(),
  assigneeId: z.string().uuid().nullish(),
  note: z.string().trim().max(2000).nullish(),
});
export type FollowupUpdate = z.infer<typeof FollowupUpdateSchema>;

export const FollowupListQuerySchema = z.object({
  status: z.enum(FOLLOWUP_STATUSES).optional(),
  assigneeId: z.string().uuid().optional(),
  due: z.enum(["today", "overdue", "upcoming"]).optional(),
});
export type FollowupListQuery = z.infer<typeof FollowupListQuerySchema>;

export const FollowupTemplateCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(5000),
});
export type FollowupTemplateCreate = z.infer<
  typeof FollowupTemplateCreateSchema
>;
