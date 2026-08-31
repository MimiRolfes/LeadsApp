"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiError, apiPost } from "@/lib/api";
import { Alert, Button, TextField } from "@/components/ui";
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
      <h1 className={styles.h1}>Anmelden</h1>
      {error ? <Alert kind="error">{error}</Alert> : null}
      <TextField
        id="email"
        label="Work-E-Mail"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextField
        id="password"
        label="Passwort"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {needsCode ? (
        <TextField
          id="code"
          label="2FA-Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      ) : null}
      <Button type="submit" block disabled={busy}>
        {busy ? "…" : "Anmelden"}
      </Button>
      <div className={styles.foot}>
        <Link href="/register">Konto anlegen</Link>
        <Link href="/forgot-password">Passwort vergessen?</Link>
      </div>
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
