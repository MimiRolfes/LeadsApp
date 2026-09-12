/**
 * Visitenkarten-Erkennung — Schnittstelle und Feld-Auswertung.
 *
 * Bewusst getrennt von der konkreten Texterkennung: hier steht nur, WAS
 * herauskommen soll und wie aus erkanntem Text Felder werden. Die Erkennung
 * selbst liegt dahinter (heute Tesseract im Browser, siehe
 * `card-ocr-browser.ts`). Kommt später eine native App, wird nur die
 * Implementierung gegen Apples Vision bzw. ML Kit getauscht — Parser und
 * Erfassungsmaske bleiben unverändert.
 *
 * Das Foto wird dabei NICHT gespeichert und verlässt das Gerät nicht.
 */

export interface CardFields {
  firstName?: string;
  lastName?: string;
  company?: string;
  position?: string;
  email?: string;
  phone?: string;
}

export interface CardRecognitionResult {
  fields: CardFields;
  /** Roher Text — nützlich, um Nichterkanntes in die Notiz zu übernehmen. */
  text: string;
}

export interface CardRecognizer {
  recognize(image: Blob): Promise<CardRecognitionResult>;
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+[\w]/;
/** Mindestens 7 Ziffern, dazwischen die üblichen Trenner. */
const PHONE_RE = /(\+?\d[\d\s()/.-]{6,}\d)/;

/** Rechtsformen — eine Zeile damit ist so gut wie immer die Firma. */
const COMPANY_HINTS =
  /\b(gmbh|mbh|ag|ug|kg|ohg|gbr|se|e\.?\s?k\.?|ltd|limited|inc|llc|b\.?v\.?|s\.?a\.?)\b/i;

/** Häufige Rollenbezeichnungen auf deutschen und englischen Karten. */
const POSITION_HINTS =
  /\b(geschäftsführ|inhaber|vorstand|prokurist|leiter|leitung|referent|berater|consultant|manager|director|head\s+of|chief|c[etfoi]o\b|founder|gründer|partner|recruit|personal|sales|vertrieb|marketing|entwickl|engineer|developer|assistent|trainee|praktikant)/i;

/** Zeilen, die nie Name oder Firma sind. */
const NOISE_RE =
  /^(tel|telefon|fon|mobil|mobile|handy|fax|mail|e-?mail|web|www|http|adresse|straße|strasse|str\.|platz|weg)\b/i;

function clean(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function looksLikePersonName(line: string): boolean {
  if (COMPANY_HINTS.test(line) || POSITION_HINTS.test(line)) return false;
  if (NOISE_RE.test(line)) return false;
  if (/\d/.test(line)) return false;
  const words = line.split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  // Mindestens zwei Wörter, die wie Eigennamen aussehen (Großbuchstabe vorn).
  const namey = words.filter((w) => /^[A-ZÄÖÜ][\p{L}'’-]+$/u.test(w));
  return namey.length >= 2;
}

/** Titel und Anreden, die nicht zum Namen gehören. */
function stripSalutation(line: string): string {
  return line
    .replace(
      /^(herr|frau|mr\.?|mrs\.?|ms\.?|dr\.?|prof\.?|dipl\.?-?\s?\w*\.?|m\.?sc\.?|b\.?sc\.?|mba)\s+/gi,
      "",
    )
    .trim();
}

/**
 * Wertet erkannten Text einer Visitenkarte aus.
 *
 * Bewusst konservativ: lieber ein Feld leer lassen als etwas Falsches
 * eintragen — die Werte gehen als Vorschlag in die Maske und werden von
 * Hand geprüft.
 */
export function parseCardText(text: string): CardFields {
  const lines = text
    .split(/\r?\n/)
    .map(clean)
    .filter((l) => l.length > 1);

  const fields: CardFields = {};

  const email = text.match(EMAIL_RE)?.[0];
  if (email) fields.email = email.toLowerCase();

  // Telefonnummern erst suchen, nachdem die E-Mail-Zeile ausgeschlossen ist
  // (Ziffern in Domains sonst als Nummer missdeutet).
  for (const line of lines) {
    if (email && line.includes(email)) continue;
    const candidate = line.match(PHONE_RE)?.[1];
    if (candidate) {
      const digits = candidate.replace(/\D/g, "");
      if (digits.length >= 7 && digits.length <= 16) {
        fields.phone = clean(candidate);
        break;
      }
    }
  }

  const companyLine = lines.find((l) => COMPANY_HINTS.test(l));
  if (companyLine) fields.company = companyLine;

  const positionLine = lines.find(
    (l) => POSITION_HINTS.test(l) && l !== companyLine && !NOISE_RE.test(l),
  );
  if (positionLine) fields.position = positionLine;

  const nameLine = lines.find(
    (l) => l !== companyLine && l !== positionLine && looksLikePersonName(l),
  );
  if (nameLine) {
    const parts = stripSalutation(nameLine).split(" ").filter(Boolean);
    if (parts.length >= 2) {
      fields.lastName = parts[parts.length - 1];
      fields.firstName = parts.slice(0, -1).join(" ");
    }
  }

  // Ohne Rechtsform-Treffer: Firma aus der E-Mail-Domain ableiten, wenn eine
  // Zeile dazu passt (z. B. "mindsewn.de" -> Zeile "Mindsewn").
  if (!fields.company && email) {
    const domain = email.split("@")[1]?.split(".")[0]?.toLowerCase();
    if (domain && domain.length > 2) {
      const match = lines.find(
        (l) =>
          l !== nameLine &&
          l
            .toLowerCase()
            .replace(/[^a-z]/g, "")
            .includes(domain),
      );
      if (match) fields.company = match;
    }
  }

  return fields;
}
