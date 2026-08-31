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

  const isManager = event.myRole === "manager" || event.myRole === "admin";

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
        <Kpi label="Follow-ups offen" value={stats.followups.open} />
        <Kpi label="überfällig" value={stats.followups.overdue} tone="warn" />
        <Kpi label="Team" value={stats.teamSize} />
      </ul>

      <nav className={styles.links}>
        <Link href={`/events/${eventId}/leads`}>Lead-Liste</Link>
        {isManager ? (
          <>
            <Link href={`/events/${eventId}/team`}>Team</Link>
            <Link href={`/events/${eventId}/questions`}>Fragenkatalog</Link>
            <Link href={`/events/${eventId}/export`}>Export</Link>
          </>
        ) : null}
      </nav>
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
