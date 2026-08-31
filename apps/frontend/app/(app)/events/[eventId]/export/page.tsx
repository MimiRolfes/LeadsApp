"use client";

import { use, useState } from "react";
import { EXPORT_LEAD_FIELDS } from "@humatter-leads/shared";
import { Alert, Button, Card, PageHeader, Row } from "@/components/ui";
import styles from "./export.module.css";

export default function ExportPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(EXPORT_LEAD_FIELDS),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggle(f: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });
  }

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const fields = [...selected];
      const res = await fetch(`/api/events/${eventId}/exports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          format,
          fields:
            fields.length === EXPORT_LEAD_FIELDS.length ? undefined : fields,
        }),
      });
      if (!res.ok) {
        setError("Export fehlgeschlagen (nur Manager dürfen exportieren).");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? `leads.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Export" subtitle="Jeder Export wird protokolliert." />
      {error ? <Alert kind="error">{error}</Alert> : null}

      <Card>
        <div className={styles.formatRow}>
          {(["csv", "json"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={styles.formatBtn}
              data-active={format === f}
              onClick={() => setFormat(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        <fieldset className={styles.fields}>
          <legend>Felder</legend>
          {EXPORT_LEAD_FIELDS.map((f) => (
            <label key={f} className={styles.check}>
              <input
                type="checkbox"
                checked={selected.has(f)}
                onChange={() => toggle(f)}
              />
              {f}
            </label>
          ))}
        </fieldset>

        <Row>
          <Button onClick={download} disabled={busy || selected.size === 0}>
            {busy ? "…" : "Herunterladen"}
          </Button>
        </Row>
      </Card>
    </>
  );
}
