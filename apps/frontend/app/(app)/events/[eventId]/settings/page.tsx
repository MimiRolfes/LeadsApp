"use client";

import { use, useEffect, useState } from "react";
import { EVENT_STATUSES } from "@humatter-leads/shared";
import { ApiError, apiGet, apiPatch } from "@/lib/api";
import type { EventDto } from "@/lib/types";
import {
  Alert,
  Button,
  Card,
  PageHeader,
  Row,
  SelectField,
  TextField,
} from "@/components/ui";

export default function EventSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [ev, setEv] = useState<EventDto | null>(null);
  const [msg, setMsg] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiGet<{ event: EventDto }>(`/events/${eventId}`).then((r) =>
      setEv(r.event),
    );
  }, [eventId]);

  if (!ev) return <p>Lädt…</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const current = ev!;
    try {
      const { event } = await apiPatch<{ event: EventDto }>(
        `/events/${eventId}`,
        {
          name: current.name,
          location: current.location || undefined,
          startsOn: current.startsOn || undefined,
          endsOn: current.endsOn || undefined,
          status: current.status,
          retentionDays: current.retentionDays,
        },
      );
      setEv(event);
      setMsg({ kind: "success", text: "Gespeichert." });
    } catch (err) {
      setMsg({
        kind: "error",
        text: err instanceof ApiError ? err.message : "Fehlgeschlagen.",
      });
    } finally {
      setBusy(false);
    }
  }

  function set<K extends keyof EventDto>(k: K, v: EventDto[K]) {
    setEv((e) => (e ? { ...e, [k]: v } : e));
  }

  return (
    <>
      <PageHeader title="Event-Einstellungen" />
      {msg ? <Alert kind={msg.kind}>{msg.text}</Alert> : null}
      <Card>
        <form onSubmit={save}>
          <TextField
            id="s-name"
            label="Name"
            value={ev.name}
            onChange={(e) => set("name", e.target.value)}
          />
          <TextField
            id="s-location"
            label="Ort"
            value={ev.location ?? ""}
            onChange={(e) => set("location", e.target.value)}
          />
          <Row>
            <TextField
              id="s-starts"
              label="Beginn"
              type="date"
              value={ev.startsOn ?? ""}
              onChange={(e) => set("startsOn", e.target.value)}
            />
            <TextField
              id="s-ends"
              label="Ende"
              type="date"
              value={ev.endsOn ?? ""}
              onChange={(e) => set("endsOn", e.target.value)}
            />
          </Row>
          <SelectField
            id="s-status"
            label="Status"
            value={ev.status}
            onChange={(e) =>
              set("status", e.target.value as EventDto["status"])
            }
          >
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectField>
          <TextField
            id="s-retention"
            label="Aufbewahrung (Tage nach Event-Ende)"
            type="number"
            value={ev.retentionDays?.toString() ?? ""}
            onChange={(e) =>
              set(
                "retentionDays",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            hint="Leer = keine automatische Bereinigung"
          />
          <Button type="submit" disabled={busy}>
            {busy ? "…" : "Speichern"}
          </Button>
        </form>
      </Card>
    </>
  );
}
