import { FileDown } from "lucide-react";

const REPORTS: Array<{ key: string; label: string }> = [
  { key: "disclosures", label: "Disclosures" },
  { key: "preclearance", label: "Pre-clearance" },
  { key: "flags", label: "Flags" },
  { key: "restricted-list", label: "Restricted list" },
  { key: "audit-log", label: "Audit log" },
];

// Plain <a> anchors, not a client fetch+blob dance — each export route's
// own Content-Disposition: attachment header is what triggers the browser
// download, so no client-side handling is needed here at all.
export default function ExportButtons() {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-black/10 p-4 dark:border-white/15">
      <h3 className="text-sm font-semibold text-foreground">Export reports</h3>
      <div className="flex flex-wrap gap-2">
        {REPORTS.map((report) => (
          <span key={report.key} className="flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/15">
            {report.label}
            <a
              href={`/api/compliance/export/csv?report=${report.key}`}
              className="ml-1 flex items-center gap-1 text-foreground/60 hover:text-foreground"
              title={`Download ${report.label} as CSV`}
            >
              <FileDown size={12} /> CSV
            </a>
            <a
              href={`/api/compliance/export/pdf?report=${report.key}`}
              className="flex items-center gap-1 text-foreground/60 hover:text-foreground"
              title={`Download ${report.label} as PDF`}
            >
              <FileDown size={12} /> PDF
            </a>
          </span>
        ))}
      </div>
    </div>
  );
}
