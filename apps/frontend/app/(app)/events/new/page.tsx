"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EventCreateSchema } from "@humatter-leads/shared";
import { ApiError, apiPost } from "@/lib/api";
import type { EventDto } from "@/lib/types";
import { Alert, Button, Card, PageHeader, TextField } from "@/components/ui";

export default function NewEventPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const parsed = EventCreateSchema.safeParse({
      name,
      location: location || undefined,
      startsOn: startsOn || undefined,
      endsOn: endsOn || undefined,
    });
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setBusy(true);
    try {
      const { event } = await apiPost<{ event: EventDto }>(
        "/events",
        parsed.data,
      );
      router.push(`/events/${event.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Fehlgeschlagen.");
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Neues Event"
        subtitle="Du wirst automatisch Manager."
      />
      <Card>
        <form onSubmit={submit} noValidate>
          {error ? <Alert kind="error">{error}</Alert> : null}
          <TextField
            id="name"
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name?.[0]}
          />
          <TextField
            id="location"
            label="Ort"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <TextField
            id="startsOn"
            label="Beginn"
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
          <TextField
            id="endsOn"
            label="Ende"
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
          />
          <Button type="submit" disabled={busy}>
            {busy ? "…" : "Event anlegen"}
          </Button>
        </form>
      </Card>
    </>
  );
}
