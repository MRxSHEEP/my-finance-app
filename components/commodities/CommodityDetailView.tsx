"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Fuel, Droplet, Flame, Layers, Sprout, Wheat, Leaf, Sparkles } from "lucide-react";
import PriceChart, {
  changeColorClass,
  formatDollarChange,
  formatPrice,
  PercentChangeBadge,
  PillButton,
  type HistoryPoint,
  type Interval,
  type Range as ChartRange,
} from "@/components/PriceChart";
import { IngotIcon } from "@/components/commodities/IngotIcon";
import { cardClass } from "@/lib/cardStyles";

type Range = "1D" | "1W" | "1M" | "3M" | "1Y" | "MAX";

const PAGE_RANGES: { label: string; value: Range }[] = [
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "1Y", value: "1Y" },
  { label: "MAX", value: "MAX" },
];

// Mirrors app/api/commodities/detail/route.ts's own INTERVAL_FOR_RANGE for
// the ETF-proxy path (gold/silver are always daily, handled below).
const INTERVAL_FOR_RANGE: Record<Range, Interval> = {
  "1D": "5min",
  "1W": "30min",
  "1M": "1h",
  "3M": "1day",
  "1Y": "1day",
  MAX: "1day",
};

const COMMODITY_ICON: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; className: string }> = {
  "C:XAUUSD": { icon: IngotIcon, className: "text-amber-400" },
  "C:XAGUSD": { icon: IngotIcon, className: "text-zinc-400" },
  USO: { icon: Fuel, className: "text-neutral-400" },
  BNO: { icon: Droplet, className: "text-neutral-400" },
  UNG: { icon: Flame, className: "text-blue-400" },
  CPER: { icon: Layers, className: "text-orange-600" },
  CORN: { icon: Sprout, className: "text-yellow-500" },
  WEAT: { icon: Wheat, className: "text-amber-500" },
  SOYB: { icon: Leaf, className: "text-green-600" },
};

interface CommodityQuote {
  symbol: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
}

interface DerivedStats {
  dayHigh: number | null;
  dayLow: number | null;
  previousClose: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
}

interface DetailResponse {
  symbol: string;
  name: string;
  about: string | null;
  history: HistoryPoint[];
  quote: CommodityQuote;
  stats: DerivedStats;
  explanation: string | null;
  rangeEnabled: Record<Range, boolean>;
  intradayAvailable: boolean;
}

function RangeStatBar({ low, high, current }: { low: number; high: number; current: number | null }) {
  const ratio = high > low && current != null ? Math.min(1, Math.max(0, (current - low) / (high - low))) : null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
        {ratio !== null && (
          <div
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-background bg-indigo-400"
            style={{ left: `${ratio * 100}%` }}
          />
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-foreground/50">
        <span>{formatPrice(low)}</span>
        <span>{formatPrice(high)}</span>
      </div>
    </div>
  );
}

export default function CommodityDetailView({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<Range>("1M");
  const [data, setData] = useState<DetailResponse | null>(null);
  const [historyGeneration, setHistoryGeneration] = useState(0);
  const [hoveredPoint, setHoveredPoint] = useState<HistoryPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
      try {
        const response = await fetch(
          `/api/commodities/detail?symbol=${encodeURIComponent(symbol)}&range=${range}`
        );
        if (!response.ok) throw new Error("request failed");
        const body: DetailResponse = await response.json();
        if (cancelled) return;
        setData(body);
        setHistoryGeneration((generation) => generation + 1);
        if (!body.history || body.history.length === 0) setError("No chart data available for this range.");
      } catch {
        if (!cancelled) setError("Failed to load data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  const history = data?.history ?? [];
  const periodStartPrice = history.length > 0 ? history[0].close : null;
  const activePoint = hoveredPoint ?? (history.length > 0 ? history[history.length - 1] : null);
  const displayPrice = activePoint ? activePoint.close : data?.quote.price ?? 0;
  const displayDollarChange =
    activePoint && periodStartPrice !== null && hoveredPoint
      ? activePoint.close - periodStartPrice
      : data?.quote.change ?? 0;
  const displayPercentChange =
    activePoint && periodStartPrice && hoveredPoint
      ? ((activePoint.close - periodStartPrice) / periodStartPrice) * 100
      : data?.quote.percentChange ?? 0;

  const iconDef = data ? COMMODITY_ICON[data.symbol] : undefined;
  const Icon = iconDef?.icon;

  const chartInterval: Interval = useMemo(
    () => (data?.intradayAvailable ? INTERVAL_FOR_RANGE[range] : "1day"),
    [data?.intradayAvailable, range]
  );

  return (
    <main className="flex w-full flex-1 flex-col items-center gap-6 p-6 pb-16 pt-10">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        <Link
          href="/commodities"
          className="flex w-fit items-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to Commodities
        </Link>

        {error && !data && <p className="text-sm text-red-500">{error}</p>}

        {loading && !data ? (
          <div className="h-24 w-full animate-pulse rounded-lg bg-foreground/10" />
        ) : (
          data && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {Icon && (
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/5 ${iconDef!.className}`}>
                    <Icon size={20} />
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-foreground">{data.name}</h1>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground">{formatPrice(displayPrice)}</span>
                    <span className={`text-sm font-medium transition-colors duration-200 ${changeColorClass(displayDollarChange)}`}>
                      ({formatDollarChange(displayDollarChange)})
                    </span>
                    <PercentChangeBadge value={displayPercentChange} />
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
          <div className="flex flex-wrap gap-1">
            {PAGE_RANGES.map((r) => {
              const enabled = data?.rangeEnabled[r.value] ?? true;
              return (
                <PillButton
                  key={r.value}
                  active={range === r.value}
                  onClick={() => enabled && setRange(r.value)}
                  accent="neutral"
                >
                  <span
                    title={enabled ? undefined : "Intraday data unavailable for this commodity"}
                    className={enabled ? undefined : "cursor-not-allowed opacity-40"}
                  >
                    {r.label}
                  </span>
                </PillButton>
              );
            })}
          </div>
          <div className="h-72 w-full">
            {history.length > 0 ? (
              <PriceChart
                history={history}
                historyGeneration={historyGeneration}
                chartType="line"
                range={range as ChartRange}
                interval={chartInterval}
                locked={false}
                isExpanded={false}
                loadingMore={false}
                onNearLeftEdge={() => {}}
                onHoverChange={setHoveredPoint}
              />
            ) : loading ? (
              <div className="h-full w-full animate-pulse rounded bg-foreground/10" />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded bg-foreground/5">
                <p className="text-sm text-foreground/50">Chart data temporarily unavailable.</p>
              </div>
            )}
          </div>
        </div>

        {data && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={cardClass("neutral", { extra: "flex flex-col gap-2 p-4 text-sm" })}>
              <h2 className="text-sm font-semibold text-foreground/70">Today&apos;s Range</h2>
              {data.stats.dayLow !== null && data.stats.dayHigh !== null ? (
                <RangeStatBar low={data.stats.dayLow} high={data.stats.dayHigh} current={data.quote.price} />
              ) : (
                <p className="text-xs text-foreground/50">Not available.</p>
              )}
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-foreground/50">Previous Close</span>
                <span className="font-medium text-foreground">
                  {data.stats.previousClose !== null ? formatPrice(data.stats.previousClose) : "—"}
                </span>
              </div>
            </div>

            <div className={cardClass("neutral", { extra: "flex flex-col gap-2 p-4 text-sm" })}>
              <h2 className="text-sm font-semibold text-foreground/70">52-Week Range</h2>
              {data.stats.fiftyTwoWeekLow !== null && data.stats.fiftyTwoWeekHigh !== null ? (
                <RangeStatBar
                  low={data.stats.fiftyTwoWeekLow}
                  high={data.stats.fiftyTwoWeekHigh}
                  current={data.quote.price}
                />
              ) : (
                <p className="text-xs text-foreground/50">Not available.</p>
              )}
            </div>
          </div>
        )}

        {data?.explanation && (
          <div className={cardClass("indigo", { extra: "flex flex-col gap-2 p-4 text-sm" })}>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground/70">
              <Sparkles size={14} className="text-indigo-400" /> What Changed?
            </h2>
            <p className="text-foreground/80">{data.explanation}</p>
            <p className="text-[11px] text-foreground/40">AI-generated summary of the figures shown above.</p>
          </div>
        )}

        {data?.about && (
          <div className={cardClass("neutral", { extra: "flex flex-col gap-2 p-4 text-sm" })}>
            <h2 className="text-sm font-semibold text-foreground/70">About This Data</h2>
            <p className="text-foreground/70">{data.about}</p>
          </div>
        )}
      </div>
    </main>
  );
}
