"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowLeftRight,
  Award,
  Circle,
  Clock,
  Gift,
  Receipt,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ScrollHint from "@/components/ScrollHint";
import { cardClass } from "@/lib/cardStyles";
import EntityLogo from "@/components/trackers/EntityLogo";
import { getInvestorPhoto } from "@/lib/trackers/investorPhotos";
import {
  DateComparison,
  DividendsExcludedNote,
  EstimateRangeBadge,
  MethodologyNote,
  NoDataYetNote,
  ShareBasedEstimateBadge,
  UnresolvedHoldingsNote,
} from "@/components/trackers/TransparencyLabels";

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#84cc16"];

const TYPE_LABEL: Record<string, string> = {
  congress: "Member of Congress",
  hedge_fund: "Hedge Fund",
  investor: "Investor",
  insider: "Company Insiders",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});
const preciseCurrencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// Reused for both the Type column badge and the Recent Trades section below
// — one source of truth so a given transaction type always renders with
// the same label/color/icon everywhere it's shown. Color language matches
// the earnings dot chart / analyst rating spectrum work already in this
// app: green = acquiring/buy signal, red = disposing/sell signal, neutral
// gray for everything else (SEC Form 4 codes that don't represent an
// open-market trading decision) — icons distinguish those neutral
// categories from each other so they don't all read as one indistinct gray
// blob.
const TRANSACTION_TYPE_META: Record<string, { label: string; badgeClass: string; textClass: string; Icon: LucideIcon }> = {
  buy: { label: "Buy", badgeClass: "bg-green-400/10 text-green-500", textClass: "text-green-500", Icon: TrendingUp },
  sell: { label: "Sell", badgeClass: "bg-red-400/10 text-red-500", textClass: "text-red-500", Icon: TrendingDown },
  partial_sell: { label: "Partial Sell", badgeClass: "bg-red-400/10 text-red-500", textClass: "text-red-500", Icon: TrendingDown },
  option_exercise: { label: "Option Exercise", badgeClass: "bg-foreground/10 text-foreground/60", textClass: "text-foreground/70", Icon: RefreshCw },
  award: { label: "Award", badgeClass: "bg-foreground/10 text-foreground/60", textClass: "text-foreground/70", Icon: Award },
  gift: { label: "Gift", badgeClass: "bg-foreground/10 text-foreground/60", textClass: "text-foreground/70", Icon: Gift },
  tax_withholding: { label: "Tax Withholding", badgeClass: "bg-foreground/10 text-foreground/60", textClass: "text-foreground/70", Icon: Receipt },
  vesting: { label: "Vesting", badgeClass: "bg-foreground/10 text-foreground/60", textClass: "text-foreground/70", Icon: Clock },
  exchange: { label: "Exchange", badgeClass: "bg-foreground/10 text-foreground/60", textClass: "text-foreground/70", Icon: ArrowLeftRight },
  initial_position: { label: "Existing Position", badgeClass: "bg-foreground/10 text-foreground/60", textClass: "text-foreground/70", Icon: Circle },
  other: { label: "Other", badgeClass: "bg-foreground/10 text-foreground/60", textClass: "text-foreground/70", Icon: Circle },
};

function getTypeMeta(type: string) {
  return TRANSACTION_TYPE_META[type] ?? { label: type, badgeClass: "bg-foreground/10 text-foreground/60", textClass: "text-foreground/70", Icon: Circle };
}

function TransactionTypeBadge({ type }: { type: string }) {
  const meta = getTypeMeta(type);
  const Icon = meta.Icon;
  return (
    <span className={`inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-xs font-medium ${meta.badgeClass}`}>
      <Icon size={11} />
      {meta.label}
    </span>
  );
}

// SEC convention: these transaction types are routinely reported with no
// cash price at all (RSU vesting, grants, tax withholding paid in shares,
// gifts) — a $0/blank value there is correct, not missing data, so this
// names the reason rather than leaving a bare "—" that reads as a bug.
function nonCashExplanation(type: string): string | null {
  switch (type) {
    case "tax_withholding":
      return "Shares withheld for taxes";
    case "vesting":
      return "Non-cash (RSU vesting)";
    case "award":
      return "Non-cash award";
    case "option_exercise":
      return "No cash price reported";
    case "gift":
      return "Gift — no value reported";
    default:
      return null;
  }
}

// Only genuine open-market buys/sells are a "the insider chose to trade"
// signal — matches the existing net-sentiment convention in
// app/api/stock/insiders/route.ts, which excludes grants/gifts/tax
// withholding/option exercises from the same calculation for the same
// reason.
const MEANINGFUL_TRADE_TYPES = new Set(["buy", "sell", "partial_sell"]);
const RECENT_TRADES_LIMIT = 8;

interface Holding {
  ticker: string | null;
  issuerName: string | null;
  shares: number | null;
  filingValue: number;
  currentValue: number | null;
  currentPrice: number | null;
  percentChangeToday: number | null;
  percentOfPortfolio: number;
  sector: string | null;
  isEstimate: boolean;
  asOfDate: string;
}

interface TransactionOut {
  id: string;
  ticker: string | null;
  issuerName: string | null;
  transactionType: string;
  reportedDate: string | null;
  tradeDate: string | null;
  disclosureDate: string | null;
  amountLow: number | null;
  amountHigh: number | null;
  exactValue: number | null;
  shares: number | null;
  isEstimate: boolean;
  sourceType: string;
  sourceUrl: string | null;
}

interface Performance {
  available: boolean;
  reason?: string;
  startDate?: string;
  endDate?: string;
  entityReturnPercent?: number;
  benchmarkReturnPercent?: number;
  series?: Array<{ date: string; indexedValue: number }>;
  dividendsExcluded: true;
  methodologyNote: string;
}

interface TrackerProfile {
  entity: { id: string; slug: string; type: string; name: string; title: string | null; photoUrl: string | null; secCik: string | null };
  latestDisclosureDate: string | null;
  portfolioValue: { filingValue: number; currentValue: number | null; isEstimate: boolean };
  holdings: Holding[];
  unresolvedHoldingsCount: number;
  sectorAllocation: Array<{ sector: string; value: number }>;
  topWinners: Holding[];
  topLosers: Holding[];
  recentTransactions: TransactionOut[];
  allTransactions: TransactionOut[];
  performance: Performance;
}

function TransactionRow({ tx }: { tx: TransactionOut }) {
  const meta = getTypeMeta(tx.transactionType);
  const explanation = !tx.exactValue ? nonCashExplanation(tx.transactionType) : null;

  return (
    <tr className="border-t border-black/5 dark:border-white/10">
      <td className="p-2 font-medium text-foreground">{tx.ticker ?? tx.issuerName ?? "—"}</td>
      <td className="p-2">
        <TransactionTypeBadge type={tx.transactionType} />
      </td>
      <td className="p-2">
        <DateComparison reportedDate={tx.reportedDate} tradeDate={tx.tradeDate} disclosureDate={tx.disclosureDate} />
      </td>
      <td className={`p-2 text-right ${meta.textClass}`}>
        {tx.isEstimate ? (
          <EstimateRangeBadge low={tx.amountLow} high={tx.amountHigh} />
        ) : tx.exactValue ? (
          preciseCurrencyFormatter.format(tx.exactValue)
        ) : explanation ? (
          <span
            className="text-xs italic text-foreground/40"
            title="This transaction type is reported without a cash price per SEC convention — not missing data."
          >
            {explanation}
          </span>
        ) : (
          <span className="text-foreground/40">—</span>
        )}
      </td>
      <td className="p-2 text-right">
        {tx.sourceUrl ? (
          <a href={tx.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline">
            Source
          </a>
        ) : (
          <span className="text-xs text-foreground/30">—</span>
        )}
      </td>
    </tr>
  );
}

export default function TrackerDetailView({ slug }: { slug: string }) {
  const [profile, setProfile] = useState<TrackerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"date" | "value">("date");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/trackers/${encodeURIComponent(slug)}`);
        const body = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok) {
          setError(body?.error ?? "Failed to load this tracker");
          return;
        }
        setProfile(body);
      } catch {
        if (!cancelled) setError("Failed to load this tracker");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const sortedTransactions = useMemo(() => {
    if (!profile) return [];
    const list = [...profile.allTransactions];
    if (sortKey === "value") {
      return list.sort((a, b) => (b.exactValue ?? b.amountHigh ?? 0) - (a.exactValue ?? a.amountHigh ?? 0));
    }
    return list.sort((a, b) => (b.reportedDate ?? "").localeCompare(a.reportedDate ?? ""));
  }, [profile, sortKey]);

  const recentMeaningfulTrades = useMemo(() => {
    if (!profile) return [];
    return profile.allTransactions
      .filter((tx) => MEANINGFUL_TRADE_TYPES.has(tx.transactionType))
      .sort((a, b) => (b.reportedDate ?? b.disclosureDate ?? "").localeCompare(a.reportedDate ?? a.disclosureDate ?? ""))
      .slice(0, RECENT_TRADES_LIMIT);
  }, [profile]);

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center gap-4 p-8 pt-16 text-center">
        <p className="text-sm text-red-500">{error}</p>
        <Link href="/trackers" className="text-sm text-indigo-400 hover:underline">
          Back to Trackers
        </Link>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
        <div className="h-24 w-full max-w-5xl animate-pulse rounded-md bg-foreground/10" />
      </main>
    );
  }

  const { entity, portfolioValue, holdings, sectorAllocation, topWinners, topLosers, performance, latestDisclosureDate, recentTransactions } = profile;
  const investorPhoto = getInvestorPhoto(entity.slug, entity.type);

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        <Link href="/trackers" className="flex w-fit items-center gap-1.5 text-sm text-foreground/60 hover:text-foreground">
          <ArrowLeft size={14} /> Back to Trackers
        </Link>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <EntityLogo slug={entity.slug} type={entity.type} name={entity.name} size={64} />
            {investorPhoto && (
              <a
                href={investorPhoto.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="whitespace-nowrap text-center text-[10px] leading-tight text-foreground/40 hover:text-foreground/60 hover:underline"
              >
                {investorPhoto.photographer} · {investorPhoto.license}
              </a>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{entity.name}</h1>
              <span className="rounded-full bg-indigo-400/10 px-2 py-0.5 text-xs font-medium text-indigo-400">
                {TYPE_LABEL[entity.type] ?? entity.type}
              </span>
            </div>
            {entity.title && <p className="text-sm text-foreground/60">{entity.title}</p>}
          </div>
        </div>

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-4" })}>
            <span className="text-xs text-foreground/50">Est. Portfolio Value</span>
            <p className="text-xl font-bold text-foreground">
              {portfolioValue.currentValue != null
                ? currencyFormatter.format(portfolioValue.currentValue)
                : currencyFormatter.format(portfolioValue.filingValue)}
            </p>
            {portfolioValue.isEstimate && (
              <span className="text-[11px] text-amber-500">
                {entity.type === "insider" ? "Estimated from accumulated share activity" : "Range-based estimate"}
              </span>
            )}
          </div>
          <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-4" })}>
            <span className="text-xs text-foreground/50">1Y Return vs S&amp;P 500</span>
            {performance.available ? (
              <>
                <p className={`text-xl font-bold ${performance.entityReturnPercent! >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {performance.entityReturnPercent! >= 0 ? "+" : ""}
                  {performance.entityReturnPercent!.toFixed(2)}%
                </p>
                <span className="text-[11px] text-foreground/50">
                  {performance.benchmarkReturnPercent != null
                    ? `S&P 500: ${performance.benchmarkReturnPercent >= 0 ? "+" : ""}${performance.benchmarkReturnPercent.toFixed(2)}%`
                    : "S&P 500 comparison unavailable right now"}
                </span>
                <DividendsExcludedNote />
              </>
            ) : (
              <p className="text-sm text-foreground/40">Insufficient data</p>
            )}
          </div>
          <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-4" })}>
            <span className="text-xs text-foreground/50">Current Holdings</span>
            <p className="text-xl font-bold text-foreground">{holdings.length}</p>
            <UnresolvedHoldingsNote count={profile.unresolvedHoldingsCount} />
          </div>
          <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-4" })}>
            <span className="text-xs text-foreground/50">Latest Disclosure</span>
            <p className="text-xl font-bold text-foreground">
              {latestDisclosureDate ? new Date(latestDisclosureDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
            </p>
          </div>
        </section>

        <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
          <h2 className="text-lg font-semibold text-foreground">Recent Trades</h2>
          <p className="-mt-1 text-xs text-foreground/50">
            Meaningful buy/sell activity only — excludes awards, tax withholding, option exercises, and other routine
            non-trading events. See Full Transaction History below for everything.
          </p>
          {recentMeaningfulTrades.length === 0 ? (
            <NoDataYetNote reason="no open-market buy or sell activity has been disclosed yet — only routine non-trading events (awards, tax withholding, etc.) are on record so far." />
          ) : (
            <div className="flex flex-col gap-1.5">
              {recentMeaningfulTrades.map((tx) => {
                const meta = getTypeMeta(tx.transactionType);
                const date = tx.reportedDate ?? tx.disclosureDate;
                return (
                  <div
                    key={tx.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-foreground/[0.02] px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <TransactionTypeBadge type={tx.transactionType} />
                      <Link href={`/stocks?ticker=${tx.ticker}`} className="font-medium text-foreground hover:underline">
                        {tx.ticker ?? tx.issuerName ?? "—"}
                      </Link>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-foreground/50">
                        {date ? new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </span>
                      <span className={`text-sm font-semibold ${meta.textClass}`}>
                        {tx.isEstimate ? (
                          <EstimateRangeBadge low={tx.amountLow} high={tx.amountHigh} />
                        ) : tx.exactValue ? (
                          preciseCurrencyFormatter.format(tx.exactValue)
                        ) : (
                          <span className="text-foreground/40">—</span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {performance.available && performance.series && performance.series.length > 1 && (
          <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
            <h2 className="text-lg font-semibold text-foreground">Performance Over Time</h2>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performance.series}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                  <Tooltip
                    labelFormatter={(d) => new Date(d).toLocaleDateString()}
                    formatter={(value) => [`${Number(value).toFixed(1)} (indexed, 100 = start)`, "Value"]}
                  />
                  <Line type="monotone" dataKey="indexedValue" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <MethodologyNote text={performance.methodologyNote} />
          </section>
        )}
        {!performance.available && (
          <NoDataYetNote reason={performance.reason ?? "not enough data yet."} />
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sectorAllocation.length > 0 && (
            <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
              <h2 className="text-lg font-semibold text-foreground">Sector Allocation</h2>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sectorAllocation} dataKey="value" nameKey="sector" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {sectorAllocation.map((entry, index) => (
                        <Cell key={entry.sector} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => currencyFormatter.format(Number(value))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
            <h2 className="text-lg font-semibold text-foreground">Today&apos;s Movers Among Holdings</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground/50">Winners</span>
                {topWinners.length === 0 && <span className="text-xs text-foreground/40">—</span>}
                {topWinners.map((h) => (
                  <div key={h.ticker} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{h.ticker}</span>
                    <span className="text-green-500">+{h.percentChangeToday!.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground/50">Losers</span>
                {topLosers.length === 0 && <span className="text-xs text-foreground/40">—</span>}
                {topLosers.map((h) => (
                  <div key={h.ticker} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{h.ticker}</span>
                    <span className="text-red-500">{h.percentChangeToday!.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
          <h2 className="text-lg font-semibold text-foreground">Current Holdings</h2>
          {holdings.length === 0 ? (
            <NoDataYetNote
              reason={
                profile.allTransactions.length > 0
                  ? "accumulated disclosures so far show only disposals (sells, tax withholding, etc.) with no acquisition captured in the ingested window — this pipeline doesn't backfill a starting position from before ingestion began, so a net-negative running total shows as zero rather than a fabricated negative number."
                  : "no confirmed current holdings from accumulated disclosures yet."
              }
            />
          ) : (
            <>
            <ScrollHint />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-xs text-foreground/50 dark:border-white/15">
                    <th className="p-2 text-left">Ticker</th>
                    <th className="p-2 text-left">Shares</th>
                    <th className="p-2 text-right">Value</th>
                    <th className="p-2 text-right">% of Portfolio</th>
                    <th className="p-2 text-right">Today</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => (
                    <tr key={h.ticker} className="border-t border-black/5 dark:border-white/10">
                      <td className="p-2 font-medium text-foreground">
                        <Link href={`/stocks?ticker=${h.ticker}`} className="hover:underline">
                          {h.ticker}
                        </Link>
                        {h.isEstimate &&
                          (entity.type === "insider" ? (
                            <ShareBasedEstimateBadge />
                          ) : (
                            <EstimateRangeBadge low={h.filingValue} high={null} />
                          ))}
                      </td>
                      <td className="p-2 text-foreground/70">{h.shares != null ? h.shares.toLocaleString() : "—"}</td>
                      <td className="p-2 text-right text-foreground">{currencyFormatter.format(h.currentValue ?? h.filingValue)}</td>
                      <td className="p-2 text-right text-foreground/70">{h.percentOfPortfolio.toFixed(1)}%</td>
                      <td className={`p-2 text-right ${h.percentChangeToday == null ? "text-foreground/30" : h.percentChangeToday >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {h.percentChangeToday != null ? `${h.percentChangeToday >= 0 ? "+" : ""}${h.percentChangeToday.toFixed(2)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <UnresolvedHoldingsNote count={profile.unresolvedHoldingsCount} />
            </div>
            </>
          )}
        </section>

        <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
          <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
          {recentTransactions.length === 0 ? (
            <NoDataYetNote reason="no recent disclosures accumulated yet — see the note above about this feed's rolling window." />
          ) : (
            <>
            <ScrollHint />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-xs text-foreground/50 dark:border-white/15">
                    <th className="p-2 text-left">Ticker</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-left">Dates</th>
                    <th className="p-2 text-right">Value</th>
                    <th className="p-2 text-right">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>

        <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Full Transaction History</h2>
            <div className="flex gap-1 text-xs">
              <button
                type="button"
                onClick={() => setSortKey("date")}
                className={`rounded-md border px-3 py-2 ${sortKey === "date" ? "border-indigo-400/50 text-indigo-400" : "border-black/10 text-foreground/50 dark:border-white/15"}`}
              >
                By Date
              </button>
              <button
                type="button"
                onClick={() => setSortKey("value")}
                className={`rounded-md border px-3 py-2 ${sortKey === "value" ? "border-indigo-400/50 text-indigo-400" : "border-black/10 text-foreground/50 dark:border-white/15"}`}
              >
                By Value
              </button>
            </div>
          </div>
          {sortedTransactions.length === 0 ? (
            <NoDataYetNote reason="no transactions ingested yet." />
          ) : (
            <>
            <ScrollHint />
            <div className={`overflow-x-auto ${sortedTransactions.length > 15 ? "max-h-[500px] overflow-y-auto" : ""}`}>
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="sticky top-0 border-b border-black/10 bg-background text-xs text-foreground/50 dark:border-white/15">
                    <th className="p-2 text-left">Ticker</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-left">Dates</th>
                    <th className="p-2 text-right">Value</th>
                    <th className="p-2 text-right">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTransactions.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
