"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PASSWORD_HINT } from "@humatter-leads/shared";
import { ApiError, apiPost } from "@/lib/api";
import { Alert, Button, TextField } from "@/components/ui";
import styles from "../auth.module.css";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost("/auth/password/reset", { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Fehlgeschlagen.");
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <>
        <h1 className={styles.h1}>Ungültiger Link</h1>
        <Alert kind="error">Der Link ist unvollständig oder abgelaufen.</Alert>
        <div className={styles.foot}>
          <Link href="/forgot-password">Neuen Link anfordern</Link>
        </div>
      </>
    );
  }

  if (done) {
    return (
      <>
        <h1 className={styles.h1}>Passwort gesetzt</h1>
        <Alert kind="success">
          Dein Passwort wurde geändert und du wurdest überall abgemeldet.
        </Alert>
        <div className={styles.foot}>
          <Link href="/login">Jetzt anmelden</Link>
        </div>
      </>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className={styles.h1}>Neues Passwort</h1>
      {error ? <Alert kind="error">{error}</Alert> : null}
      <TextField
        id="password"
        label="Neues Passwort"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint={PASSWORD_HINT}
      />
      <Button type="submit" block disabled={busy}>
        {busy ? "…" : "Passwort setzen"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
