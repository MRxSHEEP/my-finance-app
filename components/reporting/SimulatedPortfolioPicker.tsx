"use client";

import { useEffect, useState } from "react";

interface PortfolioSummary {
  id: string;
  tier: string;
  startingBalance: number;
  cashBalance: number;
  createdAt: string;
}

interface SimulatedPortfolioPickerProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// Fetches the existing, unmodified GET /api/simulated-portfolio — only
// ever the advisor's OWN portfolios, per the confirmed "no new cross-user
// access path" decision.
export default function SimulatedPortfolioPicker({ selectedId, onSelect }: SimulatedPortfolioPickerProps) {
  const [portfolios, setPortfolios] = useState<PortfolioSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch("/api/simulated-portfolio");
      const body = await res.json().catch(() => null);
      if (!cancelled && res.ok) setPortfolios(body?.portfolios ?? []);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!portfolios) return <p className="text-xs text-foreground/50">Loading your simulated portfolios…</p>;
  if (portfolios.length === 0) {
    return <p className="text-xs text-foreground/50">You don&apos;t have any simulated portfolios yet.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {portfolios.map((p) => (
        <label
          key={p.id}
          className="flex items-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/15"
        >
          <input type="radio" name="simulatedPortfolio" checked={selectedId === p.id} onChange={() => onSelect(p.id)} />
          <span className="capitalize text-foreground/80">{p.tier}</span>
          <span className="text-xs text-foreground/50">Started {new Date(p.createdAt).toLocaleDateString()}</span>
        </label>
      ))}
    </div>
  );
}
