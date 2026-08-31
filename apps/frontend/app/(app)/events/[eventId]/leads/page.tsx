"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LEAD_PRIORITIES } from "@humatter-leads/shared";
import { apiGet } from "@/lib/api";
import type { LeadDto } from "@/lib/types";
import { leadName } from "@/lib/format";
import {
  Alert,
  Button,
  LinkButton,
  PageHeader,
  SelectField,
} from "@/components/ui";
import { PriorityBadge } from "@/components/priority-badge";
import styles from "./leads.module.css";

const PAGE = 25;

export default function LeadsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState("");
  const [scope, setScope] = useState("");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<LeadDto[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams({
      limit: String(PAGE),
      offset: String(offset),
    });
    if (q) sp.set("q", q);
    if (priority) sp.set("priority", priority);
    if (scope) sp.set("scope", scope);
    try {
      const res = await apiGet<{ leads: LeadDto[]; total: number }>(
        `/events/${eventId}/leads?${sp}`,
      );
      setRows(res.leads);
      setTotal(res.total);
    } catch {
      setError("Leads konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [eventId, q, priority, scope, offset]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={`${total} gesamt`}
        action={
          <LinkButton href={`/events/${eventId}/capture`}>
            + Erfassen
          </LinkButton>
        }
      />

      <div className={styles.filters}>
        <input
          className={styles.search}
          placeholder="Suche (Name, Firma, E-Mail)"
          value={q}
          onChange={(e) => {
            setOffset(0);
            setQ(e.target.value);
          }}
          aria-label="Suche"
        />
        <SelectField
          id="f-priority"
          label="Priorität"
          value={priority}
          onChange={(e) => {
            setOffset(0);
            setPriority(e.target.value);
          }}
        >
          <option value="">alle</option>
          {LEAD_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="f-scope"
          label="Ansicht"
          value={scope}
          onChange={(e) => {
            setOffset(0);
            setScope(e.target.value);
          }}
        >
          <option value="">Standard</option>
          <option value="mine">nur meine</option>
          <option value="all">alle (Manager)</option>
        </SelectField>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}
      {!loading && rows.length === 0 && !error ? (
        <Alert>Keine Leads gefunden.</Alert>
      ) : null}

      <ul className={styles.list}>
        {rows.map((l) => (
          <li key={l.id}>
            <Link href={`/leads/${l.id}`} className={styles.row}>
              <span className={styles.name}>{leadName(l)}</span>
              <span className={styles.sub}>
                {l.company ?? ""}
                {l.email ? ` · ${l.email}` : ""}
              </span>
              <PriorityBadge priority={l.priority} />
            </Link>
          </li>
        ))}
      </ul>

      {total > PAGE ? (
        <div className={styles.pager}>
          <Button
            variant="secondary"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE))}
          >
            Zurück
          </Button>
          <span>
            {offset + 1}–{Math.min(offset + PAGE, total)} / {total}
          </span>
          <Button
            variant="secondary"
            disabled={offset + PAGE >= total}
            onClick={() => setOffset(offset + PAGE)}
          >
            Weiter
          </Button>
        </div>
      ) : null}
    </>
  );
}
