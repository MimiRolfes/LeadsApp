# ADR 0001 — Stack-Auswahl

- Status: Akzeptiert (OQ-1: Greenfield). **Teilweise überarbeitet durch ADR 0004:**
  Frontend und Backend sind getrennte Services — Backend = **Hono**, nicht
  Next.js-Route-Handlers. Sprache/DB/ORM/Auth/Zod/Offline/Tests unverändert.
- Datum: 2026-08-31
- Kontext: `MASTER_PROMPT` §0, `CLAUDE.md` Regel 6/7

## Kontext
Greenfield-Projekt (siehe `docs/plan.md` §1). Kein bestehender humatter-Stack im Arbeitsverzeichnis. `CLAUDE.md` verlangt: bestehenden humatter-Stack bevorzugen, keine Neuarchitektur ohne dokumentierte Begründung. `MASTER_PROMPT` §0.4 erlaubt bei Greenfield einen Vorschlag: bevorzugt TypeScript end-to-end, React/Next.js PWA, PostgreSQL, typisierte APIs, serverseitige Validierung, EU-Hosting.

## Entscheidung
OQ-1 beantwortet: Greenfield, kein bestehender humatter-Stack. Damit gilt:

- **TypeScript strict**, end-to-end.
- **Next.js (App Router) + React** als Frontend/PWA (`apps/frontend`), SSR fürs Dashboard.
- **Hono + @hono/node-server** als eigenständiges Backend/API (`apps/backend`) —
  siehe ADR 0004. Schlank, container-freundlich, typed. (Ursprünglich: Next.js
  Route Handlers; verworfen, weil die Docker/Hetzner-Vorgabe getrennte Services
  verlangt.)
- **PostgreSQL** als einzige operative DB.
- **Drizzle ORM + handgeschriebene SQL-Migrationen** (migrations-first). Alternative Prisma: komfortabler, aber Migrationsschritte weniger explizit/überprüfbar.
- **Zod** für Schema-Validierung an jeder API-Grenze und als Single Source für Client/Server-Typen.
- **Session-Auth** (opaque Token, Server-Store) statt reiner JWT: erlaubt „Logout überall" und sofortige Invalidierung.
- **Workbox** (Service Worker) + **IndexedDB** (Outbox) für Offline.
- **Vitest** (unit/integration), **Playwright** (E2E, Offline, PWA-Smoke), **axe-core** (a11y).
- **ESLint + Prettier** strict; `any` nur mit Kommentar-Begründung.
- **EU/EWR-Hosting** verbindlich (Region Frankfurt o. ä.).

## Alternativen
| Option | Pro | Contra |
|---|---|---|
| Remix / React Router | gutes Data-Loading | kleineres PWA-Ökosystem, Team-Vertrautheit? |
| SvelteKit | schlank, schnell | weicht ggf. von humatter-Stack ab, weniger Verbreitung im Team |
| Separates Backend (NestJS) + SPA | klare Trennung | zwei Deploys, mehr Boilerplate, mehr Angriffsfläche |
| Prisma statt Drizzle | DX, Migrationsgenerierung | Migrations-Kontrolle geringer, Runtime-Overhead |
| JWT-only Auth | zustandslos | Revocation/„Logout überall" schwierig — Anforderung §2A |

## Konsequenzen
- Drizzle + SQL-Migrationen erfordern Disziplin bei Reviews (database-agent).
- Getrennte Services → expliziter API-Vertrag (Zod-DTOs in `packages/shared`, Phase 2).
- Backend-Routen „thin" halten: `authn → zod → authz → service` (`architecture.md` §3).
