import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { env } from "../env";
import { errors } from "./errors";

/**
 * Objektspeicher: Dateien liegen als Datei im Verzeichnis. Ein anderer
 * Speicher (S3 o. ä.) wird hier ergänzt, wenn er gebraucht wird — die
 * Aufrufer sehen nur putObject/getObject/deleteObject.
 *
 * Keys sind zufällig und liegen unter `UPLOAD_LOCAL_DIR`. Path-Traversal ist
 * ausgeschlossen: der aufgelöste Pfad muss innerhalb des Basisverzeichnisses
 * liegen.
 */
function localPath(key: string): string {
  const base = resolve(env.UPLOAD_LOCAL_DIR);
  const full = resolve(join(base, key));
  if (full !== base && !full.startsWith(base + "/")) {
    throw errors.badRequest("bad_storage_key");
  }
  return full;
}

export async function putObject(key: string, bytes: Uint8Array): Promise<void> {
  const path = localPath(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

export async function getObject(key: string): Promise<Uint8Array> {
  const path = localPath(key);
  try {
    return new Uint8Array(await readFile(path));
  } catch {
    throw errors.notFound("object_not_found");
  }
}

export async function deleteObject(key: string): Promise<void> {
  await rm(localPath(key), { force: true });
}
