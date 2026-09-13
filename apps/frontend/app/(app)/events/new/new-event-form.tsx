"use client";

import { useState } from "react";
import { EventCreateSchema } from "@humatter-leads/shared";
import { ApiError, apiPost } from "@/lib/api";
import type { EventDto } from "@/lib/types";
import { IconAdd } from "@/components/icons";
import styles from "./new-event.module.css";

/**
 * Formular aus Figma "Messe" (Desktop 57:480 hell / 57:505 dunkel,
 * Handy 57:520 hell / 71:53 dunkel). Wird sowohl im Overlay über der
 * Startseite als auch als eigenständige Seite unter /events/new verwendet.
 *
 * Die beiden Breakpoints sind im Entwurf bewusst unterschiedlich:
 * Auf dem Desktop steht das Wort als Beschriftung links in der Zeile und der
 * Wert rechts. Auf dem Handy zeigt das leere Feld nur einen Platzhalter —
 * beim Namen sogar einen Beispielnamen statt des Wortes "Name". Beides ist
 * genau so umgesetzt; die Beschriftung bleibt auf dem Handy als
 * unsichtbares <label> für Screenreader erhalten.
 */

interface FieldProps {
  id: string;
  /** Beschriftung: Desktop sichtbar, Handy nur für Screenreader. */
  label: string;
  /** Platzhalter im leeren Feld — nur Handy, Wortlaut aus dem Handy-Frame. */
  placeholder: string;
  type?: "text" | "date";
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

function Field({
  id,
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  required,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const empty = value === "";
  // Datumsfelder zeigen im Fokus ihre eigene Eingabemaske (TT.MM.JJJJ) —
  // dann muss der Platzhalter weichen, sonst stünde beides übereinander.
  const showPlaceholder = empty && !(type === "date" && focused);
  const hideNativeDate = type === "date" && empty && !focused;

  return (
    <div className={styles.row}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={
          hideNativeDate ? `${styles.input} ${styles.dateEmpty}` : styles.input
        }
      />
      {showPlaceholder ? (
        <span className={styles.placeholder} aria-hidden="true">
          {placeholder}
        </span>
      ) : null}
    </div>
  );
}

export function NewEventForm({
  /**
   * Aus dem Overlay heraus übergibt die Übersicht hier eine Rückmeldung und
   * fügt die neue Karte selbst ein — nur so kann das Panel weich in die
   * Karte übergehen. Ohne Rückmeldung (eigenständige Seite /events/new)
   * bleibt es bei der Navigation zur Übersicht.
   */
  onCreated,
}: {
  onCreated?: (event: EventDto) => void | Promise<void>;
} = {}) {
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
      if (onCreated) {
        await onCreated(event);
        return;
      }
      // Eigenständige Seite: echte Navigation statt router.push(), weil
      // Next.js sonst die zwischengespeicherte Übersicht ohne das neue
      // Event wiederherstellt. Dasselbe Vorgehen nutzt die Anmeldung.
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
        <button
          type="submit"
          className={styles.action}
          disabled={busy}
          aria-label="Event anlegen"
        >
          <span className={styles.actionLabel}>{busy ? "…" : "Anlegen"}</span>
          <IconAdd className={styles.actionIcon} />
        </button>
      </div>

      {error ? (
        <p className={styles.message} role="alert">
          {error}
        </p>
      ) : null}

      <Field
        id="name"
        label="Name"
        placeholder="Personalmesse München"
        required
        value={name}
        onChange={setName}
      />
      {fieldErrors.name?.[0] ? (
        <span className={styles.fieldError}>{fieldErrors.name[0]}</span>
      ) : null}

      <Field
        id="location"
        label="Ort"
        placeholder="Ort"
        value={location}
        onChange={setLocation}
      />
      <Field
        id="startsOn"
        label="Beginn"
        placeholder="Start"
        type="date"
        value={startsOn}
        onChange={setStartsOn}
      />
      <Field
        id="endsOn"
        label="Ende"
        placeholder="End"
        type="date"
        value={endsOn}
        onChange={setEndsOn}
      />
    </form>
  );
}
