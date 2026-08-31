"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CONSENT_STATUSES,
  LEAD_PRIORITIES,
  LEGAL_BASES,
  type LeadPriority,
} from "@humatter-leads/shared";
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { LeadDetailDto, QuestionDto } from "@/lib/types";
import {
  CONSENT_LABEL,
  LEGAL_LABEL,
  formatDateTime,
  leadName,
} from "@/lib/format";
import {
  Alert,
  Button,
  Card,
  PageHeader,
  Row,
  SelectField,
  TextArea,
  TextField,
} from "./ui";
import { PriorityBadge } from "./priority-badge";
import { AttachmentPanel } from "./attachment-panel";
import styles from "./lead-detail.module.css";

const CONTACT_FIELDS = [
  ["firstName", "Vorname"],
  ["lastName", "Nachname"],
  ["company", "Unternehmen"],
  ["position", "Position"],
  ["email", "E-Mail"],
  ["phone", "Telefon"],
  ["country", "Land"],
] as const;

export function LeadDetail({
  initial,
  questions,
  eventName,
  isManager,
}: {
  initial: LeadDetailDto;
  questions: QuestionDto[];
  eventName: string;
  isManager: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const lead = data.lead;

  const qLabel = (id: string) =>
    questions.find((q) => q.id === id)?.prompt ?? id;

  async function reload() {
    const fresh = await apiGet<LeadDetailDto>(`/leads/${lead.id}`);
    setData(fresh);
  }

  async function patch(patchBody: Record<string, unknown>) {
    setMsg(null);
    try {
      const { lead: updated } = await apiPatch<{ lead: typeof lead }>(
        `/leads/${lead.id}`,
        { expectedVersion: lead.version, ...patchBody },
      );
      setData((d) => ({ ...d, lead: updated }));
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.code === "version_conflict") {
        await reload();
        setMsg({
          kind: "error",
          text: "Der Lead wurde zwischenzeitlich geändert — neu geladen.",
        });
      } else {
        setMsg({
          kind: "error",
          text:
            err instanceof ApiError ? err.message : "Speichern fehlgeschlagen.",
        });
      }
      return false;
    }
  }

  return (
    <>
      <PageHeader
        title={leadName(lead)}
        subtitle={eventName}
        action={
          !editing ? (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Bearbeiten
            </Button>
          ) : null
        }
      />

      {msg ? <Alert kind={msg.kind}>{msg.text}</Alert> : null}

      {editing ? (
        <EditForm
          data={data}
          onCancel={() => setEditing(false)}
          onSave={async (body) => {
            if (await patch(body)) {
              setEditing(false);
              setMsg({ kind: "success", text: "Gespeichert." });
              await reload();
            }
          }}
        />
      ) : (
        <div className={styles.cols}>
          <Card>
            <h2 className={styles.h2}>Kontakt</h2>
            <dl className={styles.dl}>
              {CONTACT_FIELDS.map(([k, label]) => (
                <div key={k}>
                  <dt>{label}</dt>
                  <dd>{(lead[k] as string | null) || "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <h2 className={styles.h2}>Qualifizierung</h2>
            <dl className={styles.dl}>
              <div>
                <dt>Priorität</dt>
                <dd>
                  <PriorityBadge priority={lead.priority} />
                </dd>
              </div>
              <div>
                <dt>Score</dt>
                <dd>{lead.leadScore ?? "—"}</dd>
              </div>
              <div>
                <dt>Rechtsgrundlage</dt>
                <dd>{LEGAL_LABEL[lead.legalBasis]}</dd>
              </div>
              <div>
                <dt>Einwilligung</dt>
                <dd>{CONSENT_LABEL[lead.consentStatus]}</dd>
              </div>
            </dl>
            {data.tags.length ? (
              <div className={styles.tags}>
                {data.tags.map((t) => (
                  <span key={t} className={styles.tag}>
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </Card>

          {data.answers.length ? (
            <Card>
              <h2 className={styles.h2}>Gesprächsfragen</h2>
              <dl className={styles.dl}>
                {data.answers.map((a) => (
                  <div key={a.questionId}>
                    <dt>{qLabel(a.questionId)}</dt>
                    <dd>{String(a.value ?? "—")}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}

          <NotesPanel leadId={lead.id} notes={data.notes} onAdded={reload} />

          <FollowupPanel leadId={lead.id} onError={setMsg} />

          <AttachmentPanel leadId={lead.id} />

          {isManager ? (
            <DangerZone
              leadId={lead.id}
              onDone={() => router.push(`/events/${lead.eventId}/leads`)}
              onMerged={reload}
            />
          ) : null}
        </div>
      )}
    </>
  );
}

function EditForm({
  data,
  onCancel,
  onSave,
}: {
  data: LeadDetailDto;
  onCancel: () => void;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const l = data.lead;
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      CONTACT_FIELDS.map(([k]) => [k, (l[k] as string | null) ?? ""]),
    ),
  );
  const [priority, setPriority] = useState<LeadPriority | "">(l.priority ?? "");
  const [score, setScore] = useState(l.leadScore?.toString() ?? "");
  const [legalBasis, setLegal] = useState(l.legalBasis);
  const [consent, setConsent] = useState(l.consentStatus);
  const [tags, setTags] = useState(data.tags.join(", "));
  const [busy, setBusy] = useState(false);

  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          onSave({
            ...Object.fromEntries(
              Object.entries(form).map(([k, v]) => [k, v.trim() || null]),
            ),
            priority: priority || null,
            leadScore: score === "" ? null : Number(score),
            legalBasis,
            consentStatus: consent,
            tags: tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          });
        }}
      >
        <div className={styles.grid2}>
          {CONTACT_FIELDS.map(([k, label]) => (
            <TextField
              key={k}
              id={`e-${k}`}
              label={label}
              value={form[k] ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
            />
          ))}
        </div>
        <div className={styles.grid2}>
          <SelectField
            id="e-priority"
            label="Priorität"
            value={priority}
            onChange={(e) => setPriority(e.target.value as LeadPriority | "")}
          >
            <option value="">—</option>
            {LEAD_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </SelectField>
          <TextField
            id="e-score"
            label="Score (0–100)"
            type="number"
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
          <SelectField
            id="e-legal"
            label="Rechtsgrundlage"
            value={legalBasis}
            onChange={(e) => setLegal(e.target.value as typeof legalBasis)}
          >
            {LEGAL_BASES.map((b) => (
              <option key={b} value={b}>
                {LEGAL_LABEL[b]}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="e-consent"
            label="Einwilligung"
            value={consent}
            onChange={(e) => setConsent(e.target.value as typeof consent)}
          >
            {CONSENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONSENT_LABEL[s]}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField
          id="e-tags"
          label="Tags"
          hint="mit Komma trennen"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <Row>
          <Button type="submit" disabled={busy}>
            {busy ? "…" : "Speichern"}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Abbrechen
          </Button>
        </Row>
      </form>
    </Card>
  );
}

function NotesPanel({
  leadId,
  notes,
  onAdded,
}: {
  leadId: string;
  notes: LeadDetailDto["notes"];
  onAdded: () => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <h2 className={styles.h2}>Notizen</h2>
      <ul className={styles.notes}>
        {notes.map((n) => (
          <li key={n.id}>
            <span className={styles.noteTime}>
              {formatDateTime(n.createdAt)}
            </span>
            <p>{n.body}</p>
          </li>
        ))}
        {notes.length === 0 ? (
          <li className={styles.noteTime}>Noch keine Notizen.</li>
        ) : null}
      </ul>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim()) return;
          setBusy(true);
          try {
            await apiPost(`/leads/${leadId}/notes`, { body });
            setBody("");
            onAdded();
          } finally {
            setBusy(false);
          }
        }}
      >
        <TextArea
          id="new-note"
          label="Notiz hinzufügen"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button type="submit" disabled={busy}>
          {busy ? "…" : "Speichern"}
        </Button>
      </form>
    </Card>
  );
}

function FollowupPanel({
  leadId,
  onError,
}: {
  leadId: string;
  onError: (m: { kind: "error" | "success"; text: string }) => void;
}) {
  const [dueOn, setDueOn] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <Card>
      <h2 className={styles.h2}>Follow-up</h2>
      {done ? (
        <Alert kind="success">Follow-up angelegt.</Alert>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await apiPost(`/leads/${leadId}/followups`, {
                dueOn: dueOn || undefined,
                note: note || undefined,
              });
              setDone(true);
            } catch (err) {
              onError({
                kind: "error",
                text: err instanceof ApiError ? err.message : "Fehlgeschlagen.",
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          <TextField
            id="fu-due"
            label="Fällig am"
            type="date"
            value={dueOn}
            onChange={(e) => setDueOn(e.target.value)}
          />
          <TextField
            id="fu-note"
            label="Notiz"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button type="submit" disabled={busy}>
            {busy ? "…" : "Follow-up anlegen"}
          </Button>
        </form>
      )}
    </Card>
  );
}

function DangerZone({
  leadId,
  onDone,
  onMerged,
}: {
  leadId: string;
  onDone: () => void;
  onMerged: () => void;
}) {
  const [mergeId, setMergeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>, after: () => void) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      after();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className={styles.h2}>Manager-Aktionen</h2>
      {err ? <Alert kind="error">{err}</Alert> : null}

      <div className={styles.action}>
        <label htmlFor="merge-id" className={styles.actionLabel}>
          Zusammenführen — ID des doppelten Leads
        </label>
        <Row>
          <input
            id="merge-id"
            className={styles.mergeInput}
            value={mergeId}
            onChange={(e) => setMergeId(e.target.value)}
            placeholder="uuid des Duplikats"
          />
          <Button
            variant="secondary"
            disabled={busy || !mergeId}
            onClick={() =>
              act(
                () =>
                  apiPost(`/leads/${leadId}/merge`, { mergedLeadId: mergeId }),
                () => {
                  setMergeId("");
                  onMerged();
                },
              )
            }
          >
            Zusammenführen
          </Button>
        </Row>
      </div>

      <div className={styles.action}>
        <span className={styles.actionLabel}>DSGVO</span>
        <Row>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              window.open(`/api/leads/${leadId}/data`, "_blank");
            }}
          >
            Auskunft (JSON)
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (!confirm("Alle PII dieses Leads entfernen?")) return;
              act(
                () => apiPost(`/leads/${leadId}/delete`, { mode: "anonymize" }),
                onMerged,
              );
            }}
          >
            Anonymisieren
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              if (!confirm("Diesen Lead endgültig löschen?")) return;
              act(
                () => apiPost(`/leads/${leadId}/delete`, { mode: "erase" }),
                onDone,
              );
            }}
          >
            Endgültig löschen
          </Button>
        </Row>
      </div>

      <div className={styles.action}>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => {
            if (!confirm("Lead in den Papierkorb (weich löschen)?")) return;
            act(() => apiDelete(`/leads/${leadId}`), onDone);
          }}
        >
          Weich löschen
        </Button>
      </div>
    </Card>
  );
}
