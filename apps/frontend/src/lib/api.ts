"use client";

import { ApiError, toApiError } from "./api-error";

/**
 * Browser-API-Client. Spricht ausschließlich denselben Origin an; Next.js
 * reicht `/api/*` serverseitig ans Backend weiter (First-Party-Cookies,
 * kein CORS). Bei Fehlern wird ein `ApiError` geworfen.
 */
export type ApiInit = Omit<RequestInit, "body"> & { json?: unknown };

export async function api<T = unknown>(
  path: string,
  init: ApiInit = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  return (
    ct.includes("application/json") ? await res.json() : await res.text()
  ) as T;
}

export { ApiError };

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, json?: unknown) =>
  api<T>(path, { method: "POST", json });
export const apiPatch = <T>(path: string, json?: unknown) =>
  api<T>(path, { method: "PATCH", json });
export const apiDelete = <T>(path: string) =>
  api<T>(path, { method: "DELETE" });
