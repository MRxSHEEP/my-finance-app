import { NextRequest, NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/complianceAuth";
import { buildReportTable, REPORT_KEYS, type ReportKey } from "@/lib/compliance/exportData";

// RFC 4180-style escaping: a field containing a comma, quote, or newline
// gets wrapped in quotes with internal quotes doubled.
function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(columns: string[], rows: string[][]): string {
  const lines = [columns, ...rows].map((row) => row.map(escapeCsvField).join(","));
  return lines.join("\r\n");
}

export async function GET(request: NextRequest) {
  const ctx = await requireOrgRole("compliance_officer");
  if (ctx.error) return ctx.error;

  const report = request.nextUrl.searchParams.get("report") as ReportKey | null;
  if (!report || !REPORT_KEYS.includes(report)) {
    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  }

  const table = await buildReportTable(ctx.organizationId, report);
  if (!table) return NextResponse.json({ error: "Invalid report type" }, { status: 400 });

  const csv = toCsv(table.columns, table.rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report}.csv"`,
    },
  });
}
