"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { X, AlertTriangle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import { isEarningsRelevant } from "@/lib/earningsNewsRelevance";
import StockLogo from "@/components/stocks/StockLogo";
import { ArticleCard, ArticleCardSkeleton } from "@/components/ArticleCard";
import type { Article } from "@/components/NewsTicker";
import type { EarningsSetupDataSnapshot } from "@/lib/earningsSetup/types";

// Same load-on-open reasoning app/stocks/page.tsx already applies to this
// exact component — it pulls in recharts, no reason to pay for that
// bundle before a user ever opens this modal.
const EarningsCard = dynamic(() => import("@/components/stocks/EarningsCard"), {
  loading: () => <div className="h-56 w-full animate-pulse rounded-md bg-foreground/10" />,
});

export interface EarningsDetailEntry {
  symbol: string;
  name: string;
  date: string;
  hour: "bmo" | "amc" | "dmh" | null;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
}

interface EarningsSetupResponse {
  status: string;
  data: EarningsSetupDataSnapshot;
  narrative: string | null;
}

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatEps(value: number | null): string {
  if (value === null) return "—";
  return `${value < 0 ? "-" : ""}$${Math.abs(value).toFixed(2)}`;
}

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatHour(hour: EarningsDetailEntry["hour"]): string {
  switch (hour) {
    case "bmo":
      return "Before Market Open";
    case "amc":
      return "After Market Close";
    case "dmh":
      return "During Market Hours";
    default:
      return "Time not yet announced";
  }
}

function ReactionStat({ label, percent }: { label: string; percent: number }) {
  const isUp = percent >= 0;
  return (
    <div className="flex flex-col items-center gap-1 rounded-md bg-foreground/5 px-3 py-2">
      <span className={`text-lg font-bold ${isUp ? "text-green-500" : "text-red-500"}`}>
        {isUp ? "▲" : "▼"} {formatSignedPercent(percent)}
      </span>
      <span className="text-center text-[11px] text-foreground/50">{label}</span>
    </div>
  );
}

// Prominent, persistent, non-dismissible — a step above /signals' own
// SignalsDisclaimer given this section explicitly touches options-adjacent
// context: it names the specific added risks (leverage, time decay, total
// loss) rather than just a generic "not advice" line, and sits at the top
// of the section it covers, before any data.
function SetupAnalysisDisclaimer() {
  return (
    <div className="flex w-full items-start gap-3 rounded-lg border border-amber-400/30 bg-amber-400/5 p-4">
      <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-500" />
      <p className="text-sm leading-relaxed text-foreground/80">
        <span className="font-semibold text-amber-500">Educational context only, not a trade recommendation.</span>{" "}
        This section presents factors relevant to this earnings event — it does not suggest any options strategy,
        trade direction, or specific action, and does not account for your individual risk tolerance, portfolio
        context, or options-specific risks (leverage, time decay, potential for total loss of premium). Options and
        other volatility-sensitive trades carry risk beyond that of the underlying stock. Nothing here is investment
        advice.
      </p>
    </div>
  );
}

function AnalystBreakdownTiles({ data }: { data: EarningsSetupDataSnapshot }) {
  if (!data.analystConsensus) return <p className="text-sm text-foreground/50">Analyst consensus not available.</p>;
  const c = data.analystConsensus;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-foreground">
        Consensus: <span className="font-semibold">{c.ratingLabel}</span> ({c.rating.toFixed(2)}/5, {c.totalAnalysts} analysts)
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        {([
          ["Strong Buy", c.strongBuy],
          ["Buy", c.buy],
          ["Hold", c.hold],
          ["Sell", c.sell],
          ["Strong Sell", c.strongSell],
        ] as const).map(([label, count]) => (
          <div key={label} className="flex flex-col items-center gap-0.5 rounded-md bg-foreground/5 px-1 py-1.5 text-center">
            <span className="text-[9px] leading-tight text-foreground/50">{label}</span>
            <span className="text-sm font-semibold text-foreground">{count}</span>
          </div>
        ))}
      </div>
      {data.priceTarget && (
        <p className="text-sm text-foreground/70">
          Price target: {currencyFormatter.format(data.priceTarget.low)} – {currencyFormatter.format(data.priceTarget.high)}, average{" "}
          {currencyFormatter.format(data.priceTarget.average)} (
          <span className={data.priceTarget.impliedChangePercent >= 0 ? "text-green-500" : "text-red-500"}>
            {formatSignedPercent(data.priceTarget.impliedChangePercent)}
          </span>{" "}
          implied from current price)
        </p>
      )}
      {data.recentRevisions.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-foreground/60">Recent rating actions</p>
          {data.recentRevisions.map((r, i) => (
            <p key={i} className="text-xs text-foreground/60">
              {r.date} — {r.gradingCompany}{" "}
              <span className={r.action === "upgrade" ? "text-green-500" : "text-red-500"}>{r.action}d</span> from {r.previousGrade} to{" "}
              {r.newGrade}
            </p>
          ))}
        </div>
      )}
      {data.beatStreak && (
        <p className="text-sm text-foreground/70">
          Beat estimates in {data.beatStreak.beats} of the last {data.beatStreak.total} quarters.
        </p>
      )}
      {data.divergences.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-dashed border-foreground/15 p-2">
          {data.divergences.map((d, i) => (
            <p key={i} className="text-xs text-foreground/70">
              {d.description}
            </p>
          ))}
        </div>
      )}
      {data.revenueSegments && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-foreground/60">FY{data.revenueSegments.fiscalYear} revenue mix (full fiscal year, not this quarter specifically)</p>
          {data.revenueSegments.segments.slice(0, 6).map((s) => (
            <div key={s.name} className="flex items-center justify-between text-xs text-foreground/60">
              <span>{s.name}</span>
              <span>{s.percentOfTotal.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EarningsDetailModal({ entry, onClose }: { entry: EarningsDetailEntry; onClose: () => void }) {
  const reported = entry.epsActual !== null;
  const beat = reported && entry.epsEstimate !== null ? entry.epsActual! >= entry.epsEstimate! : null;
  const surprisePercent =
    reported && entry.epsEstimate ? ((entry.epsActual! - entry.epsEstimate!) / Math.abs(entry.epsEstimate!)) * 100 : null;

  const [setup, setSetup] = useState<EarningsSetupResponse | null>(null);
  const [setupError, setSetupError] = useState(false);
  const [articles, setArticles] = useState<Article[] | null>(null);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    if (!reported) return;
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(
          `/api/earnings-setup?ticker=${encodeURIComponent(entry.symbol)}&reportDate=${entry.date}&companyName=${encodeURIComponent(entry.name)}`
        );
        if (!response.ok) throw new Error("request failed");
        const body: EarningsSetupResponse = await response.json();
        if (!cancelled) setSetup(body);
      } catch {
        if (!cancelled) setSetupError(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reported, entry.symbol, entry.date, entry.name]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/stock/news?ticker=${encodeURIComponent(entry.symbol)}`);
        if (!response.ok) throw new Error("request failed");
        const body = await response.json();
        const list: Article[] = Array.isArray(body?.articles) ? body.articles : [];
        // Earnings-relevant articles float to the top; everything else
        // keeps its existing recency order beneath them — never hides
        // general ticker news just because nothing earnings-specific
        // exists yet.
        const sorted = [...list].sort((a, b) => Number(isEarningsRelevant(b)) - Number(isEarningsRelevant(a)));
        if (!cancelled) setArticles(sorted);
      } catch {
        if (!cancelled) setArticles([]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [entry.symbol]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-lg border border-black/10 bg-background p-6 dark:border-white/15"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <StockLogo symbol={entry.symbol} size={36} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">{entry.symbol}</h2>
                <span className="truncate text-sm text-foreground/60">{entry.name}</span>
              </div>
              <p className="text-xs text-foreground/50">
                {new Date(`${entry.date}T00:00:00Z`).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })}{" "}
                · {formatHour(entry.hour)}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 text-foreground/50 hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {!reported && (
          <div className={cardClass("neutral", { extra: "flex flex-col gap-2 p-4" })}>
            <h3 className="font-semibold text-foreground">Not Yet Reported</h3>
            <p className="text-sm text-foreground/70">
              EPS estimate: {formatEps(entry.epsEstimate)}
              {entry.revenueEstimate !== null && ` · Revenue estimate: ${compactCurrencyFormatter.format(entry.revenueEstimate)}`}
            </p>
          </div>
        )}

        {reported && (
          <>
            <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
              <h3 className="font-semibold text-foreground">Reported Numbers</h3>
              <div className="flex flex-wrap items-center gap-3">
                {beat !== null && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${
                      beat
                        ? "bg-gradient-to-b from-green-400/25 to-green-500/5 text-green-400 ring-green-400/30"
                        : "bg-gradient-to-b from-red-400/25 to-red-500/5 text-red-400 ring-red-400/30"
                    }`}
                  >
                    {beat ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {beat ? "Beat" : "Miss"}
                    {surprisePercent !== null && ` ${formatSignedPercent(surprisePercent)}`}
                  </span>
                )}
                <span className="text-sm text-foreground/80">
                  EPS {formatEps(entry.epsActual)} vs {formatEps(entry.epsEstimate)} est.
                </span>
                {entry.revenueActual !== null && entry.revenueEstimate !== null && (
                  <span className="text-sm text-foreground/60">
                    Rev. {compactCurrencyFormatter.format(entry.revenueActual)} vs {compactCurrencyFormatter.format(entry.revenueEstimate)} est.
                  </span>
                )}
              </div>
              <EarningsCard ticker={entry.symbol} />
            </div>

            {setup?.data.priceReaction && (
              <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
                <h3 className="font-semibold text-foreground">Price Reaction</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <ReactionStat label="Report day" percent={setup.data.priceReaction.reportDayReactionPercent} />
                  <ReactionStat label="Cumulative since" percent={setup.data.priceReaction.cumulativeReactionPercent} />
                  {setup.data.priorReportReaction && (
                    <>
                      <ReactionStat label="Prior report day" percent={setup.data.priorReportReaction.reportDayReactionPercent} />
                      <ReactionStat label="Prior cumulative" percent={setup.data.priorReportReaction.cumulativeReactionPercent} />
                    </>
                  )}
                </div>
              </div>
            )}

            <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
              <h3 className="font-semibold text-foreground">Earnings Setup Analysis</h3>
              <SetupAnalysisDisclaimer />
              {!setup && !setupError && <div className="h-24 w-full animate-pulse rounded bg-foreground/10" />}
              {setupError && <p className="text-sm text-foreground/50">Analysis unavailable right now.</p>}
              {setup && (
                <>
                  <AnalystBreakdownTiles data={setup.data} />
                  {setup.narrative && <p className="text-sm leading-relaxed text-foreground/80">{setup.narrative}</p>}
                </>
              )}
            </div>

            <div className={cardClass("neutral", { extra: "flex flex-col gap-2 p-4" })}>
              <h3 className="font-semibold text-foreground">Related News</h3>
              {articles === null && Array.from({ length: 3 }).map((_, i) => <ArticleCardSkeleton key={i} />)}
              {articles !== null && articles.length === 0 && <p className="text-sm text-foreground/50">No recent news found.</p>}
              {articles !== null && articles.slice(0, 6).map((article, i) => <ArticleCard key={`${article.url}-${i}`} article={article} />)}
            </div>
          </>
        )}

        <Link href={`/stocks?ticker=${encodeURIComponent(entry.symbol)}&tab=earnings`} className="text-center text-sm font-medium text-foreground/60 hover:text-foreground hover:underline">
          View full stock page →
        </Link>
      </div>
    </div>
  );
}
