"use client";

// ARCHIVED, not deleted: this was the standalone /research page. Its only
// content (a market-wide insider-activity feed via /api/insider-activity)
// is now superseded by Trackers' "Company Insiders" section — real
// EDGAR-sourced Form 4 data per company, covering more companies with
// richer fields (reporting person/role, exact value, real disclosure
// lag) than this FMP+Finnhub feed ever did. One feature here has no
// direct equivalent in Trackers today: the AI-generated "comparison fact"
// narration (e.g. "largest purchase by this insider in available
// history") — flagged to the user rather than silently dropped when this
// page was removed from navigation.
//
// Kept here (in a leading-underscore folder, which Next.js's App Router
// excludes from routing entirely) rather than deleted, in case this
// content or layout gets repurposed later. To reactivate as a live route,
// move this file back to app/research/page.tsx and re-add its sidebar
// entry in components/Sidebar.tsx.
import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";

const POLL_INTERVAL_MS = 5 * 60_000;

interface InsiderFeedEntry {
  symbol: string;
  companyName: string;
  insiderName: string;
  action: "buy" | "sell";
  shares: number;
  value: number;
  transactionDate: string;
  source: "fmp" | "finnhub";
  comparisonFact: string | null;
}

interface InsiderActivityData {
  entries: InsiderFeedEntry[];
  generatedAt: string;
}

const shareFormatter = new Intl.NumberFormat("en-US");
const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function InsiderRow({ entry }: { entry: InsiderFeedEntry }) {
  const isBuy = entry.action === "buy";

  return (
    <div className="flex flex-col gap-2 rounded-md border border-black/10 p-4 dark:border-white/15">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{entry.symbol}</span>
            <span className="truncate text-sm text-foreground/60">{entry.companyName}</span>
          </div>
          <p className="text-sm text-foreground/80">{entry.insiderName}</p>
        </div>

        <div
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            isBuy ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
          }`}
        >
          {isBuy ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {isBuy ? "Buy" : "Sell"}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <span className="text-foreground/70">
          {shareFormatter.format(entry.shares)} shares
          {entry.value > 0 && (
            <span className="text-foreground/50"> ({compactCurrencyFormatter.format(entry.value)})</span>
          )}
        </span>
        <span className="text-foreground/50">{formatDate(entry.transactionDate)}</span>
      </div>

      {entry.comparisonFact && (
        <p className="rounded-md bg-foreground/5 px-3 py-2 text-xs italic text-foreground/70">
          {entry.comparisonFact}
        </p>
      )}
    </div>
  );
}

function InsiderRowSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-black/10 p-4 dark:border-white/15">
      <div className="flex items-center justify-between">
        <div className="h-4 w-40 animate-pulse rounded bg-foreground/10" />
        <div className="h-5 w-14 animate-pulse rounded-full bg-foreground/10" />
      </div>
      <div className="h-3 w-24 animate-pulse rounded bg-foreground/10" />
    </div>
  );
}

function InsiderActivitySection() {
  const [data, setData] = useState<InsiderActivityData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/insider-activity");
        const body = await response.json().catch(() => null);
        if (cancelled) return;

        if (!response.ok || !body) {
          setError(true);
          return;
        }
        setError(false);
        setData(body);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <RevealOnScroll className="flex w-full max-w-3xl flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">Insider Activity</h2>
        <p className="text-sm text-foreground/50">
          Recent SEC Form 4 insider buys/sells at well-known companies, sourced from public filings.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {data?.entries ? (
          data.entries.length > 0 ? (
            data.entries.map((entry, index) => (
              <InsiderRow key={`${entry.symbol}-${entry.transactionDate}-${entry.insiderName}-${index}`} entry={entry} />
            ))
          ) : (
            <p className="text-sm text-foreground/60">
              No notable insider activity in the most recent filings — check back later.
            </p>
          )
        ) : error ? (
          <p className="text-sm text-red-500">Insider activity is temporarily unavailable.</p>
        ) : (
          Array.from({ length: 5 }).map((_, i) => <InsiderRowSkeleton key={i} />)
        )}
      </div>

      <div className="flex flex-col gap-1 border-t border-black/10 pt-3 text-xs text-foreground/40 dark:border-white/15">
        <span>
          Institutional/13F holdings data isn&apos;t available on this app&apos;s current data plan —
          showing insider trading activity only.
        </span>
        <span>
          Contextual notes are generated only from confirmed comparisons against real transaction
          history — not financial advice.
        </span>
      </div>
    </RevealOnScroll>
  );
}

export default function ResearchPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <h1 className="text-3xl font-bold text-foreground">Research</h1>
      <InsiderActivitySection />
    </main>
  );
}
