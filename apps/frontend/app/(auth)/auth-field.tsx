"use client";

import type { InputHTMLAttributes } from "react";
import styles from "./auth.module.css";

/**
 * Eingabefeld im Auth-Design: sichtbar ist nur der Platzhaltertext in der
 * blau getönten Pille (Figma-Vorgabe), das eigentliche `<label>` bleibt für
 * Screenreader/Autofill erhalten, nur visuell versteckt (`.srOnly`) —
 * Platzhalter allein wäre kein ausreichender Name (WCAG 3.3.2).
 */
export function AuthField({
  id,
  label,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
}) {
  const descId = hint || error ? `${id}-desc` : undefined;
  return (
    <div className={styles.field}>
      <label className={styles.srOnly} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        placeholder={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={descId}
        {...props}
      />
      {error ? (
        <span id={descId} className={styles.error} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={descId} className={styles.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
