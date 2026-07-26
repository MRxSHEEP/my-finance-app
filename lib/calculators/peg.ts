// Extracted verbatim from app/tools/peg/page.tsx's inline calculation.
export interface PegInputs {
  pe: number;
  growth: number;
}

export function calculatePeg({ pe, growth }: PegInputs): number | null {
  return growth !== 0 ? pe / growth : null;
}

export function interpretPeg(peg: number): string {
  if (peg <= 0) return "Not meaningful (requires positive P/E and growth rate).";
  if (peg < 1) return "< 1: potentially undervalued relative to expected growth.";
  if (peg <= 2) return "1-2: roughly fairly valued relative to expected growth.";
  return "> 2: potentially overvalued relative to expected growth.";
}
