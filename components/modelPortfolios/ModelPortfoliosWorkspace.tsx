"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cardClass } from "@/lib/cardStyles";
import CreateModelPortfolioForm from "@/components/modelPortfolios/CreateModelPortfolioForm";

interface PortfolioSummary {
  id: string;
  name: string;
  holdingsCount: number;
  shareLinkActive: boolean;
  createdAt: string;
  creatorName: string | null;
}

export default function ModelPortfoliosWorkspace({ isAdmin }: { isAdmin: boolean }) {
  const [portfolios, setPortfolios] = useState<PortfolioSummary[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch("/api/model-portfolios");
      const body = await res.json().catch(() => null);
      if (!cancelled && res.ok) setPortfolios(body?.portfolios ?? []);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Your Model Portfolios</h2>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
        >
          {showCreate ? "Cancel" : "New model portfolio"}
        </button>
      </div>

      {showCreate && (
        <CreateModelPortfolioForm
          onCreated={() => {
            setRefreshToken((t) => t + 1);
            setShowCreate(false);
          }}
        />
      )}

      {!portfolios ? (
        <p className="text-sm text-foreground/50">Loading…</p>
      ) : portfolios.length === 0 ? (
        <p className="text-sm text-foreground/50">No model portfolios yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {portfolios.map((p) => (
            <Link
              key={p.id}
              href={`/portfolios/models/${p.id}`}
              className={cardClass("neutral", { interactive: true, extra: "flex items-center justify-between gap-2 p-3" })}
            >
              <div>
                <p className="text-sm font-medium text-foreground">{p.name}</p>
                <p className="text-xs text-foreground/50">
                  {p.holdingsCount} holding{p.holdingsCount === 1 ? "" : "s"} ·{" "}
                  {new Date(p.createdAt).toLocaleDateString()}
                  {isAdmin && p.creatorName ? ` · ${p.creatorName}` : ""}
                </p>
              </div>
              {p.shareLinkActive && (
                <span className="rounded-full bg-indigo-400/10 px-2 py-0.5 text-[11px] font-medium text-indigo-400">
                  Link active
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
