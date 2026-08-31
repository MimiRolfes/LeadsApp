"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api";
import { Alert, Button, TextField } from "@/components/ui";
import styles from "../auth.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiPost("/auth/password/forgot", { email });
    } finally {
      setDone(true);
      setBusy(false);
    }
  }

  if (done) {
    return (
      <>
        <h1 className={styles.h1}>E-Mail unterwegs</h1>
        <Alert kind="success">
          Falls ein Konto zu dieser Adresse existiert, wurde eine E-Mail mit
          einem Link zum Zurücksetzen verschickt.
        </Alert>
        <div className={styles.foot}>
          <Link href="/login">Zur Anmeldung</Link>
        </div>
      </>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className={styles.h1}>Passwort zurücksetzen</h1>
      <TextField
        id="email"
        label="Work-E-Mail"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" block disabled={busy}>
        {busy ? "…" : "Link anfordern"}
      </Button>
      <div className={styles.foot}>
        <Link href="/login">Zurück</Link>
      </div>
    </form>
  );
}
