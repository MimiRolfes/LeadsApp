import { NextResponse } from "next/server";

/**
 * Liveness des Frontend-Service (Docker HEALTHCHECK / Monitoring).
 * Ohne Auth, ohne Backend-/DB-Zugriff, ohne PII. Nicht unter `/api`, damit
 * es nicht an das Backend weitergereicht wird.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok", ts: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
