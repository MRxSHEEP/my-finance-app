"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Newspaper,
  TrendingUp,
  Bitcoin,
  Fuel,
  LineChart,
  GraduationCap,
  Calculator,
  type LucideIcon,
} from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";

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
  { label: "Research", href: "/research", icon: LineChart, description: "Deep-dive tools for fundamental and technical analysis." },
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

function TeaserCard({ name, price, percentChange }: { name: string; price: number | null; percentChange: number | null }) {
  const hasData = price != null && percentChange != null;
  const isUp = hasData && percentChange > 0;
  const isDown = hasData && percentChange < 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-6">
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
            />
          );
        })}
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

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-20 bg-neutral-950 pb-16">
      <Hero />
      <div className="flex w-full max-w-6xl flex-col gap-20 px-8">
        <FeaturesSection />
        <LiveDataTeaser />
      </div>
      <Footer />
    </main>
  );
}
