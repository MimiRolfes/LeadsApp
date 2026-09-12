import Link from "next/link";
import { serverApi } from "@/lib/server-api";
import type { EventDto } from "@/lib/types";
import { IconAdd } from "@/components/icons";
import styles from "./events-list.module.css";

export const dynamic = "force-dynamic";

const DAY_MONTH = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "long",
});

function formatRange(startsOn: string | null, endsOn: string | null): string {
  const start = startsOn ? DAY_MONTH.format(new Date(startsOn)) : null;
  const end = endsOn ? DAY_MONTH.format(new Date(endsOn)) : null;
  if (start && end && start !== end) return `${start}–${end}`;
  return start ?? end ?? "";
}

export default async function HomePage() {
  // Reihenfolge kommt vom Backend (alphabetisch nach Name).
  const { events } = await serverApi<{ events: EventDto[] }>("/events");

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>Events</h1>
        <Link href="/events/new" className={styles.cta}>
          <span className={styles.ctaLabel}>Neues Event</span>
          <IconAdd className={styles.ctaIcon} />
        </Link>
      </div>

      {events.length === 0 ? (
        <p className={styles.empty}>
          Noch keine Events. Lege eins an — du wirst automatisch Manager.
        </p>
      ) : (
        <ul className={styles.list}>
          {events.map((event) => (
            <li key={event.id}>
              <Link href={`/events/${event.id}`} className={styles.card}>
                <span className={styles.cardMain}>
                  <span className={styles.name}>{event.name}</span>
                  <span className={styles.dates}>
                    {formatRange(event.startsOn, event.endsOn)}
                  </span>
                  <span className={styles.place}>{event.location ?? ""}</span>
                </span>

                {/* Die Kennzahlen stehen so im Entwurf; das Backend liefert
                    bisher weder Lead-Zahlen noch die Zustände
                    "Contacted"/"Replied" — daher vorerst ohne Werte. */}
                <span className={styles.stats}>
                  <span>
                    <span className={styles.statValue}>–</span>
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
    </>
  );
}
