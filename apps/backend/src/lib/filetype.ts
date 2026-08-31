/**
 * Sehr einfache Magic-Byte-Erkennung für die erlaubten Upload-Typen.
 * Verhindert Content-Type-Spoofing (Client-`type` wird nicht vertraut).
 */
export type AllowedMime =
  "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

export const ALLOWED_MIME: AllowedMime[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const EXT: Record<AllowedMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function extensionFor(mime: AllowedMime): string {
  return EXT[mime];
}

function startsWith(buf: Uint8Array, sig: number[]): boolean {
  if (buf.length < sig.length) return false;
  return sig.every((b, i) => buf[i] === b);
}

/** Gibt den erkannten MIME-Typ zurück oder null, wenn nicht erlaubt. */
export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]))
    return "application/pdf";
  return null;
}
