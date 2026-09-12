"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { NewEventForm } from "./new-event-form";
import styles from "./new-event.module.css";

/**
 * "Neues Event" als Overlay über der Startseite: der Hintergrund wird
 * unscharf und abgedunkelt, davor liegt das Formular-Panel.
 *
 * Der Entwurf sieht keinen eigenen Schließen-Knopf vor — zum Abbrechen
 * dienen Escape und ein Klick neben das Panel.
 */
export function NewEventDialog() {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  // Abgefangene Routen schließen sich nur über den Verlauf — ein push()
  // ließe den Slot offen stehen.
  const close = useCallback(() => router.back(), [router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    // Fokus ins Overlay holen, damit Tastaturbedienung dort startet.
    panelRef.current?.focus();
    // Seite hinter dem Overlay nicht mitscrollen lassen.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Neues Event"
        className={styles.dialog}
      >
        <NewEventForm />
      </div>
    </div>
  );
}
