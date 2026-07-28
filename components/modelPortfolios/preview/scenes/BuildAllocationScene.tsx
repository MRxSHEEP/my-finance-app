import { cardClass } from "@/lib/cardStyles";
import { DEMO_HOLDINGS, DEMO_PORTFOLIO_NAME } from "@/components/modelPortfolios/preview/sampleData";

const ASSET_TYPE_LABEL: Record<string, string> = { stock: "Stock", commodity: "Commodity", crypto: "Crypto" };

// Mirrors CreateModelPortfolioForm.tsx + ModelPortfolioHoldingsEditor.tsx's
// markup/classes — static values instead of live row state, same
// "recreate the real form, no fetch" convention as every scene in the
// Compliance and Reporting walkthroughs.
export default function BuildAllocationScene() {
  const weightSum = DEMO_HOLDINGS.reduce((sum, h) => sum + h.targetWeightPercent, 0);

  return (
    <div className={cardClass("indigo", { extra: "flex flex-col gap-3 p-4 text-left" })}>
      <h3 className="text-sm font-semibold text-foreground">New model portfolio</h3>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Name</span>
        <input
          readOnly
          value={DEMO_PORTFOLIO_NAME}
          className="w-full max-w-sm rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
        />
      </label>

      <div className="flex flex-col gap-2">
        {DEMO_HOLDINGS.map((h) => (
          <div key={h.symbol} className="flex items-center gap-2">
            <span className="rounded-md border border-black/10 px-2 py-2 text-sm text-foreground/70 dark:border-white/15">
              {ASSET_TYPE_LABEL[h.assetType]}
            </span>
            <span className="flex-1 rounded-md border border-black/10 px-3 py-2 text-sm text-foreground dark:border-white/15">
              {h.symbol}
            </span>
            <span className="w-24 rounded-md border border-black/10 px-3 py-2 text-right text-sm text-foreground dark:border-white/15">
              {h.targetWeightPercent}%
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-green-500">Total target weight: {weightSum.toFixed(2)}%</p>
    </div>
  );
}
