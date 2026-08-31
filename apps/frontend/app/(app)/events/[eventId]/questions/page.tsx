"use client";

import { use, useEffect, useState } from "react";
import { QUESTION_TYPES } from "@humatter-leads/shared";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import type { QuestionDto } from "@/lib/types";
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
import styles from "./questions.module.css";

const TYPE_LABEL: Record<string, string> = {
  text: "Text",
  textarea: "Mehrzeilig",
  single_select: "Auswahl (eine)",
  multi_select: "Auswahl (mehrere)",
  boolean: "Ja/Nein",
  number: "Zahl",
};

export default function QuestionsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [items, setItems] = useState<QuestionDto[]>([]);
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState("text");
  const [optionsText, setOptionsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await apiGet<{ questions: QuestionDto[] }>(
      `/events/${eventId}/questions?archived=true`,
    );
    setItems(res.questions);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const needsOptions = type === "single_select" || type === "multi_select";

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const options = needsOptions
      ? optionsText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => ({
            value: l.toLowerCase().replace(/\s+/g, "_"),
            label: l,
          }))
      : undefined;
    try {
      await apiPost(`/events/${eventId}/questions`, {
        prompt,
        type,
        options,
        position: items.length + 1,
      });
      setPrompt("");
      setOptionsText("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Fragenkatalog" />
      {error ? <Alert kind="error">{error}</Alert> : null}

      <Card>
        <ul className={styles.list}>
          {items.map((q) => (
            <li key={q.id} data-archived={q.archivedAt != null}>
              <div>
                <span className={styles.prompt}>{q.prompt}</span>
                <span className={styles.type}>{TYPE_LABEL[q.type]}</span>
              </div>
              {q.archivedAt ? (
                <span className={styles.archived}>archiviert</span>
              ) : (
                <button
                  type="button"
                  className={styles.archiveBtn}
                  onClick={async () => {
                    await apiPost(
                      `/events/${eventId}/questions/${q.id}/archive`,
                    );
                    await load();
                  }}
                >
                  archivieren
                </button>
              )}
            </li>
          ))}
          {items.length === 0 ? (
            <li className={styles.type}>Noch keine Fragen.</li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <h2 className={styles.h2}>Frage hinzufügen</h2>
        <form onSubmit={add}>
          <TextField
            id="q-prompt"
            label="Frage"
            required
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <SelectField
            id="q-type"
            label="Typ"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </SelectField>
          {needsOptions ? (
            <TextArea
              id="q-options"
              label="Optionen (eine pro Zeile)"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
            />
          ) : null}
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
