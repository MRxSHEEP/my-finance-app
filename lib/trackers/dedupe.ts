// App-computed dedupe key for TrackerTransaction rows — mirrors the
// existing string-concat dedupe convention already used in
// app/api/insider-activity/route.ts and app/api/stock/insiders/route.ts,
// rather than a Prisma composite @@unique over nullable columns (Postgres
// treats NULLs as distinct in a unique constraint, which would let
// otherwise-identical rows with a null field slip through as "different").
export function buildDedupeKey(parts: {
  sourceType: string;
  trackedEntitySlug: string;
  ticker: string | null;
  reportedDate: string | null;
  transactionType: string;
  amountLow: number | null;
  amountHigh: number | null;
  exactValue: number | null;
  shares: number | null;
}): string {
  return [
    parts.sourceType,
    parts.trackedEntitySlug,
    parts.ticker ?? "",
    parts.reportedDate ?? "",
    parts.transactionType,
    parts.amountLow ?? "",
    parts.amountHigh ?? "",
    parts.exactValue ?? "",
    parts.shares ?? "",
  ].join(":");
}
