"use client";

import Link from "next/link";
import SparklineSlot from "@/components/SparklineSlot";
import { cardClass, type CardAccent } from "@/lib/cardStyles";

export type { CardAccent };

function decimalsForPrice(price: number): number {
  if (price >= 1) return 2;
  return 4;
}

function formatPrice(price: number): string {
  const decimals = decimalsForPrice(price);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}

// A card showing a move at or beyond this magnitude gets a colored glow
// ring — a stronger, at-a-glance signal than the plain green/red text
// alone, matching the broader color-language pass.
const STRONG_MOVE_THRESHOLD = 5;

interface TickerMiniCardProps {
  symbol: string;
  name?: string;
  price: number | null;
  percentChange: number | null;
  // undefined: quote not fetched yet (loading skeleton). null/[]: fetched,
  // no chart data (clean fallback). See components/SparklineSlot.tsx.
  history: { time: number; value: number }[] | null | undefined;
  stale?: boolean;
  accent?: CardAccent;
  // The parent remounts this component (via a flashToken-suffixed `key`)
  // whenever this symbol's price actually changes, so the same
  // `flashDirection` value re-triggers the CSS flash animation on a fresh
  // DOM node instead of silently no-op'ing on an unchanged class name.
  flashDirection?: "up" | "down" | null;
}

export default function TickerMiniCard({
  symbol,
  name,
  price,
  percentChange,
  history,
  stale = false,
  accent = "neutral",
  flashDirection = null,
}: TickerMiniCardProps) {
  const hasQuote = price != null && percentChange != null;
  const isUp = hasQuote && percentChange! > 0;
  const isDown = hasQuote && percentChange! < 0;
  const isStrongMove = hasQuote && Math.abs(percentChange!) >= STRONG_MOVE_THRESHOLD;
  const flashClass =
    flashDirection === "up" ? "animate-ticker-flash-up" : flashDirection === "down" ? "animate-ticker-flash-down" : "";

  return (
    <Link
      href={`/stocks?ticker=${encodeURIComponent(symbol)}`}
      className={cardClass(accent, {
        interactive: true,
        extra: `group flex flex-col gap-2 p-4 hover:scale-[1.02] ${flashClass} ${
          isStrongMove ? (isUp ? "ring-1 ring-green-400/40 shadow-green-400/10" : "ring-1 ring-red-400/40 shadow-red-400/10") : ""
        }`,
      })}
    >
      <div>
        <h3 className="font-semibold text-foreground">{symbol}</h3>
        {name && <p className="truncate text-xs text-foreground/50">{name}</p>}
      </div>

      <div className="h-12 w-full">
        <SparklineSlot history={history} stale={stale} height={48} />
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-base font-semibold text-foreground">
          {hasQuote ? formatPrice(price!) : "—"}
        </span>
        {hasQuote && (
          <span
            className={`text-xs font-medium transition-colors duration-200 ${
              isUp ? "text-green-500" : isDown ? "text-red-500" : "text-foreground/50"
            }`}
          >
            {isUp ? "▲" : isDown ? "▼" : ""} {percentChange! >= 0 ? "+" : ""}
            {percentChange!.toFixed(2)}%
          </span>
        )}
      </div>
    </Link>
  );
}
