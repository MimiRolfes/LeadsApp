"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiError, apiPost } from "@/lib/api";
import { AuthField } from "../auth-field";
import { AuthMessage } from "../auth-message";
import styles from "../auth.module.css";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost("/auth/login", { email, password });
      window.location.assign(next);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Anmeldung fehlgeschlagen.",
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className={styles.srOnly}>Anmelden</h1>
      {error ? <AuthMessage kind="error">{error}</AuthMessage> : null}
      <AuthField
        id="email"
        label="Work-E-Mail"
        placeholder="Mail@mindsewn.de"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <AuthField
        id="password"
        label="Passwort"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className={styles.foot}>
        <Link href="/register">Konto anlegen</Link>
        <Link href="/forgot-password">Passwort vergessen?</Link>
      </div>
      <button type="submit" className={styles.submit} disabled={busy}>
        {busy ? "…" : "Anmelden"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
