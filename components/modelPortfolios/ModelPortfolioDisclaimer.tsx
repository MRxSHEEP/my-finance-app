// Persistent, plain-text disclaimer — matches
// SimulatedTradingDisclaimer.tsx's own convention (text-xs
// text-foreground/60, no card/background) and documents the rebalancing
// decision in-product, not just in the build plan.
export default function ModelPortfolioDisclaimer() {
  return (
    <p className="w-full text-xs text-foreground/60">
      This is a hypothetical model portfolio, not real money. Performance assumes a $10,000
      notional allocation held at each holding&apos;s target weight, continuously rebalanced to that
      weight rather than reflecting a specific trade history — it is not investment advice and does
      not represent an actual account.
    </p>
  );
}
