"use client";

import { useEffect, useState } from "react";
import {
  all,
  flush,
  purgeSynced,
  subscribe,
  type OutboxItem,
} from "@/lib/outbox";
import styles from "./sync-status.module.css";

export function SyncStatus() {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const refresh = () => all().then(setItems);
    void refresh();
    const unsub = subscribe(refresh);

    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      void flush();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const iv = setInterval(() => void flush(), 30_000);
    void flush();

    return () => {
      unsub();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(iv);
    };
  }, []);

  const pending = items.filter(
    (i) => i.status === "pending" || i.status === "syncing",
  ).length;
  const failed = items.filter((i) => i.status === "failed").length;
  const synced = items.filter((i) => i.status === "synced").length;

  if (!items.length && online) return null;

  let label = "synchron";
  let tone: "ok" | "pending" | "failed" | "offline" = "ok";
  if (!online) {
    label = "offline";
    tone = "offline";
  } else if (pending) {
    label = `${pending} wird synchronisiert`;
    tone = "pending";
  } else if (failed) {
    label = `${failed} fehlgeschlagen`;
    tone = "failed";
  }

  return (
    <div className={styles.wrap} data-tone={tone}>
      <span className={styles.dot} />
      <span>{label}</span>
      {(pending || failed) && online ? (
        <button
          type="button"
          className={styles.btn}
          onClick={() => void flush()}
        >
          jetzt
        </button>
      ) : null}
      {synced > 0 ? (
        <button
          type="button"
          className={styles.btn}
          onClick={() => void purgeSynced()}
        >
          aufräumen
        </button>
      ) : null}
    </div>
  );
}
