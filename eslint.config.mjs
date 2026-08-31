import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

const config = [
  {
    ignores: [
      "**/.next/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/next-env.d.ts",
      "apps/backend/src/db/migrations/**",
    ],
  },
  js.configs.recommended,
  // TypeScript (alle Workspaces)
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // CLAUDE.md Coding Standards
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-unused-vars": "off",
      "no-undef": "off",
    },
  },
  // Next.js-Regeln nur fürs Frontend
  ...compat
    .extends("next/core-web-vitals")
    .map((c) => ({ ...c, files: ["apps/frontend/**/*.{ts,tsx}"] })),
  {
    files: ["apps/frontend/**/*.{ts,tsx}"],
    rules: {
      // App Router, kein pages/-Verzeichnis
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  // Prettier zuletzt (schaltet stilistische Regeln ab)
  ...compat.extends("prettier"),
  {
    files: ["**/*.{ts,tsx,mjs}"],
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-empty": ["error", { allowEmptyCatch: false }],
    },
  },
  // Node-Skripte (Build/Config) laufen in Node
  {
    files: ["**/*.mjs", "**/*.config.{ts,mjs}"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        URL: "readonly",
        __dirname: "readonly",
      },
    },
    rules: { "no-console": "off", "no-undef": "off" },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "no-console": "off" },
  },
];

export default config;
