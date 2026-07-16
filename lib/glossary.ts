export interface GlossaryTerm {
  slug: string;
  title: string;
  shortDefinition: string;
  content: string[];
  toolHref?: string;
  toolLabel?: string;
}

// Static, hand-written glossary content — this doesn't change per-user or
// need a database, so it lives as a plain data file rather than MDX or a
// CMS. Cross-linked tool hrefs point at the matching calculator under
// /tools so a reader can go straight from the explanation to the math.
export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    slug: "pe-ratio",
    title: "P/E Ratio",
    shortDefinition: "Price divided by earnings per share — the classic \"how expensive is this stock\" number.",
    content: [
      "The price-to-earnings (P/E) ratio is a company's stock price divided by its earnings per share (EPS). It answers a simple question: how much are investors paying for each dollar of profit the company makes? A P/E of 20 means the market is valuing the company at 20 times its annual earnings.",
      "P/E is most useful when comparing similar companies in the same industry, since \"normal\" P/E varies a lot by sector — fast-growing tech companies typically trade at much higher P/E ratios than mature utilities or banks, because investors are willing to pay more today for earnings they expect to grow quickly.",
      "A high P/E isn't automatically \"expensive\" and a low P/E isn't automatically \"cheap.\" A high P/E can mean the market expects strong future growth, and a low P/E can mean the market expects earnings to decline. It's a starting point for valuation, not a verdict on its own — pairing it with growth expectations (see PEG Ratio) gives a fuller picture.",
    ],
  },
  {
    slug: "peg-ratio",
    title: "PEG Ratio",
    shortDefinition: "P/E ratio divided by expected earnings growth — adjusts for how fast a company is growing.",
    content: [
      "The PEG ratio (price/earnings-to-growth) takes the P/E ratio a step further by dividing it by the company's expected annual earnings growth rate. The idea is that a high P/E is easier to justify if earnings are growing quickly, so PEG lets you compare a fast grower and a slow grower on more equal footing.",
      "As a rough rule of thumb, a PEG around 1 is often considered fairly valued relative to growth, below 1 potentially undervalued, and above 2 potentially overvalued — though like any single ratio, this varies by industry and depends heavily on how reliable the growth estimate actually is.",
      "The biggest weakness of PEG is that it depends on a growth forecast, and forecasts are frequently wrong. A stock can look cheap on a PEG basis simply because analysts are (incorrectly) projecting optimistic growth. Treat PEG as a quick sanity check on a P/E ratio, not a precise valuation tool.",
    ],
    toolHref: "/tools/peg",
    toolLabel: "PEG Ratio Calculator",
  },
  {
    slug: "eps",
    title: "EPS",
    shortDefinition: "Earnings per share — a company's profit divided across every outstanding share.",
    content: [
      "Earnings per share (EPS) is a company's net income divided by its number of outstanding shares. It converts total company profit into a per-share number, which is what feeds directly into the P/E ratio and many other valuation metrics.",
      "EPS can be reported as \"trailing\" (based on the last 12 months of actual results) or \"forward\" (based on analysts' estimates for the upcoming year). Forward EPS is inherently more uncertain since it's a projection, while trailing EPS reflects what already happened.",
      "Watch out for EPS growth driven by share buybacks rather than real profit growth — if a company buys back stock, the same total profit gets divided across fewer shares, which pushes EPS up even if the underlying business hasn't grown at all.",
    ],
  },
  {
    slug: "ebitda",
    title: "EBITDA",
    shortDefinition: "Earnings before interest, taxes, depreciation, and amortization — a proxy for core operating profit.",
    content: [
      "EBITDA stands for earnings before interest, taxes, depreciation, and amortization. It starts from net income and adds back those five items, aiming to show how much cash-generating profit a company's core operations produce, before the effects of financing decisions (interest), tax jurisdictions (taxes), and non-cash accounting charges (depreciation and amortization).",
      "It's especially useful for comparing companies with very different capital structures or asset bases — a company that owns its factories outright and one that leases equivalent equipment can look very different on net income, but much more similar on EBITDA, since the debt and depreciation differences are stripped out.",
      "EBITDA is not the same as cash flow, and critics point out it ignores real costs — interest on debt still has to be paid, and depreciating equipment eventually needs to be replaced with real cash. It's a useful lens for comparing operating performance, not a substitute for looking at actual cash flow and debt levels.",
    ],
    toolHref: "/tools/ebitda",
    toolLabel: "EBITDA Calculator",
  },
  {
    slug: "ev-ebitda",
    title: "EV/EBITDA",
    shortDefinition: "Enterprise value divided by EBITDA — a valuation multiple that accounts for debt and cash.",
    content: [
      "EV/EBITDA divides a company's enterprise value (market cap, plus debt, minus cash) by its EBITDA. Unlike the P/E ratio, which only looks at equity value, enterprise value accounts for the whole capital structure — so EV/EBITDA is often preferred when comparing companies that carry different amounts of debt or cash.",
      "A lower EV/EBITDA multiple can suggest a company is cheaper relative to its operating earnings, while a higher multiple suggests the market is paying a premium — again, always most meaningful when compared against similar companies in the same industry rather than in isolation.",
      "It's a favorite metric in private equity and M&A analysis specifically because it's capital-structure-neutral: it lets you compare a heavily indebted company against a debt-free one on a more apples-to-apples basis than P/E can.",
    ],
    toolHref: "/tools/ev-ebitda",
    toolLabel: "EV/EBITDA Calculator",
  },
  {
    slug: "dcf",
    title: "DCF",
    shortDefinition: "Discounted cash flow — estimating a company's value from its projected future cash.",
    content: [
      "A discounted cash flow (DCF) analysis estimates what a company is worth today by projecting its future free cash flows and then \"discounting\" them back to a present value. The core intuition is that a dollar received five years from now is worth less than a dollar today, because of both inflation and the opportunity cost of not having that money now.",
      "A basic DCF needs a few key inputs: a starting free cash flow figure, an assumed growth rate for how that cash flow will expand over a projection period, a discount rate (reflecting risk and the time value of money), and a terminal growth rate for value beyond the projection window. Change any of these inputs meaningfully and the resulting valuation can swing a lot — DCF is often described as \"precisely wrong,\" since it produces an exact-looking number from inputs that are ultimately estimates.",
      "Despite that sensitivity, DCF remains one of the most widely used valuation frameworks because it forces explicit, testable assumptions about growth and risk, rather than just comparing a stock's price to its peers. It's most useful as a way to reason about what has to be true for a given price to make sense, not as a source of a single \"correct\" answer.",
    ],
    toolHref: "/tools/dcf",
    toolLabel: "DCF Calculator",
  },
  {
    slug: "market-cap",
    title: "Market Cap",
    shortDefinition: "Share price multiplied by shares outstanding — the total market value of a company's equity.",
    content: [
      "Market capitalization (market cap) is a company's current share price multiplied by its total number of outstanding shares. It represents the total value the market currently places on the company's equity — not the same thing as the value of the whole business, since it doesn't include debt (that's what enterprise value is for).",
      "Companies are commonly grouped by market cap: micro-cap and small-cap (roughly under a few billion dollars), mid-cap (a few billion to around $10-20 billion), and large-cap or mega-cap (tens of billions to trillions). These bands are rough, shift over time, and vary by source, but they're a useful shorthand for a company's overall size and typically its risk profile — smaller companies tend to be more volatile.",
      "Market cap changes constantly as the share price moves, even though the number of shares outstanding usually doesn't (except when a company issues new shares or buys back existing ones). It's a market-value snapshot, not a measure of a company's revenue, profit, or book value.",
    ],
  },
  {
    slug: "dividend-yield",
    title: "Dividend Yield",
    shortDefinition: "Annual dividend payments divided by share price — the cash return a stock pays out.",
    content: [
      "Dividend yield is a company's annual dividend per share divided by its current share price, expressed as a percentage. It tells you what percentage of your investment you'd receive back each year in cash dividends, at the current price and payout rate.",
      "Yield moves with price even if the dividend itself doesn't change — when a stock's price falls, its yield rises (and vice versa), so a sudden double-digit yield is often a warning sign that the market expects the dividend to be cut, rather than a genuine bargain.",
      "Not every company pays a dividend — many growth-focused companies reinvest all their profit back into the business instead, which isn't inherently better or worse, just a different capital allocation strategy. Comparing dividend yield across companies only makes sense alongside a look at how sustainable that payout actually is relative to earnings.",
    ],
  },
  {
    slug: "beta",
    title: "Beta",
    shortDefinition: "A measure of how much a stock tends to move relative to the overall market.",
    content: [
      "Beta measures how volatile a stock is relative to the broader market (usually a benchmark index like the S&P 500), which is assigned a beta of 1.0. A stock with a beta of 1.5 has historically tended to move about 50% more than the market in either direction; a beta of 0.5 suggests moves about half as large.",
      "A beta above 1 generally signals a more volatile, higher-risk-higher-reward stock — common among smaller or growth-oriented companies — while a beta below 1 suggests relative stability, often seen in defensive sectors like utilities or consumer staples that people keep buying regardless of the economic cycle.",
      "Beta is calculated from historical price data, so it describes how a stock has behaved in the past, not a guarantee of how it will behave going forward. It's also just one dimension of risk — it says nothing about company-specific risks like a product recall or a failed product launch that wouldn't show up as \"market-correlated\" volatility.",
    ],
  },
  {
    slug: "analyst-ratings",
    title: "Analyst Ratings",
    shortDefinition: "Buy/hold/sell recommendations and price targets published by professional stock analysts.",
    content: [
      "Analyst ratings are recommendations — typically some version of Buy, Hold, or Sell — published by research analysts at banks and brokerages, usually alongside a price target for where they expect the stock to trade over the next 12 months. Ratings are often aggregated into a consensus view across many analysts covering the same stock.",
      "These ratings come from analysts who build detailed financial models and speak regularly with company management, so they can reflect real research. But they also carry real limitations: analysts can be slow to change a rating after new information emerges, ratings can cluster together (herd behavior), and analysts at banks with other business relationships with a company have historically faced conflict-of-interest criticism.",
      "Analyst ratings are best treated as one data point among many rather than a signal to act on directly — a useful gauge of professional sentiment, not a substitute for your own research into a company's fundamentals.",
    ],
  },
  {
    slug: "insider-trading",
    title: "Insider Trading",
    shortDefinition: "Legal, disclosed buying and selling of a company's stock by its own executives and directors.",
    content: [
      "In this context, \"insider trading\" refers to the legal, publicly disclosed buying and selling of a company's stock by its own executives, directors, and other insiders — not the illegal use of material non-public information, which is a different (and prosecutable) thing entirely. Insiders in the U.S. are required to report their trades to the SEC, and that data becomes public.",
      "Investors watch insider activity because insiders arguably know their company better than anyone else. A cluster of executives buying shares with their own money can be read as a vote of confidence, while heavy selling can (but doesn't always) suggest reduced conviction — insiders also sell for entirely mundane reasons like diversification, paying taxes, or exercising options that are about to expire.",
      "Because of that ambiguity, insider activity is best read in aggregate and in context — a single sale means little, but a sustained pattern of buying or selling across multiple insiders over time carries more signal.",
    ],
  },
  {
    slug: "dca",
    title: "DCA",
    shortDefinition: "Dollar-cost averaging — investing a fixed amount at regular intervals regardless of price.",
    content: [
      "Dollar-cost averaging (DCA) is an investing strategy where you invest a fixed dollar amount at regular intervals — say, $200 every month — regardless of whether the price is up or down that day. Because the dollar amount is fixed, you automatically buy more shares when prices are low and fewer shares when prices are high.",
      "The main appeal of DCA is behavioral as much as mathematical: it removes the temptation (and the near-impossible task) of trying to time the market, and it smooths out the emotional impact of investing a lump sum right before a downturn. It's a popular default strategy for regular contributions, like investing part of every paycheck.",
      "DCA isn't guaranteed to outperform investing a lump sum all at once — in a market that trends upward over time, investing the full amount immediately has historically outperformed DCA on average, since more money spends more time invested. DCA trades some expected return for lower regret and steadier, more manageable investing habits.",
    ],
    toolHref: "/tools/dca",
    toolLabel: "DCA Simulator",
  },
];

export function getGlossaryTerm(slug: string): GlossaryTerm | undefined {
  return GLOSSARY_TERMS.find((term) => term.slug === slug);
}
