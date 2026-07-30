import { prisma } from "@/lib/prisma";
import { fetchFmpGrades, fetchFmpRevenueSegmentation } from "@/lib/fmp";
import { ratingToPercent } from "@/lib/analystRatingSpectrum";
import type {
  DivergenceSnapshot,
  EarningsQuarterSnapshot,
  EarningsSetupDataSnapshot,
  PriceReactionSnapshot,
  RatingRevisionSnapshot,
} from "@/lib/earningsSetup/types";

// None of this gather step's external/internal calls have a timeout of
// their own (Node's native fetch has no default one), and this file's own
// Promise.all means a single call that hangs — rather than erroring
// quickly — blocks every other category too, stalling the whole modal on
// its loading skeletons indefinitely. Confirmed live: a never-before-seen
// ticker's gather hung 2+ minutes with zero server-side progress under
// this session's provider rate-limit pressure. Same fix
// lib/reportNarrative/gather.ts already applies to its own similar
// fan-out, for the exact same reason (a live user click, not a background
// cron, so a slow provider must degrade that one category to
// "unavailable" rather than stall the feature for minutes).
const GATHER_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

const MAX_REVISIONS = 5;
// A quarter's own beat/miss surprise is meaningful on its own, but a
// streak needs more than one data point — matches TrackRecordBadge's own
// "last 4 quarters" framing on app/earnings/page.tsx.
const BEAT_STREAK_QUARTERS = 4;
// Wide enough to comfortably cover both this report and the prior one
// (quarterly reports are ~90 days apart) in a single history fetch. "6M"
// isn't a valid range on /api/stock/history (confirmed live — its actual
// accepted values are 1D/1W/1M/3M/YTD/1Y/5Y/MAX), so "1Y" is the closest
// that still comfortably covers the lookback.
const PRICE_HISTORY_RANGE = "1Y";
// Bullish/bearish tier boundaries reused from lib/analystRatingSpectrum.ts's
// own 5-tier spectrum (0-20 Sell now, 20-40 Moderate sell, 40-60 Fair,
// 60-80 Moderate buy, 80-100 Good buy) — "Moderate buy" and up counts as
// bullish-leaning, "Moderate sell" and below as bearish-leaning, matching
// the same boundaries already drawn on that spectrum rather than a new cutoff.
const BULLISH_PERCENT_FLOOR = 60;
const BEARISH_PERCENT_CEILING = 40;

interface RawBar {
  date: string;
  close: number;
}

// Same never-throws, resolve-null-on-any-failure convention as
// lib/signals/gather.ts's own private fetchInternalJson.
async function fetchInternalJson<T>(path: string, origin: string): Promise<T | null> {
  try {
    const response = await fetch(new URL(path, origin));
    if (!response.ok) return null;
    return (await response.json().catch(() => null)) as T | null;
  } catch {
    return null;
  }
}

interface OverviewResponse {
  rating: number | null;
  ratingLabel: string;
  recommendationBreakdown: {
    period: string | null;
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  } | null;
}

interface PriceTargetResponse {
  available: boolean;
  high: number | null;
  low: number | null;
  average: number | null;
}

interface QuoteResponse {
  close: number;
}

interface EarningsResponse {
  quarters: EarningsQuarterSnapshot[];
}

interface InsidersResponse {
  netSentiment: { label: "Net Buying" | "Net Selling"; netValue: number } | null;
}

interface HistoryResponse {
  history: RawBar[];
}

interface CalendarEntry {
  symbol: string;
  date: string;
  epsActual: number | null;
}

interface CalendarResponse {
  entries: CalendarEntry[];
}

// The last bar strictly before `dateIso`, and the first bar on or after
// it — same "pre-close vs. reaction-session close" pairing
// app/earnings/page.tsx's own findPreEarningsClose already establishes,
// reimplemented here for server-side use (that one lives in a "use
// client" page file). Assumes `bars` is oldest-first, matching every
// other daily-bar consumer in this app.
function computeReaction(bars: RawBar[], reportDateIso: string): PriceReactionSnapshot | null {
  const reportMs = new Date(`${reportDateIso}T00:00:00Z`).getTime();

  let preReportClose: number | null = null;
  let reportDayClose: number | null = null;
  for (const bar of bars) {
    const barMs = new Date(`${bar.date}T00:00:00Z`).getTime();
    if (barMs < reportMs) {
      preReportClose = bar.close;
    } else if (reportDayClose === null) {
      reportDayClose = bar.close;
    }
  }

  const latestClose = bars.length > 0 ? bars[bars.length - 1].close : null;
  if (preReportClose === null || reportDayClose === null || latestClose === null || preReportClose === 0) {
    return null;
  }

  return {
    reportDate: reportDateIso,
    preReportClose,
    reportDayClose,
    reportDayReactionPercent: ((reportDayClose - preReportClose) / preReportClose) * 100,
    latestClose,
    cumulativeReactionPercent: ((latestClose - preReportClose) / preReportClose) * 100,
  };
}

function computeBeatStreak(quarters: EarningsQuarterSnapshot[]): { beats: number; total: number } | null {
  const scored = quarters
    .filter((q) => q.actual !== null && q.estimate !== null)
    .slice(-BEAT_STREAK_QUARTERS);
  if (scored.length === 0) return null;
  const beats = scored.filter((q) => q.actual! >= q.estimate!).length;
  return { beats, total: scored.length };
}

async function findPriorReportDate(ticker: string, reportDateIso: string, origin: string): Promise<string | null> {
  const reportDate = new Date(`${reportDateIso}T00:00:00Z`);
  const from = new Date(reportDate);
  from.setUTCDate(from.getUTCDate() - 110);
  const to = new Date(reportDate);
  to.setUTCDate(to.getUTCDate() - 1);

  const calendar = await fetchInternalJson<CalendarResponse>(
    `/api/earnings-calendar?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`,
    origin
  );
  const priorEntries = (calendar?.entries ?? [])
    .filter((e) => e.symbol === ticker && e.epsActual !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
  return priorEntries[0]?.date ?? null;
}

function directionFromPercent(percent: number): "bullish" | "bearish" | "neutral" {
  if (percent >= BULLISH_PERCENT_FLOOR) return "bullish";
  if (percent <= BEARISH_PERCENT_CEILING) return "bearish";
  return "neutral";
}

function asSignalDirection(value: string | undefined): "bullish" | "neutral" | "bearish" | null {
  return value === "bullish" || value === "neutral" || value === "bearish" ? value : null;
}

// Every divergence recorded here compares two already-real, independently
// computed values — never inferred from one side alone, never guessed.
function computeDivergences(data: Omit<EarningsSetupDataSnapshot, "divergences">): DivergenceSnapshot[] {
  const divergences: DivergenceSnapshot[] = [];
  if (!data.analystConsensus) return divergences;

  const analystDirection = directionFromPercent(ratingToPercent(data.analystConsensus.rating));

  if (data.signalDirection && data.signalDirection !== "neutral" && analystDirection !== "neutral" && data.signalDirection !== analystDirection) {
    divergences.push({
      kind: "signal_vs_analyst",
      description: `Noble Signals rates this ticker ${data.signalDirection} while analyst consensus is ${data.analystConsensus.ratingLabel}.`,
    });
  }

  if (data.insiderNetSentiment && analystDirection !== "neutral") {
    const insiderDirection = data.insiderNetSentiment.label === "Net Buying" ? "bullish" : "bearish";
    if (insiderDirection !== analystDirection) {
      divergences.push({
        kind: "insider_vs_analyst",
        description: `Recent insider transactions skew toward ${data.insiderNetSentiment.label.toLowerCase()} while analyst consensus is ${data.analystConsensus.ratingLabel}.`,
      });
    }
  }

  if (data.priceTarget && analystDirection === "bullish" && data.priceTarget.impliedChangePercent < 0) {
    divergences.push({
      kind: "target_vs_rating",
      description: `The average analyst price target implies downside from the current price, despite a ${data.analystConsensus.ratingLabel} consensus rating.`,
    });
  }

  return divergences;
}

// Gathers every real data point for one ticker's specific earnings event,
// in parallel where possible, from data already available elsewhere in
// this app (existing internal routes, lib/fmp.ts's own FMP integration,
// and this ticker's own /signals row if one exists) — no new upstream
// provider integration. Every category degrades independently (null or
// empty) rather than failing the whole gather.
export async function gatherEarningsSetupData(
  ticker: string,
  companyName: string,
  reportDate: string,
  origin: string
): Promise<EarningsSetupDataSnapshot> {
  const [overview, priceTargetRes, quote, earningsRes, insidersRes, historyRes, grades, segmentation, signal, priorReportDate] =
    await Promise.all([
      withTimeout(fetchInternalJson<OverviewResponse>(`/api/stock/overview?ticker=${encodeURIComponent(ticker)}`, origin), GATHER_TIMEOUT_MS),
      withTimeout(fetchInternalJson<PriceTargetResponse>(`/api/stock/price-target?ticker=${encodeURIComponent(ticker)}`, origin), GATHER_TIMEOUT_MS),
      withTimeout(fetchInternalJson<QuoteResponse>(`/api/stock?ticker=${encodeURIComponent(ticker)}`, origin), GATHER_TIMEOUT_MS),
      withTimeout(fetchInternalJson<EarningsResponse>(`/api/stock/earnings?ticker=${encodeURIComponent(ticker)}`, origin), GATHER_TIMEOUT_MS),
      withTimeout(fetchInternalJson<InsidersResponse>(`/api/stock/insiders?ticker=${encodeURIComponent(ticker)}`, origin), GATHER_TIMEOUT_MS),
      withTimeout(
        fetchInternalJson<HistoryResponse>(
          `/api/stock/history?ticker=${encodeURIComponent(ticker)}&interval=1day&range=${PRICE_HISTORY_RANGE}`,
          origin
        ),
        GATHER_TIMEOUT_MS
      ),
      withTimeout(fetchFmpGrades(ticker), GATHER_TIMEOUT_MS),
      withTimeout(fetchFmpRevenueSegmentation(ticker), GATHER_TIMEOUT_MS),
      prisma.tradeSignal.findUnique({ where: { ticker } }),
      withTimeout(findPriorReportDate(ticker, reportDate, origin), GATHER_TIMEOUT_MS),
    ]);

  const currentPrice = typeof quote?.close === "number" ? quote.close : null;

  const analystConsensus =
    overview?.rating !== null && overview?.rating !== undefined && overview.recommendationBreakdown
      ? {
          rating: overview.rating,
          ratingLabel: overview.ratingLabel,
          strongBuy: overview.recommendationBreakdown.strongBuy,
          buy: overview.recommendationBreakdown.buy,
          hold: overview.recommendationBreakdown.hold,
          sell: overview.recommendationBreakdown.sell,
          strongSell: overview.recommendationBreakdown.strongSell,
          totalAnalysts:
            overview.recommendationBreakdown.strongBuy +
            overview.recommendationBreakdown.buy +
            overview.recommendationBreakdown.hold +
            overview.recommendationBreakdown.sell +
            overview.recommendationBreakdown.strongSell,
          period: overview.recommendationBreakdown.period,
        }
      : null;

  const priceTarget =
    priceTargetRes?.available &&
    typeof priceTargetRes.low === "number" &&
    typeof priceTargetRes.average === "number" &&
    typeof priceTargetRes.high === "number" &&
    currentPrice !== null &&
    currentPrice !== 0
      ? {
          low: priceTargetRes.low,
          average: priceTargetRes.average,
          high: priceTargetRes.high,
          impliedChangePercent: ((priceTargetRes.average - currentPrice) / currentPrice) * 100,
        }
      : null;

  const recentRevisions: RatingRevisionSnapshot[] = (grades ?? [])
    .filter((g): g is typeof g & { action: "upgrade" | "downgrade" } => g.action === "upgrade" || g.action === "downgrade")
    .slice(0, MAX_REVISIONS)
    .map((g) => ({ date: g.date, gradingCompany: g.gradingCompany, previousGrade: g.previousGrade, newGrade: g.newGrade, action: g.action }));

  const earningsHistory = earningsRes?.quarters ?? [];
  const beatStreak = computeBeatStreak(earningsHistory);

  const bars = historyRes?.history ?? [];
  const priceReaction = computeReaction(bars, reportDate);
  const priorReportReaction = priorReportDate ? computeReaction(bars, priorReportDate) : null;

  // Only the most recent fiscal year's mix resolves on this plan
  // (confirmed live) — never presented as belonging to this specific quarter.
  const latestSegmentation = segmentation?.[0] ?? null;
  const revenueSegments = latestSegmentation
    ? (() => {
        const entries = Object.entries(latestSegmentation.data).filter(([, v]) => typeof v === "number");
        const total = entries.reduce((sum, [, v]) => sum + v, 0);
        if (total <= 0) return null;
        return {
          fiscalYear: latestSegmentation.fiscalYear,
          segments: entries
            .map(([name, revenue]) => ({ name, revenue, percentOfTotal: (revenue / total) * 100 }))
            .sort((a, b) => b.revenue - a.revenue),
        };
      })()
    : null;

  const base = {
    ticker,
    companyName,
    reportDate,
    currentPrice,
    analystConsensus,
    priceTarget,
    recentRevisions,
    earningsHistory,
    beatStreak,
    priceReaction,
    priorReportReaction,
    revenueSegments,
    insiderNetSentiment: insidersRes?.netSentiment ?? null,
    signalDirection: asSignalDirection(signal?.direction),
    signalConfidence: signal?.confidence ?? null,
  };

  return { ...base, divergences: computeDivergences(base) };
}
