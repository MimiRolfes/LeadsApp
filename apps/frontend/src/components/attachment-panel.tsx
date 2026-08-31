"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, apiDelete, apiGet } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Alert, Button, Card } from "./ui";
import styles from "./lead-detail.module.css";

interface AttachmentDto {
  id: string;
  originalFilename: string | null;
  mimeType: string;
  byteSize: number;
  scanStatus: string;
  createdAt: string;
}

export function AttachmentPanel({ leadId }: { leadId: string }) {
  const [items, setItems] = useState<AttachmentDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const res = await apiGet<{ attachments: AttachmentDto[] }>(
        `/leads/${leadId}/attachments`,
      );
      setItems(res.attachments);
    } catch {
      /* leise */
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`/api/leads/${leadId}/attachments`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new ApiError(
          res.status,
          "upload",
          body.error?.message ?? "Upload fehlgeschlagen.",
        );
      }
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Upload fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card>
      <h2 className={styles.h2}>Anhänge</h2>
      {error ? <Alert kind="error">{error}</Alert> : null}
      <ul className={styles.attachments}>
        {items.map((a) => (
          <li key={a.id}>
            <a
              href={`/api/attachments/${a.id}`}
              target="_blank"
              rel="noreferrer"
            >
              {a.originalFilename ?? a.mimeType}
            </a>
            <span className={styles.noteTime}>
              {Math.round(a.byteSize / 1024)} KB · {formatDateTime(a.createdAt)}
              {a.scanStatus !== "clean" ? ` · ${a.scanStatus}` : ""}
            </span>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={async () => {
                if (!confirm("Anhang löschen?")) return;
                await apiDelete(`/attachments/${a.id}`);
                await load();
              }}
              aria-label="Anhang löschen"
            >
              ✕
            </button>
          </li>
        ))}
        {items.length === 0 ? (
          <li className={styles.noteTime}>Keine Anhänge.</li>
        ) : null}
      </ul>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className={styles.fileInput}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? "Lädt…" : "Datei hochladen"}
      </Button>
    </Card>
  );
}
