import { cookies } from "next/headers";
import { serverEnv } from "@/env";
import { ApiError, toApiError } from "./api-error";

/**
 * Serverseitiger API-Client (RSC / Route Handler). Ruft das Backend direkt
 * über das interne Docker-Netz und reicht das Session-Cookie des aktuellen
 * Requests weiter.
 */
export async function serverApi<T = unknown>(
  path: string,
  init: Omit<RequestInit, "body"> & { json?: unknown } = {},
): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const { json, headers, ...rest } = init;
  const res = await fetch(`${serverEnv.BACKEND_INTERNAL_URL}/api${path}`, {
    ...rest,
    cache: "no-store",
    headers: {
      cookie: cookieHeader,
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export { ApiError };
