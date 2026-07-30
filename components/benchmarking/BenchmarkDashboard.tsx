"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, FileText } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import MiniLineChart from "@/components/MiniLineChart";
import { PercentChangeBadge } from "@/components/PriceChart";
import BenchmarkBrandHeader from "@/components/benchmarking/BenchmarkBrandHeader";

interface OrganizationInfo {
  id: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
}

interface MetricValues {
  revenueGrowth: number | null;
  grossMargin: number | null;
  fcfYield: number | null;
  forwardPE: number | null;
  evEbitda: number | null;
  roe: number | null;
}

interface DashboardTicker {
  ticker: string;
  isOwnCompany: boolean;
  latest: MetricValues | null;
  series: Array<MetricValues & { asOfDate: string }>;
}

type MetricKey = keyof MetricValues;

const METRIC_DEFS: Array<{ key: MetricKey; label: string; format: (v: number) => string; best: "min" | "max" }> = [
  { key: "revenueGrowth", label: "Revenue Growth", format: (v) => `${v.toFixed(1)}%`, best: "max" },
  { key: "grossMargin", label: "Gross Margin", format: (v) => `${v.toFixed(1)}%`, best: "max" },
  { key: "fcfYield", label: "FCF Yield", format: (v) => `${v.toFixed(1)}%`, best: "max" },
  { key: "forwardPE", label: "Forward P/E", format: (v) => v.toFixed(2), best: "min" },
  { key: "evEbitda", label: "EV/EBITDA", format: (v) => v.toFixed(2), best: "min" },
  { key: "roe", label: "ROE", format: (v) => `${v.toFixed(1)}%`, best: "max" },
];

// Mirrors components/stocks/PeerComparisonCard.tsx's computeBest() — finds
// the min/max value across tickers for one metric, skipping nulls.
function computeBest(tickers: DashboardTicker[], key: MetricKey, best: "min" | "max"): number | null {
  const values = tickers.map((t) => t.latest?.[key]).filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return best === "max" ? Math.max(...values) : Math.min(...values);
}

// Builds one point per CALENDAR day across the series' own date range (not
// just per stored row) so a day with no snapshot row at all — a cron miss,
// not merely a field that failed to fetch that day — becomes an explicit
// gap too, same as a day whose row exists but has this metric null. Passed
// straight to MiniLineChart's own whitespace-point handling, which breaks
// the line at any null rather than silently connecting across it.
function buildGapAwareSeries(series: Array<MetricValues & { asOfDate: string }>, key: MetricKey): { time: number; value: number | null }[] {
  if (series.length === 0) return [];

  const byDate = new Map(series.map((s) => [s.asOfDate.slice(0, 10), s[key]]));
  const sortedDates = [...byDate.keys()].sort();
  const start = new Date(sortedDates[0] + "T00:00:00Z");
  const end = new Date(sortedDates[sortedDates.length - 1] + "T00:00:00Z");

  const points: { time: number; value: number | null }[] = [];
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const dateKey = d.toISOString().slice(0, 10);
    points.push({ time: Math.floor(d.getTime() / 1000), value: byDate.get(dateKey) ?? null });
  }
  return points;
}

interface BenchmarkDashboardProps {
  organization: OrganizationInfo;
  peerSet: { ownCompanyTicker: string | null; peers: string[] };
  onEditPeerSet: () => void;
}

export default function BenchmarkDashboard({ organization, peerSet, onEditPeerSet }: BenchmarkDashboardProps) {
  const [tickers, setTickers] = useState<DashboardTicker[] | null>(null);
  const [exportingPng, setExportingPng] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch("/api/benchmarking/dashboard");
      const body = await res.json().catch(() => null);
      if (!cancelled && res.ok) setTickers(body?.tickers ?? []);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [peerSet]);

  // Mirrors components/learning/CertificateView.tsx's handleDownload
  // exactly: toPng(ref, {pixelRatio:2}) -> synthetic <a download> link.
  // Rasterizes the LIVE dashboard DOM, so the real MiniLineChart trend
  // lines and the branding header are captured as real pixels.
  async function handleExportPng() {
    if (!containerRef.current || exportingPng) return;
    setExportingPng(true);
    try {
      const dataUrl = await toPng(containerRef.current, { pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = "peer-benchmarking-dashboard.png";
      link.href = dataUrl;
      link.click();
    } catch {
      // Swallow — the dashboard is still visible on-screen even if export fails.
    } finally {
      setExportingPng(false);
    }
  }

  if (!tickers) {
    return <div className="h-24 w-full max-w-5xl animate-pulse rounded-md bg-foreground/10" />;
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <a
            href="/api/benchmarking/export/pdf?download=1"
            className="flex items-center gap-1.5 rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium text-foreground/70 hover:text-foreground dark:border-white/15"
          >
            <FileText size={13} /> Export PDF
          </a>
          <button
            type="button"
            onClick={handleExportPng}
            disabled={exportingPng}
            className="flex items-center gap-1.5 rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium text-foreground/70 hover:text-foreground disabled:opacity-50 dark:border-white/15"
          >
            <Download size={13} /> {exportingPng ? "Preparing…" : "Export PNG"}
          </button>
        </div>
        <button
          type="button"
          onClick={onEditPeerSet}
          className="rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium text-foreground/70 hover:text-foreground dark:border-white/15"
        >
          Edit peer set
        </button>
      </div>

      {/* Everything export-relevant lives inside this ref'd container —
          the PNG capture target. */}
      <div ref={containerRef} className="flex flex-col gap-6 bg-background p-2">
        <BenchmarkBrandHeader name={organization.name} logoUrl={organization.logoUrl} brandColor={organization.brandColor} />

        {tickers.length === 0 ? (
          <p className="rounded-md bg-foreground/5 px-3 py-2 text-xs text-foreground/50">No tickers configured yet.</p>
        ) : (
          <>
            <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
              <h2 className="text-lg font-semibold text-foreground">Current Comparison</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-sm">
                  <thead>
                    <tr className="border-b border-black/10 text-xs text-foreground/50 dark:border-white/15">
                      <th className="p-2 text-left">Metric</th>
                      {tickers.map((t) => (
                        <th
                          key={t.ticker}
                          className={`p-2 text-right ${t.isOwnCompany ? "text-indigo-400" : ""}`}
                        >
                          {t.ticker}
                          {t.isOwnCompany && <span className="ml-1 text-[10px] text-foreground/40">(Own)</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {METRIC_DEFS.map((def) => {
                      const best = computeBest(tickers, def.key, def.best);
                      return (
                        <tr key={def.key} className="border-t border-black/5 dark:border-white/10">
                          <td className="p-2 text-foreground/70">{def.label}</td>
                          {tickers.map((t) => {
                            const value = t.latest?.[def.key] ?? null;
                            const isBest = value != null && best != null && value === best;
                            return (
                              <td
                                key={t.ticker}
                                className={`p-2 text-right ${
                                  isBest ? "font-semibold text-green-500 drop-shadow-[0_0_6px_rgba(34,197,94,0.35)]" : "text-foreground"
                                }`}
                              >
                                {value != null ? def.format(value) : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {METRIC_DEFS.map((def) => (
              <section key={def.key} className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
                <h2 className="text-lg font-semibold text-foreground">{def.label} Trend</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {tickers.map((t) => {
                    const points = buildGapAwareSeries(t.series, def.key);
                    const realPoints = points.filter((p): p is { time: number; value: number } => p.value !== null);

                    const first = realPoints[0]?.value;
                    const last = realPoints[realPoints.length - 1]?.value;
                    const lastPointIsGap = points.length > 0 && points[points.length - 1].value === null;
                    // Guard the division, not just the display — a near-zero
                    // starting value (FCF yield hovering around 0%, for
                    // instance) would otherwise produce a meaningless
                    // thousand-percent swing rather than an honestly-omitted
                    // badge, same reasoning as this app's existing
                    // unrealizedGainLossPercent guards.
                    const percentChange = realPoints.length >= 2 && first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;

                    return (
                      <div key={t.ticker} className="flex flex-col gap-1">
                        <span className={`text-xs font-medium ${t.isOwnCompany ? "text-indigo-400" : "text-foreground/70"}`}>
                          {t.ticker}
                          {t.isOwnCompany && " (Own)"}
                        </span>
                        {realPoints.length >= 2 ? (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-foreground/60">
                                {def.format(first)} <span className="text-foreground/40">→</span> {def.format(last)}
                              </span>
                              {percentChange !== null && <PercentChangeBadge value={percentChange} />}
                            </div>
                            {/* Explicit staleness disclosure — the line itself already
                                breaks at a gap (MiniLineChart's whitespace points), but
                                a gap on today's own date specifically means the "last"
                                value above isn't current, which the chart alone doesn't say. */}
                            {lastPointIsGap && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                Latest data unavailable — showing the most recent successful update.
                              </p>
                            )}
                            <MiniLineChart data={points} height={48} showTimeAxis />
                          </>
                        ) : (
                          <p className="text-[11px] text-foreground/40">Not enough history yet.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
