/**
 * Minimaler strukturierter Logger (JSON, eine Zeile pro Ereignis).
 *
 * Regeln (CLAUDE.md / docs/architecture.md §13):
 * - keine PII (Namen, E-Mails, Telefonnummern, Notizen, Tokens) loggen
 * - keine Stacktraces/Secrets in Client-Antworten
 * - Felder bewusst wählen: was, wo, Ergebnis, Korrelation
 *
 * In Phase 2 ggf. durch pino o. ä. ersetzen; die Schnittstelle bleibt gleich.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<
  string,
  string | number | boolean | null | undefined
>;

const DENYLIST = [
  "email",
  "name",
  "firstName",
  "lastName",
  "phone",
  "password",
  "token",
  "note",
  "notes",
];

function redact(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = DENYLIST.includes(key) ? "[redacted]" : value;
  }
  return out;
}

function emit(level: LogLevel, message: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    level,
    ts: new Date().toISOString(),
    msg: message,
    ...redact(fields),
  });
  // eslint-disable-next-line no-console
  (level === "error" || level === "warn" ? console.error : console.log)(line);
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => emit("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => emit("error", msg, fields),
};
