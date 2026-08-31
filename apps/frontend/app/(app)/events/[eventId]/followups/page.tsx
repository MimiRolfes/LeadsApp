"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPatch } from "@/lib/api";
import type { FollowupDto } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Alert, Button, PageHeader } from "@/components/ui";
import styles from "./followups.module.css";

const TABS = [
  { key: "overdue", label: "Überfällig" },
  { key: "today", label: "Heute" },
  { key: "upcoming", label: "Anstehend" },
  { key: "", label: "Alle" },
] as const;

export default function FollowupsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [tab, setTab] = useState<string>("overdue");
  const [rows, setRows] = useState<FollowupDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (tab) sp.set("due", tab);
    const res = await apiGet<{ followups: FollowupDto[] }>(
      `/events/${eventId}/followups${sp.toString() ? `?${sp}` : ""}`,
    );
    setRows(res.followups);
    setLoading(false);
  }, [eventId, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markDone(id: string) {
    await apiPatch(`/followups/${id}`, { status: "done" });
    await load();
  }

  return (
    <>
      <PageHeader title="Follow-ups" />
      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={styles.tab}
            data-active={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!loading && rows.length === 0 ? (
        <Alert>Nichts zu tun.</Alert>
      ) : (
        <ul className={styles.list}>
          {rows.map((f) => (
            <li key={f.id} data-status={f.status}>
              <div className={styles.info}>
                <Link href={`/leads/${f.leadId}`}>Lead öffnen</Link>
                <span className={styles.meta}>
                  fällig {formatDate(f.dueOn)}
                  {f.note ? ` · ${f.note}` : ""}
                </span>
              </div>
              {f.status === "open" ? (
                <Button variant="secondary" onClick={() => markDone(f.id)}>
                  Erledigt
                </Button>
              ) : (
                <span className={styles.done}>{f.status}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
