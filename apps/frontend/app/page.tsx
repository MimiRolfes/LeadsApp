import type { Metadata } from "next";
import styles from "./page.module.css";
import { APP_NAME } from "@humatter-leads/shared";

export const metadata: Metadata = {
  title: "Start",
};

/**
 * Platzhalter-Startseite (Phase 0).
 * Der echte Einstieg (Login → aktives Event → Lead erfassen) kommt in Phase 3
 * (Frontend), sobald DB (Phase 1) und Backend-Auth (Phase 2) stehen.
 */
export default function HomePage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <p className={styles.kicker}>humatter</p>
        <h1 className={styles.title}>{APP_NAME}</h1>
        <p className={styles.lead}>
          Mobile-first Lead-Capture für Messeauftritte. Gerüst steht —
          Datenbank, API und Erfassungs-Flow folgen in den nächsten Phasen.
        </p>
        <p className={styles.meta}>
          Status: Phase 0 (Projektgerüst). Siehe <code>docs/plan.md</code>.
        </p>
      </div>
    </main>
  );
}
