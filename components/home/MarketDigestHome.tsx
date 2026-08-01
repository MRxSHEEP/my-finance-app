"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Newspaper,
  TrendingUp,
  Bitcoin,
  Fuel,
  UserSearch,
  GraduationCap,
  Calculator,
  Sparkles,
  Sunrise,
  BarChart3,
  Grid3x3,
  type LucideIcon,
} from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";
import WatchlistDigestSection from "@/components/digest/WatchlistDigestSection";
import SectorCompanyCards from "@/components/digest/SectorCompanyCards";
import NewsDigestSection from "@/components/digest/NewsDigestSection";
import EarningsDigestSection from "@/components/digest/EarningsDigestSection";
import MoversDigestSection from "@/components/digest/MoversDigestSection";
import InsiderActivityDigestSection from "@/components/digest/InsiderActivityDigestSection";
import DashboardConfigButton from "@/components/digest/DashboardConfigButton";
import type { DashboardConfigResult } from "@/components/digest/DashboardConfigPanel";
import { DEFAULT_SECTION_ORDER, type SectionKey, isSectionKey } from "@/lib/digest/sections";
import type { CatalogSector } from "@/lib/stockCatalog";

const FEATURES: Array<{
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}> = [
  { label: "News", href: "/news", icon: Newspaper, description: "Stay on top of market-moving headlines in real time." },
  { label: "Stocks", href: "/stocks", icon: TrendingUp, description: "Search any ticker and dive into detailed price charts." },
  { label: "Crypto", href: "/crypto", icon: Bitcoin, description: "Track Bitcoin, Ethereum, and the top digital assets." },
  { label: "Commodities", href: "/commodities", icon: Fuel, description: "Follow gold, oil, and other key raw materials." },
  { label: "Trackers", href: "/trackers", icon: UserSearch, description: "Follow hedge funds, famous investors, and company insider activity." },
  { label: "Learning", href: "/learning", icon: GraduationCap, description: "Build your financial literacy with guided resources." },
  { label: "Tools", href: "/tools", icon: Calculator, description: "Calculators and utilities for smarter money decisions." },
];

// A simple abstract "stock chart" silhouette for the hero background —
// duplicated side by side below so it can drift in a seamless loop.
const CHART_PATH =
  "M0,60 L40,45 L80,55 L120,30 L160,40 L200,20 L240,35 L280,15 L320,28 L360,10 L400,25 L440,50 L480,40 L520,55 L560,35 L600,48 L640,30 L680,42 L720,25 L760,38 L800,20";

// Small corner trend-line squiggles — alternating uptrend (green) and
// downtrend (red), positioned in the hero's outer margins only, well
// clear of the centered text column below.
const TREND_LINES: Array<{ path: string; color: string; position: string; delay: string }> = [
  {
    path: "M0,55 L20,50 L35,42 L55,44 L70,28 L90,32 L110,14 L140,18",
    color: "text-green-500",
    position: "left-3 top-10 sm:left-6",
    delay: "0.1s",
  },
  {
    path: "M0,10 L20,16 L35,14 L55,26 L70,24 L90,40 L110,38 L140,52",
    color: "text-red-500",
    position: "right-3 top-16 sm:right-6",
    delay: "0.5s",
  },
  {
    path: "M0,14 L18,22 L34,20 L52,34 L68,32 L88,46 L108,44 L140,58",
    color: "text-red-500",
    position: "left-3 bottom-12 sm:left-6",
    delay: "0.9s",
  },
  {
    path: "M0,58 L18,48 L34,50 L52,36 L68,38 L88,22 L108,24 L140,8",
    color: "text-green-500",
    position: "right-3 bottom-16 sm:right-6",
    delay: "1.3s",
  },
];

// Scattered crypto/company marks around the hero's edges — a mix of the
// lucide Bitcoin icon (no external request needed) and small favicons for
// a few Mag 7 names + Ethereum, all kept to the outer margins/corners.
// Clearbit's logo API (the obvious choice here) was shut down in Dec
// 2025 — confirmed live (DNS resolution failure) and via its own
// changelog — so these use Google's public, key-free favicon endpoint
// instead.
interface ScatteredLogo {
  kind: "lucide" | "favicon";
  domain?: string;
  label: string;
  position: string;
  rotate: number;
  duration: string;
  delay: string;
}

const SCATTERED_LOGOS: ScatteredLogo[] = [
  { kind: "lucide", label: "Bitcoin", position: "left-[4%] top-[12%]", rotate: -12, duration: "7s", delay: "0s" },
  { kind: "favicon", domain: "apple.com", label: "Apple", position: "right-[5%] top-[10%]", rotate: 8, duration: "8s", delay: "0.6s" },
  { kind: "favicon", domain: "ethereum.org", label: "Ethereum", position: "left-[6%] bottom-[15%]", rotate: -6, duration: "6.5s", delay: "1.2s" },
  { kind: "favicon", domain: "microsoft.com", label: "Microsoft", position: "right-[4%] bottom-[12%]", rotate: 14, duration: "9s", delay: "0.3s" },
  { kind: "favicon", domain: "tesla.com", label: "Tesla", position: "left-[2%] top-[45%]", rotate: -10, duration: "7.5s", delay: "1.8s" },
  { kind: "favicon", domain: "nvidia.com", label: "Nvidia", position: "right-[3%] top-[50%]", rotate: 6, duration: "8.5s", delay: "0.9s" },
  { kind: "favicon", domain: "google.com", label: "Google", position: "left-[8%] top-[30%]", rotate: 10, duration: "6.8s", delay: "2.1s" },
  { kind: "favicon", domain: "amazon.com", label: "Amazon", position: "right-[8%] top-[32%]", rotate: -8, duration: "7.2s", delay: "1.5s" },
];

// Reused across the live data teaser — matches the labels already
// returned by /api/ticker (see app/api/ticker/route.ts), just picking a
// handful of "marquee" assets and giving them friendlier display names
// than the ticker bar's compact codes.
const TEASER_ORDER = ["BTC", "DOW", "NASDAQ", "GOLD"];
const TEASER_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  DOW: "Dow Jones",
  NASDAQ: "Nasdaq",
  GOLD: "Gold",
};

const TEASER_POLL_INTERVAL_MS = 30_000;

interface TickerItem {
  symbol: string;
  label: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  stale: boolean;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// ---------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------

// Hidden below md: at narrow widths the hero's outer margins shrink to
// nothing (or go away entirely), so corner/edge decoration would either
// sit invisibly in the padding or collide with the headline — safer to
// just show the plain gradient/grid/chart-drift backdrop on mobile.
function TrendLines() {
  return (
    <div className="hidden md:block" aria-hidden="true">
      {TREND_LINES.map((line, i) => (
        <svg
          key={i}
          viewBox="0 0 140 70"
          width={140}
          height={70}
          className={`absolute opacity-20 ${line.color} ${line.position}`}
        >
          <path
            d={line.path}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={300}
            className="animate-trend-line-draw"
            style={{ animationDelay: line.delay }}
          />
        </svg>
      ))}
    </div>
  );
}

function ScatteredLogos() {
  return (
    <div className="hidden md:block" aria-hidden="true">
      {SCATTERED_LOGOS.map((logo) => (
        <div key={logo.label} className={`absolute ${logo.position}`} style={{ transform: `rotate(${logo.rotate}deg)` }}>
          {logo.kind === "lucide" ? (
            <Bitcoin
              size={28}
              className="animate-logo-float text-white/30"
              style={{ animationDuration: logo.duration, animationDelay: logo.delay }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://www.google.com/s2/favicons?domain=${logo.domain}&sz=64`}
              alt=""
              width={28}
              height={28}
              className="animate-logo-float grayscale opacity-40"
              style={{ animationDuration: logo.duration, animationDelay: logo.delay }}
              onError={(e) => {
                // A failed favicon lookup should just quietly disappear —
                // this is decorative, never worth surfacing as an error.
                e.currentTarget.style.display = "none";
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Slowly shifting dark gradient wash */}
      <div className="absolute inset-0 animate-crypto-gradient bg-gradient-to-br from-neutral-950 via-slate-900 to-neutral-950 bg-[length:200%_200%]" />

      {/* Faint drifting graph-paper grid */}
      <div
        className="absolute inset-0 animate-grid-drift opacity-[0.4]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Faint drifting abstract chart line */}
      <div className="absolute bottom-0 left-0 flex h-32 w-max animate-chart-drift items-end opacity-[0.12]">
        {[0, 1].map((i) => (
          <svg key={i} viewBox="0 0 800 80" width={800} height={128} className="shrink-0 text-indigo-300">
            <path d={CHART_PATH} fill="none" stroke="currentColor" strokeWidth={2} />
          </svg>
        ))}
      </div>

      <TrendLines />
      <ScatteredLogos />
    </div>
  );
}

function Hero() {
  return (
    <div className="relative flex min-h-[560px] w-full flex-col items-center justify-center overflow-hidden border-b border-white/10 px-4 text-center">
      <HeroBackground />

      <RevealOnScroll className="relative z-10 flex flex-col items-center gap-6">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Welcome to Noble.
          <br />
          Your one-stop shop for financial information.
        </h1>
        <p className="max-w-xl text-base text-white/60 sm:text-lg">
          Search stocks, track crypto, follow market news, and access research
          tools — all in one place.
        </p>
        <Link
          href="/stocks"
          className="mt-2 rounded-md bg-white px-6 py-3 text-sm font-semibold text-neutral-950 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/90"
        >
          Explore Markets
        </Link>
      </RevealOnScroll>
    </div>
  );
}

// ---------------------------------------------------------------------
// Feature highlights
// ---------------------------------------------------------------------

function FeatureCard({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-6 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/5 text-white transition-colors duration-200 group-hover:bg-white/10">
        <Icon size={20} />
      </div>
      <h3 className="font-semibold text-white">{label}</h3>
      <p className="text-sm text-white/60">{description}</p>
    </Link>
  );
}

function FeaturesSection() {
  return (
    <RevealOnScroll className="flex w-full flex-col gap-6">
      <h2 className="text-2xl font-bold text-white">Everything you need, in one place.</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <FeatureCard key={feature.href} {...feature} />
        ))}
      </div>
    </RevealOnScroll>
  );
}

// ---------------------------------------------------------------------
// Live data teaser
// ---------------------------------------------------------------------

function TeaserCard({
  name,
  price,
  percentChange,
  stale = false,
}: {
  name: string;
  price: number | null;
  percentChange: number | null;
  stale?: boolean;
}) {
  const hasData = price != null && percentChange != null;
  const isUp = hasData && percentChange > 0;
  const isDown = hasData && percentChange < 0;

  return (
    <div className="relative flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-6">
      {hasData && stale && (
        <span
          className="absolute right-2 top-2 rounded-sm bg-white/10 px-1 py-px text-[8px] font-medium uppercase leading-none tracking-wide text-white/50"
          title="Showing the last available data — live data is temporarily unavailable"
        >
          Stale
        </span>
      )}
      <span className="text-sm font-medium text-white/50">{name}</span>
      <span className="text-2xl font-bold text-white">
        {hasData ? currencyFormatter.format(price) : "—"}
      </span>
      {hasData && (
        <span
          className={`text-sm font-medium ${
            isUp ? "text-green-500" : isDown ? "text-red-500" : "text-white/50"
          }`}
        >
          {isUp ? "▲" : isDown ? "▼" : ""} {percentChange >= 0 ? "+" : ""}
          {percentChange.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

function LiveDataTeaser() {
  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/ticker");
        if (!response.ok) return;
        const data = await response.json().catch(() => null);
        const list: TickerItem[] = Array.isArray(data?.items) ? data.items : [];
        if (!cancelled && list.length > 0) setItems(list);
      } catch {
        // Keep showing the last successful data.
      }
    }

    poll();
    const id = setInterval(poll, TEASER_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const byLabel = new Map(items.map((item) => [item.label, item]));

  return (
    <RevealOnScroll className="flex w-full flex-col gap-6">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold text-white">Live market data</h2>
        <span className="flex items-center gap-1 rounded bg-red-500/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-red-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
          Live
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TEASER_ORDER.map((label) => {
          const item = byLabel.get(label);
          return (
            <TeaserCard
              key={label}
              name={TEASER_NAMES[label]}
              price={item?.price ?? null}
              percentChange={item?.percentChange ?? null}
              stale={item?.stale ?? false}
            />
          );
        })}
      </div>
    </RevealOnScroll>
  );
}

// ---------------------------------------------------------------------
// Daily Briefing — AI-generated, once-a-day fuller market overview
// ---------------------------------------------------------------------

// This only needs to catch "a new day has started server-side" rather
// than track anything live — /api/daily-briefing itself only regenerates
// once per UTC calendar day (see that route's cache-key comment), so a
// 30-minute poll is plenty to pick up the new day's briefing shortly
// after it rolls over without polling pointlessly often.
const DAILY_BRIEFING_POLL_INTERVAL_MS = 30 * 60_000;

interface DailyBriefingData {
  overnightNews: string | null;
  todaysCatalysts: string | null;
  sectorWatch: string | null;
  generatedAt: string | null;
  available: boolean;
}

function DailyBriefingSection() {
  const [data, setData] = useState<DailyBriefingData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/daily-briefing");
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
    const id = setInterval(load, DAILY_BRIEFING_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const isReady = data?.available && data.overnightNews && data.todaysCatalysts && data.sectorWatch;

  return (
    <RevealOnScroll className="flex w-full flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sunrise size={20} className="text-amber-400" />
        <h2 className="text-2xl font-bold text-white">Today&apos;s Market Briefing</h2>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6">
        {isReady ? (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
                  Overnight News
                </h3>
                <p className="text-sm leading-relaxed text-white/80">{data.overnightNews}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
                  Today&apos;s Catalysts
                </h3>
                <p className="text-sm leading-relaxed text-white/80">{data.todaysCatalysts}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
                  Sector Watch
                </h3>
                <p className="text-sm leading-relaxed text-white/80">{data.sectorWatch}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-xs text-white/40">
              <span>
                Last updated {data.generatedAt ? formatRelativeTime(data.generatedAt) : "recently"}
              </span>
              <span>AI-generated analysis based on available market data — not financial advice.</span>
            </div>
          </div>
        ) : error || data?.available === false ? (
          <p className="text-sm text-white/50">
            Today&apos;s briefing is temporarily unavailable — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-full animate-pulse rounded bg-white/10" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-white/10" />
              </div>
            ))}
          </div>
        )}
      </div>
    </RevealOnScroll>
  );
}

// ---------------------------------------------------------------------
// Market Pulse — AI-generated "why is the market moving" explanation
// ---------------------------------------------------------------------

const MARKET_PULSE_POLL_INTERVAL_MS = 5 * 60_000;

interface MarketPulseData {
  explanation: string | null;
  generatedAt: string | null;
  available: boolean;
}

function formatRelativeTime(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}

function MarketPulseSection() {
  const [data, setData] = useState<MarketPulseData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/market-pulse");
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
    const id = setInterval(load, MARKET_PULSE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <RevealOnScroll className="flex w-full flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sparkles size={20} className="text-indigo-400" />
        <h2 className="text-2xl font-bold text-white">Why is the market moving?</h2>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6">
        {data?.available && data.explanation ? (
          <div className="flex flex-col gap-4">
            <p className="text-base leading-relaxed text-white/80">{data.explanation}</p>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-white/40">
              <span>
                Last updated {data.generatedAt ? formatRelativeTime(data.generatedAt) : "recently"}
              </span>
              <span>AI-generated analysis based on available market data — not financial advice.</span>
            </div>
          </div>
        ) : error || data?.available === false ? (
          <p className="text-sm text-white/50">
            Market Pulse is temporarily unavailable — check back soon.
          </p>
        ) : (
          <div className="flex flex-col gap-2" aria-hidden="true">
            <div className="h-4 w-full animate-pulse rounded bg-white/10" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
          </div>
        )}
      </div>
    </RevealOnScroll>
  );
}

// ---------------------------------------------------------------------
// SPY Drivers — pure-calculation contribution breakdown (no AI)
// ---------------------------------------------------------------------

// Quote-freshness-bound, same as the API route's own cache — no reason
// to poll more often than the underlying numbers can actually change.
const SPY_DRIVERS_POLL_INTERVAL_MS = 60_000;

interface DriverEntry {
  symbol: string;
  name: string;
  percentChange: number | null;
  weight: number;
  contribution: number | null;
}

interface SpyDriversData {
  spyPercentChange: number | null;
  drivers: DriverEntry[];
  restOfIndexContribution: number | null;
  weightsAsOf: string;
  generatedAt: string;
}

interface DriverRow {
  key: string;
  label: string;
  sublabel?: string;
  value: number | null;
  emphasis?: "total" | "residual";
}

function DriverBar({ row, maxAbs }: { row: DriverRow; maxAbs: number }) {
  const hasValue = row.value !== null;
  const isUp = hasValue && row.value! > 0;
  const isDown = hasValue && row.value! < 0;
  const widthPercent = hasValue ? Math.min(50, (Math.abs(row.value!) / maxAbs) * 50) : 0;

  return (
    <div
      className={`grid grid-cols-[minmax(0,110px)_1fr_72px] items-center gap-3 rounded px-2 py-1.5 ${
        row.emphasis === "total" ? "bg-white/[0.04]" : ""
      }`}
    >
      <div className="min-w-0 truncate">
        <span className={`text-xs font-medium ${row.emphasis ? "text-white/90" : "text-white/70"}`}>
          {row.label}
        </span>
        {row.sublabel && <span className="ml-1 text-[10px] text-white/40">{row.sublabel}</span>}
      </div>

      <div className="relative h-4 w-full">
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/15" />
        {hasValue && (
          <div
            className={`absolute inset-y-0 rounded-sm ${isUp ? "bg-green-500" : isDown ? "bg-red-500" : "bg-white/20"} ${
              row.value! >= 0 ? "left-1/2" : "right-1/2"
            }`}
            style={{ width: `${widthPercent}%` }}
          />
        )}
      </div>

      <span
        className={`text-right text-xs font-semibold tabular-nums ${
          isUp ? "text-green-500" : isDown ? "text-red-500" : "text-white/40"
        }`}
      >
        {hasValue ? `${row.value! >= 0 ? "+" : ""}${row.value!.toFixed(2)}pp` : "—"}
      </span>
    </div>
  );
}

function SpyDriversSection() {
  const [data, setData] = useState<SpyDriversData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/spy-drivers");
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
    const id = setInterval(load, SPY_DRIVERS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const rows: DriverRow[] | null = data
    ? [
        {
          key: "total",
          label: "SPY (Total)",
          value: data.spyPercentChange,
          emphasis: "total",
        },
        ...data.drivers.map((driver) => ({
          key: driver.symbol,
          label: driver.symbol,
          sublabel: driver.name,
          value: driver.contribution,
        })),
        {
          key: "rest",
          label: "Rest of S&P 500",
          sublabel: "~493 other stocks",
          value: data.restOfIndexContribution,
          emphasis: "residual" as const,
        },
      ]
    : null;

  const maxAbs = rows
    ? Math.max(
        0.01,
        ...rows.map((row) => (row.value !== null ? Math.abs(row.value) : 0))
      )
    : 0.01;

  return (
    <RevealOnScroll className="flex w-full flex-col gap-4">
      <div className="flex items-center gap-2">
        <BarChart3 size={20} className="text-sky-400" />
        <h2 className="text-2xl font-bold text-white">What&apos;s Driving SPY Today</h2>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6">
        {rows ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              {rows.map((row) => (
                <DriverBar key={row.key} row={row} maxAbs={maxAbs} />
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-xs text-white/40">
              <span>
                Contribution ≈ each stock&apos;s % change × its approximate index
                weight ({data!.weightsAsOf}) — calculated directly from live prices, no AI involved.
              </span>
              <span>For informational purposes only — not investment advice.</span>
            </div>
          </div>
        ) : error ? (
          <p className="text-sm text-white/50">
            SPY driver data is temporarily unavailable — check back soon.
          </p>
        ) : (
          <div className="flex flex-col gap-2" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 w-full animate-pulse rounded bg-white/10" />
            ))}
          </div>
        )}
      </div>
    </RevealOnScroll>
  );
}

// ---------------------------------------------------------------------
// Sector Rotation Heatmap — sector ETF performance as a capital-flow proxy
// ---------------------------------------------------------------------

// Matches the API route's own cache TTL as a ceiling — no reason to poll
// more often than the underlying numbers can actually change.
const SECTOR_HEATMAP_POLL_INTERVAL_MS = 5 * 60_000;

type SectorTimeframe = "oneDay" | "oneWeek" | "oneMonth";

const TIMEFRAME_OPTIONS: Array<{ key: SectorTimeframe; label: string }> = [
  { key: "oneDay", label: "1D" },
  { key: "oneWeek", label: "1W" },
  { key: "oneMonth", label: "1M" },
];

interface SectorPerformance {
  symbol: string;
  name: string;
  oneDay: number | null;
  oneWeek: number | null;
  oneMonth: number | null;
}

interface SectorHeatmapData {
  sectors: SectorPerformance[];
  interpretation: string | null;
  generatedAt: string;
}

// Green/red base (matching this app's established up/down convention
// everywhere else) with alpha scaled to the move's magnitude relative to
// the biggest mover currently on screen — the classic heatmap read:
// pale tint for a small move, a strong saturated fill for the day's
// biggest mover, direction from hue.
function heatCellStyle(value: number | null, maxAbs: number): CSSProperties {
  if (value === null) return { backgroundColor: "rgba(255,255,255,0.04)" };
  const intensity = maxAbs > 0 ? Math.min(1, Math.abs(value) / maxAbs) : 0;
  const alpha = 0.18 + intensity * 0.62;
  const [r, g, b] = value >= 0 ? [34, 197, 94] : [239, 68, 68];
  return { backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})` };
}

function SectorHeatmapSection() {
  const [data, setData] = useState<SectorHeatmapData | null>(null);
  const [error, setError] = useState(false);
  const [timeframe, setTimeframe] = useState<SectorTimeframe>("oneDay");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/sector-heatmap");
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
    const id = setInterval(load, SECTOR_HEATMAP_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const sectors = data?.sectors ?? null;
  const maxAbs = sectors
    ? Math.max(
        0.01,
        ...sectors.map((s) => (s[timeframe] !== null ? Math.abs(s[timeframe]!) : 0))
      )
    : 0.01;

  // Ranked biggest-mover-first within the grid, same reasoning as the
  // SPY drivers bars above — the point of a heatmap is spotting the
  // extremes quickly, not scanning alphabetically.
  const ranked = sectors
    ? [...sectors].sort(
        (a, b) => Math.abs(b[timeframe] ?? 0) - Math.abs(a[timeframe] ?? 0)
      )
    : null;

  return (
    <RevealOnScroll className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Grid3x3 size={20} className="text-violet-400" />
          <h2 className="text-2xl font-bold text-white">Sector Rotation</h2>
        </div>
        <div className="flex gap-1">
          {TIMEFRAME_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setTimeframe(option.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                timeframe === option.key
                  ? "bg-white/15 text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6">
        {ranked ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {ranked.map((sector) => {
                const value = sector[timeframe];
                return (
                  <div
                    key={sector.symbol}
                    className="flex flex-col gap-1 rounded-md p-3 transition-all duration-300"
                    style={heatCellStyle(value, maxAbs)}
                  >
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-xs font-semibold text-white">{sector.symbol}</span>
                      <span className="text-sm font-bold tabular-nums text-white">
                        {value !== null ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` : "—"}
                      </span>
                    </div>
                    <span className="truncate text-[11px] text-white/70">{sector.name}</span>
                  </div>
                );
              })}
            </div>

            {data?.interpretation && (
              <p className="rounded-md bg-white/[0.03] px-3 py-2 text-sm italic text-white/70">
                {data.interpretation}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-xs text-white/40">
              <span>Sector ETF performance as a capital-flow proxy — not a direct measure of fund flows.</span>
              <span>AI-generated interpretation based on today&apos;s data — not financial advice.</span>
            </div>
          </div>
        ) : error ? (
          <p className="text-sm text-white/50">
            Sector data is temporarily unavailable — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="h-16 w-full animate-pulse rounded-md bg-white/10" />
            ))}
          </div>
        )}
      </div>
    </RevealOnScroll>
  );
}

// ---------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------

function Footer() {
  return (
    <RevealOnScroll className="flex w-full flex-col items-center gap-1 border-t border-white/10 px-8 py-10 text-center">
      <span className="font-semibold text-white">Noble</span>
      <p className="text-xs text-white/40">Your one-stop shop for financial information.</p>
    </RevealOnScroll>
  );
}

// ---------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------

// Public teaser, personalized once signed in — the watchlist fetch here is
// the ONLY thing gated on auth status; every other section below renders
// the same real data for every visitor, no login wall anywhere on the page.
// Fetched once here and passed down (mirroring app/earnings/page.tsx's own
// "fetch once, pass down" watchlistSymbols pattern) rather than each
// section independently re-fetching /api/watchlist.
function useWatchlistSymbols(): Set<string> {
  const { status } = useSession();
  const [symbols, setSymbols] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (status !== "authenticated") {
        if (!cancelled) setSymbols(new Set());
        return;
      }
      try {
        const response = await fetch("/api/watchlist");
        const body = await response.json().catch(() => null);
        if (cancelled) return;
        const items: Array<{ symbol: string; assetType?: string }> = Array.isArray(body?.items) ? body.items : [];
        setSymbols(new Set(items.filter((item) => (item.assetType ?? "stock") === "stock").map((item) => item.symbol)));
      } catch {
        if (!cancelled) setSymbols(new Set());
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [status]);

  return symbols;
}

interface DigestConfigState {
  sectionOrder: SectionKey[] | null;
  sectorCardsSectors: CatalogSector[] | null;
}

// Signed-out visitors always get null/null (the full default layout) — this
// hook only ever fetches for a signed-in user, mirroring
// useWatchlistSymbols's own fetch-once-on-auth pattern above.
function useDashboardConfig(): [DigestConfigState, (next: DigestConfigState) => void] {
  const { status } = useSession();
  const [config, setConfig] = useState<DigestConfigState>({ sectionOrder: null, sectorCardsSectors: null });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (status !== "authenticated") {
        if (!cancelled) setConfig({ sectionOrder: null, sectorCardsSectors: null });
        return;
      }
      try {
        const response = await fetch("/api/dashboard-config");
        const body = await response.json().catch(() => null);
        if (cancelled) return;
        const sectionOrder: SectionKey[] | null = Array.isArray(body?.sectionOrder)
          ? body.sectionOrder.filter(isSectionKey)
          : null;
        setConfig({
          sectionOrder: sectionOrder && sectionOrder.length > 0 ? sectionOrder : null,
          sectorCardsSectors: Array.isArray(body?.sectorCardsSectors) ? body.sectorCardsSectors : null,
        });
      } catch {
        if (!cancelled) setConfig({ sectionOrder: null, sectorCardsSectors: null });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [status]);

  return [config, setConfig];
}

function renderDigestSection(
  key: SectionKey,
  watchlistSymbols: Set<string>,
  selectedSectors: CatalogSector[] | null
) {
  switch (key) {
    case "watchlist":
      return <WatchlistDigestSection symbols={watchlistSymbols} />;
    case "sectorCards":
      return <SectorCompanyCards watchlistSymbols={watchlistSymbols} selectedSectors={selectedSectors ?? undefined} />;
    case "news":
      return <NewsDigestSection />;
    case "earnings":
      return <EarningsDigestSection watchlistSymbols={watchlistSymbols} />;
    case "movers":
      return <MoversDigestSection watchlistSymbols={watchlistSymbols} />;
    case "insiderActivity":
      return <InsiderActivityDigestSection />;
  }
}

export default function MarketDigestHome() {
  const { status } = useSession();
  const watchlistSymbols = useWatchlistSymbols();
  const [digestConfig, setDigestConfig] = useDashboardConfig();

  const isSignedIn = status === "authenticated";
  const effectiveOrder = isSignedIn && digestConfig.sectionOrder ? digestConfig.sectionOrder : [...DEFAULT_SECTION_ORDER];
  const effectiveSelectedSectors = isSignedIn ? digestConfig.sectorCardsSectors : null;

  return (
    <main className="flex flex-1 flex-col items-center gap-20 bg-neutral-950 pb-16">
      <Hero />
      <div className="flex w-full max-w-6xl flex-col gap-20 px-8">
        {isSignedIn && (
          <div className="flex justify-end">
            <DashboardConfigButton
              currentSectionOrder={digestConfig.sectionOrder}
              currentSelectedSectors={digestConfig.sectorCardsSectors}
              onSaved={(result: DashboardConfigResult) =>
                setDigestConfig({ sectionOrder: result.sectionOrder, sectorCardsSectors: result.sectorCardsSectors })
              }
              onReset={() => setDigestConfig({ sectionOrder: null, sectorCardsSectors: null })}
            />
          </div>
        )}

        {effectiveOrder.map((key) => (
          <div key={key}>{renderDigestSection(key, watchlistSymbols, effectiveSelectedSectors)}</div>
        ))}

        <DailyBriefingSection />
        <MarketPulseSection />
        <SpyDriversSection />
        <SectorHeatmapSection />
        <FeaturesSection />
        <LiveDataTeaser />
      </div>
      <Footer />
    </main>
  );
}
