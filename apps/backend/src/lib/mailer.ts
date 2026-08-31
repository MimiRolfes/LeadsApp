import { logger as log } from "@humatter-leads/shared/logger";
import { env } from "../env";

/**
 * E-Mail-Versand. Aktuell nur der `log`-Treiber: die Nachricht wird
 * strukturiert protokolliert (in Entwicklung inkl. Textvorschau), nicht
 * versendet. Ein echter SMTP-/Provider-Treiber wird ergänzt, sobald der
 * Anbieter feststeht (OQ-5). Bis dahin muss der Reset-Link manuell aus dem
 * Log entnommen bzw. der Admin ein Passwort direkt setzen.
 */
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(mail: Mail): Promise<void> {
  if (env.MAIL_DRIVER === "smtp") {
    throw new Error(
      "SMTP-Treiber ist noch nicht implementiert (OQ-5: Anbieter offen).",
    );
  }
  log.info("mail_queued", {
    subject: mail.subject,
    // In Produktion keine Inhalte ins Log; lokal für die DX die Vorschau.
    preview: env.NODE_ENV === "production" ? undefined : mail.text,
  });
}
