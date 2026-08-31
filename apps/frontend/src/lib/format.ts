import type { LeadDto } from "./types";

/** Anzeigename eines Leads (Fallback-Kaskade). */
export function leadName(
  l: Pick<LeadDto, "firstName" | "lastName" | "company">,
): string {
  const name = [l.firstName, l.lastName].filter(Boolean).join(" ").trim();
  return name || l.company || "Namenlos";
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export const PRIORITY_LABEL: Record<string, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

export const LEGAL_LABEL: Record<string, string> = {
  not_set: "nicht gesetzt",
  consent: "Einwilligung",
  legitimate_interest: "berechtigtes Interesse",
  contract: "Vertrag(sanbahnung)",
};

export const CONSENT_LABEL: Record<string, string> = {
  not_asked: "nicht gefragt",
  granted: "erteilt",
  denied: "abgelehnt",
};
