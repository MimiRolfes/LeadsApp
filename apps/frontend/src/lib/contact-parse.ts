/**
 * Parst den Rohinhalt eines gescannten QR-Codes in Kontaktfelder.
 *
 * Auf Messen sind mehrere Kodierungen üblich:
 *  - vCard (BEGIN:VCARD …)               — Aussteller-Badges, "digitale Visitenkarte"
 *  - MECARD:N:…;TEL:…;EMAIL:…;;          — ältere Badge-Systeme / Japan
 *  - mailto:                             — simple Kontakt-Codes
 *  - http(s)://…                         — Lead-Retrieval-Link des Messeveranstalters
 *  - freier Text                         — Fallback
 *
 * Rückgabe: nur die erkannten Felder + `raw` (immer) + optional `link`/`note`
 * für nicht strukturierbare Inhalte. Nichts wird erfunden.
 */

export interface ParsedContact {
  firstName?: string;
  lastName?: string;
  company?: string;
  position?: string;
  email?: string;
  phone?: string;
  country?: string;
  /** Nicht auflösbarer Link (z. B. Lead-Retrieval-URL des Veranstalters). */
  link?: string;
  /** Freitext, der keinem Feld zugeordnet werden konnte. */
  note?: string;
  /** Ursprünglicher Scan-Inhalt, ungekürzt. */
  raw: string;
}

/** Feld-Labels für die "übernommen aus QR"-Rückmeldung. */
export const CONTACT_FIELD_LABEL: Record<string, string> = {
  firstName: "Vorname",
  lastName: "Nachname",
  company: "Unternehmen",
  position: "Position",
  email: "E-Mail",
  phone: "Telefon",
  country: "Land",
  link: "Badge-Link",
  note: "Notiz",
};

function unescapeVCard(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

/** vCard 2.1–4.0: nur die für Leads relevanten Properties. */
function parseVCard(raw: string): ParsedContact {
  const out: ParsedContact = { raw };
  // Zeilen-Fortsetzungen (RFC 6350: Folding) zusammenführen.
  const lines = raw.replace(/\r\n[ \t]/g, "").split(/\r?\n/);

  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const rawName = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const name = (rawName.split(";")[0] ?? "").toUpperCase();

    if (name === "N") {
      // N:Nachname;Vorname;Weitere;Präfix;Suffix
      const parts = value.split(";").map(unescapeVCard);
      if (parts[0] && !out.lastName) out.lastName = parts[0];
      if (parts[1] && !out.firstName) out.firstName = parts[1];
    } else if (name === "FN" && !out.firstName && !out.lastName) {
      const parts = unescapeVCard(value).split(/\s+/);
      out.firstName = parts.shift();
      if (parts.length) out.lastName = parts.join(" ");
    } else if (name === "ORG" && !out.company) {
      out.company = unescapeVCard(value).split(";")[0]?.trim() || undefined;
    } else if (name === "TITLE" && !out.position) {
      out.position = unescapeVCard(value) || undefined;
    } else if (name === "EMAIL" && !out.email) {
      out.email = unescapeVCard(value).toLowerCase() || undefined;
    } else if (name === "TEL" && !out.phone) {
      out.phone = unescapeVCard(value) || undefined;
    }
  }
  return out;
}

/** MECARD:N:Nachname,Vorname;TEL:…;EMAIL:…;ORG:…;; */
function parseMeCard(raw: string): ParsedContact {
  const out: ParsedContact = { raw };
  const body = raw.slice(raw.indexOf(":") + 1);
  for (const seg of body.split(";")) {
    const idx = seg.indexOf(":");
    if (idx === -1) continue;
    const key = seg.slice(0, idx).toUpperCase();
    const value = seg.slice(idx + 1).trim();
    if (!value) continue;
    if (key === "N") {
      const [last, first] = value.split(",").map((s) => s.trim());
      if (last) out.lastName = last;
      if (first) out.firstName = first;
    } else if (key === "TEL" && !out.phone) {
      out.phone = value;
    } else if (key === "EMAIL" && !out.email) {
      out.email = value.toLowerCase();
    } else if (key === "ORG" && !out.company) {
      out.company = value;
    }
  }
  return out;
}

/** ?firstName=…&email=… oder mailto:a@b.de?subject=… */
function parseQueryish(raw: string): ParsedContact {
  const out: ParsedContact = { raw };
  try {
    const qIdx = raw.indexOf("?");
    const mailtoMatch = /^mailto:([^?]+)/i.exec(raw);
    if (mailtoMatch?.[1]) out.email = mailtoMatch[1].trim().toLowerCase();
    if (qIdx !== -1) {
      const params = new URLSearchParams(raw.slice(qIdx + 1));
      const pick = (...keys: string[]) => {
        for (const k of keys) {
          const v = params.get(k);
          if (v) return v.trim();
        }
        return undefined;
      };
      out.firstName ??= pick("firstName", "first_name", "vorname", "fname");
      out.lastName ??= pick("lastName", "last_name", "nachname", "lname");
      out.company ??= pick("company", "org", "organization", "firma");
      out.position ??= pick("title", "position", "jobTitle", "role");
      const mail = pick("email", "mail", "e-mail");
      if (mail) out.email = mail.toLowerCase();
      out.phone ??= pick("phone", "tel", "telephone", "mobile");
      out.country ??= pick("country", "land");
    }
  } catch {
    /* kaputte URL → als Link/Text behandeln */
  }
  return out;
}

export function parseScannedContact(input: string): ParsedContact {
  const raw = input.trim();
  const upper = raw.toUpperCase();

  if (upper.startsWith("BEGIN:VCARD")) {
    const v = parseVCard(raw);
    if (hasAnyField(v)) return v;
  }
  if (upper.startsWith("MECARD:")) {
    const m = parseMeCard(raw);
    if (hasAnyField(m)) return m;
  }
  if (upper.startsWith("MAILTO:")) {
    return parseQueryish(raw);
  }
  if (/^https?:\/\//i.test(raw)) {
    const q = parseQueryish(raw);
    if (hasAnyField(q)) return q;
    // Kein verwertbarer Query-String → Veranstalter-Lead-Link, roh übernehmen.
    return { raw, link: raw };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return { raw, email: raw.toLowerCase() };
  }
  return { raw, note: raw };
}

function hasAnyField(c: ParsedContact): boolean {
  return Boolean(
    c.firstName ||
    c.lastName ||
    c.company ||
    c.position ||
    c.email ||
    c.phone ||
    c.country,
  );
}
