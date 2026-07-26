"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";

const DAYS_AHEAD = 7;
const ENTRY_COUNT = 6;

interface EarningsEntry {
  symbol: string;
  name: string;
  date: string;
  hour: "bmo" | "amc" | "dmh" | null;
  epsEstimate: number | null;
  epsActual: number | null;
}

function todayIsoUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetweenIso(dateIso: string, todayIso: string): number {
  const a = new Date(`${dateIso}T00:00:00Z`).getTime();
  const b = new Date(`${todayIso}T00:00:00Z`).getTime();
  return Math.round((a - b) / 86_400_000);
}

function formatEps(value: number | null): string {
  if (value === null) return "—";
  return `${value < 0 ? "-" : ""}$${Math.abs(value).toFixed(2)}`;
}

// Reuses the existing multi-company earnings calendar as-is —
// GET /api/earnings-calendar (lib/earningsCalendar.ts's fetchEarningsCalendar),
// the same data source that powers the full /earnings page — condensed
// here to just the next 7 days.
export default function EarningsDigestSection({ watchlistSymbols }: { watchlistSymbols: Set<string> }) {
  const [entries, setEntries] = useState<EarningsEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/earnings-calendar");
        const body = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok || !Array.isArray(body?.entries)) {
          setError(true);
          return;
        }
        setEntries(body.entries);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const todayIso = todayIsoUTC();
  const upcoming = (entries ?? [])
    .filter((e) => e.epsActual === null && daysBetweenIso(e.date, todayIso) >= 0 && daysBetweenIso(e.date, todayIso) <= DAYS_AHEAD)
    .sort((a, b) => {
      const aWatched = watchlistSymbols.has(a.symbol) ? 0 : 1;
      const bWatched = watchlistSymbols.has(b.symbol) ? 0 : 1;
      if (aWatched !== bWatched) return aWatched - bWatched;
      return a.date.localeCompare(b.date);
    })
    .slice(0, ENTRY_COUNT);

  return (
    <RevealOnScroll className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock size={20} className="text-green-400" />
          <h2 className="text-2xl font-bold text-white">Earnings This Week</h2>
        </div>
        <Link href="/earnings" className="text-sm text-white/50 hover:text-white/80">
          Full calendar →
        </Link>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        {entries ? (
          upcoming.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {upcoming.map((entry) => (
                <div key={`${entry.symbol}-${entry.date}`} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${watchlistSymbols.has(entry.symbol) ? "text-amber-400" : "text-white"}`}>
                      {entry.symbol}
                    </span>
                    <span className="truncate text-white/50">{entry.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-white/50">
                    <span>{new Date(`${entry.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    <span>Est. {formatEps(entry.epsEstimate)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/50">No notable earnings in the next {DAYS_AHEAD} days.</p>
          )
        ) : error ? (
          <p className="text-sm text-white/50">Earnings calendar is temporarily unavailable.</p>
        ) : (
          <div className="flex flex-col gap-3" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 w-full animate-pulse rounded bg-white/10" />
            ))}
          </div>
        )}
      </div>
    </RevealOnScroll>
  );
}
