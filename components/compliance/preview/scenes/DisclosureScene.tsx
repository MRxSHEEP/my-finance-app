import { Check, FileText } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import { DEMO_DISCLOSURE } from "@/components/compliance/preview/sampleData";

// Mirrors TradeReportForm.tsx's "disclosure" mode markup/classes, but with
// static/disabled fields instead of live TickerAutocompleteInput + state —
// this scene never fetches, so there's nothing for a viewer's cursor to
// trigger even if they click into it.
export default function DisclosureScene() {
  return (
    <div className={cardClass("indigo", { extra: "flex flex-col gap-4 p-4" })}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <FileText size={15} className="text-indigo-400" />
        Report a trade
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Ticker</span>
          <input
            readOnly
            value={DEMO_DISCLOSURE.ticker}
            className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Trade date</span>
          <input
            readOnly
            type="date"
            value={DEMO_DISCLOSURE.tradeDate}
            className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Type</span>
          <div className="flex gap-2">
            {(["buy", "sell"] as const).map((t) => (
              <span
                key={t}
                className={`flex-1 rounded-md border px-3 py-2 text-center text-sm font-medium capitalize ${
                  t === DEMO_DISCLOSURE.transactionType
                    ? "border-indigo-400/50 bg-indigo-400/10 text-indigo-400"
                    : "border-black/10 text-foreground/40 dark:border-white/15"
                }`}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Quantity</span>
          <div className="flex items-center gap-2 rounded-md border border-black/10 px-3 py-2 dark:border-white/15">
            <span className="w-full text-sm text-foreground">{DEMO_DISCLOSURE.quantity}</span>
          </div>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Notes (optional)</span>
        <p className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm text-foreground/70 dark:border-white/15">
          {DEMO_DISCLOSURE.notes}
        </p>
      </label>

      <div className="flex flex-col gap-3 border-t border-black/10 pt-3 dark:border-white/15">
        <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-500">
          <Check size={16} className="shrink-0" />
          <span>Trade disclosed. 1 compliance flag raised for review.</span>
        </div>

        <span className="inline-flex w-fit items-center gap-1.5 self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background opacity-50">
          <Check size={14} /> Submitted
        </span>
      </div>
    </div>
  );
}
