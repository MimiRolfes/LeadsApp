// Bündelt das Backend zu eigenständigen ESM-Dateien in dist/.
// Ziel: schlankes Runtime-Image ohne node_modules (nur dist/ + Migrationen).
import { build } from "esbuild";
import { cp, rm, mkdir } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

/**
 * `src/db/dev.ts` ist der PGlite-Dev-Treiber. Er wird nur dynamisch importiert
 * (server.ts / seed.ts) und darf NICHT ins Bundle wandern — sonst hebt esbuild
 * seine `@electric-sql/pglite`-Imports an den Modulkopf von `dist/server.js`,
 * und das Runtime-Image (ohne node_modules) stürzt beim Start ab.
 * Der Import bleibt so ein lazy Runtime-`import("./dev")`, der in Produktion
 * (DB_DRIVER=postgres) nie ausgeführt wird.
 */
const externalizeDevDb = {
  name: "externalize-dev-db",
  setup(b) {
    b.onResolve({ filter: /(^|\/)(db\/)?dev$/ }, (args) =>
      args.kind === "dynamic-import"
        ? { path: args.path, external: true }
        : null,
    );
  },
};

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
  // postgres.js optionale native Bindung ist nicht nötig.
  external: ["pg-native", "cloudflare:sockets"],
  plugins: [externalizeDevDb],
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
  logLevel: "info",
});

// Migrationen neben die gebündelten Runner legen (import.meta.url -> dist/)
await cp("src/db/migrations", "dist/migrations", { recursive: true });

console.log("backend build complete -> dist/");
