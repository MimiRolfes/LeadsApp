"use client";

import { useState } from "react";
import Link from "next/link";
import { RegisterInputSchema } from "@humatter-leads/shared";
import { ApiError, apiPost } from "@/lib/api";
import { AuthField } from "../auth-field";
import { AuthMessage } from "../auth-message";
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
      <h1 className={styles.srOnly}>Konto anlegen</h1>
      {error ? <AuthMessage kind="error">{error}</AuthMessage> : null}
      <AuthField
        id="name"
        label="Name"
        autoComplete="name"
        value={displayName}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.displayName?.[0]}
      />
      <AuthField
        id="email"
        label="Work-E-Mail"
        placeholder="Mail@mindsewn.de"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email?.[0]}
      />
      <AuthField
        id="password"
        label="Passwort"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password?.[0]}
      />
      <div className={styles.foot}>
        <span>Mindestens 6 Zeichen und eine Ziffer</span>
        <Link href="/login">Anmelden</Link>
      </div>
      <button type="submit" className={styles.submit} disabled={busy}>
        {busy ? "…" : "Registrieren"}
      </button>
    </form>
  );
}
