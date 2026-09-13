import { logger as log } from "@humatter-leads/shared/logger";
import { env } from "../env";

/**
 * E-Mail-Versand — noch keiner: Die Nachricht wird strukturiert
 * protokolliert (lokal inklusive Textvorschau), nicht versendet. Bis ein
 * Anbieter feststeht (OQ-5), muss der Reset-Link aus dem Log entnommen oder
 * das Passwort direkt gesetzt werden.
 */
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(mail: Mail): Promise<void> {
  log.info("mail_queued", {
    subject: mail.subject,
    // In Produktion keine Inhalte ins Log; lokal für die DX die Vorschau.
    preview: env.NODE_ENV === "production" ? undefined : mail.text,
  });
}
