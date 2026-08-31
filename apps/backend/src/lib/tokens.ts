import { webcrypto } from "node:crypto";

/**
 * Undurchsichtige Zufallstoken (Session, Passwort-Reset).
 * In der DB wird NUR der SHA-256-Hash gespeichert — ein DB-Leak gibt keine
 * gültigen Token preis.
 */
const TOKEN_BYTES = 32;

export function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  webcrypto.getRandomValues(bytes);
  return base64url(bytes);
}

export async function hashToken(token: string): Promise<string> {
  const digest = await webcrypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return base64url(new Uint8Array(digest));
}

/** Hash beliebiger Klartext-Metadaten (IP, User-Agent) für Logs/Audit. */
export async function hashOpaque(value: string): Promise<string> {
  return hashToken(value);
}

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
