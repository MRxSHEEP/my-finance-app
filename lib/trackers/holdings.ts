import { prisma } from "@/lib/prisma";

// Recomputes TrackerHolding rows for a congress/insider-type entity from
// its accumulated TrackerTransaction rows — a best-effort running
// position, never more precise than the source data allows. Congressional
// disclosures only ever report a value RANGE, never a share count, so
// there's no real "shares held" to sum here — this uses each
// transaction's range midpoint as a rough net-exposure estimate (buys
// add, sells/partial sells subtract, clamped at zero), always flagged
// `isEstimate: true`. This is deliberately cruder than the 13F holdings
// path (lib/trackers/thirteenF.ts), which writes real share counts
// straight from an actual filing — congress/insider tracking can't do
// that because the source data itself doesn't carry share counts.
export async function recomputeRangeBasedHoldings(trackedEntityId: string): Promise<void> {
  const transactions = await prisma.trackerTransaction.findMany({
    where: { trackedEntityId, ticker: { not: null } },
  });

  const byTicker = new Map<string, { issuerName: string | null; net: number; latestDate: Date | null }>();

  for (const tx of transactions) {
    if (!tx.ticker) continue;
    const midpoint =
      tx.exactValue ?? (tx.amountLow != null && tx.amountHigh != null ? (tx.amountLow + tx.amountHigh) / 2 : tx.amountLow ?? 0);

    const entry = byTicker.get(tx.ticker) ?? { issuerName: tx.issuerName, net: 0, latestDate: null };
    const signed = tx.transactionType === "sell" || tx.transactionType === "partial_sell" ? -midpoint : midpoint;
    entry.net += signed;
    const txDate = tx.reportedDate ?? tx.disclosureDate;
    if (txDate && (!entry.latestDate || txDate > entry.latestDate)) entry.latestDate = txDate;
    if (!entry.issuerName && tx.issuerName) entry.issuerName = tx.issuerName;
    byTicker.set(tx.ticker, entry);
  }

  for (const [ticker, entry] of byTicker) {
    // A net at or below zero means the accumulated feed has only ever
    // shown a sell with no corresponding buy on record (unsurprising —
    // there's no backfill, see lib/trackers/congress.ts's own comment) —
    // there's no honest "current holding" to report, so the row is
    // removed rather than shown as a $0 position. It still exists in the
    // transaction history/recent-sells feed regardless.
    if (entry.net <= 0) {
      await prisma.trackerHolding.deleteMany({ where: { trackedEntityId, ticker } });
      continue;
    }

    await prisma.trackerHolding.upsert({
      where: { trackedEntityId_ticker: { trackedEntityId, ticker } },
      update: {
        estimatedValue: entry.net,
        issuerName: entry.issuerName,
        asOfDate: entry.latestDate ?? new Date(),
        isEstimate: true,
      },
      create: {
        trackedEntityId,
        ticker,
        issuerName: entry.issuerName,
        estimatedValue: entry.net,
        asOfDate: entry.latestDate ?? new Date(),
        isEstimate: true,
      },
    });
  }
}
