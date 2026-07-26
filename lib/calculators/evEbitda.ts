// Extracted verbatim from app/tools/ev-ebitda/page.tsx's inline
// calculation — includes the composition-split math the page's bar chart
// already needs, so one extraction serves both consumers.
export interface EvEbitdaInputs {
  marketCap: number;
  debt: number;
  cash: number;
  ebitda: number;
}

export interface EvEbitdaResult {
  enterpriseValue: number;
  ratio: number | null;
  netDebt: number;
  marketCapSharePercent: number;
  netDebtSharePercent: number;
}

export function calculateEvEbitda({ marketCap, debt, cash, ebitda }: EvEbitdaInputs): EvEbitdaResult {
  const enterpriseValue = marketCap + debt - cash;
  const ratio = ebitda > 0 ? enterpriseValue / ebitda : null;

  const netDebt = debt - cash;
  const marketCapSharePercent =
    enterpriseValue > 0 ? Math.max(0, Math.min(1, marketCap / enterpriseValue)) * 100 : 0;
  const netDebtSharePercent = enterpriseValue > 0 ? Math.max(0, 100 - marketCapSharePercent) : 0;

  return { enterpriseValue, ratio, netDebt, marketCapSharePercent, netDebtSharePercent };
}
