"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import { NOTIONAL_BASE, WEIGHT_SUM_EPSILON } from "@/lib/modelPortfolios/constants";
import SimulatedPerformanceChart from "@/components/portfolio/SimulatedPerformanceChart";
import ModelPortfolioHoldingsEditor, { type HoldingRow } from "@/components/modelPortfolios/ModelPortfolioHoldingsEditor";
import ShareLinkPanel from "@/components/modelPortfolios/ShareLinkPanel";
import ModelPortfolioDisclaimer from "@/components/modelPortfolios/ModelPortfolioDisclaimer";

interface HoldingOut {
  id: string;
  assetType: string;
  symbol: string;
  name: string | null;
  targetWeightPercent: number;
  priceAtCreation: number;
  currentPrice: number | null;
  priceUnavailable: boolean;
}

interface Detail {
  modelPortfolio: { id: string; name: string; createdAt: string; updatedAt: string };
  holdings: HoldingOut[];
  totalValue: number;
  // Null when this portfolio predates chain-linked weight-history tracking
  // — its old since-inception return was computed under a formula a weight
  // edit could retroactively rewrite, so it's suppressed rather than shown
  // with a caveat (see lib/modelPortfolios/detail.ts).
  totalReturn: number | null;
  totalReturnPercent: number | null;
  performanceSeries: { date: string; value: number }[];
  trackingStartsAt: string | null;
  shareLink: { token: string; active: boolean } | null;
}

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

export default function ModelPortfolioDetailView({ id }: { id: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRows, setEditRows] = useState<HoldingRow[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  // Bumped after a successful edit or share-link change to re-trigger the
  // effect below — the fetch itself is declared inside the effect body,
  // matching this app's established refreshToken idiom.
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/model-portfolios/${id}`);
      const body = await res.json().catch(() => null);
      if (cancelled) return;
      if (!res.ok) {
        setError(body?.error ?? "Failed to load this model portfolio");
        return;
      }
      setDetail(body);
      setError(null);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, refreshToken]);

  function startEditing() {
    if (!detail) return;
    setEditName(detail.modelPortfolio.name);
    setEditRows(
      detail.holdings.map((h) => ({
        assetType: h.assetType as HoldingRow["assetType"],
        symbol: h.symbol,
        targetWeightPercent: String(h.targetWeightPercent),
      }))
    );
    setEditError(null);
    setEditing(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditError(null);

    if (!editName.trim()) return setEditError("Name is required.");

    const holdings = editRows.map((r) => ({
      assetType: r.assetType,
      symbol: r.symbol.trim().toUpperCase(),
      targetWeightPercent: Number(r.targetWeightPercent),
    }));
    if (holdings.some((h) => !h.symbol || !Number.isFinite(h.targetWeightPercent) || h.targetWeightPercent <= 0)) {
      return setEditError("Every holding needs a symbol and a positive weight.");
    }
    const weightSum = holdings.reduce((s, h) => s + h.targetWeightPercent, 0);
    if (Math.abs(weightSum - 100) > WEIGHT_SUM_EPSILON) {
      return setEditError(`Target weights must sum to 100% (currently ${weightSum.toFixed(2)}%).`);
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/model-portfolios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), holdings }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return setEditError(body?.error ?? "Failed to save");
      setEditing(false);
      setRefreshToken((t) => t + 1);
    } finally {
      setSavingEdit(false);
    }
  }

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center gap-4 p-8 pt-16 text-center">
        <p className="text-sm text-red-500">{error}</p>
        <Link href="/portfolios/models" className="text-sm text-indigo-400 hover:underline">
          Back to Model Portfolios
        </Link>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
        <div className="h-24 w-full max-w-5xl animate-pulse rounded-md bg-foreground/10" />
      </main>
    );
  }

  const { modelPortfolio, holdings, totalValue, totalReturn, totalReturnPercent, performanceSeries, trackingStartsAt, shareLink } = detail;
  const hasReturn = totalReturn !== null;
  const isUp = hasReturn && totalReturn! >= 0;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        <Link href="/portfolios/models" className="flex w-fit items-center gap-1.5 text-sm text-foreground/60 hover:text-foreground">
          <ArrowLeft size={14} /> Back to Model Portfolios
        </Link>

        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-foreground">{modelPortfolio.name}</h1>
          {!editing && (
            <button
              type="button"
              onClick={startEditing}
              className="rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium text-foreground/70 hover:text-foreground dark:border-white/15"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSaveEdit} className={cardClass("indigo", { extra: "flex flex-col gap-3 p-4" })}>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">Name</span>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full max-w-sm rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-400/50 dark:border-white/15 dark:focus:border-blue-400/50"
              />
            </label>

            <ModelPortfolioHoldingsEditor rows={editRows} onChange={setEditRows} />

            {editError && <p className="text-sm text-red-500">{editError}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingEdit}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {savingEdit ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground dark:border-white/15"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-foreground/50">
              Weight changes only affect performance going forward — already-recorded history isn&apos;t
              rewritten.
            </p>
          </form>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-4" })}>
                <span className="text-xs text-foreground/50">Total Value</span>
                <p className="text-xl font-bold text-foreground">{compactCurrencyFormatter.format(totalValue)}</p>
              </div>
              <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-4" })}>
                <span className="text-xs text-foreground/50">Total Return</span>
                {hasReturn ? (
                  <>
                    <p className={`text-xl font-bold ${isUp ? "text-green-500" : "text-red-500"}`}>
                      {isUp ? "+" : ""}
                      {currencyFormatter.format(totalReturn!)}
                    </p>
                    <span className={`text-[11px] ${isUp ? "text-green-500" : "text-red-500"}`}>
                      {isUp ? "+" : ""}
                      {totalReturnPercent!.toFixed(2)}%
                    </span>
                  </>
                ) : (
                  <p className="text-sm font-medium text-foreground/50">
                    Tracking since{" "}
                    {new Date(trackingStartsAt!).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                )}
              </div>
              <div className={cardClass("neutral", { extra: "flex flex-col gap-1 p-4" })}>
                <span className="text-xs text-foreground/50">Created</span>
                <p className="text-xl font-bold text-foreground">
                  {new Date(modelPortfolio.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            </section>

            <SimulatedPerformanceChart
              portfolio={{ createdAt: modelPortfolio.createdAt, startingBalance: NOTIONAL_BASE }}
              performanceSeries={performanceSeries}
              trackingStartsAt={trackingStartsAt}
              totalValue={totalValue}
            />

            <section className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
              <h2 className="text-lg font-semibold text-foreground">Holdings</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-sm">
                  <thead>
                    <tr className="border-b border-black/10 text-xs text-foreground/50 dark:border-white/15">
                      <th className="p-2 text-left">Symbol</th>
                      <th className="p-2 text-right">Target Weight</th>
                      <th className="p-2 text-right">Price at Creation</th>
                      <th className="p-2 text-right">Current Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h) => (
                      <tr key={h.id} className="border-t border-black/5 dark:border-white/10">
                        <td className="p-2 font-medium text-foreground">
                          {h.symbol}
                          {h.name && <span className="ml-1 text-xs text-foreground/50">{h.name}</span>}
                        </td>
                        <td className="p-2 text-right text-foreground/70">{h.targetWeightPercent.toFixed(2)}%</td>
                        <td className="p-2 text-right text-foreground/70">{currencyFormatter.format(h.priceAtCreation)}</td>
                        <td className="p-2 text-right text-foreground">
                          {h.currentPrice != null ? currencyFormatter.format(h.currentPrice) : "—"}
                          {h.priceUnavailable && (
                            <span className="ml-1 text-[10px] text-foreground/40" title="Live price unavailable right now">
                              (est.)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <ShareLinkPanel modelPortfolioId={id} shareLink={shareLink} onChanged={() => setRefreshToken((t) => t + 1)} />

            <ModelPortfolioDisclaimer />
          </>
        )}
      </div>
    </main>
  );
}
