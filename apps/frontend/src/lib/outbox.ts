"use client";

/**
 * Offline-Warteschlange (ADR 0003). Erfasste Leads landen bei fehlender
 * Verbindung hier (IndexedDB) und werden später über `POST /api/sync`
 * synchronisiert. Der lokale Store ist NUR Zwischenspeicher — die zentrale
 * DB bleibt Source of Truth.
 */
export type OutboxStatus = "pending" | "syncing" | "failed" | "synced";

export interface OutboxItem {
  localId: string;
  kind: "lead.create";
  eventId: string;
  payload: unknown;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  serverId?: string;
  createdAt: number;
}

const DB_NAME = "humatter-leads";
const STORE = "outbox";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "localId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const r = fn(store);
    t.oncomplete = () => resolve(r ? (r.result as T) : undefined);
    t.onerror = () => reject(t.error);
  });
}

export async function enqueue(
  item: Omit<OutboxItem, "status" | "attempts" | "createdAt">,
): Promise<void> {
  await tx("readwrite", (s) =>
    s.put({ ...item, status: "pending", attempts: 0, createdAt: Date.now() }),
  );
  notify();
}

export async function all(): Promise<OutboxItem[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as OutboxItem[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function pendingCount(): Promise<number> {
  return (await all()).filter((i) => i.status !== "synced").length;
}

async function update(item: OutboxItem): Promise<void> {
  await tx("readwrite", (s) => s.put(item));
  notify();
}

export async function remove(localId: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(localId));
  notify();
}

/** Alle bereits synchronisierten Einträge löschen (Bereinigung). */
export async function purgeSynced(): Promise<void> {
  for (const i of await all()) {
    if (i.status === "synced") await remove(i.localId);
  }
}

let flushing = false;

/** Warteschlange gegen `/api/sync` abarbeiten. */
export async function flush(): Promise<void> {
  if (flushing || !navigator.onLine) return;
  const items = (await all()).filter(
    (i) => i.status === "pending" || i.status === "failed",
  );
  if (items.length === 0) return;
  flushing = true;
  try {
    for (const i of items) await update({ ...i, status: "syncing" });

    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operations: items.map((i) => ({
          kind: i.kind,
          localId: i.localId,
          eventId: i.eventId,
          payload: i.payload,
        })),
      }),
    });
    if (!res.ok) {
      for (const i of items)
        await update({
          ...i,
          status: "failed",
          attempts: i.attempts + 1,
          lastError: `HTTP ${res.status}`,
        });
      return;
    }
    const body = (await res.json()) as {
      results: {
        localId: string;
        status: "synced" | "conflict" | "failed";
        serverId?: string;
        error?: string;
      }[];
    };
    const byId = new Map(body.results.map((r) => [r.localId, r]));
    for (const i of items) {
      const r = byId.get(i.localId);
      if (r?.status === "synced") {
        await update({ ...i, status: "synced", serverId: r.serverId });
      } else {
        await update({
          ...i,
          status: "failed",
          attempts: i.attempts + 1,
          lastError: r?.error ?? r?.status ?? "unknown",
        });
      }
    }
  } catch {
    for (const i of items)
      await update({ ...i, status: "failed", attempts: i.attempts + 1 });
  } finally {
    flushing = false;
    notify();
  }
}

// --- kleine Pub/Sub für die UI ------------------------------------
type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
function notify() {
  for (const l of listeners) l();
}
