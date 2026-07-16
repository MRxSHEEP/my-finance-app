"use client";

import RevealOnScroll from "@/components/RevealOnScroll";
import EarningsCard from "./EarningsCard";
import InsiderActivityCard from "./InsiderActivityCard";
import AnalystViewCard from "./AnalystViewCard";
import PeerComparisonCard from "./PeerComparisonCard";
import DividendsCard from "./DividendsCard";

interface DeepDiveSectionProps {
  ticker: string;
  rating: number | null;
  ratingLabel: string;
  currentPrice: number | null;
}

// Each card is its own RevealOnScroll instance with an incrementing
// delay, so they settle in one after another instead of all popping in
// at once — matching the staggered-but-still-quick motion already used
// for the home page's feature grid.
const STAGGER_MS = 60;

export default function DeepDiveSection({
  ticker,
  rating,
  ratingLabel,
  currentPrice,
}: DeepDiveSectionProps) {
  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <RevealOnScroll>
        <h2 className="text-xl font-bold text-foreground">Deep Dive</h2>
      </RevealOnScroll>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RevealOnScroll delayMs={STAGGER_MS}>
          <EarningsCard ticker={ticker} />
        </RevealOnScroll>
        <RevealOnScroll delayMs={STAGGER_MS * 2}>
          <AnalystViewCard
            ticker={ticker}
            rating={rating}
            ratingLabel={ratingLabel}
            currentPrice={currentPrice}
          />
        </RevealOnScroll>
        <RevealOnScroll delayMs={STAGGER_MS * 3}>
          <InsiderActivityCard ticker={ticker} />
        </RevealOnScroll>
        <RevealOnScroll delayMs={STAGGER_MS * 4}>
          <DividendsCard ticker={ticker} currentPrice={currentPrice} />
        </RevealOnScroll>
        <RevealOnScroll delayMs={STAGGER_MS * 5} className="lg:col-span-2">
          <PeerComparisonCard ticker={ticker} />
        </RevealOnScroll>
      </div>
    </div>
  );
}
