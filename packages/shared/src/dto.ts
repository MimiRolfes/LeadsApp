import { z } from "zod";
import { GLOBAL_ROLES } from "./constants";

/**
 * API-Verträge zwischen Frontend und Backend. Einzige Quelle der Wahrheit
 * für Request-/Response-Formen. Feld-Level-Validierung hier; policy-abhängige
 * Prüfungen (z. B. erlaubte E-Mail-Domains) macht das Backend.
 *
 * Konvention: `*Schema` = Zod-Objekt, gleichnamiger Typ ohne Suffix.
 */

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_HINT = `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen und mindestens eine Ziffer.`;

/** E-Mail wird immer klein geschrieben und getrimmt. */
export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("Bitte eine gültige E-Mail-Adresse angeben.")
  .max(254);

export const passwordField = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen haben.`,
  )
  .max(PASSWORD_MAX_LENGTH)
  .regex(/\d/, "Das Passwort muss mindestens eine Ziffer enthalten.");

export const RegisterInputSchema = z.object({
  email: emailField,
  password: passwordField,
  displayName: z.string().trim().min(1).max(120).optional(),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: emailField,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  /** TOTP-Code, falls für das Konto 2FA aktiv ist. */
  code: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const PasswordForgotSchema = z.object({ email: emailField });
export type PasswordForgot = z.infer<typeof PasswordForgotSchema>;

export const PasswordResetSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordField,
});
export type PasswordReset = z.infer<typeof PasswordResetSchema>;

const totpCode = z.string().regex(/^\d{6}$/, "Sechsstelliger Code.");
export const TotpEnableSchema = z.object({
  secret: z.string().min(16).max(64),
  code: totpCode,
});
export type TotpEnable = z.infer<typeof TotpEnableSchema>;

export const TotpCodeSchema = z.object({ code: totpCode });
export type TotpCode = z.infer<typeof TotpCodeSchema>;

export const CurrentUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  displayName: z.string(),
  globalRole: z.enum(GLOBAL_ROLES),
});
export type CurrentUser = z.infer<typeof CurrentUserSchema>;

/** Standardisierte Fehlerantwort (keine Stacktraces/Secrets). */
export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string().optional(),
    fields: z.record(z.array(z.string())).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;
