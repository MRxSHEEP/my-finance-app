import { FileBarChart2 } from "lucide-react";
import { cardClass } from "@/lib/cardStyles";
import { DEMO_CLIENT_NAME } from "@/components/reporting/preview/sampleData";

// Mirrors ReportGeneratorForm.tsx's Client Name field and Portfolio
// (optional) section markup/classes — static values instead of live state,
// same "recreate the real form, no fetch" convention as every scene in the
// Compliance walkthrough (see e.g. DisclosureScene.tsx). Holdings
// themselves aren't shown here — the real form's Simulated Portfolio
// picker only ever shows tier + start date at this step; the actual
// holdings table doesn't appear until the generated report (FinalReportScene).
export default function ClientSetupScene() {
  return (
    <div className="flex flex-col gap-4 text-left">
      <div className={cardClass("indigo", { extra: "flex flex-col gap-3 p-4" })}>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <FileBarChart2 size={15} className="text-indigo-400" />
          New Report
        </h3>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Client Name</span>
          <input
            readOnly
            value={DEMO_CLIENT_NAME}
            className="w-full max-w-sm rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/15"
          />
        </label>
      </div>

      <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-4" })}>
        <h3 className="text-sm font-semibold text-foreground">Portfolio (optional)</h3>
        <div className="flex gap-2">
          {["None", "Simulated Portfolio", "Manual Holdings"].map((source) => (
            <span
              key={source}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                source === "Simulated Portfolio"
                  ? "bg-indigo-500 text-white"
                  : "border border-black/10 text-foreground/60 dark:border-white/15"
              }`}
            >
              {source}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/15">
          <input type="radio" checked readOnly />
          <span className="capitalize text-foreground/80">Growth</span>
          <span className="text-xs text-foreground/50">Started Jul 2, 2026</span>
        </div>
      </div>
    </div>
  );
}
