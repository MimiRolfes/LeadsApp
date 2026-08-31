"use client";

import { use, useEffect, useState } from "react";
import { EVENT_ROLES } from "@humatter-leads/shared";
import { ApiError, apiDelete, apiGet, apiPost } from "@/lib/api";
import type { EventMemberDto } from "@/lib/types";
import {
  Alert,
  Button,
  Card,
  PageHeader,
  Row,
  SelectField,
  TextField,
} from "@/components/ui";
import styles from "./team.module.css";

const ROLE_LABEL: Record<string, string> = {
  manager: "Manager",
  member: "Mitglied",
  readonly: "Nur lesen",
};

export default function TeamPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [members, setMembers] = useState<EventMemberDto[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await apiGet<{ members: EventMemberDto[] }>(
      `/events/${eventId}/members`,
    );
    setMembers(res.members);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ members: EventMemberDto[] }>(
        `/events/${eventId}/members`,
        { email, eventRole: role },
      );
      setMembers(res.members);
      setEmail("");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.code === "user_not_registered"
            ? "Diese Person muss sich zuerst selbst registrieren."
            : err.message
          : "Fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Team" subtitle={`${members.length} Mitglieder`} />
      {error ? <Alert kind="error">{error}</Alert> : null}

      <Card>
        <ul className={styles.list}>
          {members.map((m) => (
            <li key={m.userId}>
              <div>
                <span className={styles.name}>{m.displayName}</span>
                <span className={styles.email}>{m.email}</span>
              </div>
              <span className={styles.role}>{ROLE_LABEL[m.eventRole]}</span>
              <button
                type="button"
                className={styles.remove}
                aria-label={`${m.displayName} entfernen`}
                onClick={async () => {
                  if (!confirm(`${m.displayName} entfernen?`)) return;
                  try {
                    await apiDelete(`/events/${eventId}/members/${m.userId}`);
                    await load();
                  } catch (err) {
                    setError(
                      err instanceof ApiError ? err.message : "Fehlgeschlagen.",
                    );
                  }
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className={styles.h2}>Mitglied hinzufügen</h2>
        <form onSubmit={add}>
          <TextField
            id="m-email"
            label="Work-E-Mail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            hint="Die Person muss bereits ein Konto haben."
          />
          <SelectField
            id="m-role"
            label="Rolle"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {EVENT_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </SelectField>
          <Row>
            <Button type="submit" disabled={busy}>
              {busy ? "…" : "Hinzufügen"}
            </Button>
          </Row>
        </form>
      </Card>
    </>
  );
}
