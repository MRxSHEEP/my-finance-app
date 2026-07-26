"use client";

import { useEffect, useState } from "react";
import { fetchStockLogo } from "@/lib/stockLogoCache";

// A small fixed palette, picked by a deterministic hash of the ticker (not
// Math.random — same reasoning as the header backgrounds' fixed
// coordinates: this needs to render identically server- and client-side,
// and a hash of a stable string input is safe for that where a random
// pick wouldn't be).
const FALLBACK_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-orange-500",
];

function colorForSymbol(symbol: string): string {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = (hash * 31 + symbol.charCodeAt(i)) | 0;
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

function initialsForSymbol(symbol: string): string {
  return symbol.slice(0, 2).toUpperCase();
}

interface StockLogoProps {
  symbol: string;
  size?: number;
  className?: string;
}

// Real company logo when available (same /api/stock/overview source and
// module-level cache as the Stocks header background — see
// lib/stockLogoCache.ts), falling back to a colored circle with the
// ticker's initials rather than a generic icon. The fallback renders
// immediately (not behind a loading spinner) and is simply replaced once
// the real logo resolves, the same "placeholder now, swap in once ready"
// pattern most avatar UIs use.
export default function StockLogo({ symbol, size = 28, className = "" }: StockLogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) {
        setLogoUrl(null);
        setImgFailed(false);
      }
      const url = await fetchStockLogo(symbol);
      if (!cancelled) setLogoUrl(url);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (logoUrl && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 rounded-full bg-white object-contain p-0.5 ${className}`}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${colorForSymbol(symbol)} ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.38)) }}
      aria-hidden="true"
    >
      {initialsForSymbol(symbol)}
    </div>
  );
}
