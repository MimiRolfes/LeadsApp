import { webcrypto } from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";

/**
 * Passwort-Hashing mit Argon2id (pure WASM — keine nativen Abhängigkeiten,
 * bundelt sauber ins eigenständige Backend-Image).
 *
 * Parameter an OWASP-Mindestempfehlung angelehnt (m=19 MiB, t=2, p=1).
 * Der Hash ist selbstbeschreibend (`$argon2id$v=19$m=...`), sodass die
 * Parameter später ohne Migration erhöht werden können.
 */
const MEMORY_KIB = 19456;
const ITERATIONS = 2;
const PARALLELISM = 1;
const HASH_LENGTH = 32;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_LENGTH);
  webcrypto.getRandomValues(salt);
  return argon2id({
    password,
    salt,
    parallelism: PARALLELISM,
    iterations: ITERATIONS,
    memorySize: MEMORY_KIB,
    hashLength: HASH_LENGTH,
    outputType: "encoded",
  });
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  try {
    return await argon2Verify({ password, hash });
  } catch {
    // Unbrauchbarer Hash-String → als Fehlschlag behandeln, nicht werfen.
    return false;
  }
}
