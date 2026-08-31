import { redirect } from "next/navigation";
import type { CurrentUser } from "@humatter-leads/shared";
import { ApiError, serverApi } from "./server-api";

export interface SessionInfo {
  user: CurrentUser;
  twoFactorEnabled: boolean;
}

/** Aktuelle Session oder null (RSC). */
export async function getSession(): Promise<SessionInfo | null> {
  try {
    return await serverApi<SessionInfo>("/auth/me");
  } catch (err) {
    // 401 = nicht angemeldet. Netzfehler (Backend nicht erreichbar) behandeln
    // wir best effort ebenfalls als "nicht angemeldet", statt zu crashen.
    if (err instanceof ApiError) {
      if (err.status === 401) return null;
      throw err;
    }
    return null;
  }
}

/** Session erzwingen — leitet sonst zum Login (mit `next`-Ziel). */
export async function requireSession(next?: string): Promise<SessionInfo> {
  const session = await getSession();
  if (!session) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return session;
}
