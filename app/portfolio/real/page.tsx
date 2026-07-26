"use client";

// The manual real-holdings tracker (ticker/shares/cost-basis/purchase-date
// entry) — relocated here, unchanged, when /portfolio became Simulated-only.
// Kept fully intact and working at this URL rather than deleted, in case
// it's reintroduced into the main navigation later; nothing currently
// links to this route.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Pencil, X } from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import NumberField from "@/components/tools/NumberField";

const CARD_EXIT_DURATION_MS = 300;

const PIE_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#ec4899",
  "#84cc16",
];

interface Holding {
  id: string;
  symbol: string;
  shares: number;
  costBasis: number;
  purchaseDate: string;
  price: number | null;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatChange(change: number): string {
  const formatted = currencyFormatter.format(Math.abs(change));
  return `${change >= 0 ? "+" : "-"}${formatted}`;
}

const inputClassName =
  "w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/30";

// ---------------------------------------------------------------------
// Add holding
// ---------------------------------------------------------------------

function AddHoldingForm({ onAdded }: { onAdded: (holding: Holding) => void }) {
  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [costBasis, setCostBasis] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.trim().toUpperCase(),
          shares: Number(shares),
          costBasis: Number(costBasis),
          purchaseDate,
        }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(body?.error ?? "Failed to add holding.");
        return;
      }

      onAdded({ ...body.holding, price: null });
      setSymbol("");
      setShares("");
      setCostBasis("");
      setPurchaseDate("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-md border border-black/10 p-4 dark:border-white/15"
    >
      <h2 className="text-lg font-semibold text-foreground">Add Holding</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Ticker</span>
          <input
            required
            value={symbol}
            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
            placeholder="AAPL"
            className={inputClassName}
          />
        </label>
        <NumberField label="Shares" value={shares} onChange={setShares} placeholder="10" />
        <NumberField
          label="Cost Basis / Share"
          value={costBasis}
          onChange={setCostBasis}
          prefix="$"
          placeholder="150.00"
        />
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Purchase Date</span>
          <input
            required
            type="date"
            value={purchaseDate}
            onChange={(event) => setPurchaseDate(event.target.value)}
            className={inputClassName}
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Adding…" : "Add Holding"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------
// Holding card
// ---------------------------------------------------------------------

function HoldingCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-black/10 p-4 dark:border-white/15">
      <div className="flex flex-col gap-1.5">
        <div className="h-4 w-20 animate-pulse rounded bg-foreground/10" />
        <div className="h-3 w-32 animate-pulse rounded bg-foreground/10" />
      </div>
      <div className="h-5 w-28 animate-pulse rounded bg-foreground/10" />
    </div>
  );
}

function HoldingCard({
  holding,
  removing,
  onRemove,
  onUpdated,
}: {
  holding: Holding;
  removing: boolean;
  onRemove: () => void;
  onUpdated: (holding: Holding) => void;
}) {
  // Same mount-triggered fade/scale-in as WatchlistCard — see that
  // component for why this is deferred via setTimeout(0) rather than set
  // synchronously in the effect body.
  const [entered, setEntered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editShares, setEditShares] = useState(String(holding.shares));
  const [editCostBasis, setEditCostBasis] = useState(String(holding.costBasis));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setEntered(true), 0);
    return () => clearTimeout(id);
  }, []);

  const hasPrice = holding.price != null;
  const value = hasPrice ? holding.shares * holding.price! : null;
  const costTotal = holding.shares * holding.costBasis;
  const gainLoss = value != null ? value - costTotal : null;
  const gainLossPercent = value != null && costTotal > 0 ? (gainLoss! / costTotal) * 100 : null;
  const isUp = gainLoss != null && gainLoss > 0;
  const isDown = gainLoss != null && gainLoss < 0;
  const settled = entered && !removing;

  async function handleSave() {
    setSaveError(null);
    const sharesNum = Number(editShares);
    const costBasisNum = Number(editCostBasis);

    if (!Number.isFinite(sharesNum) || sharesNum <= 0) {
      setSaveError("Shares must be a positive number.");
      return;
    }
    if (!Number.isFinite(costBasisNum) || costBasisNum < 0) {
      setSaveError("Cost basis must be a non-negative number.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/portfolio/${holding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shares: sharesNum, costBasis: costBasisNum }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setSaveError(body?.error ?? "Failed to update holding.");
        return;
      }

      onUpdated({ ...holding, ...body.holding });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-md border border-black/10 p-4 transition-all duration-300 ease-out dark:border-white/15 ${
        settled ? "scale-100 opacity-100" : "scale-95 opacity-0"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-foreground">{holding.symbol}</h3>
          <p className="text-xs text-foreground/50">
            {holding.shares} shares @ {currencyFormatter.format(holding.costBasis)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            aria-label={`Edit ${holding.symbol}`}
            className="rounded-md border border-black/10 p-1 text-foreground/40 transition-colors hover:text-foreground dark:border-white/15"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${holding.symbol}`}
            className="rounded-md border border-black/10 p-1 text-foreground/40 transition-colors hover:text-foreground dark:border-white/15"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <NumberField label="Shares" value={editShares} onChange={setEditShares} />
          <NumberField label="Cost Basis / Share" value={editCostBasis} onChange={setEditCostBasis} prefix="$" />
          {saveError && <p className="text-xs text-red-500">{saveError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-black/10 px-3 py-1.5 text-xs text-foreground/60 hover:text-foreground dark:border-white/15"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          <span className="text-lg font-semibold text-foreground">
            {hasPrice ? currencyFormatter.format(value!) : "—"}
          </span>
          {gainLoss != null && (
            <span
              className={`text-xs font-medium ${
                isUp ? "text-green-500" : isDown ? "text-red-500" : "text-foreground/50"
              }`}
            >
              {isUp ? "▲" : isDown ? "▼" : ""} {formatChange(gainLoss)} (
              {gainLossPercent! >= 0 ? "+" : ""}
              {gainLossPercent!.toFixed(2)}%)
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------

export default function RealPortfolioPage() {
  const { status } = useSession();
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const removalTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timeouts = removalTimeoutsRef.current;
    return () => {
      timeouts.forEach((id) => clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    async function load() {
      try {
        const listResponse = await fetch("/api/portfolio");
        const listBody = await listResponse.json().catch(() => null);

        if (!listResponse.ok || cancelled) {
          if (!cancelled) setError("Failed to load your portfolio");
          return;
        }

        const raw: Array<{
          id: string;
          symbol: string;
          shares: number;
          costBasis: number;
          purchaseDate: string;
        }> = Array.isArray(listBody.holdings) ? listBody.holdings : [];

        const enriched = await Promise.all(
          raw.map(async (holding) => {
            const quoteResponse = await fetch(
              `/api/stock?ticker=${encodeURIComponent(holding.symbol)}`
            ).catch(() => null);
            const quote =
              quoteResponse && quoteResponse.ok ? await quoteResponse.json().catch(() => null) : null;
            return { ...holding, price: quote?.close ?? null };
          })
        );

        if (!cancelled) setHoldings(enriched);
      } catch {
        if (!cancelled) setError("Failed to load your portfolio");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [status]);

  function handleAdded(newHolding: Holding) {
    setHoldings((prev) => (prev ? [newHolding, ...prev] : [newHolding]));

    fetch(`/api/stock?ticker=${encodeURIComponent(newHolding.symbol)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((quote) => {
        if (!quote) return;
        setHoldings((prev) =>
          prev
            ? prev.map((holding) =>
                holding.id === newHolding.id ? { ...holding, price: quote.close } : holding
              )
            : prev
        );
      })
      .catch(() => {});
  }

  function handleUpdated(updated: Holding) {
    setHoldings((prev) =>
      prev ? prev.map((holding) => (holding.id === updated.id ? { ...holding, ...updated } : holding)) : prev
    );
  }

  function handleRemove(id: string) {
    setRemovingIds((prev) => new Set(prev).add(id));
    fetch(`/api/portfolio/${id}`, { method: "DELETE" }).catch(() => {});

    const timeoutId = setTimeout(() => {
      setHoldings((prev) => (prev ? prev.filter((holding) => holding.id !== id) : prev));
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      removalTimeoutsRef.current.delete(id);
    }, CARD_EXIT_DURATION_MS);

    removalTimeoutsRef.current.set(id, timeoutId);
  }

  const totalValue =
    holdings?.reduce((sum, h) => sum + (h.price != null ? h.shares * h.price : 0), 0) ?? 0;
  const totalCost = holdings?.reduce((sum, h) => sum + h.shares * h.costBasis, 0) ?? 0;
  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
  const hasAnyPrice = holdings?.some((h) => h.price != null) ?? false;
  const isTotalUp = hasAnyPrice && totalGainLoss > 0;
  const isTotalDown = hasAnyPrice && totalGainLoss < 0;

  const allocationData = (holdings ?? [])
    .filter((h) => h.price != null)
    .map((h) => ({ name: h.symbol, value: h.shares * h.price! }));

  if (status === "loading") {
    return (
      <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
        <h1 className="text-3xl font-bold text-foreground">Portfolio</h1>
      </main>
    );
  }

  if (status !== "authenticated") {
    return (
      <main className="flex flex-1 flex-col items-center gap-4 p-8 pt-16 text-center">
        <h1 className="text-3xl font-bold text-foreground">Portfolio</h1>
        <p className="text-foreground/60">Sign in to track your holdings here.</p>
        <Link
          href="/login"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Sign In
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <h1 className="text-3xl font-bold text-foreground">Portfolio</h1>

      <div className="flex w-full max-w-5xl flex-col gap-8">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1 rounded-md border border-black/10 p-4 dark:border-white/15">
            <span className="text-xs text-foreground/50">Total Value</span>
            <p className="text-2xl font-bold text-foreground">
              {hasAnyPrice ? currencyFormatter.format(totalValue) : "—"}
            </p>
          </div>
          <div className="flex flex-col gap-1 rounded-md border border-black/10 p-4 dark:border-white/15">
            <span className="text-xs text-foreground/50">Total Gain/Loss</span>
            <p
              className={`text-2xl font-bold ${
                isTotalUp ? "text-green-500" : isTotalDown ? "text-red-500" : "text-foreground"
              }`}
            >
              {hasAnyPrice ? formatChange(totalGainLoss) : "—"}
            </p>
            {hasAnyPrice && (
              <span
                className={`text-xs font-medium ${
                  isTotalUp ? "text-green-500" : isTotalDown ? "text-red-500" : "text-foreground/50"
                }`}
              >
                {isTotalUp ? "▲" : isTotalDown ? "▼" : ""} {totalGainLossPercent >= 0 ? "+" : ""}
                {totalGainLossPercent.toFixed(2)}%
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1 rounded-md border border-black/10 p-4 dark:border-white/15">
            <span className="text-xs text-foreground/50">Holdings</span>
            <p className="text-2xl font-bold text-foreground">{holdings?.length ?? 0}</p>
          </div>
        </section>

        {allocationData.length > 0 && (
          <section className="rounded-md border border-black/10 p-4 dark:border-white/15">
            <h2 className="mb-3 text-lg font-semibold text-foreground">Allocation</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => currencyFormatter.format(Number(value))}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        <AddHoldingForm onAdded={handleAdded} />

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {holdings === null &&
            !error &&
            Array.from({ length: 3 }).map((_, i) => <HoldingCardSkeleton key={i} />)}

          {error && <p className="col-span-full text-sm text-red-500">{error}</p>}

          {holdings !== null && holdings.length === 0 && !error && (
            <p className="col-span-full text-sm text-foreground/60">
              No holdings yet — add one above to get started.
            </p>
          )}

          {holdings?.map((holding) => (
            <HoldingCard
              key={holding.id}
              holding={holding}
              removing={removingIds.has(holding.id)}
              onRemove={() => handleRemove(holding.id)}
              onUpdated={handleUpdated}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
