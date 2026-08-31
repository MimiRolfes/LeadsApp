import { z } from "zod";
import { CONSENT_STATUSES, LEAD_PRIORITIES, LEGAL_BASES } from "./constants";

const trimmedMax = (max: number) => z.string().trim().max(max);

/** Kontaktdaten (B2B). Alle Felder optional — am Stand zählt Tempo. */
export const LeadContactSchema = z.object({
  firstName: trimmedMax(120).optional(),
  lastName: trimmedMax(120).optional(),
  company: trimmedMax(200).optional(),
  position: trimmedMax(160).optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Ungültige E-Mail-Adresse.")
    .max(254)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: trimmedMax(60).optional(),
  website: trimmedMax(300).optional(),
  linkedin: trimmedMax(300).optional(),
  country: trimmedMax(2).optional(),
  language: trimmedMax(10).optional(),
  source: trimmedMax(120).optional(),
});

/** Qualifizierung. `legalBasis`/`consentStatus` bewusst getrennt vom Score. */
export const LeadQualificationSchema = z.object({
  priority: z.enum(LEAD_PRIORITIES).nullish(),
  leadScore: z.number().int().min(0).max(100).nullish(),
  legalBasis: z.enum(LEGAL_BASES).optional(),
  consentStatus: z.enum(CONSENT_STATUSES).optional(),
  /** Antworten auf den Fragenkatalog: { questionId: value }. */
  answers: z.record(z.string().uuid(), z.unknown()).optional(),
  /** Interessens-Tags als Labels. */
  tags: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  /** Eine erste Gesprächsnotiz (Freitext). */
  note: z.string().trim().max(5000).optional(),
});

export const LeadCreateSchema = LeadContactSchema.merge(
  LeadQualificationSchema,
).extend({
  /** Vom Client vor dem ersten Speichern erzeugt (UUID v4). */
  clientLocalId: z.string().uuid(),
  /** Duplikatprüfung überspringen (Nutzer hat „trotzdem neu" gewählt). */
  allowDuplicate: z.boolean().optional(),
});
export type LeadCreate = z.infer<typeof LeadCreateSchema>;

export const LeadUpdateSchema = LeadContactSchema.merge(
  LeadQualificationSchema.omit({ note: true }),
)
  .partial()
  .extend({
    /** Optimistische Sperre — muss der aktuellen `version` entsprechen. */
    expectedVersion: z.number().int().positive(),
    ownerId: z.string().uuid().nullish(),
  });
export type LeadUpdate = z.infer<typeof LeadUpdateSchema>;

export const LeadNoteCreateSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});
export type LeadNoteCreate = z.infer<typeof LeadNoteCreateSchema>;

export const LeadListQuerySchema = z.object({
  scope: z.enum(["mine", "all"]).optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  ownerId: z.string().uuid().optional(),
  q: z.string().trim().max(120).optional(),
  tag: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type LeadListQuery = z.infer<typeof LeadListQuerySchema>;
