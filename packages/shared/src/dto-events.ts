import { z } from "zod";
import { EVENT_ROLES, EVENT_STATUSES, QUESTION_TYPES } from "./constants";
import { emailField } from "./dto";

/** ISO-Datum (YYYY-MM-DD). */
const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format YYYY-MM-DD.");

export const EventCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).optional(),
  startsOn: dateField.optional(),
  endsOn: dateField.optional(),
  retentionDays: z.number().int().positive().max(3650).nullish(),
  retentionMode: z.enum(["anonymize", "hard_delete"]).optional(),
});
export type EventCreate = z.infer<typeof EventCreateSchema>;

export const EventUpdateSchema = EventCreateSchema.partial().extend({
  status: z.enum(EVENT_STATUSES).optional(),
});
export type EventUpdate = z.infer<typeof EventUpdateSchema>;

export const EventMemberAddSchema = z.object({
  email: emailField,
  eventRole: z.enum(EVENT_ROLES),
});
export type EventMemberAdd = z.infer<typeof EventMemberAddSchema>;

const selectOption = z.object({
  value: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
});

export const QuestionCreateSchema = z
  .object({
    prompt: z.string().trim().min(1).max(500),
    type: z.enum(QUESTION_TYPES),
    options: z.array(selectOption).max(50).optional(),
    position: z.number().int().min(0).max(1000).optional(),
    required: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    const needsOptions =
      v.type === "single_select" || v.type === "multi_select";
    if (needsOptions && (!v.options || v.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Auswahlfragen brauchen mindestens eine Option.",
      });
    }
  });
export type QuestionCreate = z.infer<typeof QuestionCreateSchema>;

export const QuestionUpdateSchema = z.object({
  prompt: z.string().trim().min(1).max(500).optional(),
  options: z.array(selectOption).max(50).optional(),
  position: z.number().int().min(0).max(1000).optional(),
  required: z.boolean().optional(),
});
export type QuestionUpdate = z.infer<typeof QuestionUpdateSchema>;
