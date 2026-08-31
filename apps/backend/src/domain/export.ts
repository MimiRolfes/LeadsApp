import { and, asc, eq, isNull } from "drizzle-orm";
import { EXPORT_LEAD_FIELDS, type ExportRequest } from "@humatter-leads/shared";
import type { Db } from "../db/types";
import { exports as exportsTable, leads } from "../db/schema";
import { audit } from "./audit";

/**
 * CSV-Zellen gegen Formel-Injektion absichern: führende `= + - @` sowie
 * Tab/CR werden mit einem Apostroph neutralisiert; Anführungszeichen escaped.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export interface ExportResult {
  format: "csv" | "json";
  filename: string;
  contentType: string;
  body: string;
  rowCount: number;
}

export async function exportEventLeads(
  db: Db,
  params: { actorId: string; eventId: string; input: ExportRequest },
): Promise<ExportResult> {
  const fields = params.input.fields ?? [...EXPORT_LEAD_FIELDS];

  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.eventId, params.eventId), isNull(leads.deletedAt)))
    .orderBy(asc(leads.createdAt));

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  let result: ExportResult;

  if (params.input.format === "json") {
    const data = rows.map((r) =>
      Object.fromEntries(
        fields.map((f) => [f, r[f as keyof typeof r] ?? null]),
      ),
    );
    result = {
      format: "json",
      filename: `leads_${stamp}.json`,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(data, null, 2),
      rowCount: rows.length,
    };
  } else {
    const header = fields.map(csvCell).join(",");
    const lines = rows.map((r) =>
      fields.map((f) => csvCell(r[f as keyof typeof r])).join(","),
    );
    result = {
      format: "csv",
      filename: `leads_${stamp}.csv`,
      contentType: "text/csv; charset=utf-8",
      body: [header, ...lines].join("\r\n"),
      rowCount: rows.length,
    };
  }

  await db.transaction(async (tx) => {
    await tx.insert(exportsTable).values({
      eventId: params.eventId,
      requestedBy: params.actorId,
      format: params.input.format,
      fieldMap: fields,
      rowCount: result.rowCount,
      status: "completed",
      completedAt: new Date(),
    });
    await audit(tx, {
      actorId: params.actorId,
      action: "export.leads",
      entityType: "event",
      entityId: params.eventId,
      eventId: params.eventId,
      metadata: { format: params.input.format, rows: result.rowCount },
    });
  });

  return result;
}
