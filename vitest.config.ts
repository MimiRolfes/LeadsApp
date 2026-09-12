import { defineConfig } from "vitest/config";

/**
 * Monorepo-Testlauf. Backend-Suiten starten je eine eigene In-Memory-
 * Postgres-Instanz (PGlite/WASM) — deshalb laufen Testdateien sequentiell,
 * damit nicht viele WASM-Instanzen gleichzeitig um Ressourcen konkurrieren.
 * Vom Frontend werden bislang nur reine Hilfsfunktionen getestet (node,
 * ohne DOM); Komponententests kämen als eigenes Projekt dazu.
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
      {
        test: {
          name: "frontend",
          root: "apps/frontend",
          environment: "node",
          include: ["src/lib/**/*.test.ts"],
        },
      },
    ],
  },
});
