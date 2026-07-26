// Extracted verbatim from app/tools/ebitda/page.tsx's inline calculation.
export interface EbitdaInputs {
  netIncome: number;
  interest: number;
  taxes: number;
  depreciation: number;
  amortization: number;
  revenue: number;
}

export interface EbitdaResult {
  ebitda: number;
  margin: number | null;
}

export function calculateEbitda({
  netIncome,
  interest,
  taxes,
  depreciation,
  amortization,
  revenue,
}: EbitdaInputs): EbitdaResult {
  const ebitda = netIncome + interest + taxes + depreciation + amortization;
  const margin = revenue > 0 ? (ebitda / revenue) * 100 : null;
  return { ebitda, margin };
}
