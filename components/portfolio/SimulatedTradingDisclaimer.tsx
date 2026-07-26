// Persistent, plain-text disclaimer required on every simulated-portfolio
// page — matches app/tools/page.tsx's own plainest disclaimer convention
// (text-xs text-foreground/60, no card/background) rather than a louder
// treatment, since this is informational/legal boilerplate, not a data
// caveat about a specific number.
export default function SimulatedTradingDisclaimer() {
  return (
    <p className="w-full text-xs text-foreground/60">
      This is a paper-trading simulation only. No real securities are bought or sold, no real
      brokerage account is used or required, and no real money is ever invested. Purchasing a
      starting-balance tier is solely a one-time fee for access to this simulation feature — it
      is not an investment, and it does not constitute the purchase of any security.
    </p>
  );
}
