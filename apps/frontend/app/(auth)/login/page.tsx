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
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost("/auth/login", {
        email,
        password,
        ...(needsCode && code ? { code } : {}),
      });
      window.location.assign(next);
    } catch (err) {
      if (err instanceof ApiError && err.code === "totp_required") {
        setNeedsCode(true);
        setError("Bitte den Code aus deiner Authenticator-App eingeben.");
      } else {
        setError(
          err instanceof ApiError ? err.message : "Anmeldung fehlgeschlagen.",
        );
      }
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
      {needsCode ? (
        <AuthField
          id="code"
          label="2FA-Code"
          placeholder="6-stelliger Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      ) : null}
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
