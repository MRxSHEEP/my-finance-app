"use client";

import { useEffect, useRef, useState } from "react";

// Matches the client-visible cadence in app/api/ticker/route.ts. The
// server-side cache there independently throttles the Polygon-backed
// symbols (gold/silver) to a slower refresh — see that file for the
// rate-budget math — so polling here just checks in on whatever the
// server currently has, rather than driving the upstream call rate.
const POLL_INTERVAL_MS = 20_000;

// These map to the --animate-ticker-flash-* tokens declared in the
// @theme block in globals.css, which is what makes their @keyframes
// survive the production build (see the comment there for why a plain
// top-level @keyframes or an arbitrary-value animate-[...] class doesn't).
const FLASH_UP_CLASS = "animate-ticker-flash-up";
const FLASH_DOWN_CLASS = "animate-ticker-flash-down";

interface TickerItem {
  symbol: string;
  label: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
}

interface DisplayItem extends TickerItem {
  // Bumped whenever price changes so the flashing pill can be remounted
  // (fresh DOM node -> fresh CSS animation) without touching the parent
  // track's own, unrelated, continuously-running scroll animation.
  flashToken: number;
  flashDirection: "up" | "down" | null;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function TickerBar() {
  const [items, setItems] = useState<DisplayItem[]>([]);
  const itemsRef = useRef<DisplayItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/ticker");
        if (!response.ok) return;
        const data = await response.json().catch(() => null);
        const incoming: TickerItem[] = Array.isArray(data?.items) ? data.items : [];
        if (cancelled || incoming.length === 0) return;

        const prevMap = new Map(itemsRef.current.map((item) => [item.symbol, item]));
        const merged: DisplayItem[] = incoming.map((next) => {
          const prev = prevMap.get(next.symbol);
          const priceChanged =
            prev != null && prev.price != null && next.price != null && prev.price !== next.price;

          return {
            ...next,
            flashToken: priceChanged ? prev!.flashToken + 1 : (prev?.flashToken ?? 0),
            flashDirection: priceChanged ? (next.price! > prev!.price! ? "up" : "down") : null,
          };
        });

        itemsRef.current = merged;
        setItems(merged);
      } catch {
        // Keep showing the last successful data — one failed poll
        // shouldn't blank out the whole ticker.
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="sticky top-0 z-40 h-[30px] shrink-0 overflow-hidden border-b border-white/10 bg-neutral-950">
      <div className="group h-full overflow-hidden">
        <div className="flex h-full w-max animate-ticker-scroll items-center group-hover:[animation-play-state:paused]">
          {items.length > 0 &&
            [...items, ...items].map((item, index) => (
              <TickerPill
                key={`${item.symbol}-${index < items.length ? "a" : "b"}-${item.flashToken}`}
                item={item}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

function TickerPill({ item }: { item: DisplayItem }) {
  const { label, price, percentChange, flashDirection } = item;
  const hasData = price != null && percentChange != null;
  const isUp = hasData && percentChange > 0;
  const isDown = hasData && percentChange < 0;

  const flashClass =
    flashDirection === "up" ? FLASH_UP_CLASS : flashDirection === "down" ? FLASH_DOWN_CLASS : "";

  return (
    <div className={`flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap px-4 ${flashClass}`}>
      <span className="text-[11px] font-normal text-white/45">{label}</span>
      <span className="text-[11px] font-semibold text-white">
        {hasData ? currencyFormatter.format(price) : "—"}
      </span>
      {hasData && (
        <span
          className={`text-[11px] font-medium ${
            isUp ? "text-green-500" : isDown ? "text-red-500" : "text-white/45"
          }`}
        >
          {isUp ? "▲" : isDown ? "▼" : ""} {percentChange >= 0 ? "+" : ""}
          {percentChange.toFixed(1)}%
        </span>
      )}
    </div>
  );
}
