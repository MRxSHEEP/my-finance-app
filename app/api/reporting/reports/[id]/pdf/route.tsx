import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireOrgMembership } from "@/lib/orgAuth";
import { prisma } from "@/lib/prisma";
import ReportDocument from "@/lib/reporting/pdf/ReportDocument";
import { buildCalculatorSection, buildPortfolioSection, type CalculatorEntry } from "@/lib/reporting/buildReportSections";

// Collapses view/download/regenerate into one route — a Report only ever
// stores raw inputs, never a rendered PDF, so all three are the same
// operation (render again), differing only in Content-Disposition. Auth
// goes through lib/orgAuth.ts's requireOrgMembership() DIRECTLY (not
// lib/reportingAuth.ts) so the ownership-or-admin check below can read the
// real orgRole — see the White-Label Reporting plan's architectural nuance.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgMembership();
  if (ctx.error) return ctx.error;

  const { id } = await params;
  const report = await prisma.report.findUnique({ where: { id } });

  const hasAccess =
    report != null &&
    report.organizationId === ctx.organizationId &&
    (ctx.orgRole === "admin" || report.createdByUserId === ctx.userId);

  if (!report || !hasAccess) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const [organization, creator] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { name: true, logoUrl: true, brandColor: true },
    }),
    prisma.user.findUnique({ where: { id: report.createdByUserId }, select: { name: true, email: true } }),
  ]);

  const calculatorEntries = Array.isArray(report.calculators) ? (report.calculators as unknown as CalculatorEntry[]) : [];

  const [calculatorSections, portfolioSection] = await Promise.all([
    Promise.all(calculatorEntries.map(buildCalculatorSection)),
    buildPortfolioSection(report),
  ]);

  const buffer = await renderToBuffer(
    <ReportDocument
      organizationName={organization?.name ?? ""}
      logoUrl={organization?.logoUrl ?? null}
      brandColor={organization?.brandColor ?? null}
      clientName={report.clientName}
      advisorName={creator?.name ?? creator?.email ?? "Advisor"}
      generatedAt={new Date()}
      calculatorSections={calculatorSections}
      portfolioSection={portfolioSection}
    />
  );

  const download = request.nextUrl.searchParams.get("download") === "1";
  const safeFilename = report.clientName.replace(/[^a-z0-9]+/gi, "_").toLowerCase() || "report";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeFilename}-report.pdf"`,
    },
  });
}
