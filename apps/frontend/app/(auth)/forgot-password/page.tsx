"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api";
import { AuthField } from "../auth-field";
import { AuthMessage } from "../auth-message";
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
        <AuthMessage kind="success">
          Falls ein Konto zu dieser Adresse existiert, wurde eine E-Mail mit
          einem Link zum Zurücksetzen verschickt.
        </AuthMessage>
        <div className={styles.foot}>
          <span />
          <Link href="/login">Zur Anmeldung</Link>
        </div>
      </>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className={styles.h1}>Passwort zurücksetzen</h1>
      <AuthField
        id="email"
        label="Work-E-Mail"
        placeholder="name@mindsewn.de"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className={styles.foot}>
        <Link href="/login">Zurück</Link>
        <span />
      </div>
      <button type="submit" className={styles.submit} disabled={busy}>
        {busy ? "…" : "Link anfordern"}
      </button>
    </form>
  );
}
