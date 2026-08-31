import { errors } from "./errors";

/**
 * Hook für `@hono/zod-validator`: bei ungültiger Eingabe einen
 * strukturierten 422-Fehler mit Feld-Details werfen (kein Stacktrace).
 */
export function onInvalid(result: { success: boolean; error?: unknown }): void {
  if (!result.success) {
    const flat = (
      result.error as { flatten(): { fieldErrors: Record<string, string[]> } }
    ).flatten();
    throw errors.validation(flat.fieldErrors);
  }
}
