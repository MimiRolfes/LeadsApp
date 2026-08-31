"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PASSWORD_MIN_LENGTH,
  RegisterInputSchema,
} from "@humatter-leads/shared";
import { ApiError, apiPost } from "@/lib/api";
import { Alert, Button, TextField } from "@/components/ui";
import styles from "../auth.module.css";

export default function RegisterPage() {
  const [displayName, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const parsed = RegisterInputSchema.safeParse({
      email,
      password,
      displayName: displayName || undefined,
    });
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setBusy(true);
    try {
      await apiPost("/auth/register", parsed.data);
      window.location.assign("/");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.fields) setFieldErrors(err.fields);
      } else {
        setError("Registrierung fehlgeschlagen.");
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className={styles.h1}>Konto anlegen</h1>
      {error ? <Alert kind="error">{error}</Alert> : null}
      <TextField
        id="name"
        label="Name"
        autoComplete="name"
        value={displayName}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.displayName?.[0]}
      />
      <TextField
        id="email"
        label="Work-E-Mail"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email?.[0]}
        hint="Nur @mindsewn.de-Adressen"
      />
      <TextField
        id="password"
        label="Passwort"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password?.[0]}
        hint={`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`}
      />
      <Button type="submit" block disabled={busy}>
        {busy ? "…" : "Konto anlegen"}
      </Button>
      <div className={styles.foot}>
        <Link href="/login">Zurück zur Anmeldung</Link>
      </div>
    </form>
  );
}
