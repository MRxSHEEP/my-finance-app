"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MiniLineChart from "@/components/MiniLineChart";
import PriceChart, {
  changeColorClass,
  formatDollarChange,
  formatPrice,
  PercentChangeBadge,
  PillButton,
  toUnixTime,
  type HistoryPoint,
  type Range,
} from "@/components/PriceChart";
import WatchlistStar from "@/components/WatchlistStar";
import { cardClass } from "@/lib/cardStyles";

interface CryptoOverview {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  percentChange24h: number | null;
  marketCap: number;
  totalVolume: number;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  ath: number | null;
  athDate: string | null;
  athChangePercentage: number | null;
  atl: number | null;
  atlDate: string | null;
}

interface SeriesPoint {
  date: string;
  value: number;
}

interface CoinInfo {
  platforms: Array<{ network: string; contractAddress: string }>;
  tickers: Array<{ exchange: string; pair: string; volumeUsd: number | null; trustScore: string | null }>;
}

interface DerivativesData {
  available: boolean;
  contractCount: number;
  avgFundingRate: number | null;
  totalOpenInterest: number | null;
  totalVolume24h: number | null;
  topContracts: Array<{
    market: string;
    symbol: string;
    contractType: string;
    fundingRate: number | null;
    openInterest: number | null;
    volume24h: number | null;
  }>;
}

type DetailTab = "overview" | "derivatives";

// The requested timeframe set (1D/7D/1M/1Y/MAX) mapped onto PriceChart's
// existing Range type — "1W" is CoinGecko's own name for a 7-day window,
// so the label reads "7D" while the value stays "1W" for the shared
// daysForRange()/PriceChart machinery.
const PAGE_RANGES: { label: string; value: Range }[] = [
  { label: "1D", value: "1D" },
  { label: "7D", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "1Y", value: "1Y" },
  { label: "MAX", value: "MAX" },
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function seriesToHistory(points: SeriesPoint[]): { time: number; value: number }[] {
  return points.map((point) => ({ time: toUnixTime(point.date), value: point.value }));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CoinDetailView({ id }: { id: string }) {
  const [overview, setOverview] = useState<CryptoOverview | null>(null);
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const [historyGeneration, setHistoryGeneration] = useState(0);
  const [marketCapHistory, setMarketCapHistory] = useState<SeriesPoint[]>([]);
  const [volumeHistory, setVolumeHistory] = useState<SeriesPoint[]>([]);
  const [range, setRange] = useState<Range>("1M");
  const [hoveredPoint, setHoveredPoint] = useState<HistoryPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coinInfo, setCoinInfo] = useState<CoinInfo | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [derivatives, setDerivatives] = useState<DerivativesData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }

      try {
        const response = await fetch(`/api/crypto/detail?id=${encodeURIComponent(id)}&range=${range}&chartType=line`);
        if (!response.ok) throw new Error("request failed");
        const body = await response.json();
        if (cancelled) return;

        setOverview(body.overview ?? null);
        const list: HistoryPoint[] = Array.isArray(body.history) ? body.history : [];
        setHistory(list);
        setHistoryGeneration((generation) => generation + 1);
        setMarketCapHistory(Array.isArray(body.marketCapHistory) ? body.marketCapHistory : []);
        setVolumeHistory(Array.isArray(body.volumeHistory) ? body.volumeHistory : []);
        if (!body.overview) setError("Coin not found.");
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
  }, [id, range]);

  // Platforms/exchange listings barely change day to day — fetched once
  // per coin, independent of the range toggle above.
  useEffect(() => {
    let cancelled = false;

    async function loadInfo() {
      const response = await fetch(`/api/crypto/coin-info?id=${encodeURIComponent(id)}`).catch(() => null);
      const body = response?.ok ? await response.json().catch(() => null) : null;
      if (!cancelled && body) setCoinInfo(body);
    }

    loadInfo();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Derivatives are keyed by ticker symbol (CoinGecko's /derivatives
  // endpoint, e.g. "BTC"), not the CoinGecko id used everywhere else on
  // this page — so this waits for the overview fetch to resolve the
  // symbol rather than firing off the id directly.
  const overviewSymbol = overview?.symbol;
  useEffect(() => {
    if (!overviewSymbol) return;
    let cancelled = false;

    async function loadDerivatives() {
      const response = await fetch(`/api/crypto/derivatives?symbol=${encodeURIComponent(overviewSymbol!)}`).catch(
        () => null
      );
      const body = response?.ok ? await response.json().catch(() => null) : null;
      if (!cancelled && body) setDerivatives(body);
    }

    loadDerivatives();
    return () => {
      cancelled = true;
    };
  }, [overviewSymbol]);

  const periodStartPrice = history && history.length > 0 ? history[0].close : null;
  const activePoint = hoveredPoint ?? (history && history.length > 0 ? history[history.length - 1] : null);
  const displayPrice = activePoint ? activePoint.close : overview?.currentPrice ?? 0;
  const displayDollarChange =
    activePoint && periodStartPrice !== null ? activePoint.close - periodStartPrice : 0;
  const displayPercentChange =
    activePoint && periodStartPrice ? (displayDollarChange / periodStartPrice) * 100 : overview?.percentChange24h ?? 0;

  const supplyRatio =
    overview?.circulatingSupply && overview?.maxSupply ? Math.min(1, overview.circulatingSupply / overview.maxSupply) : null;

  return (
    <main className="flex w-full flex-1 flex-col items-center gap-6 p-6 pb-16 pt-10">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        <Link
          href="/crypto"
          className="flex w-fit items-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to Crypto
        </Link>

        {error && !overview && <p className="text-sm text-red-500">{error}</p>}

        {loading && !overview ? (
          <div className="h-24 w-full animate-pulse rounded-lg bg-foreground/10" />
        ) : (
          overview && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold text-foreground">
                      {overview.name} <span className="font-normal text-foreground/50">({overview.symbol.toUpperCase()})</span>
                    </h1>
                    <WatchlistStar symbol={id} name={overview.name} assetType="crypto" />
                  </div>
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

        {overview && (
          <div className="flex gap-1 border-b border-black/10 pb-2 dark:border-white/15">
            <PillButton active={tab === "overview"} onClick={() => setTab("overview")}>
              Overview
            </PillButton>
            <PillButton active={tab === "derivatives"} onClick={() => setTab("derivatives")}>
              Derivatives
            </PillButton>
          </div>
        )}

        {tab === "overview" && (
        <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
          <div className="flex gap-1">
            {PAGE_RANGES.map((r) => (
              <PillButton key={r.value} active={range === r.value} onClick={() => setRange(r.value)}>
                {r.label}
              </PillButton>
            ))}
          </div>
          <div className="h-72 w-full">
            {history && history.length > 0 ? (
              <PriceChart
                history={history}
                historyGeneration={historyGeneration}
                chartType="line"
                range={range}
                interval="1day"
                locked={false}
                isExpanded={false}
                loadingMore={false}
                onNearLeftEdge={() => {}}
                onHoverChange={setHoveredPoint}
              />
            ) : (
              loading && <div className="h-full w-full animate-pulse rounded bg-foreground/10" />
            )}
          </div>
        </div>
        )}

        {tab === "overview" && overview && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className={cardClass("neutral", { extra: "p-4 text-sm" })}>
              <span className="block text-xs text-foreground/50">Market Cap</span>
              <span className="font-semibold text-foreground">{compactCurrencyFormatter.format(overview.marketCap)}</span>
            </div>
            <div className={cardClass("neutral", { extra: "p-4 text-sm" })}>
              <span className="block text-xs text-foreground/50">24h Volume</span>
              <span className="font-semibold text-foreground">{compactCurrencyFormatter.format(overview.totalVolume)}</span>
            </div>
            <div className={cardClass("neutral", { extra: "p-4 text-sm" })}>
              <span className="block text-xs text-foreground/50">All-Time High</span>
              <span className="font-semibold text-foreground">
                {overview.ath !== null ? currencyFormatter.format(overview.ath) : "—"}
              </span>
              {overview.athChangePercentage !== null && (
                <span className="block text-xs text-red-500">{overview.athChangePercentage.toFixed(1)}% below ATH</span>
              )}
              <span className="block text-xs text-foreground/40">{formatDate(overview.athDate)}</span>
            </div>
            <div className={cardClass("neutral", { extra: "p-4 text-sm" })}>
              <span className="block text-xs text-foreground/50">All-Time Low</span>
              <span className="font-semibold text-foreground">
                {overview.atl !== null ? currencyFormatter.format(overview.atl) : "—"}
              </span>
              <span className="block text-xs text-foreground/40">{formatDate(overview.atlDate)}</span>
            </div>
          </div>
        )}

        {tab === "overview" && overview && (
          <div className={cardClass("neutral", { extra: "flex flex-col gap-2 p-4 text-sm" })}>
            <div className="flex items-center justify-between">
              <span className="text-foreground/70">Circulating Supply</span>
              <span className="font-semibold text-foreground">
                {overview.circulatingSupply !== null ? compactFormatter.format(overview.circulatingSupply) : "—"}{" "}
                {overview.symbol.toUpperCase()}
              </span>
            </div>
            {overview.maxSupply !== null ? (
              <>
                <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="h-full rounded-full bg-indigo-400"
                    style={{ width: `${((supplyRatio ?? 0) * 100).toFixed(1)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-foreground/50">
                  <span>Max Supply</span>
                  <span>
                    {compactFormatter.format(overview.maxSupply)} {overview.symbol.toUpperCase()}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-foreground/50">
                No maximum supply — {overview.totalSupply !== null ? `${compactFormatter.format(overview.totalSupply)} total supply` : "uncapped"}.
              </p>
            )}
          </div>
        )}

        {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={cardClass("neutral", { extra: "flex flex-col gap-2 p-4" })}>
            <h2 className="text-sm font-semibold text-foreground/70">Market Cap History</h2>
            <div className="h-36 w-full">
              {marketCapHistory.length > 1 ? (
                <MiniLineChart data={seriesToHistory(marketCapHistory)} height={144} />
              ) : (
                <div className="h-full w-full animate-pulse rounded bg-foreground/10" />
              )}
            </div>
          </div>
          <div className={cardClass("neutral", { extra: "flex flex-col gap-2 p-4" })}>
            <h2 className="text-sm font-semibold text-foreground/70">Volume History</h2>
            <div className="h-36 w-full">
              {volumeHistory.length > 1 ? (
                <MiniLineChart data={seriesToHistory(volumeHistory)} height={144} />
              ) : (
                <div className="h-full w-full animate-pulse rounded bg-foreground/10" />
              )}
            </div>
          </div>
        </div>
        )}

        {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={cardClass("neutral", { extra: "flex flex-col gap-2 p-4 text-sm" })}>
            <h2 className="text-sm font-semibold text-foreground/70">Supported Networks</h2>
            {coinInfo === null ? (
              <div className="h-16 w-full animate-pulse rounded bg-foreground/10" />
            ) : coinInfo.platforms.length === 0 ? (
              <p className="text-xs text-foreground/50">Native asset — not issued as a token on another network.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {coinInfo.platforms.map((platform) => (
                  <li key={platform.network} className="flex items-center justify-between gap-2">
                    <span className="text-foreground/70 capitalize">{platform.network.replace(/-/g, " ")}</span>
                    <span className="truncate font-mono text-xs text-foreground/50" title={platform.contractAddress}>
                      {platform.contractAddress.slice(0, 6)}…{platform.contractAddress.slice(-4)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={cardClass("neutral", { extra: "flex flex-col gap-2 p-4 text-sm" })}>
            <h2 className="text-sm font-semibold text-foreground/70">Exchange Listings</h2>
            {coinInfo === null ? (
              <div className="h-16 w-full animate-pulse rounded bg-foreground/10" />
            ) : coinInfo.tickers.length === 0 ? (
              <p className="text-xs text-foreground/50">No exchange data available.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {coinInfo.tickers.map((ticker, index) => (
                  <li key={`${ticker.exchange}-${ticker.pair}-${index}`} className="flex items-center justify-between gap-2">
                    <span className="text-foreground/70">
                      {ticker.exchange} <span className="text-foreground/40">{ticker.pair}</span>
                    </span>
                    <span className="text-foreground">
                      {ticker.volumeUsd !== null ? compactCurrencyFormatter.format(ticker.volumeUsd) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        )}

        {tab === "derivatives" && (
          <div className="flex flex-col gap-4">
            {derivatives === null ? (
              <div className="h-40 w-full animate-pulse rounded-md bg-foreground/10" />
            ) : !derivatives.available ? (
              <p className="text-sm text-foreground/50">
                No derivatives contracts found for {overview?.symbol.toUpperCase()} across tracked exchanges.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className={cardClass("neutral", { extra: "p-4 text-sm" })}>
                    <span className="block text-xs text-foreground/50">Avg. Funding Rate</span>
                    <span
                      className={`font-semibold ${
                        (derivatives.avgFundingRate ?? 0) >= 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {derivatives.avgFundingRate !== null ? `${derivatives.avgFundingRate.toFixed(4)}%` : "—"}
                    </span>
                  </div>
                  <div className={cardClass("neutral", { extra: "p-4 text-sm" })}>
                    <span className="block text-xs text-foreground/50">Total Open Interest</span>
                    <span className="font-semibold text-foreground">
                      {derivatives.totalOpenInterest !== null
                        ? compactCurrencyFormatter.format(derivatives.totalOpenInterest)
                        : "—"}
                    </span>
                  </div>
                  <div className={cardClass("neutral", { extra: "p-4 text-sm" })}>
                    <span className="block text-xs text-foreground/50">24h Derivatives Volume</span>
                    <span className="font-semibold text-foreground">
                      {derivatives.totalVolume24h !== null
                        ? compactCurrencyFormatter.format(derivatives.totalVolume24h)
                        : "—"}
                    </span>
                  </div>
                </div>

                <div className={cardClass("neutral", { extra: "flex flex-col gap-2 p-4 text-sm" })}>
                  <h2 className="text-sm font-semibold text-foreground/70">
                    Top Contracts by Open Interest ({derivatives.contractCount} tracked)
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="border-b border-black/10 dark:border-white/15">
                          <th className="p-2 text-left text-xs font-medium text-foreground/50">Exchange</th>
                          <th className="p-2 text-left text-xs font-medium text-foreground/50">Type</th>
                          <th className="p-2 text-right text-xs font-medium text-foreground/50">Funding</th>
                          <th className="p-2 text-right text-xs font-medium text-foreground/50">Open Interest</th>
                          <th className="p-2 text-right text-xs font-medium text-foreground/50">24h Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {derivatives.topContracts.map((contract, index) => (
                          <tr key={`${contract.market}-${index}`} className="border-t border-black/5 dark:border-white/10">
                            <td className="p-2 text-foreground">{contract.market}</td>
                            <td className="p-2 text-foreground/60 capitalize">{contract.contractType}</td>
                            <td className="p-2 text-right text-foreground">
                              {contract.fundingRate !== null ? `${contract.fundingRate.toFixed(4)}%` : "—"}
                            </td>
                            <td className="p-2 text-right text-foreground">
                              {contract.openInterest !== null ? compactCurrencyFormatter.format(contract.openInterest) : "—"}
                            </td>
                            <td className="p-2 text-right text-foreground">
                              {contract.volume24h !== null ? compactCurrencyFormatter.format(contract.volume24h) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            <div className={cardClass("neutral", { extra: "flex flex-col gap-2 p-4 text-sm" })}>
              <h2 className="text-sm font-semibold text-foreground/70">Liquidations, Exchange Inflows &amp; On-Chain Activity</h2>
              <p className="text-xs text-foreground/50">
                Not available — these require a dedicated on-chain/liquidations data provider (e.g. CryptoQuant,
                Glassnode, or Coinglass&apos;s liquidation feed), which isn&apos;t configured in this app. Funding
                rate, open interest, and derivatives volume above come from CoinGecko&apos;s free derivatives
                endpoint and are real.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
