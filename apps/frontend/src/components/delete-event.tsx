"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, apiDelete } from "@/lib/api";
import styles from "./delete-event.module.css";

/**
 * Event löschen — unumkehrbar, deshalb mit Sicherheitsabfrage.
 *
 * Nach dem Bestätigen verschwinden alle Daten des Events (Leads, Antworten,
 * Anhänge, Team, Fragen, Follow-ups). Danach geht es hart zur Übersicht,
 * damit dort garantiert die frische Liste steht.
 */
export function DeleteEvent({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy]);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      await apiDelete(`/events/${eventId}`);
      window.location.assign("/");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Löschen fehlgeschlagen.",
      );
      setBusy(false);
    }
  }

  // Das Overlay liegt bewusst AUSSERHALB von .zone: dort wirkt ein
  // backdrop-filter, und der macht das Element zum Bezugsrahmen für
  // `position: fixed` — die Abfrage säße sonst in der Glasfläche fest
  // statt mittig im Fenster.
  return (
    <>
      <section className={styles.zone}>
        <h2 className={styles.zoneTitle}>Event löschen</h2>
        <p className={styles.zoneText}>
          Entfernt das Event mit allen erfassten Leads und Daten. Das lässt sich
          nicht rückgängig machen.
        </p>
        <button
          type="button"
          className={styles.danger}
          onClick={() => setOpen(true)}
        >
          Event löschen
        </button>
      </section>

      {open ? (
        <div
          className={styles.overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="del-title"
            aria-describedby="del-text"
            className={styles.dialog}
          >
            <h3 id="del-title" className={styles.title}>
              Wirklich löschen?
            </h3>
            <p id="del-text" className={styles.text}>
              „{eventName}“ und <strong>alle dazugehörigen Daten</strong> werden
              endgültig gelöscht — auch alle erfassten Leads. Das kann nicht
              rückgängig gemacht werden.
            </p>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancel}
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className={styles.danger}
                onClick={confirmDelete}
                disabled={busy}
              >
                {busy ? "Wird gelöscht…" : "Endgültig löschen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
