"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, ChevronDown } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import { COMMODITY_NAMES } from "@/lib/commodityNames";
import { PORTFOLIO_TIERS } from "@/lib/simulatedTrading/tiers";
import { SCROLLBAR_THIN_CLASS } from "@/lib/scrollbarStyles";
import { PercentChangeBadge } from "@/components/PriceChart";
import ScrollHint from "@/components/ScrollHint";
import SparklineSlot from "@/components/SparklineSlot";
import MiniLineChart from "@/components/MiniLineChart";
import TickerAutocompleteInput from "@/components/TickerAutocompleteInput";
import RevealOnScroll from "@/components/RevealOnScroll";
import AnimatedNumber from "@/components/tools/AnimatedNumber";
import SimulatedBadge from "./SimulatedBadge";
import SimulatedTradingDisclaimer from "./SimulatedTradingDisclaimer";
import SimulatedPerformanceChart from "./SimulatedPerformanceChart";

type AssetType = "stock" | "commodity" | "crypto";

interface HoldingOut {
  assetType: string;
  symbol: string;
  name: string | null;
  quantity: number;
  averageCostBasis: number;
  currentPrice: number | null;
  currentValue: number;
  unrealizedGainLoss: number | null;
  unrealizedGainLossPercent: number | null;
  percentOfPortfolio: number;
  priceUnavailable: boolean;
}

interface TransactionOut {
  id: string;
  assetType: string;
  symbol: string;
  name: string | null;
  transactionType: string;
  quantity: number;
  price: number;
  totalValue: number;
  createdAt: string;
}

interface PortfolioDetail {
  portfolio: { id: string; tier: string; startingBalance: number; cashBalance: number; createdAt: string };
  totalValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  holdings: HoldingOut[];
  performanceSeries: { date: string; value: number }[];
  recentTransactions: TransactionOut[];
  allTransactions: TransactionOut[];
}

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

function tierLabel(tierId: string): string {
  return PORTFOLIO_TIERS.find((t) => t.id === tierId)?.label ?? tierId;
}

function formatTransactionType(type: string): string {
  return type === "buy" ? "Buy" : type === "sell" ? "Sell" : type;
}

function TransactionRow({ tx }: { tx: TransactionOut }) {
  const isBuy = tx.transactionType === "buy";
  return (
    <tr className="border-t border-black/5 transition-colors duration-150 ease-out hover:bg-foreground/[0.03] dark:border-white/10">
      <td className="p-2 font-medium text-foreground">{tx.symbol}</td>
      <td className="p-2">
        <span
          className={`rounded-sm px-1.5 py-0.5 text-xs font-medium ${
            isBuy ? "bg-green-400/10 text-green-500" : "bg-red-400/10 text-red-500"
          }`}
        >
          {formatTransactionType(tx.transactionType)}
        </span>
      </td>
      <td className="p-2 text-foreground/70">{tx.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
      <td className="p-2 text-right text-foreground/70">{currencyFormatter.format(tx.price)}</td>
      <td className="p-2 text-right text-foreground">{currencyFormatter.format(tx.totalValue)}</td>
      <td className="p-2 text-right text-xs text-foreground/40">
        {new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </td>
    </tr>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

// A custom-rendered listbox, not a native <select> — a native select's
// OPEN dropdown list is rendered by the OS/browser chrome and can't be
// themed (always light background/dark text and the browser's default
// blue selection highlight, regardless of this app's dark mode), which is
// exactly the "unstyled, clashes with dark theme" problem this replaces.
// Matches components/stocks/StockCatalogSection.tsx's SectorFilterDropdown
// pattern (click-to-toggle trigger + absolute-positioned bg-background
// popup + click-outside/Escape-to-close), simplified since these options
// have no per-item icon or accent color of their own — selected/hover use
// this app's generic indigo feature accent instead of a per-option color.
function StyledSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyMessage,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  emptyMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-black/10 bg-transparent px-3 py-2 text-left text-sm outline-none transition-colors duration-200 ease-out hover:border-black/25 dark:border-white/15 dark:hover:border-white/30"
      >
        <span className={selected ? "text-foreground" : "text-foreground/40"}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className={`absolute left-0 top-full z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-black/10 bg-background py-1 text-sm shadow-lg dark:border-white/15 ${SCROLLBAR_THIN_CLASS}`}
        >
          {options.length === 0 && <li className="px-3 py-2 text-foreground/40">{emptyMessage ?? "No options available"}</li>}
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left transition-colors duration-150 ease-out ${
                    isSelected ? "bg-indigo-400/10 text-indigo-400" : "text-foreground hover:bg-foreground/5"
                  }`}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface AssetPreviewData {
  price: number;
  percentChange: number | null;
  history: { time: number; value: number }[] | null;
  week52Range?: string;
}

// Quick-reference context shown once an asset is picked in the trade form
// — current price, a compact sparkline (reusing SparklineSlot/MiniLineChart,
// the same chart already used for Top ETFs/Mag 7 and the stock catalog,
// rather than a new chart implementation), daily % change, and (stocks
// only) 52-week range from the existing fundamentals endpoint. Compact by
// design — this is inline context for the trade decision, not a
// replacement for the asset's own full detail page.
function AssetPreview({
  assetType,
  symbol,
  onPriceUpdate,
}: {
  assetType: AssetType;
  symbol: string;
  onPriceUpdate: (price: number | null) => void;
}) {
  const [data, setData] = useState<AssetPreviewData | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!symbol) {
        setData(undefined);
        onPriceUpdate(null);
        return;
      }
      try {
        if (assetType === "stock") {
          const [quoteResponse, fundamentalsResponse] = await Promise.all([
            fetch(`/api/stock/mini-quotes?symbols=${encodeURIComponent(symbol)}`),
            fetch(`/api/stock/fundamentals?ticker=${encodeURIComponent(symbol)}`).catch(() => null),
          ]);
          const quoteBody = await quoteResponse.json().catch(() => null);
          const quote = Array.isArray(quoteBody?.quotes) ? quoteBody.quotes[0] : null;
          const fundamentalsBody =
            fundamentalsResponse && fundamentalsResponse.ok ? await fundamentalsResponse.json().catch(() => null) : null;
          if (cancelled) return;
          if (!quote || quote.price == null) {
            setData(null);
            onPriceUpdate(null);
            return;
          }
          setData({
            price: quote.price,
            percentChange: quote.percentChange,
            history: quote.history,
            week52Range: fundamentalsBody?.week52Range || undefined,
          });
          onPriceUpdate(quote.price);
        } else if (assetType === "commodity") {
          const response = await fetch("/api/ticker");
          const body = await response.json().catch(() => null);
          const entry: { symbol: string; price: number | null; percentChange: number | null; history: { time: number; value: number }[] | null } | undefined =
            Array.isArray(body?.commodities) ? body.commodities.find((c: { symbol: string }) => c.symbol === symbol) : undefined;
          if (cancelled) return;
          if (!entry || entry.price == null) {
            setData(null);
            onPriceUpdate(null);
            return;
          }
          setData({ price: entry.price, percentChange: entry.percentChange, history: entry.history });
          onPriceUpdate(entry.price);
        } else {
          const response = await fetch(`/api/crypto/detail?id=${encodeURIComponent(symbol)}&range=1M`);
          const body = await response.json().catch(() => null);
          if (cancelled) return;
          if (!body?.overview?.currentPrice) {
            setData(null);
            onPriceUpdate(null);
            return;
          }
          const history: { time: number; value: number }[] = Array.isArray(body.history)
            ? body.history.map((h: { date: string; close: number }) => ({
                time: Math.floor(new Date(h.date.replace(" ", "T") + "Z").getTime() / 1000),
                value: h.close,
              }))
            : [];
          setData({ price: body.overview.currentPrice, percentChange: body.overview.percentChange24h, history });
          onPriceUpdate(body.overview.currentPrice);
        }
      } catch {
        if (!cancelled) {
          setData(null);
          onPriceUpdate(null);
        }
      }
    }

    // Deferred behind a macrotask (rather than calling load() directly)
    // so even its very first synchronous statement (the `!symbol` early
    // return, which sets state before any `await`) never runs
    // synchronously within the effect body itself.
    const timer = setTimeout(load, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [assetType, symbol, onPriceUpdate]);

  if (!symbol) return null;

  if (data === undefined) {
    return <div className="h-24 w-full animate-pulse rounded-md bg-foreground/10" />;
  }

  if (data === null) {
    return (
      <p className="rounded-md bg-foreground/5 px-3 py-2 text-xs text-foreground/50">
        Price currently unavailable for {symbol} — try again shortly.
      </p>
    );
  }

  return (
    <div className={cardClass("neutral", { extra: "flex flex-col gap-2 p-3" })}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-semibold text-foreground">{currencyFormatter.format(data.price)}</span>
        {data.percentChange != null && <PercentChangeBadge value={data.percentChange} />}
      </div>
      <div className="h-12 w-full">
        <SparklineSlot history={data.history} height={48} />
      </div>
      {data.week52Range && <span className="text-xs text-foreground/50">52-Week Range: {data.week52Range}</span>}
    </div>
  );
}

function TradeForm({ portfolioId, holdings, onTraded }: { portfolioId: string; holdings: HoldingOut[]; onTraded: () => void }) {
  const [assetType, setAssetType] = useState<AssetType>("stock");
  const [transactionType, setTransactionType] = useState<"buy" | "sell">("buy");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState<{ symbol: string; name: string }[]>([]);
  const [quantity, setQuantity] = useState("");
  // Reported by AssetPreview once it resolves the selected asset's live
  // price — drives the "Estimated Total" line below, purely client-side
  // (quantity changes never need a re-fetch, only a re-multiply).
  const [previewPrice, setPreviewPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const heldForAssetType = holdings.filter((h) => h.assetType === assetType);

  // Search-driven symbol picking only applies to Buy for crypto — Stocks
  // now use TickerAutocompleteInput below, which owns its own debounced
  // /api/stock/suggestions fetch internally, so this effect only ever
  // needs to cover crypto's own /api/crypto/search. Sell instead sources
  // its choices from what's actually held (below), and Commodities always
  // uses the fixed 9-symbol dropdown regardless of buy/sell, since there's
  // no free-text search for that asset type.
  useEffect(() => {
    let cancelled = false;
    // The "clear" case is scheduled through the same debounce timer as the
    // "fetch" case, rather than clearing synchronously up front — every
    // setSuggestions call this effect makes happens inside this deferred
    // callback, never synchronously within the effect body itself.
    const timer = setTimeout(async () => {
      if (cancelled) return;
      if (assetType !== "crypto" || transactionType === "sell") {
        setSuggestions([]);
        return;
      }
      const term = searchInput.trim();
      if (term.length < 1) {
        setSuggestions([]);
        return;
      }

      try {
        const response = await fetch(`/api/crypto/search?q=${encodeURIComponent(term)}`);
        const body = await response.json().catch(() => null);
        if (!cancelled && Array.isArray(body?.results)) {
          setSuggestions(body.results.map((r: { id: string; name: string }) => ({ symbol: r.id, name: r.name })));
        }
      } catch {
        // leave suggestions empty — not a fatal error for the form
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchInput, assetType, transactionType]);

  function resetSelection() {
    setSymbol("");
    setName(null);
    setSearchInput("");
    setSuggestions([]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const quantityNum = Number(quantity);
    if (!symbol) {
      setError("Pick an asset first.");
      return;
    }
    if (!Number.isFinite(quantityNum) || quantityNum <= 0) {
      setError("Quantity must be a positive number.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/simulated-portfolio/${portfolioId}/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetType, symbol, name, transactionType, quantity: quantityNum }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Trade failed");
        return;
      }
      setSuccess(
        `${transactionType === "buy" ? "Bought" : "Sold"} ${quantityNum.toLocaleString()} ${symbol} @ ${currencyFormatter.format(body.transaction.price)}`
      );
      setQuantity("");
      resetSelection();
      onTraded();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-1">
        {(["stock", "commodity", "crypto"] as AssetType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              setAssetType(type);
              resetSelection();
            }}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 ease-out ${
              assetType === type
                ? "bg-foreground text-background"
                : "border border-black/10 text-foreground/60 hover:border-black/25 dark:border-white/15"
            }`}
          >
            {type === "stock" ? "Stocks" : type === "commodity" ? "Commodities" : "Crypto"}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-black/10 dark:bg-white/15" />
        {(["buy", "sell"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              setTransactionType(type);
              resetSelection();
            }}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 ease-out ${
              transactionType === type
                ? type === "buy"
                  ? "bg-green-500 text-white"
                  : "bg-red-500 text-white"
                : "border border-black/10 text-foreground/60 hover:border-black/25 dark:border-white/15"
            }`}
          >
            {type === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      {transactionType === "sell" ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Sell which holding</span>
          <StyledSelect
            value={symbol}
            onChange={(value) => {
              const holding = heldForAssetType.find((h) => h.symbol === value);
              setSymbol(value);
              setName(holding?.name ?? null);
            }}
            placeholder="Select a holding…"
            emptyMessage="No holdings to sell"
            options={heldForAssetType.map((h) => ({
              value: h.symbol,
              label: `${h.symbol} — ${h.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })} held`,
            }))}
          />
          {heldForAssetType.length === 0 && (
            <span className="text-xs text-foreground/40">You don&apos;t hold any {assetType === "stock" ? "stocks" : assetType === "commodity" ? "commodities" : "crypto"} in this portfolio yet.</span>
          )}
        </label>
      ) : assetType === "commodity" ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Commodity</span>
          <StyledSelect
            value={symbol}
            onChange={(value) => {
              setSymbol(value);
              setName(COMMODITY_NAMES[value] ?? null);
            }}
            placeholder="Select a commodity…"
            options={Object.entries(COMMODITY_NAMES).map(([sym, label]) => ({ value: sym, label }))}
          />
        </label>
      ) : assetType === "stock" ? (
        // Reuses the same TickerAutocompleteInput component Peer Benchmarking
        // and Compliance already use (real-time validated suggestions from
        // /api/stock/suggestions, debounce built in) — fixes stocks not
        // reliably popping up under the old hand-rolled fetch below.
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Ticker or company name</span>
          <TickerAutocompleteInput
            value={symbol ? `${symbol} — ${name}` : searchInput}
            onChange={(value) => {
              setSymbol("");
              setName(null);
              setSearchInput(value);
            }}
            onSelect={(sym, description) => {
              setSymbol(sym);
              setName(description);
            }}
            placeholder="AAPL"
          />
        </label>
      ) : (
        <label className="relative flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Coin name or symbol</span>
          <input
            value={symbol ? `${symbol} — ${name}` : searchInput}
            onChange={(e) => {
              setSymbol("");
              setName(null);
              setSearchInput(e.target.value);
            }}
            placeholder="bitcoin"
            className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
          />
          {suggestions.length > 0 && !symbol && (
            <ul className="absolute top-full z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-black/10 bg-background text-sm shadow-lg dark:border-white/15">
              {suggestions.map((s) => (
                <li key={s.symbol}>
                  <button
                    type="button"
                    onClick={() => {
                      setSymbol(s.symbol);
                      setName(s.name);
                      setSuggestions([]);
                    }}
                    className="block w-full px-3 py-2 text-left hover:bg-foreground/5"
                  >
                    <span className="font-medium text-foreground">{s.symbol}</span>{" "}
                    <span className="text-foreground/60">{s.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>
      )}

      <AssetPreview assetType={assetType} symbol={symbol} onPriceUpdate={setPreviewPrice} />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Quantity</span>
        <input
          type="number"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="10"
          className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30"
        />
      </label>

      {previewPrice != null && Number.isFinite(Number(quantity)) && Number(quantity) > 0 && (
        <p className="text-sm text-foreground/60">
          Estimated total: <span className="font-medium text-foreground">{currencyFormatter.format(previewPrice * Number(quantity))}</span>
        </p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && <p className="text-sm text-green-500">{success}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Executing…" : transactionType === "buy" ? "Buy" : "Sell"}
      </button>
    </form>
  );
}

export default function SimulatedPortfolioDetailView({ id }: { id: string }) {
  const [detail, setDetail] = useState<PortfolioDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"date" | "value">("date");
  // Bumped after a successful trade to re-trigger the effect below — the
  // fetch itself is defined inline inside the effect (rather than called
  // as an externally-defined function) so every setState it performs is
  // deferred behind an `await`, never synchronous within the effect body.
  const [refreshToken, setRefreshToken] = useState(0);
  // Per-symbol price history for the Current Holdings sparklines, stock
  // holdings only — one batched /api/stock/mini-quotes call (the same
  // endpoint Market Digest/Watchlist already use for exactly this), rather
  // than a fetch per row. Commodity/crypto holdings simply show no
  // sparkline (that endpoint doesn't cover them) instead of faking one
  // from a mismatched data source. Purely decorative — never read for any
  // balance/value calculation.
  const [holdingHistories, setHoldingHistories] = useState<Record<string, { time: number; value: number }[]>>({});

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      try {
        const response = await fetch(`/api/simulated-portfolio/${id}`);
        const body = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok) {
          setError(body?.error ?? "Failed to load this simulated portfolio");
          return;
        }
        setDetail(body);
        setError(null);
      } catch {
        if (!cancelled) setError("Failed to load this simulated portfolio");
      }
    }
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [id, refreshToken]);

  useEffect(() => {
    let cancelled = false;
    // Both the "nothing to fetch" early-out and the real fetch defer their
    // first setState behind this macrotask — same pattern as AssetPreview's
    // own effect above — so neither ever calls setState synchronously
    // within the effect body itself.
    const timer = setTimeout(async () => {
      if (cancelled) return;
      const stockSymbols = (detail?.holdings ?? []).filter((h) => h.assetType === "stock").map((h) => h.symbol);
      if (stockSymbols.length === 0) {
        setHoldingHistories({});
        return;
      }

      try {
        const response = await fetch(`/api/stock/mini-quotes?symbols=${encodeURIComponent(stockSymbols.join(","))}`);
        const body = await response.json().catch(() => null);
        if (cancelled || !Array.isArray(body?.quotes)) return;
        const map: Record<string, { time: number; value: number }[]> = {};
        for (const q of body.quotes as Array<{ symbol: string; history: { time: number; value: number }[] | null }>) {
          if (q.history) map[q.symbol] = q.history;
        }
        setHoldingHistories(map);
      } catch {
        if (!cancelled) setHoldingHistories({});
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Re-fetch only when the actual set of stock symbols held changes, not
    // on every detail refresh (price ticks alone shouldn't re-trigger this).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.holdings.map((h) => h.symbol).join(",")]);

  const sortedTransactions = useMemo(() => {
    if (!detail) return [];
    const list = [...detail.allTransactions];
    if (sortKey === "value") return list.sort((a, b) => b.totalValue - a.totalValue);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [detail, sortKey]);

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center gap-4 p-8 pt-16 text-center">
        <p className="text-sm text-red-500">{error}</p>
        <Link href="/portfolio" className="text-sm text-indigo-400 hover:underline">
          Back to Portfolio
        </Link>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
        <div className="h-24 w-full max-w-5xl animate-pulse rounded-md bg-foreground/10" />
      </main>
    );
  }

  const { portfolio, totalValue, totalReturn, totalReturnPercent, holdings, performanceSeries, recentTransactions } = detail;
  const isUp = totalReturn >= 0;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        <Link href="/portfolio" className="flex w-fit items-center gap-1.5 text-sm text-foreground/60 hover:text-foreground">
          <ArrowLeft size={14} /> Back to Portfolio
        </Link>

        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">{tierLabel(portfolio.tier)} Portfolio</h1>
          <SimulatedBadge />
        </div>

        <RevealOnScroll className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-4" })}>
            <span className="text-xs text-foreground/50">Total Value</span>
            <p className="text-xl font-bold text-foreground">
              <AnimatedNumber value={totalValue} format={compactCurrencyFormatter.format} />
            </p>
          </div>
          <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-4" })}>
            <span className="text-xs text-foreground/50">Total Return</span>
            <p className={`text-xl font-bold ${isUp ? "text-green-500" : "text-red-500"}`}>
              {isUp ? "+" : ""}
              <AnimatedNumber value={totalReturn} format={currencyFormatter.format} />
            </p>
            <span className={`text-[11px] ${isUp ? "text-green-500" : "text-red-500"}`}>
              {isUp ? "+" : ""}
              <AnimatedNumber value={totalReturnPercent} format={(v) => `${v.toFixed(2)}%`} />
            </span>
          </div>
          <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-4" })}>
            <span className="text-xs text-foreground/50">Cash Balance</span>
            <p className="text-xl font-bold text-foreground">
              <AnimatedNumber value={portfolio.cashBalance} format={compactCurrencyFormatter.format} />
            </p>
          </div>
          <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-4" })}>
            <span className="text-xs text-foreground/50">Started</span>
            <p className="text-xl font-bold text-foreground">
              {new Date(portfolio.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delayMs={60}>
          <SimulatedPerformanceChart portfolio={portfolio} performanceSeries={performanceSeries} totalValue={totalValue} />
        </RevealOnScroll>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RevealOnScroll delayMs={100}>
          <section key={refreshToken} className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4 animate-nav-item-fade-in motion-reduce:animate-none" })}>
            <h2 className="text-lg font-semibold text-foreground">Current Holdings</h2>
            {holdings.length === 0 ? (
              <p className="rounded-md bg-foreground/5 px-3 py-2 text-xs text-foreground/50">No holdings yet — trade below to get started.</p>
            ) : (
              <>
              <ScrollHint />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-black/10 text-xs text-foreground/50 dark:border-white/15">
                      <th className="p-2 text-left">Symbol</th>
                      <th className="p-2 text-left">Trend</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Avg Cost</th>
                      <th className="p-2 text-right">Price</th>
                      <th className="p-2 text-right">Gain/Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h) => (
                      <tr
                        key={`${h.assetType}-${h.symbol}`}
                        className="border-t border-black/5 transition-colors duration-150 ease-out hover:bg-foreground/[0.03] dark:border-white/10"
                      >
                        <td className="p-2 font-medium text-foreground">
                          {h.symbol}
                          {h.priceUnavailable && (
                            <span className="ml-1 text-[10px] text-foreground/40" title="Live price unavailable right now — showing book value">
                              (est.)
                            </span>
                          )}
                        </td>
                        <td className="w-20 p-2">
                          {holdingHistories[h.symbol] ? (
                            <MiniLineChart data={holdingHistories[h.symbol]} height={28} />
                          ) : (
                            <span className="text-[10px] text-foreground/30">—</span>
                          )}
                        </td>
                        <td className="p-2 text-right text-foreground/70">{h.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                        <td className="p-2 text-right text-foreground/70">{currencyFormatter.format(h.averageCostBasis)}</td>
                        <td className="p-2 text-right text-foreground">{h.currentPrice != null ? currencyFormatter.format(h.currentPrice) : "—"}</td>
                        <td className={`p-2 text-right ${h.unrealizedGainLoss == null ? "text-foreground/30" : h.unrealizedGainLoss >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {h.unrealizedGainLoss != null
                            ? `${h.unrealizedGainLoss >= 0 ? "+" : ""}${currencyFormatter.format(h.unrealizedGainLoss)} (${h.unrealizedGainLossPercent!.toFixed(1)}%)`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </section>
          </RevealOnScroll>

          <RevealOnScroll delayMs={140}>
          <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
            <h2 className="text-lg font-semibold text-foreground">Trade</h2>
            <TradeForm portfolioId={portfolio.id} holdings={holdings} onTraded={() => setRefreshToken((t) => t + 1)} />
          </section>
          </RevealOnScroll>
        </div>

        <RevealOnScroll delayMs={180}>
        <section key={refreshToken} className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4 animate-nav-item-fade-in motion-reduce:animate-none" })}>
          <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
          {recentTransactions.length === 0 ? (
            <p className="rounded-md bg-foreground/5 px-3 py-2 text-xs text-foreground/50">No trades yet.</p>
          ) : (
            <ul className="flex flex-col">
              {recentTransactions.map((tx, i) => {
                const isBuy = tx.transactionType === "buy";
                return (
                  <li
                    key={tx.id}
                    className={`flex items-center gap-3 py-2.5 transition-colors duration-150 ease-out hover:bg-foreground/[0.03] ${
                      i > 0 ? "border-t border-black/5 dark:border-white/10" : ""
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        isBuy ? "bg-green-400/10 text-green-500" : "bg-red-400/10 text-red-500"
                      }`}
                    >
                      {isBuy ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {formatTransactionType(tx.transactionType)} {tx.symbol}
                      </p>
                      <p className="text-xs text-foreground/50">
                        {tx.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })} @ {currencyFormatter.format(tx.price)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium text-foreground">{currencyFormatter.format(tx.totalValue)}</p>
                      <p className="text-[11px] text-foreground/40">
                        {new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        </RevealOnScroll>

        <RevealOnScroll delayMs={220}>
        <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Full Transaction History</h2>
            <div className="flex gap-1 text-xs">
              <button
                type="button"
                onClick={() => setSortKey("date")}
                className={`rounded-md border px-2.5 py-1.5 font-medium transition-colors duration-150 ease-out ${sortKey === "date" ? "border-indigo-400/50 text-indigo-400" : "border-black/10 text-foreground/50 hover:border-black/25 dark:border-white/15"}`}
              >
                By Date
              </button>
              <button
                type="button"
                onClick={() => setSortKey("value")}
                className={`rounded-md border px-2.5 py-1.5 font-medium transition-colors duration-150 ease-out ${sortKey === "value" ? "border-indigo-400/50 text-indigo-400" : "border-black/10 text-foreground/50 hover:border-black/25 dark:border-white/15"}`}
              >
                By Value
              </button>
            </div>
          </div>
          {sortedTransactions.length === 0 ? (
            <p className="rounded-md bg-foreground/5 px-3 py-2 text-xs text-foreground/50">No transactions yet.</p>
          ) : (
            <>
            <ScrollHint />
            <div className={`overflow-x-auto ${sortedTransactions.length > 15 ? "max-h-[500px] overflow-y-auto" : ""}`}>
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="sticky top-0 border-b border-black/10 bg-background text-xs text-foreground/50 dark:border-white/15">
                    <th className="p-2 text-left">Symbol</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-left">Qty</th>
                    <th className="p-2 text-right">Price</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-right">Date</th>
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
        </RevealOnScroll>

        <SimulatedTradingDisclaimer />
      </div>
    </main>
  );
}
