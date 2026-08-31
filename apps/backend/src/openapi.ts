/**
 * Kompakte OpenAPI-3.1-Beschreibung der API. Request-/Response-Schemata
 * sind bewusst knapp gehalten (die verbindlichen Formen stehen als Zod-DTOs
 * in `@humatter-leads/shared`); dies dient als maschinenlesbarer Index.
 * Serviert unter `GET /api/openapi.json`.
 */
const op = (summary: string, extra: Record<string, unknown> = {}) => ({
  summary,
  responses: { default: { description: "siehe @humatter-leads/shared" } },
  ...extra,
});

const cookieAuth = [{ cookieAuth: [] }];

export const openapiDocument = {
  openapi: "3.1.0",
  info: {
    title: "humatter Leads API",
    version: "0.0.0",
    description:
      "Interne Messe-Lead-App. Session-Cookie-Auth. Alle Fehler: { error: { code, message?, fields? } }.",
  },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: {
      cookieAuth: { type: "apiKey", in: "cookie", name: "hl_session" },
    },
  },
  paths: {
    "/health": { get: op("Liveness (kein Auth, kein DB-Zugriff)") },
    "/health/ready": { get: op("Readiness inkl. DB") },

    "/auth/register": {
      post: op("Konto anlegen (nur erlaubte E-Mail-Domain)"),
    },
    "/auth/login": { post: op("Anmelden (optional TOTP-Code)") },
    "/auth/logout": {
      post: op("Aktuelle Session beenden", { security: cookieAuth }),
    },
    "/auth/logout-all": {
      post: op("Von allen Geräten abmelden", { security: cookieAuth }),
    },
    "/auth/me": { get: op("Aktueller Nutzer", { security: cookieAuth }) },
    "/auth/password/forgot": {
      post: op("Passwort-Reset anfordern (immer 202)"),
    },
    "/auth/password/reset": { post: op("Passwort mit Token neu setzen") },
    "/auth/2fa/setup": {
      post: op("TOTP-Secret erzeugen", { security: cookieAuth }),
    },
    "/auth/2fa/enable": {
      post: op("TOTP aktivieren", { security: cookieAuth }),
    },
    "/auth/2fa/disable": {
      post: op("TOTP deaktivieren", { security: cookieAuth }),
    },

    "/events": {
      get: op("Eigene Events auflisten", { security: cookieAuth }),
      post: op("Event anlegen (Ersteller wird Manager)", {
        security: cookieAuth,
      }),
    },
    "/events/{eventId}": {
      get: op("Event lesen", { security: cookieAuth }),
      patch: op("Event ändern (Manager)", { security: cookieAuth }),
    },
    "/events/{eventId}/members": {
      get: op("Team lesen", { security: cookieAuth }),
      post: op("Mitglied per E-Mail zuweisen (Manager)", {
        security: cookieAuth,
      }),
    },
    "/events/{eventId}/members/{userId}": {
      delete: op("Mitglied entfernen (Manager)", { security: cookieAuth }),
    },
    "/events/{eventId}/questions": {
      get: op("Fragenkatalog lesen", { security: cookieAuth }),
      post: op("Frage anlegen (Manager)", { security: cookieAuth }),
    },
    "/events/{eventId}/questions/{questionId}": {
      patch: op("Frage ändern (Manager)", { security: cookieAuth }),
    },
    "/events/{eventId}/questions/{questionId}/archive": {
      post: op("Frage archivieren (Manager)", { security: cookieAuth }),
    },
    "/events/{eventId}/leads": {
      get: op("Leads auflisten (Filter/Pagination)", { security: cookieAuth }),
      post: op("Lead erfassen (idempotent via clientLocalId; Duplikat → 409)", {
        security: cookieAuth,
      }),
    },
    "/events/{eventId}/followups": {
      get: op("Follow-ups des Events (Filter)", { security: cookieAuth }),
    },
    "/events/{eventId}/followup-templates": {
      get: op("Vorlagen lesen", { security: cookieAuth }),
      post: op("Vorlage anlegen (Manager)", { security: cookieAuth }),
    },
    "/events/{eventId}/stats": {
      get: op("Dashboard-Kennzahlen", { security: cookieAuth }),
    },
    "/events/{eventId}/exports": {
      post: op("Leads exportieren CSV/JSON (Manager) → Datei-Download", {
        security: cookieAuth,
      }),
    },

    "/leads/{leadId}": {
      get: op("Lead-Detail (Antworten/Notizen/Tags)", { security: cookieAuth }),
      patch: op("Lead ändern (optimistische Sperre: expectedVersion)", {
        security: cookieAuth,
      }),
      delete: op("Lead weich löschen", { security: cookieAuth }),
    },
    "/leads/{leadId}/notes": {
      post: op("Notiz hinzufügen", { security: cookieAuth }),
    },
    "/leads/{leadId}/followups": {
      post: op("Follow-up anlegen", { security: cookieAuth }),
    },
    "/leads/{leadId}/attachments": {
      get: op("Anhänge auflisten", { security: cookieAuth }),
      post: op("Anhang hochladen (multipart 'file', JPEG/PNG/WebP/PDF)", {
        security: cookieAuth,
      }),
    },
    "/leads/{leadId}/merge": {
      post: op("Zwei Leads zusammenführen (Manager)", { security: cookieAuth }),
    },
    "/leads/{leadId}/data": {
      get: op("DSGVO-Auskunft: alle Daten des Leads (Manager)", {
        security: cookieAuth,
      }),
    },
    "/leads/{leadId}/delete": {
      post: op("DSGVO: anonymize | erase (Manager)", { security: cookieAuth }),
    },

    "/attachments/{attachmentId}": {
      get: op("Anhang herunterladen (nur 'clean')", { security: cookieAuth }),
      delete: op("Anhang löschen", { security: cookieAuth }),
    },
    "/followups/{followupId}": {
      patch: op("Follow-up ändern (Manager/Zuständige:r/Owner)", {
        security: cookieAuth,
      }),
    },
    "/sync": {
      post: op(
        "Offline-Warteschlange abarbeiten → results[] (synced/conflict/failed)",
        {
          security: cookieAuth,
        },
      ),
    },
  },
} as const;
