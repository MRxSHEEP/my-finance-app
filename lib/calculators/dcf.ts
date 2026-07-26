// Extracted verbatim from app/tools/dcf/page.tsx's inline calculation —
// same math, same clamping, just callable outside the page component (the
// White-Label Reporting PDF route is the first second caller).
export interface DcfInputs {
  fcf: number;
  growthRatePercent: number;
  discountRatePercent: number;
  years: number;
  terminalGrowthPercent: number;
  shares: number;
}

export interface DcfRow {
  year: number;
  projectedFcf: number;
  presentValue: number;
}

export interface DcfResult {
  rows: DcfRow[];
  isValid: boolean;
  terminalValue: number;
  pvOfTerminalValue: number;
  totalIntrinsicValue: number;
  fairValuePerShare: number | null;
}

export function calculateDcf({
  fcf,
  growthRatePercent,
  discountRatePercent,
  years,
  terminalGrowthPercent,
  shares,
}: DcfInputs): DcfResult {
  const growthNum = growthRatePercent / 100;
  const discountNum = discountRatePercent / 100;
  const yearsRaw = Math.round(years);
  const yearsNum = Math.max(1, Math.min(20, yearsRaw || 5));
  const terminalNum = terminalGrowthPercent / 100;

  const isValid = discountNum > terminalNum;

  const rows: DcfRow[] = [];
  let cumulativePV = 0;

  for (let year = 1; year <= yearsNum; year++) {
    const projectedFcf = fcf * Math.pow(1 + growthNum, year);
    const presentValue = projectedFcf / Math.pow(1 + discountNum, year);
    rows.push({ year, projectedFcf, presentValue });
    cumulativePV += presentValue;
  }

  const finalYearFcf = rows[rows.length - 1]?.projectedFcf ?? 0;
  const terminalValue = isValid
    ? (finalYearFcf * (1 + terminalNum)) / (discountNum - terminalNum)
    : 0;
  const pvOfTerminalValue = isValid
    ? terminalValue / Math.pow(1 + discountNum, yearsNum)
    : 0;

  const totalIntrinsicValue = cumulativePV + pvOfTerminalValue;
  const fairValuePerShare = shares > 0 ? totalIntrinsicValue / shares : null;

  return { rows, isValid, terminalValue, pvOfTerminalValue, totalIntrinsicValue, fairValuePerShare };
}
