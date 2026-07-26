import { COURSES } from "./courses";

export interface GlossaryEntry {
  slug: string;
  term: string;
  definition: string;
}

// The single canonical source every `[[Display Text|slug]]` reference in
// courses.ts resolves against — a term is defined once here regardless of
// how many courses/slides mention it. Kept intentionally separate from
// courses.ts itself (which stays import-light for the server-imported
// progress API route) even though this file has no such constraint of its
// own; it's still plain data with no component imports, so importing it
// from courses.ts would have been safe either way, but keeping definitions
// here matches "one concept, one place" with the rest of this reasoning.
export const GLOSSARY: Record<string, GlossaryEntry> = {
  "pe-ratio": {
    slug: "pe-ratio",
    term: "P/E ratio",
    definition: "Price-to-earnings ratio — a company's share price divided by its earnings per share, showing how much investors are paying today for each dollar of annual profit.",
  },
  earnings: {
    slug: "earnings",
    term: "Earnings",
    definition: "A company's profit — revenue minus every cost of doing business, including taxes and interest.",
  },
  "trailing-pe": {
    slug: "trailing-pe",
    term: "Trailing P/E",
    definition: "A P/E ratio calculated using the last 12 months of actual, already-reported earnings.",
  },
  "forward-pe": {
    slug: "forward-pe",
    term: "Forward P/E",
    definition: "A P/E ratio calculated using analysts' estimated earnings for the next 12 months, rather than past results.",
  },
  "cape-ratio": {
    slug: "cape-ratio",
    term: "CAPE ratio",
    definition:
      "The cyclically-adjusted P/E ratio (Shiller P/E): price divided by the average of 10 years of inflation-adjusted earnings, smoothing out short-term earnings swings and business-cycle effects that a single year's P/E can't see.",
  },
  "valuation-multiple": {
    slug: "valuation-multiple",
    term: "Valuation multiple",
    definition: "Any ratio that expresses a company's price relative to some measure of its size or profit (e.g. P/E, EV/EBITDA) — a fast way to compare companies without building a full model.",
  },
  "peg-ratio": {
    slug: "peg-ratio",
    term: "PEG ratio",
    definition: "A P/E ratio divided by a company's expected earnings growth rate — a way to judge whether a high P/E is justified by fast growth, rather than reading P/E in isolation.",
  },
  "net-income": {
    slug: "net-income",
    term: "Net income",
    definition: "The bottom-line profit left after subtracting every expense, interest payment, and tax from revenue — also called \"the bottom line.\"",
  },
  depreciation: {
    slug: "depreciation",
    term: "Depreciation",
    definition: "A non-cash expense that spreads the cost of a tangible asset (like machinery or buildings) across its useful life, rather than expensing the full cost the year it was purchased.",
  },
  ebitda: {
    slug: "ebitda",
    term: "EBITDA",
    definition: "Earnings Before Interest, Taxes, Depreciation, and Amortization — an approximation of a company's core operating profit, before financing and accounting choices affect the picture.",
  },
  "average-cost-basis": {
    slug: "average-cost-basis",
    term: "Average cost basis",
    definition: "The average price paid per share across multiple purchases over time — buying more shares when prices are low (and fewer when prices are high) with a fixed dollar amount tends to pull this average down below the simple average of the prices paid.",
  },
  "form-4": {
    slug: "form-4",
    term: "Form 4",
    definition: "The SEC filing a company insider (officer, director, or large shareholder) must submit within two business days of buying or selling their own company's stock — the disclosure requirement that makes legal insider trading data public.",
  },
  "10b5-1-plan": {
    slug: "10b5-1-plan",
    term: "10b5-1 plan",
    definition: "A pre-scheduled trading plan an insider sets up in advance (often for reasons unrelated to any current view on the stock, like diversification or tax planning) — a trade executed under one of these plans carries much less signal than an unscheduled, discretionary trade.",
  },
  "analyst-consensus": {
    slug: "analyst-consensus",
    term: "Analyst consensus",
    definition: "The aggregated Buy/Hold/Sell view (and average price target) across every sell-side analyst covering a stock — a single-stock snapshot of professional research sentiment.",
  },
  drip: {
    slug: "drip",
    term: "DRIP",
    definition: "A dividend reinvestment plan — automatically using cash dividends to buy more shares instead of receiving them as cash, compounding your share count over time.",
  },
  "payout-ratio": {
    slug: "payout-ratio",
    term: "Payout ratio",
    definition: "The share of a company's earnings paid out as dividends — a payout ratio consistently above 100% (paying out more than it earns) is a common warning sign a dividend cut may be coming.",
  },
  "enterprise-value": {
    slug: "enterprise-value",
    term: "Enterprise value",
    definition: "The theoretical full takeover cost of a business: market cap (the equity) plus total debt, minus cash — what an acquirer would actually have to pay and assume to buy the whole company outright.",
  },
  "diluted-shares": {
    slug: "diluted-shares",
    term: "Diluted shares",
    definition: "A company's share count including stock options, convertible bonds, and other securities that could become shares — used for diluted EPS, a more conservative figure than basic EPS.",
  },
  "share-buyback": {
    slug: "share-buyback",
    term: "Share buyback",
    definition: "A company repurchasing its own shares on the open market, shrinking the share count — this mechanically raises EPS even if total profit doesn't grow, since the same profit is divided across fewer shares.",
  },
  "weighted-average-shares": {
    slug: "weighted-average-shares",
    term: "Weighted average shares",
    definition: "The average number of shares outstanding over a reporting period, weighted by how long each share count was in effect — used in the EPS formula instead of a single point-in-time share count.",
  },
  "preferred-dividends": {
    slug: "preferred-dividends",
    term: "Preferred dividends",
    definition: "Dividends owed to preferred shareholders, subtracted from net income before computing EPS since that income was never available to common shareholders.",
  },
  "non-gaap-earnings": {
    slug: "non-gaap-earnings",
    term: "Non-GAAP earnings",
    definition:
      "A company's own \"adjusted\" earnings figure that excludes items it considers one-off or non-cash (e.g. stock-based compensation, restructuring charges) — not calculated under standard accounting rules (GAAP), and a frequent point of analyst scrutiny since companies choose what to exclude.",
  },
  "free-cash-flow": {
    slug: "free-cash-flow",
    term: "Free cash flow",
    definition: "Cash generated by operations minus the capital expenditures needed to maintain and grow the business — the actual spendable cash a company produces, which a DCF projects and discounts.",
  },
  "discount-rate": {
    slug: "discount-rate",
    term: "Discount rate",
    definition: "The annual rate used to convert a future cash flow into today's dollars, reflecting both the time value of money and the riskiness of actually receiving that cash.",
  },
  wacc: {
    slug: "wacc",
    term: "WACC",
    definition:
      "Weighted Average Cost of Capital — the blended rate a company pays across all its funding sources (equity and debt, weighted by how much of each it uses), the professional standard discount rate for a company-level DCF.",
  },
  "terminal-value": {
    slug: "terminal-value",
    term: "Terminal value",
    definition: "The estimated value of all cash flows beyond a DCF's explicit projection period, typically the single largest component of the total valuation.",
  },
  "gordon-growth-model": {
    slug: "gordon-growth-model",
    term: "Gordon Growth Model",
    definition: "A terminal-value method that assumes cash flows grow at a constant, modest rate forever — the more common alternative to the exit-multiple method, and mathematically identical to a simplified dividend discount model.",
  },
  "intrinsic-value": {
    slug: "intrinsic-value",
    term: "Intrinsic value",
    definition: "What an asset is actually worth based on its own fundamentals (like projected cash flows), as opposed to whatever price the market happens to be quoting for it right now.",
  },
  "present-value": {
    slug: "present-value",
    term: "Present value",
    definition: "The value today of a cash flow that will actually be received at some point in the future, after discounting it back by the discount rate.",
  },
  "equity-risk-premium": {
    slug: "equity-risk-premium",
    term: "Equity risk premium",
    definition: "The extra return investors demand for holding stocks instead of a risk-free asset like government bonds — a key input to a company's cost of equity, and therefore its WACC.",
  },
  "cost-of-capital": {
    slug: "cost-of-capital",
    term: "Cost of capital",
    definition: "The return a company must generate on its investments to satisfy everyone who supplies it money — shareholders and lenders alike.",
  },
};

export function getGlossaryEntry(slug: string): GlossaryEntry | undefined {
  return GLOSSARY[slug];
}

const TERM_PATTERN = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;

// Scans every course's slide body/deepDive/caseStudy text for `[[Display|slug]]`
// references and derives which topics use each glossary slug — computed at
// read time rather than hand-maintained, so it can never drift out of sync
// with what courses.ts actually references as more topics get authored later.
export function deriveGlossaryUsage(): Record<string, string[]> {
  const usage: Record<string, Set<string>> = {};

  for (const course of COURSES) {
    for (const slide of course.slides) {
      if (slide.type !== "content") continue;
      const texts = [...slide.body, ...(slide.deepDive?.body ?? []), ...(slide.caseStudy?.body ?? [])];
      for (const text of texts) {
        for (const match of text.matchAll(TERM_PATTERN)) {
          const slug = match[2].trim();
          if (!usage[slug]) usage[slug] = new Set();
          usage[slug].add(course.topicId);
        }
      }
    }
  }

  const result: Record<string, string[]> = {};
  for (const [slug, topics] of Object.entries(usage)) result[slug] = [...topics];
  return result;
}
