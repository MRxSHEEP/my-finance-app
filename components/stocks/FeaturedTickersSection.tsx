"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";
import TickerMiniCard, { type CardAccent } from "./TickerMiniCard";

export interface FeaturedTicker {
  symbol: string;
  name: string;
}

interface MiniQuote {
  symbol: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  history: { time: number; value: number }[] | null;
  sparklineStale: boolean;
  priceStale: boolean;
}

interface DisplayQuote extends MiniQuote {
  flashToken: number;
  flashDirection: "up" | "down" | null;
}

// Refreshed periodically (not just fetched once) so these tiles feel like
// a live market snapshot rather than a static one — matching the
// "prices update live" polish pass. 30s: frequent enough to feel current
// for a handful of large, liquid tickers, gentler than the top ticker
// bar's own 20s cadence since these cards aren't the page's primary focus.
const POLL_INTERVAL_MS = 30_000;
const STAGGER_MS = 50;
const MAX_STAGGER_MS = 300;

// Matches each card accent to the icon color used in its section header,
// so the header reads as the same "identity" as the cards beneath it.
const ICON_COLOR_BY_ACCENT: Record<CardAccent, string> = {
  neutral: "text-foreground/60",
  blue: "text-blue-400",
  indigo: "text-indigo-400",
  purple: "text-purple-400",
};

interface FeaturedTickersSectionProps {
  title: string;
  subtitle: string;
  tickers: FeaturedTicker[];
  accent: CardAccent;
  icon: LucideIcon;
}

// `tickers` must be a stable (module-level) array reference from the
// caller — an inline array literal would change identity every render and
// re-trigger the fetch below on every parent re-render.
export default function FeaturedTickersSection({
  title,
  subtitle,
  tickers,
  accent,
  icon: Icon,
}: FeaturedTickersSectionProps) {
  const [quotes, setQuotes] = useState<Map<string, DisplayQuote> | null>(null);
  const quotesRef = useRef<Map<string, DisplayQuote>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const symbols = tickers.map((t) => t.symbol).join(",");
        const response = await fetch(
          `/api/stock/mini-quotes?symbols=${encodeURIComponent(symbols)}`
        );
        const body = await response.json().catch(() => null);
        if (cancelled) return;

        const list: MiniQuote[] = Array.isArray(body?.quotes) ? body.quotes : [];
        const prevMap = quotesRef.current;
        const merged = new Map<string, DisplayQuote>(
          list.map((quote) => {
            const prev = prevMap.get(quote.symbol);
            const priceChanged =
              prev != null && prev.price != null && quote.price != null && prev.price !== quote.price;

            return [
              quote.symbol,
              {
                ...quote,
                flashToken: priceChanged ? prev!.flashToken + 1 : (prev?.flashToken ?? 0),
                flashDirection: priceChanged ? (quote.price! > prev!.price! ? "up" : "down") : null,
              },
            ];
          })
        );

        quotesRef.current = merged;
        setQuotes(merged);
      } catch {
        if (!cancelled && quotesRef.current.size === 0) setQuotes(new Map());
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tickers]);

  return (
    <RevealOnScroll className="flex w-full flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <Icon size={20} className={ICON_COLOR_BY_ACCENT[accent]} />
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
        </div>
        <p className="text-sm text-foreground/50">{subtitle}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {tickers.map((ticker, index) => {
          const quote = quotes?.get(ticker.symbol);
          return (
            <RevealOnScroll
              key={ticker.symbol}
              delayMs={Math.min(index * STAGGER_MS, MAX_STAGGER_MS)}
            >
              <TickerMiniCard
                key={`${ticker.symbol}-${quote?.flashToken ?? 0}`}
                symbol={ticker.symbol}
                name={ticker.name}
                price={quote?.price ?? null}
                percentChange={quote?.percentChange ?? null}
                history={quote ? quote.history : undefined}
                stale={(quote?.sparklineStale ?? false) || (quote?.priceStale ?? false)}
                accent={accent}
                flashDirection={quote?.flashDirection ?? null}
              />
            </RevealOnScroll>
          );
        })}
      </div>
    </RevealOnScroll>
  );
}
