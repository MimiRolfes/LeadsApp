"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  CONSENT_STATUSES,
  LEAD_PRIORITIES,
  LEGAL_BASES,
  type LeadPriority,
} from "@humatter-leads/shared";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { enqueue } from "@/lib/outbox";
import { CONTACT_FIELD_LABEL, parseScannedContact } from "@/lib/contact-parse";
import { downscaleToJpeg } from "@/lib/image";
import type { LeadDto, QuestionDto } from "@/lib/types";
import {
  Alert,
  Button,
  Card,
  LinkButton,
  PageHeader,
  Row,
  SelectField,
  TextArea,
  TextField,
} from "@/components/ui";
import styles from "./capture.module.css";

// Kamera + QR-Decoder (jsQR) erst laden, wenn der Scanner wirklich geöffnet wird.
const QrScanner = dynamic(
  () => import("@/components/qr-scanner").then((m) => m.QrScanner),
  { ssr: false },
);

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

function hasStructuredField(
  p: ReturnType<typeof parseScannedContact>,
): boolean {
  return Boolean(
    p.firstName || p.lastName || p.company || p.position || p.email || p.phone,
  );
}

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

  const [scanOpen, setScanOpen] = useState(false);
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  const [cardPreview, setCardPreview] = useState<string | null>(null);
  const cardInputRef = useRef<HTMLInputElement>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [ocr, setOcr] = useState<"idle" | "working" | "done" | "error">("idle");

  useEffect(() => {
    apiGet<{ questions: QuestionDto[] }>(`/events/${eventId}/questions`)
      .then((r) => setQuestions(r.questions))
      .catch(() => setQuestions([]));
  }, [eventId]);

  useEffect(() => {
    return () => {
      if (cardPreview) URL.revokeObjectURL(cardPreview);
    };
  }, [cardPreview]);

  // Die Texterkennung läuft ein paar Sekunden. Damit sie nur Felder füllt,
  // die zum ERGEBNIS-Zeitpunkt noch leer sind, wird der aktuelle Stand
  // mitgeführt — sonst überschriebe sie, was währenddessen getippt wurde.
  const contactRef = useRef(contact);
  useEffect(() => {
    contactRef.current = contact;
  }, [contact]);

  // Foto-Erfassung nur anbieten, wo es eine Kamera gibt — am Schreibtisch
  // fotografiert niemand eine Visitenkarte.
  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((devices) => {
        if (active) setHasCamera(devices.some((d) => d.kind === "videoinput"));
      })
      .catch(() => {
        /* keine Berechtigung/Unterstützung -> Knopf bleibt aus */
      });
    return () => {
      active = false;
    };
  }, []);

  // Erkennungs-Worker beim Verlassen der Seite freigeben.
  useEffect(() => {
    return () => {
      void import("@/lib/card-ocr-browser").then((m) =>
        m.releaseCardRecognizer(),
      );
    };
  }, []);

  function set<K extends keyof Contact>(k: K, v: string) {
    setContact((c) => ({ ...c, [k]: v }));
  }

  const applyScan = useCallback(
    (raw: string) => {
      setScanOpen(false);
      const parsed = parseScannedContact(raw);
      const applied: string[] = [];
      const patch: Partial<Contact> = {};

      for (const key of Object.keys(EMPTY) as (keyof Contact)[]) {
        const value = parsed[key as keyof typeof parsed];
        if (typeof value === "string" && value && !contact[key].trim()) {
          patch[key] = value;
          applied.push(CONTACT_FIELD_LABEL[key] ?? key);
        }
      }
      if (applied.length) setContact((c) => ({ ...c, ...patch }));

      const extra = [
        parsed.link ? `Badge-Link: ${parsed.link}` : null,
        parsed.note && !hasStructuredField(parsed)
          ? `Aus QR-Scan: ${parsed.note}`
          : null,
      ].filter((v): v is string => Boolean(v));
      if (extra.length) {
        setNote((n) => [n, ...extra].filter(Boolean).join("\n"));
        applied.push("Notiz");
      }

      setScanInfo(
        applied.length
          ? `Aus QR-Code übernommen: ${applied.join(", ")}.`
          : "QR-Code gelesen, aber keine neuen Felder erkannt. Inhalt: " +
              raw.slice(0, 120),
      );
    },
    [contact],
  );

  /**
   * Das Foto der Visitenkarte dient nur als Lesehilfe beim Ausfüllen und
   * bleibt auf dem Gerät — es wird bewusst NICHT hochgeladen oder
   * gespeichert und beim Verlassen der Seite verworfen (Datensparsamkeit).
   */
  async function pickCard(file: File) {
    const jpeg = await downscaleToJpeg(file).catch(() => file);
    setCardPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(jpeg);
    });

    // Texterkennung läuft auf dem Gerät; das Foto verlässt es nicht.
    setOcr("working");
    setScanInfo(null);
    try {
      const { browserCardRecognizer } = await import("@/lib/card-ocr-browser");
      const { fields } = await browserCardRecognizer.recognize(jpeg);

      // Nur leere Felder füllen — von Hand Eingetragenes bleibt stehen,
      // genau wie beim QR-Scan.
      const current = contactRef.current;
      const patch: Partial<Contact> = {};
      const applied: string[] = [];
      for (const key of Object.keys(EMPTY) as (keyof Contact)[]) {
        const value = fields[key as keyof typeof fields];
        if (typeof value === "string" && value && !current[key].trim()) {
          patch[key] = value;
          applied.push(CONTACT_FIELD_LABEL[key] ?? key);
        }
      }
      if (applied.length) setContact((c) => ({ ...c, ...patch }));

      setOcr("done");
      setScanInfo(
        applied.length
          ? `Aus der Visitenkarte übernommen: ${applied.join(", ")}. Bitte kurz prüfen.`
          : "Auf der Visitenkarte war nichts eindeutig lesbar — bitte von Hand eintragen.",
      );
    } catch {
      setOcr("error");
    }
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
    setScanInfo(null);
    setOcr("idle");
    setCardPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
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
            <LinkButton variant="secondary" href={`/events/${eventId}/leads`}>
              Zur Lead-Liste
            </LinkButton>
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
            <LinkButton variant="secondary" href={`/leads/${saved.id}`}>
              Lead öffnen
            </LinkButton>
            <LinkButton variant="secondary" href={`/events/${eventId}/leads`}>
              Zur Lead-Liste
            </LinkButton>
          </Row>
        </Card>
      </>
    );
  }

  return (
    <>
      {scanOpen ? (
        <QrScanner onResult={applyScan} onClose={() => setScanOpen(false)} />
      ) : null}

      <PageHeader
        title="Lead erfassen"
        subtitle="Wenig tippen — Pflichtfelder gibt es keine."
      />

      <div className={styles.quickCapture}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setScanInfo(null);
            setScanOpen(true);
          }}
        >
          QR-Code scannen
        </Button>
        {hasCamera ? (
          <Button
            type="button"
            variant="secondary"
            disabled={ocr === "working"}
            onClick={() => cardInputRef.current?.click()}
          >
            {ocr === "working"
              ? "Karte wird gelesen…"
              : "Visitenkarte fotografieren"}
          </Button>
        ) : null}
        <input
          ref={cardInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className={styles.hiddenInput}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pickCard(f);
            e.target.value = "";
          }}
        />
      </div>

      {scanInfo ? (
        <Alert kind="success">
          {scanInfo}{" "}
          <button
            type="button"
            className={styles.inlineBtn}
            onClick={() => setScanInfo(null)}
          >
            ausblenden
          </button>
        </Alert>
      ) : null}

      {ocr === "error" ? (
        <Alert kind="error">
          Die Karte konnte nicht gelesen werden — bitte die Felder von Hand
          ausfüllen. Das Foto bleibt als Lesehilfe stehen.
        </Alert>
      ) : null}

      {cardPreview ? (
        <div className={styles.cardPreview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cardPreview} alt="Fotografierte Visitenkarte" />
          <div>
            <span>
              Nur als Lesehilfe — das Foto bleibt auf diesem Gerät und wird
              nicht gespeichert.
            </span>
            <button
              type="button"
              className={styles.inlineBtn}
              onClick={() => {
                setOcr("idle");
                setCardPreview((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return null;
                });
              }}
            >
              entfernen
            </button>
          </div>
        </div>
      ) : null}

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
