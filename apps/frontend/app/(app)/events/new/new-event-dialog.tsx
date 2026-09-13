"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { EventDto } from "@/lib/types";
import { NewEventForm } from "./new-event-form";
import styles from "./new-event.module.css";

/**
 * "Neues Event" als Overlay über der Startseite.
 *
 * Der Schleier (`.scrim`) ist bewusst eine eigene Ebene, nicht der
 * Hintergrund des Overlays — siehe Kommentar im Markup.
 *
 * Bewegung läuft bewusst über echte CSS-Übergänge am lebenden Element und
 * NICHT über View Transitions: Der Browser ersetzt Elemente dabei durch
 * Standbilder, und ein `backdrop-filter` im Standbild hat keinen Hintergrund
 * mehr zum Abtasten — Weichzeichner und Glas fielen erst nach dem Übergang
 * an ihren Platz. Am lebenden DOM stimmt beides von der ersten Bildreihe an.
 *
 * Der Entwurf sieht keinen eigenen Schließen-Knopf vor — zum Abbrechen
 * dienen Escape und ein Klick neben das Panel.
 */
export function NewEventDialog({
  state,
  panelRef,
  onClose,
  onCreated,
}: {
  /** "enter" fährt auf, "exit" blendet ab, "morph" geht in die neue Karte über. */
  state: "enter" | "exit" | "morph";
  panelRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onCreated: (event: EventDto) => void | Promise<void>;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    // Seite hinter dem Overlay nicht mitscrollen lassen. Der Platz für die
    // Bildlaufleiste bleibt reserviert (scrollbar-gutter in globals.css),
    // sonst ruckt das Layout genau beim Öffnen.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Erst im nächsten Bild auf "offen" schalten, damit der Übergang von den
    // Startwerten aus läuft statt sofort am Ziel zu stehen.
    const raf = requestAnimationFrame(() => {
      overlayRef.current?.setAttribute("data-shown", "");
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, panelRef]);

  return (
    <div
      ref={overlayRef}
      data-state={state}
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Schleier als eigene Ebene: Beim Übergang in die Karte muss er
          verschwinden, WÄHREND das Panel sichtbar weiterwandert. Läge beides
          im selben Element, blendete das Panel mit aus — und der Übergang
          sähe wieder nach "schließen, dann öffnen" aus. */}
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Neues Event"
        className={styles.dialog}
      >
        <NewEventForm onCreated={onCreated} />
      </div>
    </div>
  );
}
