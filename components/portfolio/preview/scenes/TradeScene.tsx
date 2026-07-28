"use client";

import { useEffect, useState } from "react";
import { DEMO_TRADE } from "@/components/portfolio/preview/sampleData";

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// Timeline (ms from mount) for the self-playing sequence — search text
// appears, a suggestion shows up, gets picked, then the quantity fills in.
const TYPE_AT_MS = 600;
const SUGGESTION_AT_MS = 1400;
const SELECT_AT_MS = 2000;
const QUANTITY_AT_MS = 2600;

// Mirrors TradeForm.tsx's markup/classes exactly — a scripted sequence
// instead of a real POST to /api/simulated-portfolio/[id]/trade (a real
// authenticated write a signed-out visitor could never complete), same
// non-live-API convention as every other walkthrough's write-action scenes.
export default function TradeScene() {
  const [searchInput, setSearchInput] = useState("");
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [symbol, setSymbol] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");

  useEffect(() => {
    const timers = [
      setTimeout(() => setSearchInput(DEMO_TRADE.symbol), TYPE_AT_MS),
      setTimeout(() => setShowSuggestion(true), SUGGESTION_AT_MS),
      setTimeout(() => {
        setSymbol(DEMO_TRADE.symbol);
        setShowSuggestion(false);
      }, SELECT_AT_MS),
      setTimeout(() => setQuantity(String(DEMO_TRADE.quantity)), QUANTITY_AT_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const quantityNum = Number(quantity);
  const showEstimate = Number.isFinite(quantityNum) && quantityNum > 0;

  return (
    <form className="flex flex-col gap-4 text-left" onSubmit={(e) => e.preventDefault()}>
      <div className="flex gap-1">
        {["Stocks", "Commodities", "Crypto"].map((label) => (
          <span
            key={label}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              label === "Stocks" ? "bg-foreground text-background" : "border border-black/10 text-foreground/60 dark:border-white/15"
            }`}
          >
            {label}
          </span>
        ))}
        <span className="mx-1 h-6 w-px bg-black/10 dark:bg-white/15" />
        {["Buy", "Sell"].map((label) => (
          <span
            key={label}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              label === "Buy" ? "bg-green-500 text-white" : "border border-black/10 text-foreground/60 dark:border-white/15"
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      <label className="relative flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Ticker or company name</span>
        <input
          readOnly
          value={symbol ? `${symbol} — ${DEMO_TRADE.name}` : searchInput}
          placeholder="AAPL"
          className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
        />
        {showSuggestion && (
          <ul className="absolute top-full z-10 mt-1 w-full overflow-auto rounded-md border border-black/10 bg-background text-sm shadow-lg dark:border-white/15">
            <li>
              <span className="block w-full px-3 py-2 text-left">
                <span className="font-medium text-foreground">{DEMO_TRADE.symbol}</span>{" "}
                <span className="text-foreground/60">{DEMO_TRADE.name}</span>
              </span>
            </li>
          </ul>
        )}
      </label>

      {symbol && (
        <p className="animate-nav-item-fade-in motion-reduce:animate-none text-sm text-foreground/60">
          Current price: <span className="font-medium text-foreground">{currencyFormatter.format(DEMO_TRADE.price)}</span>
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Quantity</span>
        <input
          readOnly
          value={quantity}
          placeholder="10"
          className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
        />
      </label>

      {showEstimate && (
        <p className="animate-nav-item-fade-in motion-reduce:animate-none text-sm text-foreground/60">
          Estimated total:{" "}
          <span className="font-medium text-foreground">{currencyFormatter.format(DEMO_TRADE.price * quantityNum)}</span>
        </p>
      )}

      <button
        type="button"
        className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        Buy
      </button>
    </form>
  );
}
