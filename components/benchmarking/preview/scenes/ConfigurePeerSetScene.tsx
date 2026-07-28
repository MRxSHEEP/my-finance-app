"use client";

import { useState } from "react";
import { cardClass } from "@/lib/cardStyles";
import TickerAutocompleteInput from "@/components/TickerAutocompleteInput";
import { DEMO_TICKERS } from "@/components/benchmarking/preview/sampleData";

const OWN = DEMO_TICKERS.find((t) => t.isOwnCompany)!;
const PEERS = DEMO_TICKERS.filter((t) => !t.isOwnCompany);

// Mirrors PeerSetConfigForm.tsx's markup/classes exactly, including reusing
// the REAL TickerAutocompleteInput component (not a recreation) — its
// suggestion dropdown hits /api/stock/suggestions, a public,
// unauthenticated endpoint, so it's safe for a signed-out visitor and
// demonstrates the actual validated-ticker fix this form now has, rather
// than a lookalike raw text input.
export default function ConfigurePeerSetScene() {
  const [ownTicker, setOwnTicker] = useState(OWN.ticker);
  const [peerRows, setPeerRows] = useState(PEERS.map((p) => p.ticker));

  return (
    <div className={cardClass("indigo", { extra: "flex w-full flex-col gap-4 p-4 text-left" })}>
      <h2 className="text-lg font-semibold text-foreground">Configure Peer Set</h2>

      <label className="flex max-w-xs flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Your company&apos;s ticker (optional)</span>
        <TickerAutocompleteInput value={ownTicker} onChange={setOwnTicker} placeholder="e.g. AAPL" />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Peer tickers (up to 6)</span>
        {peerRows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <TickerAutocompleteInput
              value={row}
              onChange={(value) => setPeerRows((rows) => rows.map((r, idx) => (idx === i ? value : r)))}
              placeholder="Ticker"
              className="w-40 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
            />
            <span className="rounded-md border border-black/10 px-2 py-1 text-xs text-foreground/50 dark:border-white/15">
              Remove
            </span>
          </div>
        ))}
        <span className="self-start text-xs text-indigo-400">+ Add peer</span>
      </div>

      <button type="button" className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90">
        Save
      </button>
    </div>
  );
}
