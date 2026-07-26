"use client";

import { formatCurrency, formatPercent, toNumber } from "@/lib/format";

export interface ManualHolding {
  label: string;
  value: number;
}

interface ManualHoldingsEditorProps {
  holdings: ManualHolding[];
  onChange: (holdings: ManualHolding[]) => void;
}

// Fully freeform {label, value} rows with no live price lookups — per the
// confirmed design decision for the Manual Holdings portfolio source.
export default function ManualHoldingsEditor({ holdings, onChange }: ManualHoldingsEditorProps) {
  const total = holdings.reduce((sum, h) => sum + (Number.isFinite(h.value) ? h.value : 0), 0);

  function updateRow(index: number, patch: { label?: string; valueText?: string }) {
    onChange(
      holdings.map((h, i) => {
        if (i !== index) return h;
        return {
          label: patch.label !== undefined ? patch.label : h.label,
          value: patch.valueText !== undefined ? toNumber(patch.valueText) : h.value,
        };
      })
    );
  }

  function addRow() {
    onChange([...holdings, { label: "", value: 0 }]);
  }

  function removeRow(index: number) {
    onChange(holdings.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      {holdings.map((h, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={h.label}
            onChange={(e) => updateRow(i, { label: e.target.value })}
            placeholder="Label (e.g. Rental Property)"
            className="flex-1 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
          />
          <input
            type="number"
            inputMode="decimal"
            value={h.value || ""}
            onChange={(e) => updateRow(i, { valueText: e.target.value })}
            placeholder="Value"
            className="w-32 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
          />
          <span className="w-14 text-right text-xs text-foreground/50">
            {total > 0 ? formatPercent((h.value / total) * 100) : "—"}
          </span>
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
      {holdings.length > 0 && (
        <p className="text-sm text-foreground/70">
          Total: <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
        </p>
      )}
    </div>
  );
}
