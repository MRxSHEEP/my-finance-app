import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/reportingAuth";
import BenchmarkReportDocument, { type BenchmarkTickerData } from "@/lib/benchmarking/pdf/BenchmarkReportDocument";

// Mirrors app/api/reporting/reports/[id]/pdf/route.tsx's exact pattern:
// fetch org branding directly via Prisma, fetch the same data the
// authenticated dashboard route reads, render, return with
// Content-Disposition. Shared org-wide resource — no ownership check,
// same as every other /api/benchmarking/* route.
export async function GET(request: NextRequest) {
  const ctx = await requireOrgRole("advisor");
  if (ctx.error) return ctx.error;

  const [organization, peerSet] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { name: true, logoUrl: true, brandColor: true },
    }),
    prisma.benchmarkPeerSet.findUnique({ where: { organizationId: ctx.organizationId }, include: { peers: true } }),
  ]);

  if (!peerSet) {
    return NextResponse.json({ error: "No peer set configured yet" }, { status: 404 });
  }

  const tickerList = [
    ...(peerSet.ownCompanyTicker ? [{ ticker: peerSet.ownCompanyTicker, isOwnCompany: true }] : []),
    ...peerSet.peers.map((p) => ({ ticker: p.ticker, isOwnCompany: false })),
  ];

  const allSnapshots = await prisma.benchmarkMetricSnapshot.findMany({
    where: { organizationId: ctx.organizationId, ticker: { in: tickerList.map((t) => t.ticker) } },
    orderBy: { asOfDate: "asc" },
  });
  const snapshotsByTicker = new Map<string, typeof allSnapshots>();
  for (const snap of allSnapshots) {
    const list = snapshotsByTicker.get(snap.ticker) ?? [];
    list.push(snap);
    snapshotsByTicker.set(snap.ticker, list);
  }

  const tickers: BenchmarkTickerData[] = tickerList.map(({ ticker, isOwnCompany }) => {
    const series = snapshotsByTicker.get(ticker) ?? [];
    const latestSnap = series[series.length - 1] ?? null;
    return {
      ticker,
      isOwnCompany,
      latest: latestSnap
        ? {
            revenueGrowth: latestSnap.revenueGrowth,
            grossMargin: latestSnap.grossMargin,
            fcfYield: latestSnap.fcfYield,
            forwardPE: latestSnap.forwardPE,
            evEbitda: latestSnap.evEbitda,
            roe: latestSnap.roe,
          }
        : null,
      series: series.map((s) => ({
        asOfDate: s.asOfDate.toISOString(),
        revenueGrowth: s.revenueGrowth,
        grossMargin: s.grossMargin,
        fcfYield: s.fcfYield,
        forwardPE: s.forwardPE,
        evEbitda: s.evEbitda,
        roe: s.roe,
      })),
    };
  });

  const buffer = await renderToBuffer(
    <BenchmarkReportDocument
      organizationName={organization?.name ?? ""}
      logoUrl={organization?.logoUrl ?? null}
      brandColor={organization?.brandColor ?? null}
      generatedAt={new Date()}
      tickers={tickers}
    />
  );

  const download = request.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="peer-benchmarking-report.pdf"`,
    },
  });
}
