"use client";

import { useEffect, useState } from "react";

interface InsiderTransaction {
  name: string;
  codeLabel: string;
  isBuy: boolean;
  isSell: boolean;
  shares: number;
  value: number;
  transactionDate: string;
}

interface InsiderData {
  transactions: InsiderTransaction[];
  netSentiment: { label: "Net Buying" | "Net Selling"; netValue: number } | null;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const shareFormatter = new Intl.NumberFormat("en-US");

export default function InsiderActivityCard({ ticker }: { ticker: string }) {
  const [data, setData] = useState<InsiderData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) {
        setData(null);
        setError(null);
      }
      try {
        const response = await fetch(`/api/stock/insiders?ticker=${encodeURIComponent(ticker)}`);
        if (!response.ok) throw new Error("request failed");
        const body = await response.json();
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setError("Data unavailable");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-black/10 p-4 dark:border-white/15">
      <h3 className="font-semibold text-foreground">Insider Activity</h3>

      {!data && !error && (
        <div className="flex flex-col gap-2">
          <div className="h-8 w-full animate-pulse rounded bg-foreground/10" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 w-full animate-pulse rounded bg-foreground/10" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-foreground/60">Data unavailable</p>}

      {data && (
        <>
          {data.netSentiment ? (
            <div className="rounded-md bg-foreground/5 px-3 py-2 text-sm">
              <span className="text-foreground/70">Trailing 3mo sentiment: </span>
              <span
                className={`font-semibold ${
                  data.netSentiment.label === "Net Buying" ? "text-green-500" : "text-red-500"
                }`}
              >
                {data.netSentiment.label} ({currencyFormatter.format(Math.abs(data.netSentiment.netValue))})
              </span>
            </div>
          ) : (
            <p className="text-sm text-foreground/60">No recent open-market buy/sell activity.</p>
          )}

          {data.transactions.length > 0 ? (
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto text-xs">
              {data.transactions.map((transaction, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 border-b border-black/5 py-1.5 last:border-0 dark:border-white/10"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{transaction.name}</span>
                    <span className="text-foreground/50">{transaction.transactionDate}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span
                      className={`font-medium ${
                        transaction.isBuy
                          ? "text-green-500"
                          : transaction.isSell
                            ? "text-red-500"
                            : "text-foreground/60"
                      }`}
                    >
                      {transaction.codeLabel}
                    </span>
                    <span className="text-foreground/50">
                      {shareFormatter.format(transaction.shares)} sh
                      {transaction.value > 0 ? ` · ${currencyFormatter.format(transaction.value)}` : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground/60">No recent insider transactions found.</p>
          )}
        </>
      )}
    </div>
  );
}
