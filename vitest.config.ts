import { defineConfig } from "vitest/config";

/**
 * Monorepo-Testlauf. Backend-Suiten starten je eine eigene In-Memory-
 * Postgres-Instanz (PGlite/WASM) — deshalb laufen Testdateien sequentiell,
 * damit nicht viele WASM-Instanzen gleichzeitig um Ressourcen konkurrieren.
 * Frontend-Komponententests kommen in Phase 3 als eigenes Projekt hinzu.
 */
export default defineConfig({
  test: {
    fileParallelism: false,
    hookTimeout: 40000,
    testTimeout: 30000,
    projects: [
      {
        test: {
          name: "shared",
          root: "packages/shared",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "backend",
          root: "apps/backend",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
    ],
  },
});
