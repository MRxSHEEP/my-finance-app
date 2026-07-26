import { useEffect, useState } from "react";
import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import { fetchStockLogo, getCachedStockLogo } from "@/lib/stockLogoCache";

// Ticker/market-energy background for the Stocks section banner — a
// faint drifting grid (graph paper), a slow-drifting row of candlesticks,
// a handful of glowing "live tick" dots, faint drifting ticker symbols,
// and a few minimal chart/trend icons. Pure CSS/SVG, no JS computation or
// network cost, so there's nothing to lazy-load: the whole thing paints
// in the same frame as the rest of the banner.
//
// Candlestick heights/colors are generated once at module load with a
// fixed formula (sine waves, not Math.random) — deterministic so the
// server-rendered and client-hydrated markup always match exactly, unlike
// a per-render random sequence which would mismatch and force a hydration
// warning/repaint.
//
// bodyHeight/wickExtra are rounded to whole pixels *here*, once, rather
// than left as raw Math.sin() floats (e.g. 16.080659202910294) — a real
// hydration mismatch was reproduced from exactly this: the server-rendered
// HTML's style attribute came out as a 4-decimal rounded string
// ("16.0807px") while the client's own re-computation of the identical
// expression produced the full-precision float, and React's hydration
// diff treats those as different values. Rounding once at generation time
// means every consumer of `Candle` only ever sees an already-clean
// integer, so there's no float-precision gap left for server and client
// to disagree about regardless of how each one stringifies it.
const CANDLE_COUNT = 26;

interface Candle {
  bodyHeight: number;
  wickExtra: number;
  isUp: boolean;
}

const CANDLES: Candle[] = Array.from({ length: CANDLE_COUNT }, (_, i) => {
  const wave = Math.sin(i * 0.7) * 14 + Math.sin(i * 1.9) * 6;
  const bodyHeight = Math.round(Math.max(6, 22 + wave));
  const wickExtra = Math.round(4 + Math.abs(Math.sin(i * 1.3)) * 8);
  return { bodyHeight, wickExtra, isUp: Math.sin(i * 0.7 + 0.4) >= 0 };
});

// Fixed positions (percent-based) for the pulsing "live tick" dots,
// loosely tracing a rising-then-dipping trend so they read as sitting on
// an implied price line rather than scattered at random.
const TICK_DOTS: Array<{ top: string; left: string; isUp: boolean; delay: string }> = [
  { top: "62%", left: "10%", isUp: true, delay: "0s" },
  { top: "48%", left: "24%", isUp: true, delay: "0.4s" },
  { top: "55%", left: "39%", isUp: false, delay: "0.9s" },
  { top: "34%", left: "53%", isUp: true, delay: "1.3s" },
  { top: "40%", left: "68%", isUp: false, delay: "0.6s" },
  { top: "26%", left: "82%", isUp: true, delay: "1.7s" },
  { top: "58%", left: "92%", isUp: false, delay: "1.1s" },
];

// Faint drifting ticker symbols — a handful of widely-recognized names
// rather than anything tied to live data, purely for background texture.
// Each one is paired with that company's logo (fetched below) so the two
// drift together as one unit rather than as disconnected elements.
const TICKER_SYMBOLS: Array<{ symbol: string; top: string; left: string; size: string; duration: string; delay: string }> = [
  { symbol: "AAPL", top: "14%", left: "16%", size: "13px", duration: "10s", delay: "0.2s" },
  { symbol: "MSFT", top: "72%", left: "8%", size: "12px", duration: "11s", delay: "1.3s" },
  { symbol: "GOOGL", top: "20%", left: "44%", size: "12px", duration: "9.5s", delay: "0.7s" },
  { symbol: "TSLA", top: "76%", left: "58%", size: "13px", duration: "10.5s", delay: "1.9s" },
  { symbol: "NVDA", top: "12%", left: "74%", size: "12px", duration: "9s", delay: "0.4s" },
  { symbol: "AAPL", top: "44%", left: "90%", size: "12px", duration: "11.5s", delay: "1.1s" },
];

// Logos are pulled through lib/stockLogoCache.ts — the same shared,
// module-level cache the Stock Catalog rows use (see
// components/stocks/StockLogo.tsx), so whichever of the two loads a given
// ticker's logo first saves the other one a redundant fetch.
const HEADER_LOGO_TICKERS = Array.from(new Set(TICKER_SYMBOLS.map((t) => t.symbol)));

// Minimal chart/trend icons — TrendingUp/TrendingDown standing in for a
// "bull/bear" cue and Activity for a ticker-tape/pulse cue, since lucide
// has no literal bull/bear/ticker-tape glyphs. Reuses this app's existing
// green-up/red-down convention rather than inventing a new color meaning.
const TREND_ICONS: Array<{
  Icon: typeof TrendingUp;
  top: string;
  left: string;
  size: number;
  duration: string;
  delay: string;
  className: string;
}> = [
  { Icon: TrendingUp, top: "30%", left: "8%", size: 26, duration: "9s", delay: "0.5s", className: "text-green-400/20" },
  { Icon: TrendingDown, top: "66%", left: "30%", size: 24, duration: "10s", delay: "1.4s", className: "text-red-400/20" },
  { Icon: Activity, top: "18%", left: "60%", size: 28, duration: "11s", delay: "0.9s", className: "text-slate-300/15" },
  { Icon: TrendingUp, top: "58%", left: "78%", size: 22, duration: "9.5s", delay: "1.7s", className: "text-green-400/15" },
];

function CandlestickRow() {
  return (
    <div
      className="absolute bottom-0 left-0 flex h-24 w-max animate-chart-drift items-end opacity-[0.22] motion-reduce:animate-none"
      aria-hidden="true"
    >
      {[0, 1].map((copy) => (
        <div key={copy} className="flex shrink-0 items-end gap-3 px-3">
          {CANDLES.map((candle, i) => (
            <div
              key={i}
              className="relative flex w-2 shrink-0 items-end justify-center"
              style={{ height: candle.bodyHeight + candle.wickExtra * 2 }}
            >
              <div
                className={`absolute left-1/2 w-px -translate-x-1/2 ${candle.isUp ? "bg-green-400" : "bg-red-400"}`}
                style={{ height: candle.bodyHeight + candle.wickExtra * 2 }}
              />
              <div
                className={`absolute bottom-0 left-1/2 w-2 -translate-x-1/2 rounded-[1px] ${
                  candle.isUp ? "bg-green-400" : "bg-red-400"
                }`}
                style={{ height: candle.bodyHeight, bottom: candle.wickExtra }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TickDots() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {TICK_DOTS.map((dot, i) => (
        <span
          key={i}
          className={`absolute h-1.5 w-1.5 rounded-full opacity-70 motion-reduce:animate-none animate-pulse-glow ${
            dot.isUp
              ? "bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.5)]"
              : "bg-red-400 shadow-[0_0_6px_2px_rgba(248,113,113,0.5)]"
          }`}
          style={{ top: dot.top, left: dot.left, animationDelay: dot.delay }}
        />
      ))}
    </div>
  );
}

function TickerSymbols() {
  // Seeded from whatever's already in the shared module-level cache — on
  // a client-side remount within the same session (not a fresh page
  // load), or if the catalog already fetched one of these same tickers
  // first, this skips straight to showing it, no re-fetch, no flash of a
  // missing logo.
  const [logos, setLogos] = useState<Map<string, string | null>>(
    () => new Map(HEADER_LOGO_TICKERS.map((symbol) => [symbol, getCachedStockLogo(symbol) ?? null]))
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all(HEADER_LOGO_TICKERS.map((symbol) => fetchStockLogo(symbol).then((url) => [symbol, url] as const))).then(
      (entries) => {
        if (!cancelled) setLogos(new Map(entries));
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="absolute inset-0" aria-hidden="true">
      {TICKER_SYMBOLS.map((ticker, i) => {
        const logoUrl = logos.get(ticker.symbol);
        return (
          <div
            key={i}
            className="absolute flex items-center gap-1 motion-reduce:animate-none animate-crypto-float"
            style={{ top: ticker.top, left: ticker.left, animationDuration: ticker.duration, animationDelay: ticker.delay }}
          >
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                width={14}
                height={14}
                className="rounded-[2px] opacity-30 grayscale"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <span
              className="font-mono font-semibold tracking-wide text-white/10"
              style={{ fontSize: ticker.size }}
            >
              {ticker.symbol}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TrendIcons() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {TREND_ICONS.map(({ Icon, top, left, size, duration, delay, className }, i) => (
        <Icon
          key={i}
          aria-hidden="true"
          className={`absolute animate-crypto-float motion-reduce:animate-none ${className}`}
          style={{ top, left, width: size, height: size, animationDuration: duration, animationDelay: delay }}
        />
      ))}
    </div>
  );
}

export default function StocksHeaderBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Slowly shifting neutral gradient wash — kept desaturated so the
          green/red language reads through the candlesticks/dots instead
          of tinting the whole banner. */}
      <div className="absolute inset-0 animate-crypto-gradient bg-gradient-to-br from-neutral-950 via-slate-900 to-neutral-950 bg-[length:200%_200%] motion-reduce:animate-none" />

      {/* Faint drifting graph-paper grid */}
      <div
        className="absolute inset-0 animate-grid-drift opacity-[0.3] motion-reduce:animate-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <TrendIcons />
      <TickerSymbols />
      <CandlestickRow />
      <TickDots />
    </div>
  );
}
