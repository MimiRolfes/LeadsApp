import { createHmac, timingSafeEqual, webcrypto } from "node:crypto";

/**
 * Minimaler TOTP (RFC 6238, SHA-1, 6 Stellen, 30-s-Schritt) — ohne
 * externe Abhängigkeit. Für die optionale 2FA.
 */
const DIGITS = 6;
const PERIOD = 30;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateSecret(): string {
  const bytes = new Uint8Array(20);
  webcrypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

export function otpauthUri(secret: string, account: string): string {
  const issuer = encodeURIComponent("humatter Leads");
  return `otpauth://totp/${issuer}:${encodeURIComponent(
    account,
  )}?secret=${secret}&issuer=${issuer}&digits=${DIGITS}&period=${PERIOD}`;
}

export function verify(
  secret: string,
  code: string,
  window = 1,
  atMs = Date.now(),
): boolean {
  const clean = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const counter = Math.floor(atMs / 1000 / PERIOD);
  for (let i = -window; i <= window; i++) {
    if (constantTimeEqual(generate(secret, counter + i), clean)) return true;
  }
  return false;
}

/** Aktuellen 6-stelligen Code erzeugen (v. a. für Tests / QR-Preview). */
export function currentCode(secret: string, atMs = Date.now()): string {
  return generate(secret, Math.floor(atMs / 1000 / PERIOD));
}

function generate(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const bin =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (bin % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
