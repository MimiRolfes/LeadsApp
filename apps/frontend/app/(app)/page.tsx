import Link from "next/link";
import { serverApi } from "@/lib/server-api";
import type { EventDto } from "@/lib/types";
import { Alert, LinkButton, PageHeader } from "@/components/ui";
import styles from "./events-list.module.css";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { events } = await serverApi<{ events: EventDto[] }>("/events");
  const active = events.filter((e) => e.status === "active");
  const others = events.filter((e) => e.status !== "active");

  return (
    <>
      <PageHeader
        title="Events"
        subtitle="Wähle ein Event, um Leads zu erfassen oder auszuwerten."
        action={<LinkButton href="/events/new">Neues Event</LinkButton>}
      />

      {events.length === 0 ? (
        <Alert>
          Noch keine Events. Lege eins an — du wirst automatisch Manager.
        </Alert>
      ) : null}

      {active.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Aktiv</h2>
          <ul className={styles.grid}>
            {active.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </ul>
        </section>
      ) : null}

      {others.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Weitere</h2>
          <ul className={styles.grid}>
            {others.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function EventCard({ event }: { event: EventDto }) {
  return (
    <li>
      <Link href={`/events/${event.id}`} className={styles.card}>
        <span className={styles.name}>{event.name}</span>
        <span className={styles.meta}>
          {event.location ?? "—"}
          {event.startsOn ? ` · ${event.startsOn}` : ""}
        </span>
        <span className={styles.badge} data-status={event.status}>
          {event.status}
        </span>
      </Link>
    </li>
  );
}
