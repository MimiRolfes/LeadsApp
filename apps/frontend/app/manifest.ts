import type { MetadataRoute } from "next";
import { APP_NAME } from "@humatter-leads/shared";

/**
 * PWA-Manifest (Basis). Icons + Screenshots kommen in Phase 3 mit dem
 * finalen Icon-Satz aus der Marke. `display: standalone` für die
 * installierbare mobile Erfassungs-App.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "Leads",
    description: "Interne Lead-Capture-App für Messeauftritte von humatter.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7fb",
    theme_color: "#001540",
    lang: "de",
    orientation: "portrait",
  };
}
