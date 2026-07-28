import Image from "next/image";
import { Check } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import { PORTFOLIO_TIERS } from "@/lib/simulatedTrading/tiers";
import { DEMO_TIER } from "@/components/portfolio/preview/sampleData";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// Mirrors SimulatedPortfolioSection.tsx's TierCard markup/classes exactly,
// fed the real PORTFOLIO_TIERS table (not invented) — "Growth" shown
// already selected, this walkthrough's chosen demo tier.
export default function PickTierScene() {
  return (
    <div className="flex flex-col gap-3 text-left">
      <h2 className="text-lg font-semibold text-foreground">Start a Simulated Portfolio</h2>
      <p className="-mt-1 text-sm text-foreground/50">Pick a starting balance to begin paper trading.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PORTFOLIO_TIERS.map((tier) => {
          const isFree = tier.priceCents === 0;
          const isSelected = tier.id === DEMO_TIER.id;
          return (
            <div
              key={tier.id}
              className={cardClass(isSelected ? "indigo" : "neutral", { extra: "flex flex-col gap-2 p-4" })}
            >
              <div className="flex items-center gap-1.5">
                <Image src="/crown(1).webp.webp" alt="" width={14} height={14} style={{ width: "auto", height: "14px" }} />
                <span className="font-semibold text-foreground">{tier.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{currencyFormatter.format(tier.startingBalance)}</p>
              <p className="text-xs text-foreground/50">starting balance</p>
              <span
                className={`mt-2 flex w-fit items-center gap-1 self-start rounded-md px-3 py-1.5 text-xs font-medium ${
                  isSelected ? "bg-indigo-500 text-white" : "bg-foreground text-background"
                }`}
              >
                {isSelected && <Check size={13} />}
                {isSelected ? "Selected" : isFree ? "Start free" : `Buy for $${(tier.priceCents / 100).toFixed(2)}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
