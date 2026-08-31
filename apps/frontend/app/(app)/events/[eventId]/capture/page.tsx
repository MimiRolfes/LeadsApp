"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CONSENT_STATUSES,
  LEAD_PRIORITIES,
  LEGAL_BASES,
  type LeadPriority,
} from "@humatter-leads/shared";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { enqueue } from "@/lib/outbox";
import type { LeadDto, QuestionDto } from "@/lib/types";
import {
  Alert,
  Button,
  Card,
  PageHeader,
  Row,
  SelectField,
  TextArea,
  TextField,
} from "@/components/ui";
import styles from "./capture.module.css";

type Contact = {
  firstName: string;
  lastName: string;
  company: string;
  position: string;
  email: string;
  phone: string;
  country: string;
};

const EMPTY: Contact = {
  firstName: "",
  lastName: "",
  company: "",
  position: "",
  email: "",
  phone: "",
  country: "",
};

const PRIORITY_LABEL: Record<LeadPriority, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

const LEGAL_LABEL: Record<string, string> = {
  not_set: "nicht gesetzt",
  consent: "Einwilligung",
  legitimate_interest: "berechtigtes Interesse",
  contract: "Vertrag(sanbahnung)",
};
const CONSENT_LABEL: Record<string, string> = {
  not_asked: "nicht gefragt",
  granted: "erteilt",
  denied: "abgelehnt",
};

export default function CapturePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [questions, setQuestions] = useState<QuestionDto[]>([]);
  const [contact, setContact] = useState<Contact>(EMPTY);
  const [priority, setPriority] = useState<LeadPriority | null>(null);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [legalBasis, setLegalBasis] = useState("not_set");
  const [consentStatus, setConsentStatus] = useState("not_asked");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  const clientLocalId = useRef(crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<LeadDto[] | null>(null);
  const [saved, setSaved] = useState<LeadDto | null>(null);
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    apiGet<{ questions: QuestionDto[] }>(`/events/${eventId}/questions`)
      .then((r) => setQuestions(r.questions))
      .catch(() => setQuestions([]));
  }, [eventId]);

  function set<K extends keyof Contact>(k: K, v: string) {
    setContact((c) => ({ ...c, [k]: v }));
  }

  function resetForm() {
    setContact(EMPTY);
    setPriority(null);
    setNote("");
    setTags("");
    setLegalBasis("not_set");
    setConsentStatus("not_asked");
    setAnswers({});
    setDuplicates(null);
    setError(null);
    setSaved(null);
    setQueued(false);
    clientLocalId.current = crypto.randomUUID();
  }

  async function save(allowDuplicate = false) {
    setBusy(true);
    setError(null);
    const payload = {
      clientLocalId: clientLocalId.current,
      ...Object.fromEntries(
        Object.entries(contact).filter(([, v]) => v.trim() !== ""),
      ),
      priority: priority ?? undefined,
      legalBasis,
      consentStatus,
      note: note.trim() || undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      answers: Object.keys(answers).length ? answers : undefined,
      allowDuplicate: allowDuplicate || undefined,
    };
    try {
      const { lead } = await apiPost<{ lead: LeadDto }>(
        `/events/${eventId}/leads`,
        payload,
      );
      setSaved(lead);
    } catch (err) {
      if (err instanceof ApiError && err.code === "duplicate_found") {
        setDuplicates([]);
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        // Kein Server erreicht (offline / Netzfehler) → Warteschlange.
        await enqueue({
          localId: clientLocalId.current,
          kind: "lead.create",
          eventId,
          payload,
        });
        setQueued(true);
      }
    } finally {
      setBusy(false);
    }
  }

  if (queued) {
    return (
      <>
        <PageHeader title="Offline gespeichert" />
        <Card>
          <Alert kind="success">
            Der Lead liegt lokal in der Warteschlange und wird synchronisiert,
            sobald wieder eine Verbindung besteht.
          </Alert>
          <Row>
            <Button onClick={resetForm}>Nächsten Lead erfassen</Button>
            <Link
              href={`/events/${eventId}/leads`}
              className={styles.secondaryLink}
            >
              Zur Lead-Liste
            </Link>
          </Row>
        </Card>
      </>
    );
  }

  if (saved) {
    return (
      <>
        <PageHeader title="Gespeichert" />
        <Card>
          <Alert kind="success">
            {[saved.firstName, saved.lastName].filter(Boolean).join(" ") ||
              saved.company ||
              "Lead"}{" "}
            wurde erfasst.
          </Alert>
          <Row>
            <Button onClick={resetForm}>Nächsten Lead erfassen</Button>
            <Link
              href={`/events/${eventId}/leads`}
              className={styles.secondaryLink}
            >
              Zur Lead-Liste
            </Link>
          </Row>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Lead erfassen"
        subtitle="Wenig tippen — Pflichtfelder gibt es keine."
      />

      {error ? <Alert kind="error">{error}</Alert> : null}
      {duplicates ? (
        <Alert kind="error">
          Zu dieser E-Mail-Adresse gibt es bereits einen Lead in diesem Event.{" "}
          <button
            type="button"
            className={styles.inlineBtn}
            onClick={() => save(true)}
          >
            Trotzdem als neuen Lead speichern
          </button>
        </Alert>
      ) : null}

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className={styles.grid2}>
            <TextField
              id="firstName"
              label="Vorname"
              value={contact.firstName}
              onChange={(e) => set("firstName", e.target.value)}
            />
            <TextField
              id="lastName"
              label="Nachname"
              value={contact.lastName}
              onChange={(e) => set("lastName", e.target.value)}
            />
          </div>
          <TextField
            id="company"
            label="Unternehmen"
            value={contact.company}
            onChange={(e) => set("company", e.target.value)}
          />
          <TextField
            id="position"
            label="Position"
            value={contact.position}
            onChange={(e) => set("position", e.target.value)}
          />
          <div className={styles.grid2}>
            <TextField
              id="email"
              label="Geschäftliche E-Mail"
              type="email"
              inputMode="email"
              value={contact.email}
              onChange={(e) => set("email", e.target.value)}
            />
            <TextField
              id="phone"
              label="Telefon"
              type="tel"
              inputMode="tel"
              value={contact.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>

          <fieldset className={styles.priorityRow}>
            <legend className={styles.legend}>Priorität</legend>
            {LEAD_PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                className={styles.priorityBtn}
                data-active={priority === p}
                data-p={p}
                onClick={() => setPriority(priority === p ? null : p)}
              >
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </fieldset>

          {questions.map((q) => (
            <QuestionField
              key={q.id}
              q={q}
              value={answers[q.id]}
              onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
            />
          ))}

          <TextArea
            id="note"
            label="Gesprächsnotiz"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <TextField
            id="tags"
            label="Tags"
            hint="mit Komma trennen"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />

          <div className={styles.grid2}>
            <SelectField
              id="legalBasis"
              label="Rechtsgrundlage"
              value={legalBasis}
              onChange={(e) => setLegalBasis(e.target.value)}
            >
              {LEGAL_BASES.map((b) => (
                <option key={b} value={b}>
                  {LEGAL_LABEL[b]}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="consentStatus"
              label="Einwilligung"
              value={consentStatus}
              onChange={(e) => setConsentStatus(e.target.value)}
            >
              {CONSENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CONSENT_LABEL[s]}
                </option>
              ))}
            </SelectField>
          </div>

          <Button type="submit" block disabled={busy}>
            {busy ? "Speichern…" : "Lead speichern"}
          </Button>
        </form>
      </Card>
    </>
  );
}

function QuestionField({
  q,
  value,
  onChange,
}: {
  q: QuestionDto;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `q-${q.id}`;
  if (q.type === "textarea") {
    return (
      <TextArea
        id={id}
        label={q.prompt}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (q.type === "single_select" && q.options) {
    return (
      <SelectField
        id={id}
        label={q.prompt}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">—</option>
        {q.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </SelectField>
    );
  }
  if (q.type === "boolean") {
    return (
      <SelectField
        id={id}
        label={q.prompt}
        value={value === true ? "yes" : value === false ? "no" : ""}
        onChange={(e) =>
          onChange(
            e.target.value === "yes"
              ? true
              : e.target.value === "no"
                ? false
                : undefined,
          )
        }
      >
        <option value="">—</option>
        <option value="yes">Ja</option>
        <option value="no">Nein</option>
      </SelectField>
    );
  }
  return (
    <TextField
      id={id}
      label={q.prompt}
      type={q.type === "number" ? "number" : "text"}
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
    />
  );
}
