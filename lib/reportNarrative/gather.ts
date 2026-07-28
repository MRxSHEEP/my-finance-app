import { prisma } from "@/lib/prisma";
import { getSimulatedPortfolioDetail } from "@/lib/simulatedTrading/portfolioDetail";
import { gatherTickerData } from "@/lib/signals/gather";
import type { SignalDataSnapshot } from "@/lib/signals/types";
import type {
  ReportNarrativeContext,
  SimulatedHoldingContext,
  ManualHoldingContext,
  FreshTickerContext,
} from "@/lib/reportNarrative/types";

// Same top-N-by-value cap for the same reason lib/signals/gather.ts bounds
// its own per-category fetches — this runs on an advisor's own click, so
// latency/cost needs to stay bounded even for a large portfolio.
const MAX_HOLDINGS = 8;

// gatherTickerData's own upstream calls (marketaux, TwelveData, Finnhub)
// have no timeout of their own — fine for the background daily-ingest cron
// this function was originally built for, but this call site is a live
// advisor click. One slow provider must degrade that single ticker to "no
// fresh data" rather than stall the whole draft for minutes.
const TICKER_GATHER_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

function toFreshTickerContext(data: SignalDataSnapshot): FreshTickerContext {
  const { technical, earnings, news } = data;
  const smaTrend =
    technical.latestClose !== null && technical.sma50 !== null
      ? technical.latestClose >= technical.sma50
        ? "above"
        : "below"
      : null;
  const lastQuarter = earnings && earnings.recentQuarters.length > 0 ? earnings.recentQuarters[earnings.recentQuarters.length - 1] : null;

  return {
    latestClose: technical.latestClose,
    smaTrend,
    nextEarningsDate: earnings?.nextEarningsDate ?? null,
    lastEarningsSurprisePercent: lastQuarter?.surprisePercent ?? null,
    topNewsHeadline: news[0]?.title ?? null,
  };
}

interface HoldingInput {
  symbol: string;
  name: string | null;
  assetType: string;
  currentValue: number;
  percentOfPortfolio: number;
  unrealizedGainLossPercent: number | null;
}

// A real, persisted TradeSignal row (today's actual /signals output) is
// preferred over a fresh gather — it's read directly with no extra fetch.
// Only hit lib/signals/gather.ts's gatherTickerData when no such row
// exists for this ticker, which in practice is most non-mega-cap holdings.
async function gatherHoldingContext(holding: HoldingInput, origin: string): Promise<SimulatedHoldingContext> {
  const base = {
    ticker: holding.symbol,
    companyName: holding.name,
    assetType: holding.assetType,
    currentValue: holding.currentValue,
    percentOfPortfolio: holding.percentOfPortfolio,
    unrealizedGainLossPercent: holding.unrealizedGainLossPercent,
  };

  if (holding.assetType !== "stock") {
    // Earnings/analyst-rating data is stock-specific — a commodity or
    // crypto holding never had a real TradeSignal row or a gatherTickerData
    // category to draw from, so don't spend a fetch pretending otherwise.
    return { ...base, freshData: null, existingSignal: null };
  }

  const existing = await prisma.tradeSignal.findUnique({ where: { ticker: holding.symbol } });
  if (existing) {
    const snapshot = existing.dataSnapshot as unknown as SignalDataSnapshot;
    return {
      ...base,
      freshData: toFreshTickerContext(snapshot),
      existingSignal: {
        direction: existing.direction,
        confidence: existing.confidence,
        rationale: existing.rationale,
        generatedAt: existing.generatedAt.toISOString(),
      },
    };
  }

  try {
    const data = await withTimeout(gatherTickerData(holding.symbol, origin), TICKER_GATHER_TIMEOUT_MS);
    return { ...base, freshData: data ? toFreshTickerContext(data) : null, existingSignal: null };
  } catch {
    return { ...base, freshData: null, existingSignal: null };
  }
}

interface GatherParams {
  clientName: string;
  portfolioSource: "simulated" | "manual";
  simulatedPortfolioId: string | null;
  manualHoldings: Array<{ label: string; value: number }> | null;
  ownerUserId: string;
  origin: string;
}

// Read-only — mirrors buildReportSections.ts's own portfolio resolution
// (simulated: live lookup + ownership check; manual: the rows as typed,
// no ticker lookups per that source's own "no live price lookups by
// design" convention), then layers each real ticker's own /signals data
// on top for the simulated path. Returns null only when the referenced
// simulated portfolio doesn't exist or isn't owned by the requesting
// advisor — the same defense app/api/reporting/reports/route.ts's POST
// already applies for report creation itself.
export async function gatherReportNarrativeContext(params: GatherParams): Promise<ReportNarrativeContext | null> {
  const { clientName, portfolioSource, simulatedPortfolioId, manualHoldings, ownerUserId, origin } = params;

  if (portfolioSource === "manual") {
    const holdings = manualHoldings ?? [];
    const total = holdings.reduce((sum, h) => sum + h.value, 0);
    const manualContext: ManualHoldingContext[] = holdings.map((h) => ({
      label: h.label,
      value: h.value,
      percentOfPortfolio: total > 0 ? (h.value / total) * 100 : 0,
    }));
    return { clientName, totalValue: total, simulatedHoldings: null, manualHoldings: manualContext };
  }

  if (!simulatedPortfolioId) return null;
  const owned = await prisma.simulatedPortfolio.findUnique({ where: { id: simulatedPortfolioId }, select: { userId: true } });
  if (!owned || owned.userId !== ownerUserId) return null;

  const detail = await getSimulatedPortfolioDetail(simulatedPortfolioId);
  if (!detail) return null;

  const topHoldings = [...detail.holdings].sort((a, b) => b.currentValue - a.currentValue).slice(0, MAX_HOLDINGS);
  const simulatedHoldings = await Promise.all(topHoldings.map((h) => gatherHoldingContext(h, origin)));

  return { clientName, totalValue: detail.totalValue, simulatedHoldings, manualHoldings: null };
}
