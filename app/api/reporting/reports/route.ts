import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/reportingAuth";
import { requireOrgMembership } from "@/lib/orgAuth";

export const dynamic = "force-dynamic";

const CALCULATOR_TYPES = ["dcf", "dca", "ebitda", "ev-ebitda", "peg"];
const PORTFOLIO_SOURCES = ["none", "simulated", "manual"];

// Gated via lib/orgAuth.ts's requireOrgMembership() DIRECTLY rather than
// lib/reportingAuth.ts, so this can branch on the real orgRole: a plain
// advisor sees only their own reports, while an org-wide Admin sees every
// report in the org (with an optional ?userId= filter, mirroring
// app/api/compliance/disclosures/route.ts's pattern). Going through
// lib/reportingAuth.ts here would make "real advisor" and "Admin bypass"
// indistinguishable — see the White-Label Reporting plan's architectural
// nuance section.
export async function GET(request: NextRequest) {
  const ctx = await requireOrgMembership();
  if (ctx.error) return ctx.error;

  const isAdmin = ctx.orgRole === "admin";
  const hasReportingAccess = isAdmin || ctx.featureGrants["reporting"] !== undefined;
  if (!hasReportingAccess) {
    return NextResponse.json({ error: "Not part of Reporting" }, { status: 403 });
  }

  const requestedUserId = request.nextUrl.searchParams.get("userId");

  const reports = await prisma.report.findMany({
    where: {
      organizationId: ctx.organizationId,
      // A plain advisor only ever sees their own rows, regardless of ?userId=.
      createdByUserId: isAdmin ? (requestedUserId ?? undefined) : ctx.userId,
    },
    orderBy: { createdAt: "desc" },
  });

  let creatorNames: Record<string, string> = {};
  if (isAdmin && reports.length > 0) {
    const creators = await prisma.user.findMany({
      where: { id: { in: [...new Set(reports.map((r) => r.createdByUserId))] } },
      select: { id: true, name: true, email: true },
    });
    creatorNames = Object.fromEntries(creators.map((u) => [u.id, u.name ?? u.email]));
  }

  return NextResponse.json({
    reports: reports.map((r) => ({
      id: r.id,
      clientName: r.clientName,
      calculators: r.calculators,
      portfolioSource: r.portfolioSource,
      createdAt: r.createdAt.toISOString(),
      createdByUserId: r.createdByUserId,
      creatorName: isAdmin ? creatorNames[r.createdByUserId] ?? null : null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await requireOrgRole("advisor");
  if (ctx.error) return ctx.error;

  const body = await request.json().catch(() => null);
  const clientName = typeof body?.clientName === "string" ? body.clientName.trim() : "";
  const calculators = Array.isArray(body?.calculators) ? body.calculators : null;
  const portfolioSource = body?.portfolioSource;
  const simulatedPortfolioId = typeof body?.simulatedPortfolioId === "string" ? body.simulatedPortfolioId : null;
  const manualHoldings = Array.isArray(body?.manualHoldings) ? body.manualHoldings : null;

  if (!clientName) return NextResponse.json({ error: "Client name is required" }, { status: 400 });
  if (!calculators || calculators.length === 0) {
    return NextResponse.json({ error: "At least one calculator is required" }, { status: 400 });
  }
  for (const calc of calculators) {
    if (!CALCULATOR_TYPES.includes(calc?.type) || typeof calc?.inputs !== "object" || calc.inputs === null) {
      return NextResponse.json({ error: "Invalid calculator entry" }, { status: 400 });
    }
  }
  if (!PORTFOLIO_SOURCES.includes(portfolioSource)) {
    return NextResponse.json({ error: "Invalid portfolioSource" }, { status: 400 });
  }
  if (portfolioSource === "simulated") {
    if (!simulatedPortfolioId) {
      return NextResponse.json({ error: "simulatedPortfolioId is required" }, { status: 400 });
    }
    // Defense against a tampered payload — a straight copy of the ownership
    // condition app/api/simulated-portfolio/[id]/route.ts itself checks.
    const owned = await prisma.simulatedPortfolio.findUnique({
      where: { id: simulatedPortfolioId },
      select: { userId: true },
    });
    if (!owned || owned.userId !== ctx.userId) {
      return NextResponse.json({ error: "Simulated portfolio not found" }, { status: 404 });
    }
  }
  if (portfolioSource === "manual") {
    if (!manualHoldings || manualHoldings.length === 0) {
      return NextResponse.json({ error: "At least one manual holding is required" }, { status: 400 });
    }
    for (const h of manualHoldings) {
      if (typeof h?.label !== "string" || !h.label.trim() || typeof h?.value !== "number" || !Number.isFinite(h.value)) {
        return NextResponse.json({ error: "Invalid manual holding entry" }, { status: 400 });
      }
    }
  }

  const report = await prisma.report.create({
    data: {
      organizationId: ctx.organizationId,
      createdByUserId: ctx.userId,
      clientName,
      calculators,
      portfolioSource,
      simulatedPortfolioId: portfolioSource === "simulated" ? simulatedPortfolioId : null,
      manualHoldings: portfolioSource === "manual" ? manualHoldings : undefined,
    },
  });

  return NextResponse.json({ report });
}
