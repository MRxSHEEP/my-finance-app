import { calculateDcf } from "@/lib/calculators/dcf";
import { calculateDca, type HistoryPoint, type DcaFrequency } from "@/lib/calculators/dca";
import { calculateEbitda } from "@/lib/calculators/ebitda";
import { calculateEvEbitda } from "@/lib/calculators/evEbitda";
import { calculatePeg, interpretPeg } from "@/lib/calculators/peg";
import { CALCULATOR_DISCLAIMERS, type CalculatorType } from "@/lib/reporting/disclaimers";
import { resolveTickerSymbol } from "@/lib/resolveTicker";
import { fetchHistoryWithFallback } from "@/lib/stockHistoryCache";
import { formatCurrency, formatCompactCurrency, formatPercent, formatRatio } from "@/lib/format";
import { getSimulatedPortfolioDetail } from "@/lib/simulatedTrading/portfolioDetail";
import type { ReportCalculatorSection, ReportPortfolioSection } from "@/lib/reporting/pdf/ReportDocument";

export interface CalculatorEntry {
  type: CalculatorType;
  inputs: Record<string, unknown>;
}

function num(inputs: Record<string, unknown>, key: string): number {
  const v = Number(inputs[key]);
  return Number.isFinite(v) ? v : 0;
}

function str(inputs: Record<string, unknown>, key: string): string {
  return typeof inputs[key] === "string" ? (inputs[key] as string) : "";
}

// Server-side equivalent of app/tools/dca/page.tsx's own history fetch —
// reuses the same resolveTickerSymbol/fetchHistoryWithFallback functions
// app/api/stock/history/route.ts itself calls (its explicit start/end
// date-range branch), rather than a self-referential HTTP call to that route.
async function fetchDcaHistory(ticker: string, startDate: string, endDate: string): Promise<HistoryPoint[]> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey || !ticker || !startDate || !endDate) return [];

  const resolvedTicker = await resolveTickerSymbol(ticker, process.env.FINNHUB_API_KEY);
  const primaryUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
    resolvedTicker
  )}&interval=1day&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&apikey=${apiKey}`;

  const result = await fetchHistoryWithFallback({
    ticker: resolvedTicker,
    range: `custom:${startDate}:${endDate}`,
    primaryUrl,
    primaryInterval: "1day",
    dailyUrl: null,
  });

  if ("error" in result) return [];
  return result.history.map((b) => ({ date: b.date, close: b.close }));
}

// Rebuilds a report's stored calculator inputs into a rendered PDF section
// by calling the matching lib/calculators/* function — the same source of
// truth the live tool pages use, so a report's figures can never drift from
// what the calculator itself would show for the same inputs today.
export async function buildCalculatorSection(entry: CalculatorEntry): Promise<ReportCalculatorSection> {
  const { type, inputs } = entry;

  if (type === "dcf") {
    const dcfInputs = {
      fcf: num(inputs, "fcf"),
      growthRatePercent: num(inputs, "growthRatePercent"),
      discountRatePercent: num(inputs, "discountRatePercent"),
      years: num(inputs, "years"),
      terminalGrowthPercent: num(inputs, "terminalGrowthPercent"),
      shares: num(inputs, "shares"),
    };
    const result = calculateDcf(dcfInputs);
    return {
      title: "DCF Valuation",
      inputs: [
        { label: "Current Free Cash Flow", value: formatCompactCurrency(dcfInputs.fcf) },
        { label: "Expected Growth Rate", value: formatPercent(dcfInputs.growthRatePercent) },
        { label: "Discount Rate (WACC)", value: formatPercent(dcfInputs.discountRatePercent) },
        { label: "Projection Years", value: String(dcfInputs.years) },
        { label: "Terminal Growth Rate", value: formatPercent(dcfInputs.terminalGrowthPercent) },
        ...(dcfInputs.shares > 0
          ? [{ label: "Shares Outstanding", value: dcfInputs.shares.toLocaleString("en-US") }]
          : []),
      ],
      figures: result.isValid
        ? [
            { label: "Terminal Value", value: formatCompactCurrency(result.terminalValue) },
            { label: "PV of Terminal Value", value: formatCompactCurrency(result.pvOfTerminalValue) },
            { label: "Estimated Intrinsic Value", value: formatCompactCurrency(result.totalIntrinsicValue) },
            ...(result.fairValuePerShare !== null
              ? [{ label: "Fair Value per Share", value: formatCurrency(result.fairValuePerShare) }]
              : []),
          ]
        : [{ label: "Result", value: "Invalid — discount rate must exceed terminal growth rate" }],
      disclaimer: CALCULATOR_DISCLAIMERS.dcf,
    };
  }

  if (type === "dca") {
    const ticker = str(inputs, "ticker").toUpperCase();
    const amount = num(inputs, "amount");
    const frequency: DcaFrequency = inputs.frequency === "weekly" ? "weekly" : "monthly";
    const startDate = str(inputs, "startDate");
    const endDate = str(inputs, "endDate");
    const history = await fetchDcaHistory(ticker, startDate, endDate);
    const result = calculateDca({ amount, frequency, startDate, endDate, history });

    return {
      title: `DCA Simulation — ${ticker}`,
      inputs: [
        { label: "Ticker", value: ticker },
        { label: "Investment Amount", value: formatCurrency(amount) },
        { label: "Frequency", value: frequency === "weekly" ? "Weekly" : "Monthly" },
        { label: "Start Date", value: startDate },
        { label: "End Date", value: endDate },
      ],
      figures:
        history.length > 0
          ? [
              { label: "Total Invested", value: formatCurrency(result.totalInvested) },
              { label: "Total Shares", value: result.totalShares.toFixed(4) },
              { label: "Current Value", value: formatCurrency(result.currentValue) },
              {
                label: "Overall Return",
                value: result.overallReturnPercent !== null ? formatPercent(result.overallReturnPercent) : "—",
              },
            ]
          : [{ label: "Result", value: "Historical price data unavailable for this ticker/date range" }],
      disclaimer: CALCULATOR_DISCLAIMERS.dca,
    };
  }

  if (type === "ebitda") {
    const ebitdaInputs = {
      netIncome: num(inputs, "netIncome"),
      interest: num(inputs, "interest"),
      taxes: num(inputs, "taxes"),
      depreciation: num(inputs, "depreciation"),
      amortization: num(inputs, "amortization"),
      revenue: num(inputs, "revenue"),
    };
    const result = calculateEbitda(ebitdaInputs);
    return {
      title: "EBITDA",
      inputs: [
        { label: "Net Income", value: formatCompactCurrency(ebitdaInputs.netIncome) },
        { label: "Interest Expense", value: formatCompactCurrency(ebitdaInputs.interest) },
        { label: "Taxes", value: formatCompactCurrency(ebitdaInputs.taxes) },
        { label: "Depreciation", value: formatCompactCurrency(ebitdaInputs.depreciation) },
        { label: "Amortization", value: formatCompactCurrency(ebitdaInputs.amortization) },
        ...(ebitdaInputs.revenue > 0
          ? [{ label: "Revenue", value: formatCompactCurrency(ebitdaInputs.revenue) }]
          : []),
      ],
      figures: [
        { label: "EBITDA", value: formatCompactCurrency(result.ebitda) },
        ...(result.margin !== null ? [{ label: "EBITDA Margin", value: formatPercent(result.margin) }] : []),
      ],
      disclaimer: CALCULATOR_DISCLAIMERS.ebitda,
    };
  }

  if (type === "ev-ebitda") {
    const evInputs = {
      marketCap: num(inputs, "marketCap"),
      debt: num(inputs, "debt"),
      cash: num(inputs, "cash"),
      ebitda: num(inputs, "ebitda"),
    };
    const result = calculateEvEbitda(evInputs);
    return {
      title: "EV/EBITDA",
      inputs: [
        { label: "Market Cap", value: formatCompactCurrency(evInputs.marketCap) },
        { label: "Total Debt", value: formatCompactCurrency(evInputs.debt) },
        { label: "Cash and Equivalents", value: formatCompactCurrency(evInputs.cash) },
        { label: "EBITDA", value: formatCompactCurrency(evInputs.ebitda) },
      ],
      figures: [
        { label: "Enterprise Value", value: formatCompactCurrency(result.enterpriseValue) },
        { label: "EV/EBITDA", value: result.ratio !== null ? formatRatio(result.ratio) : "—" },
      ],
      disclaimer: CALCULATOR_DISCLAIMERS["ev-ebitda"],
    };
  }

  // "peg" — the only remaining CalculatorType.
  const pegInputs = { pe: num(inputs, "pe"), growth: num(inputs, "growth") };
  const peg = calculatePeg(pegInputs);
  return {
    title: "PEG Ratio",
    inputs: [
      { label: "P/E Ratio", value: formatRatio(pegInputs.pe) },
      { label: "Expected EPS Growth Rate", value: formatPercent(pegInputs.growth) },
    ],
    figures: [
      { label: "PEG Ratio", value: peg !== null ? formatRatio(peg) : "—" },
      ...(peg !== null ? [{ label: "Interpretation", value: interpretPeg(peg) }] : []),
    ],
    disclaimer: CALCULATOR_DISCLAIMERS.peg,
  };
}

interface ReportPortfolioFields {
  portfolioSource: string;
  simulatedPortfolioId: string | null;
  manualHoldings: unknown;
}

// Simulated: re-fetched LIVE via the same helper the owner's own detail
// route uses (see lib/simulatedTrading/portfolioDetail.ts) — a report only
// stores the portfolio's id, never a frozen snapshot, so the PDF is always
// labeled with the render timestamp rather than implying a point-in-time
// capture. Manual: the exact opposite — holdings ARE frozen as typed at
// report-creation time, so no "as of" caveat applies.
export async function buildPortfolioSection(fields: ReportPortfolioFields): Promise<ReportPortfolioSection | null> {
  if (fields.portfolioSource === "simulated" && fields.simulatedPortfolioId) {
    const detail = await getSimulatedPortfolioDetail(fields.simulatedPortfolioId);
    if (!detail) return null;

    return {
      heading: "Simulated Portfolio",
      asOfLabel: `As of ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC — reflects this portfolio's current state, not a snapshot from when the report was created.`,
      rows: detail.holdings.map((h) => ({
        label: h.name ? `${h.symbol} — ${h.name}` : h.symbol,
        value: formatCurrency(h.currentValue),
        percent: formatPercent(h.percentOfPortfolio),
      })),
      totalLabel: "Total Portfolio Value",
      totalValue: formatCurrency(detail.totalValue),
    };
  }

  if (fields.portfolioSource === "manual" && Array.isArray(fields.manualHoldings)) {
    const holdings = fields.manualHoldings as Array<{ label: string; value: number }>;
    const total = holdings.reduce((sum, h) => sum + h.value, 0);

    return {
      heading: "Manual Holdings",
      asOfLabel: "As entered at report creation.",
      rows: holdings.map((h) => ({
        label: h.label,
        value: formatCurrency(h.value),
        percent: total > 0 ? formatPercent((h.value / total) * 100) : "—",
      })),
      totalLabel: "Total",
      totalValue: formatCurrency(total),
    };
  }

  return null;
}
