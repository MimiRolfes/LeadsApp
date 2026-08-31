"use client";

/**
 * Verkleinert ein Kamerabild (Visitenkarte) client-seitig und normalisiert es
 * auf JPEG. Messe-Fotos sind schnell 5–12 MB und teils HEIC — der Upload-
 * Endpoint akzeptiert nur jpeg/png/webp/pdf und begrenzt die Größe. Das
 * Re-Encoding über ein Canvas löst beides und spart Bandbreite am Stand.
 */
export async function downscaleToJpeg(
  file: File,
  { maxDim = 1600, quality = 0.82 }: { maxDim?: number; quality?: number } = {},
): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // Browser kann das Format nicht dekodieren → Original hochladen

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) return file;

  const base = file.name.replace(/\.[^.]+$/, "") || "visitenkarte";
  return new File([blob], `${base}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
