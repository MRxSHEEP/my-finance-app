import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireOrgRole } from "@/lib/complianceAuth";
import { buildReportTable, REPORT_KEYS, type ReportKey } from "@/lib/compliance/exportData";
import { prisma } from "@/lib/prisma";
import ComplianceReportDocument from "@/lib/compliance/pdf/ComplianceReportDocument";

export async function GET(request: NextRequest) {
  const ctx = await requireOrgRole("compliance_officer");
  if (ctx.error) return ctx.error;

  const report = request.nextUrl.searchParams.get("report") as ReportKey | null;
  if (!report || !REPORT_KEYS.includes(report)) {
    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  }

  const [table, organization] = await Promise.all([
    buildReportTable(ctx.organizationId, report),
    prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { name: true } }),
  ]);
  if (!table) return NextResponse.json({ error: "Invalid report type" }, { status: 400 });

  const buffer = await renderToBuffer(
    <ComplianceReportDocument organizationName={organization?.name ?? ""} table={table} generatedAt={new Date()} />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${report}.pdf"`,
    },
  });
}
