// Bündelt das Backend zu eigenständigen ESM-Dateien in dist/.
// Ziel: schlankes Runtime-Image ohne node_modules (nur dist/ + Migrationen).
import { build } from "esbuild";
import { cp, rm, mkdir } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

await build({
  entryPoints: {
    server: "src/server.ts",
    migrate: "src/db/migrate.ts",
    seed: "src/db/seed.ts",
    retention: "src/jobs/retention.ts",
  },
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  // postgres.js optionale native Bindung ist nicht nötig; PGlite ist nur ein
  // Dev-Only-Treiber (dynamischer Import, nie in Produktion geladen).
  external: [
    "pg-native",
    "cloudflare:sockets",
    "@electric-sql/pglite",
    "drizzle-orm/pglite",
    "drizzle-orm/pglite/migrator",
  ],
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
  logLevel: "info",
});

// Migrationen neben die gebündelten Runner legen (import.meta.url -> dist/)
await cp("src/db/migrations", "dist/migrations", { recursive: true });

console.log("backend build complete -> dist/");
