import type { MetadataRoute } from "next";
import { APP_NAME } from "@humatter-leads/shared";

/**
 * PWA-Manifest. `display: standalone` für die installierbare mobile
 * Erfassungs-App. Icon ist ein skalierbares SVG (Marken-Monogramm);
 * ein PNG-Satz (192/512) kann für ältere Plattformen ergänzt werden.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "Leads",
    description: "Interne Lead-Capture-App für Messeauftritte von humatter.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#001540",
    theme_color: "#001540",
    lang: "de",
    dir: "ltr",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
