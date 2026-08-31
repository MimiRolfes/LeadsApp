import { defineConfig } from "vitest/config";

/**
 * Monorepo-Testlauf. Frontend-Komponententests kommen in Phase 3 als
 * eigenes Projekt hinzu.
 */
export default defineConfig({
  test: {
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
          // PGlite (WASM) startet je Suite eine Postgres-Instanz
          testTimeout: 20000,
        },
      },
    ],
  },
});
