"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RankingsTable } from "@/components/crypto/MarketOverview";
import type { CoinRanking } from "@/lib/cryptoTypes";

// A one-off fetch (not the homepage's 60s poll) — this is a full listing
// page a user navigates to deliberately, not a live-updating dashboard
// section. It hits the same server-cached /api/crypto/rankings route the
// homepage uses, so navigating here shortly after visiting /crypto reuses
// that cache rather than re-hitting CoinGecko.
export default function CryptoRankingsPage() {
  const [coins, setCoins] = useState<CoinRanking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/crypto/rankings");
        const body = await response.json().catch(() => null);
        if (cancelled) return;

        const list: CoinRanking[] = Array.isArray(body?.coins) ? body.coins : [];
        if (list.length === 0) {
          setError("Failed to load market data.");
          return;
        }
        setError(null);
        setCoins(list);
      } catch {
        if (!cancelled) setError("Failed to load market data.");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex w-full flex-1 flex-col items-center gap-6 p-6 pb-16 pt-10">
      <div className="flex w-full max-w-6xl flex-col gap-6">
        <Link
          href="/crypto"
          className="flex w-fit items-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to Crypto
        </Link>

        <h1 className="text-2xl font-bold text-foreground">Market Cap Rankings</h1>

        {error && !coins && <p className="text-sm text-red-500">{error}</p>}
        {!coins && !error && <div className="h-96 w-full animate-pulse rounded-md bg-foreground/10" />}
        {coins && coins.length > 0 && <RankingsTable coins={coins} />}
      </div>
    </main>
  );
}
