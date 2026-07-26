"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cardClass } from "@/lib/cardStyles";
import { PORTFOLIO_TIERS } from "@/lib/simulatedTrading/tiers";
import SimulatedBadge from "./SimulatedBadge";
import SimulatedTradingDisclaimer from "./SimulatedTradingDisclaimer";

interface PortfolioSummary {
  id: string;
  tier: string;
  startingBalance: number;
  cashBalance: number;
  holdingsCount: number;
  transactionsCount: number;
  createdAt: string;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// The webhook (app/api/webhooks/stripe/route.ts) is what actually creates
// the portfolio, and it can land slightly after Stripe's own redirect back
// to this page — a short bounded poll covers that gap instead of the user
// landing on "checkout succeeded" with no new portfolio yet visible.
const SUCCESS_POLL_ATTEMPTS = 6;
const SUCCESS_POLL_INTERVAL_MS = 1500;

function tierLabel(tierId: string): string {
  return PORTFOLIO_TIERS.find((t) => t.id === tierId)?.label ?? tierId;
}

function PortfolioCard({ portfolio }: { portfolio: PortfolioSummary }) {
  return (
    <Link
      href={`/portfolio/simulated/${portfolio.id}`}
      className={cardClass("indigo", { interactive: true, extra: "flex flex-col gap-2 p-4" })}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">{tierLabel(portfolio.tier)}</span>
        <SimulatedBadge />
      </div>
      <p className="text-xl font-bold text-foreground">{currencyFormatter.format(portfolio.cashBalance)}</p>
      <p className="text-xs text-foreground/50">
        cash of {currencyFormatter.format(portfolio.startingBalance)} starting balance ·{" "}
        {portfolio.holdingsCount} holding{portfolio.holdingsCount === 1 ? "" : "s"}
      </p>
      <p className="text-[11px] text-foreground/40">
        Created {new Date(portfolio.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </p>
    </Link>
  );
}

function TierCard({ tier, onClaim, busy }: { tier: (typeof PORTFOLIO_TIERS)[number]; onClaim: (tierId: string) => void; busy: boolean }) {
  const isFree = tier.priceCents === 0;
  return (
    <div className={cardClass("neutral", { extra: "flex flex-col gap-2 p-4" })}>
      <div className="flex items-center gap-1.5">
        <Image src="/crown(1).webp.webp" alt="" width={14} height={14} style={{ width: "auto", height: "14px" }} />
        <span className="font-semibold text-foreground">{tier.label}</span>
      </div>
      <p className="text-xl font-bold text-foreground">{currencyFormatter.format(tier.startingBalance)}</p>
      <p className="text-xs text-foreground/50">starting balance</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => onClaim(tier.id)}
        className="mt-2 self-start rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "…" : isFree ? "Start free" : `Buy for $${(tier.priceCents / 100).toFixed(2)}`}
      </button>
    </div>
  );
}

export default function SimulatedPortfolioSection() {
  const searchParams = useSearchParams();
  const [portfolios, setPortfolios] = useState<PortfolioSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  async function loadPortfolios(): Promise<PortfolioSummary[]> {
    const response = await fetch("/api/simulated-portfolio");
    const body = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(body?.portfolios)) {
      throw new Error("Failed to load");
    }
    return body.portfolios;
  }

  useEffect(() => {
    let cancelled = false;
    loadPortfolios()
      .then((list) => {
        if (!cancelled) setPortfolios(list);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load your simulated portfolios");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout");
    if (!checkoutStatus) return;

    let cancelled = false;
    // Every setState this effect performs is deferred behind at least one
    // tick (this outer timer, or the awaits inside the poll loop below) —
    // never called synchronously within the effect body itself.
    const kickoff = setTimeout(() => {
      if (cancelled) return;

      if (checkoutStatus === "cancelled") {
        setCheckoutNotice("Checkout was cancelled — no charge was made.");
        return;
      }

      setCheckoutNotice("Payment received — setting up your new portfolio…");
      const knownIds = new Set((portfolios ?? []).map((p) => p.id));

      (async () => {
        for (let attempt = 0; attempt < SUCCESS_POLL_ATTEMPTS; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, SUCCESS_POLL_INTERVAL_MS));
          if (cancelled) return;
          try {
            const list = await loadPortfolios();
            if (cancelled) return;
            if (list.some((p) => !knownIds.has(p.id))) {
              setPortfolios(list);
              setCheckoutNotice("Your new simulated portfolio is ready.");
              return;
            }
          } catch {
            // keep polling — a transient failure here just tries again next tick
          }
        }
        if (!cancelled) {
          setCheckoutNotice(
            "Payment received, but the new portfolio hasn't appeared yet — refresh in a moment."
          );
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(kickoff);
    };
    // Only re-run this effect when the checkout query param itself changes —
    // re-running on every `portfolios` update would restart the poll loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleClaim(tierId: string) {
    setBusyTier(tierId);
    try {
      const tier = PORTFOLIO_TIERS.find((t) => t.id === tierId);
      if (tier && tier.priceCents === 0) {
        const response = await fetch("/api/simulated-portfolio/claim-free", { method: "POST" });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          setError(body?.error ?? "Failed to start your free simulated portfolio");
          return;
        }
        setPortfolios((prev) => [
          {
            id: body.portfolio.id,
            tier: body.portfolio.tier,
            startingBalance: body.portfolio.startingBalance,
            cashBalance: body.portfolio.cashBalance,
            holdingsCount: 0,
            transactionsCount: 0,
            createdAt: body.portfolio.createdAt,
          },
          ...(prev ?? []),
        ]);
        return;
      }

      const response = await fetch("/api/simulated-portfolio/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tierId }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.url) {
        setError(body?.error ?? "Failed to start checkout");
        return;
      }
      window.location.href = body.url;
    } finally {
      setBusyTier(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {checkoutNotice && (
        <p className="rounded-md bg-indigo-400/10 px-3 py-2 text-sm text-indigo-400">{checkoutNotice}</p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Start a Simulated Portfolio</h2>
        <p className="-mt-1 text-sm text-foreground/50">
          Pick a starting balance. Paid tiers are a one-time fee, charged via Stripe — see the
          disclaimer below.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PORTFOLIO_TIERS.map((tier) => (
            <TierCard key={tier.id} tier={tier} onClaim={handleClaim} busy={busyTier === tier.id} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Your Simulated Portfolios</h2>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {portfolios === null && !error && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-lg bg-foreground/10" />
            ))}
          </div>
        )}
        {portfolios !== null && portfolios.length === 0 && !error && (
          <p className="text-sm text-foreground/60">
            No simulated portfolios yet — start one above to begin paper trading.
          </p>
        )}
        {portfolios !== null && portfolios.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {portfolios.map((p) => (
              <PortfolioCard key={p.id} portfolio={p} />
            ))}
          </div>
        )}
      </section>

      <SimulatedTradingDisclaimer />
    </div>
  );
}
