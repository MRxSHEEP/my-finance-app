import { NextRequest, NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/reportingAuth";
import { gatherReportNarrativeContext } from "@/lib/reportNarrative/gather";
import { generateReportNarrative } from "@/lib/reportNarrative/generate";

export const dynamic = "force-dynamic";

const PORTFOLIO_SOURCES = ["simulated", "manual"];

// Read-only and non-persisting: this never creates or touches a Report
// row. It's a fresh, on-demand draft (see
// components/reporting/ReportGeneratorForm.tsx) the advisor can edit or
// discard entirely before the eventual POST /api/reporting/reports call
// — which is the only place narrativeCommentary is ever actually saved.
export async function POST(request: NextRequest) {
  const ctx = await requireOrgRole("advisor");
  if (ctx.error) return ctx.error;

  const body = await request.json().catch(() => null);
  const clientName = typeof body?.clientName === "string" ? body.clientName.trim() : "";
  const portfolioSource = body?.portfolioSource;
  const simulatedPortfolioId = typeof body?.simulatedPortfolioId === "string" ? body.simulatedPortfolioId : null;
  const manualHoldings = Array.isArray(body?.manualHoldings) ? body.manualHoldings : null;

  if (!clientName) return NextResponse.json({ error: "Client name is required" }, { status: 400 });
  if (!PORTFOLIO_SOURCES.includes(portfolioSource)) {
    return NextResponse.json({ error: "A portfolio (simulated or manual) is required to draft commentary" }, { status: 400 });
  }
  if (portfolioSource === "simulated" && !simulatedPortfolioId) {
    return NextResponse.json({ error: "simulatedPortfolioId is required" }, { status: 400 });
  }
  if (portfolioSource === "manual" && (!manualHoldings || manualHoldings.length === 0)) {
    return NextResponse.json({ error: "At least one manual holding is required" }, { status: 400 });
  }

  const context = await gatherReportNarrativeContext({
    clientName,
    portfolioSource,
    simulatedPortfolioId,
    manualHoldings,
    ownerUserId: ctx.userId,
    origin: request.nextUrl.origin,
  });
  if (!context) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const narrative = await generateReportNarrative(context);
  if (!narrative) {
    return NextResponse.json({ error: "AI commentary is unavailable right now" }, { status: 503 });
  }

  return NextResponse.json({ narrative });
}
