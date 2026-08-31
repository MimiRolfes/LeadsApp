import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError, serverApi } from "@/lib/server-api";
import type { EventDto, EventStatsDto } from "@/lib/types";
import { LinkButton, PageHeader } from "@/components/ui";
import styles from "./event.module.css";

export const dynamic = "force-dynamic";

export default async function EventOverviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  let event: EventDto;
  let stats: EventStatsDto;
  try {
    [{ event }, stats] = await Promise.all([
      serverApi<{ event: EventDto }>(`/events/${eventId}`),
      serverApi<EventStatsDto>(`/events/${eventId}/stats`),
    ]);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
      notFound();
    }
    throw err;
  }

  const maxDay = Math.max(1, ...stats.byDay.map((d) => d.count));

  return (
    <>
      <PageHeader
        title={event.name}
        subtitle={[event.location, event.startsOn].filter(Boolean).join(" · ")}
        action={
          <LinkButton href={`/events/${eventId}/capture`}>
            + Lead erfassen
          </LinkButton>
        }
      />

      <ul className={styles.kpis}>
        <Kpi label="Leads" value={stats.leads.total} />
        <Kpi label="Hot" value={stats.leads.hot} tone="hot" />
        <Kpi label="Qualifiziert" value={stats.leads.qualified} />
        <Kpi label="mit Einwilligung" value={stats.leads.withConsent} />
        <Kpi label="Follow-ups offen" value={stats.followups.open} />
        <Kpi label="überfällig" value={stats.followups.overdue} tone="warn" />
      </ul>

      {stats.byDay.length > 1 ? (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Leads pro Tag</h2>
          <div className={styles.chart} role="img" aria-label="Leads pro Tag">
            {stats.byDay.map((d) => (
              <div key={d.day} className={styles.bar}>
                <div
                  className={styles.barFill}
                  style={{ height: `${(d.count / maxDay) * 100}%` }}
                  title={`${d.day}: ${d.count}`}
                />
                <span className={styles.barLabel}>{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {stats.byOwner.length > 0 ? (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Nach Erfasser:in</h2>
          <ul className={styles.owners}>
            {stats.byOwner.map((o) => (
              <li key={o.userId ?? "none"}>
                <span>{o.displayName ?? "—"}</span>
                <strong>{o.count}</strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className={styles.quick}>
        <Link href={`/events/${eventId}/leads`} className={styles.quickCard}>
          <span className={styles.quickTitle}>Lead-Liste</span>
          <span className={styles.quickMeta}>
            {stats.leads.total} Leads · {stats.leads.qualified} qualifiziert
          </span>
        </Link>
        <Link
          href={`/events/${eventId}/followups`}
          className={styles.quickCard}
        >
          <span className={styles.quickTitle}>
            Follow-ups
            {stats.followups.overdue > 0 ? (
              <span className={styles.pill}>{stats.followups.overdue}</span>
            ) : null}
          </span>
          <span className={styles.quickMeta}>{stats.followups.open} offen</span>
        </Link>
      </div>
    </>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "hot" | "warn";
}) {
  return (
    <li className={styles.kpi} data-tone={tone}>
      <span className={styles.kpiValue}>{value}</span>
      <span className={styles.kpiLabel}>{label}</span>
    </li>
  );
}
