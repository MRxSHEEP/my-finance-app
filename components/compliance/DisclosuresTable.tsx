interface Disclosure {
  id: string;
  ticker: string;
  tradeDate: string;
  transactionType: string;
  quantity: number;
  notes: string | null;
  createdAt: string;
  user?: { name: string | null; email: string } | null;
}

interface DisclosuresTableProps {
  disclosures: Disclosure[];
  showEmployeeColumn?: boolean;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Hand-rolled <table> mirroring components/trackers/TrackerDetailView.tsx's
// transaction-history table shape — no shared table component exists
// anywhere in this app yet to import instead.
export default function DisclosuresTable({ disclosures, showEmployeeColumn = false }: DisclosuresTableProps) {
  if (disclosures.length === 0) {
    return <p className="p-4 text-sm text-foreground/50">No trade disclosures yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-black/10 text-xs text-foreground/50 dark:border-white/15">
            {showEmployeeColumn && <th className="p-2 text-left">Employee</th>}
            <th className="p-2 text-left">Ticker</th>
            <th className="p-2 text-left">Type</th>
            <th className="p-2 text-right">Quantity</th>
            <th className="p-2 text-left">Trade date</th>
            <th className="p-2 text-left">Disclosed</th>
            <th className="p-2 text-left">Notes</th>
          </tr>
        </thead>
        <tbody>
          {disclosures.map((d) => (
            <tr key={d.id} className="border-b border-black/5 last:border-0 dark:border-white/10">
              {showEmployeeColumn && (
                <td className="p-2 text-foreground/80">{d.user?.name ?? d.user?.email ?? "—"}</td>
              )}
              <td className="p-2 font-medium text-foreground">{d.ticker}</td>
              <td className={`p-2 capitalize ${d.transactionType === "buy" ? "text-green-500" : "text-red-500"}`}>
                {d.transactionType}
              </td>
              <td className="p-2 text-right text-foreground/80">{d.quantity.toLocaleString()}</td>
              <td className="p-2 text-foreground/80">{formatDate(d.tradeDate)}</td>
              <td className="p-2 text-foreground/50">{formatDate(d.createdAt)}</td>
              <td className="p-2 max-w-[200px] truncate text-foreground/50" title={d.notes ?? undefined}>
                {d.notes ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
