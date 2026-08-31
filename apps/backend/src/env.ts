import { z } from "zod";

/**
 * Zentrale, validierte Umgebungskonfiguration des Backends.
 *
 * Grundsatz (siehe docs/HETZNER_DEPLOYMENT.md): KEINE Server-, DB- oder
 * Infrastrukturwerte im Code. Alles Deployment-Abhängige kommt aus der
 * Umgebung und wird hier einmalig beim Start geprüft. Bei fehlenden/
 * ungültigen Pflichtwerten bricht der Prozess mit klarer Meldung ab.
 */

const isProd = process.env.NODE_ENV === "production";

/** In Produktion Pflicht, sonst optional (lokale DX ohne vollständige .env). */
const requiredInProd = <T extends z.ZodTypeAny>(schema: T) =>
  isProd ? schema : schema.optional();

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /** Port, auf dem das Backend im Container lauscht. */
  PORT: z.coerce.number().int().positive().max(65535).default(8080),

  /**
   * Erlaubte Browser-Origin(s) für CORS, kommagetrennt. Bei der empfohlenen
   * Topologie (Frontend proxyt /api → Backend) ist CORS nicht nötig und kann
   * leer bleiben. Für direkten Browser→Backend-Zugriff hier die Frontend-URL
   * eintragen.
   */
  CORS_ALLOWED_ORIGINS: z.string().optional(),

  /** Hinter Reverse Proxy / Frontend-Proxy: X-Forwarded-* auswerten. */
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  // --- Datenbank ---
  DATABASE_URL: requiredInProd(z.string().url()),
  DATABASE_SSL: z.enum(["disable", "require", "no-verify"]).default("disable"),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),

  // --- Auth / Session ---
  SESSION_SECRET: requiredInProd(z.string().min(32)),
  SESSION_IDLE_TTL_MINUTES: z.coerce.number().int().positive().default(60),
  SESSION_ABSOLUTE_TTL_HOURS: z.coerce.number().int().positive().default(12),

  // --- Uploads / Objektspeicher ---
  UPLOAD_DRIVER: z.enum(["local", "s3"]).default("local"),
  UPLOAD_LOCAL_DIR: z.string().default("./.data/uploads"),
  UPLOAD_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  // --- E-Mail (Passwort-Reset) ---
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().max(65535).default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default("humatter Leads <no-reply@example.invalid>"),

  // --- Rate Limiting ---
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),

  // --- Retention / Cleanup ---
  EXPORT_RETENTION_DAYS: z.coerce.number().int().positive().default(7),
  SYNC_RECEIPT_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(365),

  // --- Seed ---
  SEED_ALLOW: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof EnvSchema>;

function parseOrThrow<S extends z.ZodTypeAny>(
  schema: S,
  source: unknown,
): z.infer<S> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Ungültige Backend-Umgebungskonfiguration:\n${issues}\nSiehe .env.example.`,
    );
  }
  return parsed.data;
}

export const env: Env = parseOrThrow(EnvSchema, process.env);

export function corsOrigins(): string[] {
  return (env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
