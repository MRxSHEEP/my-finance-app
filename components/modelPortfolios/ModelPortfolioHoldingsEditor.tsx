"use client";

export interface HoldingRow {
  assetType: "stock" | "commodity" | "crypto";
  symbol: string;
  targetWeightPercent: string;
}

interface ModelPortfolioHoldingsEditorProps {
  rows: HoldingRow[];
  onChange: (rows: HoldingRow[]) => void;
}

// Shared repeatable-row editor used by both the create form and the
// detail page's edit form — mirrors ManualHoldingsEditor.tsx's row-array
// pattern (add/remove/update-in-place), extended with an assetType select
// and a live running weight-sum indicator so an advisor sees before
// submitting whether they're at 100%.
export default function ModelPortfolioHoldingsEditor({ rows, onChange }: ModelPortfolioHoldingsEditorProps) {
  const weightSum = rows.reduce((sum, r) => sum + (Number(r.targetWeightPercent) || 0), 0);
  const atTarget = Math.abs(weightSum - 100) <= 0.01;

  function updateRow(index: number, patch: Partial<HoldingRow>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    onChange([...rows, { assetType: "stock", symbol: "", targetWeightPercent: "" }]);
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={row.assetType}
            onChange={(e) => updateRow(i, { assetType: e.target.value as HoldingRow["assetType"] })}
            className="rounded-md border border-black/10 bg-transparent px-2 py-2 text-sm outline-none dark:border-white/15"
          >
            <option value="stock">Stock</option>
            <option value="commodity">Commodity</option>
            <option value="crypto">Crypto</option>
          </select>
          <input
            type="text"
            value={row.symbol}
            onChange={(e) => updateRow(i, { symbol: e.target.value.toUpperCase() })}
            placeholder="Symbol (e.g. VOO)"
            className="flex-1 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
          />
          <input
            type="number"
            inputMode="decimal"
            value={row.targetWeightPercent}
            onChange={(e) => updateRow(i, { targetWeightPercent: e.target.value })}
            placeholder="Weight %"
            className="w-24 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="rounded-md border border-black/10 px-2 py-1 text-xs text-foreground/50 hover:text-foreground dark:border-white/15"
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={addRow} className="self-start text-xs text-indigo-400 hover:underline">
        + Add holding
      </button>
      <p className={`text-xs ${atTarget ? "text-green-500" : "text-foreground/50"}`}>
        Total target weight: {weightSum.toFixed(2)}% {atTarget ? "" : "(must sum to 100%)"}
      </p>
    </div>
  );
}
