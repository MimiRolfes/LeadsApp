import { z } from "zod";

/**
 * Validierte Umgebungskonfiguration des Frontends.
 *
 * Grundsatz: keine Infrastrukturwerte im Code. Der Browser bekommt nur
 * `NEXT_PUBLIC_*`. Serverseitige Werte (z. B. die interne Backend-URL)
 * verlassen den Server nie.
 */
const ServerSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  /**
   * Interne URL des Backend-Service im Docker-Netzwerk. Wird nur
   * serverseitig für das /api-Proxying und SSR-Fetches genutzt.
   */
  BACKEND_INTERNAL_URL: z.string().url().default("http://localhost:8080"),
});

const PublicSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("humatter Leads"),
});

function parse<S extends z.ZodTypeAny>(schema: S, src: unknown): z.infer<S> {
  const r = schema.safeParse(src);
  if (!r.success) {
    const issues = r.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Ungültige Frontend-Umgebung:\n${issues}\nSiehe .env.example.`,
    );
  }
  return r.data;
}

export const serverEnv = parse(ServerSchema, {
  NODE_ENV: process.env.NODE_ENV,
  BACKEND_INTERNAL_URL: process.env.BACKEND_INTERNAL_URL,
});

export const publicEnv = parse(PublicSchema, {
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
});
