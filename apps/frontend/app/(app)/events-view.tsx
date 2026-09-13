"use client";

import { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { DEFAULT_LOCALE } from "@humatter-leads/shared";
import type { EventDto } from "@/lib/types";
import { IconAdd } from "@/components/icons";
import { NewEventDialog } from "./events/new/new-event-dialog";
import styles from "./events-list.module.css";

/**
 * Übersicht der Events samt "Neues Event".
 *
 * Der Dialog ist Zustand DIESER Seite und keine eigene Route: Nur so bleiben
 * Panel und neue Karte im selben Dokument, und nur dann lässt sich das eine
 * in das andere überführen.
 *
 * Der Übergang läuft am lebenden DOM, nicht über View Transitions — die
 * ersetzen Elemente durch Standbilder, in denen `backdrop-filter` keinen
 * Hintergrund mehr abtasten kann. Panel und Karte sind auf beiden
 * Breakpoints gleich breit, der Weg ist also rein senkrecht: Das Panel wird
 * eingefroren und fährt Höhe und Position der Karte an, während sein Inhalt
 * ausblendet. Kein Skalieren, also keine verzerrte Schrift.
 */

/** Muss zu den Dauern in new-event.module.css passen. */
const EXIT_MS = 220;
const MORPH_MS = 420;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
/** Leichtes Überschwingen: Das Panel "setzt sich" beim Ankommen. */
const SETTLE = "cubic-bezier(0.34, 1.24, 0.64, 1)";

const DAY_MONTH = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  day: "numeric",
  month: "long",
});

function formatRange(startsOn: string | null, endsOn: string | null): string {
  const start = startsOn ? DAY_MONTH.format(new Date(startsOn)) : null;
  const end = endsOn ? DAY_MONTH.format(new Date(endsOn)) : null;
  if (start && end && start !== end) return `${start}–${end}`;
  return start ?? end ?? "";
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function EventsView({ initialEvents }: { initialEvents: EventDto[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [dialog, setDialog] = useState<"enter" | "exit" | "morph" | null>(null);
  /** Karte, die noch unsichtbar ist, weil das Panel gerade auf sie zufährt. */
  const [pendingId, setPendingId] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const close = useCallback(() => {
    setDialog("exit");
    window.setTimeout(() => setDialog(null), EXIT_MS);
  }, []);

  async function created(event: EventDto) {
    const fresh: EventDto = { ...event, leadCount: 0 };
    const panel = panelRef.current;
    const list = listRef.current;

    function insert() {
      // Neueste zuerst, wie das Backend sortiert. Ein frisches Event hat noch
      // keine Leads — die Zahl steht damit sofort richtig, ohne Nachladen.
      setEvents((prev) => [fresh, ...prev]);
    }

    if (!panel || prefersReducedMotion()) {
      insert();
      setDialog(null);
      return;
    }

    const from = panel.getBoundingClientRect();
    const cards = () => [
      ...(list?.querySelectorAll<HTMLElement>("[data-event]") ?? []),
    ];
    // Wo die bestehenden Karten JETZT stehen — gleich rutschen sie nach unten.
    const vorher = new Map(
      cards().map((el) => [el.dataset.event, el.getBoundingClientRect().top]),
    );

    flushSync(() => {
      insert();
      setPendingId(fresh.id);
    });

    const neu = list?.querySelector<HTMLElement>(`[data-event="${fresh.id}"]`);
    if (!neu) {
      setPendingId(null);
      setDialog(null);
      return;
    }
    const to = neu.getBoundingClientRect();

    // Die bestehenden Karten sind soeben gesprungen. Sie werden an ihren
    // alten Platz zurückversetzt und gleiten von dort mit — so entsteht die
    // Lücke im selben Zug, in dem das Panel hineinfährt, statt vorher.
    const geschoben = cards().filter((el) => {
      const alt = vorher.get(el.dataset.event);
      if (alt === undefined) return false;
      const dy = alt - el.getBoundingClientRect().top;
      if (!dy) return false;
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
      return true;
    });

    // Panel aus dem Fluss nehmen und auf seinen aktuellen Platz nageln …
    Object.assign(panel.style, {
      position: "fixed",
      margin: "0",
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      minHeight: "0",
    });
    void panel.offsetHeight; // Layout erzwingen, sonst gibt es keinen Übergang

    requestAnimationFrame(() => {
      // … und von dort auf die Karte. Die Kurve schießt leicht über und
      // federt zurück — das ist das kurze "Setzen" beim Ankommen.
      panel.style.transition = ["top", "left", "width", "height"]
        .map((prop) => `${prop} ${MORPH_MS}ms ${SETTLE}`)
        .join(", ");
      panel.style.top = `${to.top}px`;
      panel.style.left = `${to.left}px`;
      panel.style.width = `${to.width}px`;
      panel.style.height = `${to.height}px`;

      for (const el of geschoben) {
        el.style.transition = `transform ${MORPH_MS}ms ${EASE}`;
        el.style.transform = "";
      }
    });
    setDialog("morph");

    // Kurz vor Schluss die echte Karte darunter aufdecken: Das Panel liegt
    // dann noch darüber und ist durchscheinend, der Text der Karte wächst
    // also heran, statt beim Austausch aufzuploppen.
    await new Promise((r) => window.setTimeout(r, MORPH_MS - 120));
    setPendingId(null);
    await new Promise((r) => window.setTimeout(r, 160));
    for (const el of geschoben) {
      el.style.transition = "";
      el.style.transform = "";
    }
    setDialog(null);
  }

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>Events</h1>
        <Link
          href="/events/new"
          className={styles.cta}
          onClick={(e) => {
            // Ohne JavaScript bleibt der Link die echte Seite /events/new.
            e.preventDefault();
            setDialog("enter");
          }}
        >
          <span className={styles.ctaLabel}>Neues Event</span>
          <IconAdd className={styles.ctaIcon} />
        </Link>
      </div>

      {events.length === 0 ? (
        <p className={styles.empty}>
          Noch keine Events. Lege eins an — du wirst automatisch Manager.
        </p>
      ) : (
        <ul className={styles.list} ref={listRef}>
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/events/${event.id}`}
                data-event={event.id}
                data-pending={event.id === pendingId ? "" : undefined}
                className={styles.card}
              >
                <span className={styles.cardMain}>
                  <span className={styles.name}>{event.name}</span>
                  <span className={styles.dates}>
                    {formatRange(event.startsOn, event.endsOn)}
                  </span>
                  <span className={styles.place}>{event.location ?? ""}</span>
                </span>

                {/* "Contacted"/"Replied" stehen so im Entwurf, das
                    Datenmodell kennt diese Zustände aber nicht — sie bleiben
                    ohne Wert, bis feststeht, was sie zählen sollen. */}
                <span className={styles.stats}>
                  <span>
                    <span className={styles.statValue}>
                      {event.leadCount ?? "–"}
                    </span>
                    <span className={styles.statLabel}>Leads</span>
                  </span>
                  <span>
                    <span className={styles.statValue}>–</span>
                    <span className={styles.statLabel}>Contacted</span>
                  </span>
                  <span>
                    <span className={styles.statValue}>–</span>
                    <span className={styles.statLabel}>Replied</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {dialog ? (
        <NewEventDialog
          state={dialog}
          panelRef={panelRef}
          onClose={close}
          onCreated={created}
        />
      ) : null}
    </>
  );
}
