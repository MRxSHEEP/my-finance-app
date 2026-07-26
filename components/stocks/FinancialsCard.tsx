"use client";

import { useEffect, useState } from "react";
import { PillButton } from "@/components/PriceChart";
import ScrollHint from "@/components/ScrollHint";
import { cardClass } from "@/lib/cardStyles";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";

interface StatementPeriod {
  label: string;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalStockholdersEquity: number | null;
  cashAndCashEquivalents: number | null;
  totalDebt: number | null;
  operatingCashFlow: number | null;
  capitalExpenditure: number | null;
  freeCashFlow: number | null;
  netDividendsPaid: number | null;
}

interface FinancialsData {
  periods: StatementPeriod[];
  available: boolean;
}

type Period = "annual" | "quarter";
type NumericKey = Exclude<keyof StatementPeriod, "label">;

interface StatementSection {
  title: string;
  rows: Array<{ key: NumericKey; label: string; format: (value: number) => string }>;
}

const SECTIONS: StatementSection[] = [
  {
    title: "Income Statement",
    rows: [
      { key: "revenue", label: "Revenue", format: formatCompactCurrency },
      { key: "grossProfit", label: "Gross Profit", format: formatCompactCurrency },
      { key: "operatingIncome", label: "Operating Income", format: formatCompactCurrency },
      { key: "netIncome", label: "Net Income", format: formatCompactCurrency },
      { key: "eps", label: "EPS", format: (v) => formatCurrency(v, 2) },
    ],
  },
  {
    title: "Balance Sheet",
    rows: [
      { key: "totalAssets", label: "Total Assets", format: formatCompactCurrency },
      { key: "totalLiabilities", label: "Total Liabilities", format: formatCompactCurrency },
      { key: "totalStockholdersEquity", label: "Total Equity", format: formatCompactCurrency },
      { key: "cashAndCashEquivalents", label: "Cash & Equivalents", format: formatCompactCurrency },
      { key: "totalDebt", label: "Total Debt", format: formatCompactCurrency },
    ],
  },
  {
    title: "Cash Flow",
    rows: [
      { key: "operatingCashFlow", label: "Operating Cash Flow", format: formatCompactCurrency },
      { key: "capitalExpenditure", label: "Capital Expenditure", format: formatCompactCurrency },
      { key: "freeCashFlow", label: "Free Cash Flow", format: formatCompactCurrency },
      { key: "netDividendsPaid", label: "Dividends Paid", format: formatCompactCurrency },
    ],
  },
];

function StatementTable({ section, periods }: { section: StatementSection; periods: StatementPeriod[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr>
            <th className="p-2 text-left text-xs font-medium text-foreground/50">{section.title}</th>
            {periods.map((period) => (
              <th key={period.label} className="p-2 text-right text-xs font-medium text-foreground/50">
                {period.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row) => (
            <tr key={row.key} className="border-t border-black/5 dark:border-white/10">
              <td className="p-2 text-foreground/60">{row.label}</td>
              {periods.map((period) => {
                const value = period[row.key];
                return (
                  <td key={period.label} className="p-2 text-right text-foreground">
                    {typeof value === "number" ? row.format(value) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FinancialsCard({ ticker }: { ticker: string }) {
  const [data, setData] = useState<FinancialsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("annual");
  // A brief opacity dip while new period data swaps in — same technique
  // as PriceChart's range/type switch (a dip-and-restore around the data
  // swap) rather than an abrupt table replacement.
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) setSwitching(true);
      try {
        const response = await fetch(
          `/api/stock/financials?ticker=${encodeURIComponent(ticker)}&period=${period}`
        );
        if (!response.ok) throw new Error("request failed");
        const body: FinancialsData = await response.json();
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Data unavailable");
      } finally {
        if (!cancelled) setSwitching(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [ticker, period]);

  return (
    <div className={cardClass("neutral", { extra: "flex flex-col gap-4 p-4" })}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground">Financials</h3>
        <div className="flex gap-1">
          <PillButton accent="blue" active={period === "annual"} onClick={() => setPeriod("annual")}>
            Annual
          </PillButton>
          <PillButton accent="blue" active={period === "quarter"} onClick={() => setPeriod("quarter")}>
            Quarterly
          </PillButton>
        </div>
      </div>

      {!data && !error && (
        <div className="flex flex-col gap-2">
          <div className="h-32 w-full animate-pulse rounded bg-foreground/10" />
        </div>
      )}

      {error && <p className="text-sm text-foreground/60">Data unavailable</p>}

      {data && !data.available && period === "quarter" && (
        <p className="text-sm text-foreground/60">
          Quarterly statements aren&apos;t available on the current data plan — try Annual instead.
        </p>
      )}

      {data && !data.available && period === "annual" && (
        <p className="text-sm text-foreground/60">
          Financial statement data isn&apos;t available for this ticker right now.
        </p>
      )}

      {data?.available && (
        <div
          className="flex flex-col gap-5 transition-opacity duration-200 ease-out"
          style={{ opacity: switching ? 0.4 : 1 }}
        >
          <ScrollHint />
          {SECTIONS.map((section) => (
            <StatementTable key={section.title} section={section} periods={data.periods} />
          ))}
        </div>
      )}
    </div>
  );
}
