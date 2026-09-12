"use client";

import { useState } from "react";
import { EventCreateSchema } from "@humatter-leads/shared";
import { ApiError, apiPost } from "@/lib/api";
import type { EventDto } from "@/lib/types";
import { IconAdd } from "@/components/icons";
import styles from "./new-event.module.css";

/**
 * Formular aus Figma "Messe" (Desktop 57:480 hell / 57:505 dunkel,
 * Handy 57:520). Wird sowohl im Overlay über der Startseite als auch als
 * eigenständige Seite unter /events/new verwendet.
 */
export function NewEventForm() {
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
      await apiPost<{ event: EventDto }>("/events", parsed.data);
      // Bewusst eine echte Navigation statt router.back()/push(): Next.js
      // stellt bei Zurück-Navigation immer die zwischengespeicherte Seite
      // wieder her, sodass das neue Event in der Liste fehlen würde — und
      // ein push() ließe zudem das abgefangene Overlay offen stehen.
      // Dasselbe Vorgehen nutzt auch die Anmeldung.
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Fehlgeschlagen.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className={styles.panel}>
      <div className={styles.head}>
        <h1 className={styles.title}>Neues Event</h1>
        <button type="submit" className={styles.action} disabled={busy}>
          <span className={styles.actionLabel}>{busy ? "…" : "Anlegen"}</span>
          <IconAdd className={styles.actionIcon} />
        </button>
      </div>

      {error ? (
        <p className={styles.message} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.row}>
        <label className={styles.label} htmlFor="name">
          Name
        </label>
        <input
          id="name"
          className={styles.input}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {fieldErrors.name?.[0] ? (
        <span className={styles.fieldError}>{fieldErrors.name[0]}</span>
      ) : null}

      <div className={styles.row}>
        <label className={styles.label} htmlFor="location">
          Ort
        </label>
        <input
          id="location"
          className={styles.input}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="startsOn">
          Beginn
        </label>
        <input
          id="startsOn"
          className={styles.input}
          type="date"
          value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)}
        />
      </div>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="endsOn">
          Ende
        </label>
        <input
          id="endsOn"
          className={styles.input}
          type="date"
          value={endsOn}
          onChange={(e) => setEndsOn(e.target.value)}
        />
      </div>
    </form>
  );
}
