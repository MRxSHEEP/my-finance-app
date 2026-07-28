"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import DcfBlock, { toDcfInputs } from "@/components/reporting/blocks/DcfBlock";
import DcaBlock, { toDcaInputs } from "@/components/reporting/blocks/DcaBlock";
import EbitdaBlock, { toEbitdaInputs } from "@/components/reporting/blocks/EbitdaBlock";
import EvEbitdaBlock, { toEvEbitdaInputs } from "@/components/reporting/blocks/EvEbitdaBlock";
import PegBlock, { toPegInputs } from "@/components/reporting/blocks/PegBlock";
import SimulatedPortfolioPicker from "@/components/reporting/SimulatedPortfolioPicker";
import ManualHoldingsEditor, { type ManualHolding } from "@/components/reporting/ManualHoldingsEditor";

type CalculatorType = "dcf" | "dca" | "ebitda" | "ev-ebitda" | "peg";
type PortfolioSource = "none" | "simulated" | "manual";

const CALCULATOR_DEFS: Array<{ type: CalculatorType; label: string }> = [
  { type: "dcf", label: "DCF Valuation" },
  { type: "dca", label: "DCA Simulation" },
  { type: "ebitda", label: "EBITDA" },
  { type: "ev-ebitda", label: "EV/EBITDA" },
  { type: "peg", label: "PEG Ratio" },
];

const EMPTY_FIELD_VALUES: Record<CalculatorType, Record<string, string>> = {
  dcf: {},
  dca: {},
  ebitda: {},
  "ev-ebitda": {},
  peg: {},
};

export default function ReportGeneratorForm({ onCreated }: { onCreated: () => void }) {
  const [clientName, setClientName] = useState("");
  const [enabledTypes, setEnabledTypes] = useState<Set<CalculatorType>>(new Set());
  const [fieldValues, setFieldValues] = useState(EMPTY_FIELD_VALUES);
  const [portfolioSource, setPortfolioSource] = useState<PortfolioSource>("none");
  const [simulatedPortfolioId, setSimulatedPortfolioId] = useState<string | null>(null);
  const [manualHoldings, setManualHoldings] = useState<ManualHolding[]>([]);
  const [narrative, setNarrative] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDraftNarrative =
    portfolioSource !== "none" &&
    clientName.trim().length > 0 &&
    (portfolioSource === "simulated" ? simulatedPortfolioId !== null : manualHoldings.length > 0);

  async function handleDraftNarrative() {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/reporting/reports/draft-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          portfolioSource,
          simulatedPortfolioId: portfolioSource === "simulated" ? simulatedPortfolioId : undefined,
          manualHoldings: portfolioSource === "manual" ? manualHoldings : undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.narrative) {
        setAiError(body?.error ?? "AI commentary is unavailable right now.");
        return;
      }
      setNarrative(body.narrative);
    } catch {
      setAiError("AI commentary is unavailable right now.");
    } finally {
      setAiLoading(false);
    }
  }

  function toggleType(type: CalculatorType) {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function updateField(type: CalculatorType, key: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [type]: { ...prev[type], [key]: value } }));
  }

  function buildCalculatorPayload(type: CalculatorType) {
    const values = fieldValues[type];
    if (type === "dcf") return { type, inputs: toDcfInputs(values) };
    if (type === "dca") return { type, inputs: toDcaInputs(values) };
    if (type === "ebitda") return { type, inputs: toEbitdaInputs(values) };
    if (type === "ev-ebitda") return { type, inputs: toEvEbitdaInputs(values) };
    return { type, inputs: toPegInputs(values) };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientName.trim()) return setError("Client name is required.");
    if (enabledTypes.size === 0) return setError("Select at least one calculator.");
    if (portfolioSource === "simulated" && !simulatedPortfolioId) return setError("Select a simulated portfolio.");
    if (portfolioSource === "manual" && manualHoldings.length === 0) {
      return setError("Add at least one manual holding.");
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reporting/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          calculators: Array.from(enabledTypes).map(buildCalculatorPayload),
          portfolioSource,
          simulatedPortfolioId: portfolioSource === "simulated" ? simulatedPortfolioId : undefined,
          manualHoldings: portfolioSource === "manual" ? manualHoldings : undefined,
          narrativeCommentary: narrative.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return setError(body?.error ?? "Failed to generate report");

      setClientName("");
      setEnabledTypes(new Set());
      setFieldValues(EMPTY_FIELD_VALUES);
      setPortfolioSource("none");
      setSimulatedPortfolioId(null);
      setManualHoldings([]);
      setNarrative("");
      setAiError(null);
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className={cardClass("indigo", { extra: "flex flex-col gap-3 p-4" })}>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Client Name</span>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full max-w-sm rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-400/50 dark:border-white/15 dark:focus:border-blue-400/50"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {CALCULATOR_DEFS.map((def) => (
            <button
              key={def.type}
              type="button"
              onClick={() => toggleType(def.type)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out ${
                enabledTypes.has(def.type)
                  ? "bg-indigo-500 text-white"
                  : "border border-black/10 text-foreground/60 hover:text-foreground dark:border-white/15"
              }`}
            >
              {def.label}
            </button>
          ))}
        </div>
      </div>

      {CALCULATOR_DEFS.filter((def) => enabledTypes.has(def.type)).map((def) => (
        <div key={def.type} className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
          <h3 className="text-sm font-semibold text-foreground">{def.label}</h3>
          {def.type === "dcf" && (
            <DcfBlock values={fieldValues.dcf} onFieldChange={(k, v) => updateField("dcf", k, v)} />
          )}
          {def.type === "dca" && (
            <DcaBlock values={fieldValues.dca} onFieldChange={(k, v) => updateField("dca", k, v)} />
          )}
          {def.type === "ebitda" && (
            <EbitdaBlock values={fieldValues.ebitda} onFieldChange={(k, v) => updateField("ebitda", k, v)} />
          )}
          {def.type === "ev-ebitda" && (
            <EvEbitdaBlock values={fieldValues["ev-ebitda"]} onFieldChange={(k, v) => updateField("ev-ebitda", k, v)} />
          )}
          {def.type === "peg" && (
            <PegBlock values={fieldValues.peg} onFieldChange={(k, v) => updateField("peg", k, v)} />
          )}
        </div>
      ))}

      <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
        <h3 className="text-sm font-semibold text-foreground">Portfolio (optional)</h3>
        <div className="flex gap-2">
          {(["none", "simulated", "manual"] as PortfolioSource[]).map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => setPortfolioSource(source)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out ${
                portfolioSource === source
                  ? "bg-indigo-500 text-white"
                  : "border border-black/10 text-foreground/60 hover:text-foreground dark:border-white/15"
              }`}
            >
              {source === "none" ? "None" : source === "simulated" ? "Simulated Portfolio" : "Manual Holdings"}
            </button>
          ))}
        </div>
        {portfolioSource === "simulated" && (
          <SimulatedPortfolioPicker selectedId={simulatedPortfolioId} onSelect={setSimulatedPortfolioId} />
        )}
        {portfolioSource === "manual" && (
          <ManualHoldingsEditor holdings={manualHoldings} onChange={setManualHoldings} />
        )}
      </div>

      {portfolioSource !== "none" && (
        <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Sparkles size={15} className="text-indigo-400" />
            AI Commentary (optional)
          </h3>

          {portfolioSource === "manual" && (
            <p className="text-xs text-foreground/50">
              Manual holdings have no linked market data, so a draft here will describe composition and concentration only.
            </p>
          )}

          <button
            type="button"
            onClick={handleDraftNarrative}
            disabled={!canDraftNarrative || aiLoading}
            className="self-start rounded-md border border-indigo-400/30 px-3 py-1.5 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-400/10 disabled:opacity-50"
          >
            {aiLoading ? "Drafting…" : narrative ? "Regenerate draft" : "Draft AI Commentary"}
          </button>

          {aiError && <p className="text-sm text-red-500">{aiError}</p>}

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Narrative (editable)</span>
            <textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              rows={5}
              placeholder="Click “Draft AI Commentary” to generate a suggested narrative, or write your own here."
              className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none transition-colors duration-200 ease-out focus:border-blue-400/50 dark:border-white/15 dark:focus:border-blue-400/50"
            />
          </label>

          {narrative && (
            <button type="button" onClick={() => setNarrative("")} className="self-start text-xs text-foreground/50 hover:text-foreground hover:underline">
              Discard draft
            </button>
          )}

          <p className="text-[10px] italic text-foreground/40">
            AI-generated draft for review only. Edit or discard as you see fit — only the text left here when you click &quot;Generate Report&quot; below is
            included, and it will appear in the delivered PDF exactly as written, with a disclosure noting it was AI-drafted and advisor-reviewed.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Generating…" : "Generate Report"}
      </button>
    </form>
  );
}
