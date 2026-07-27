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

// Form 4 transaction types that reduce an insider's real share count —
// everything else this pipeline classifies is treated as an acquisition.
// sell/partial_sell and tax_withholding (shares surrendered to cover tax,
// by definition a disposal) are unambiguous; gift is the one genuine
// judgment call — a corporate insider's Form 4 "gift" is far more often
// them giving shares away (estate/charitable planning) than receiving
// company stock as a personal gift, so it's grouped here too, best-effort
// rather than guaranteed correct (Form 4's own acquired/disposed flag
// isn't captured by this pipeline to disambiguate further).
const DISPOSAL_TRANSACTION_TYPES = new Set(["sell", "partial_sell", "tax_withholding", "gift"]);

// Recomputes TrackerHolding rows for an insider-type entity from its
// accumulated TrackerTransaction rows — unlike the range-based congress
// path above, Form 4 data reports a real share count per transaction, so
// this accumulates net SHARES directly rather than a dollar midpoint.
// That distinction matters a lot in practice: RSU vesting/grants/most
// option exercises are routinely reported at $0 (no cash changes hands),
// so a dollar-based net would undercount real share accumulation for any
// insider whose compensation is RSU-heavy — confirmed live, this was
// exactly why "Current Holdings"/"Est. Portfolio Value" showed 0 for an
// active insider like Alphabet's despite real accumulated share activity.
// "other" (an unrecognized transaction code) is deliberately excluded
// from the sum entirely rather than guessed at in either direction.
export async function recomputeShareBasedHoldings(trackedEntityId: string): Promise<void> {
  const transactions = await prisma.trackerTransaction.findMany({
    where: { trackedEntityId, ticker: { not: null }, shares: { not: null } },
  });

  const byTicker = new Map<
    string,
    { issuerName: string | null; netShares: number; lastKnownPrice: number | null; latestDate: Date | null }
  >();

  for (const tx of transactions) {
    if (!tx.ticker || tx.shares == null || tx.transactionType === "other") continue;

    const isDisposal = DISPOSAL_TRANSACTION_TYPES.has(tx.transactionType);
    const signedShares = isDisposal ? -tx.shares : tx.shares;

    const entry = byTicker.get(tx.ticker) ?? { issuerName: tx.issuerName, netShares: 0, lastKnownPrice: null, latestDate: null };
    entry.netShares += signedShares;
    const txDate = tx.reportedDate ?? tx.disclosureDate;
    // A real (non-zero) price is a better basis for the filing-time value
    // estimate than a $0 vesting/award price would be — prefer the latest
    // transaction that actually reported one, not just the latest overall.
    if (tx.pricePerShare && (!entry.latestDate || !txDate || txDate >= entry.latestDate)) {
      entry.lastKnownPrice = tx.pricePerShare;
    }
    if (txDate && (!entry.latestDate || txDate > entry.latestDate)) entry.latestDate = txDate;
    if (!entry.issuerName && tx.issuerName) entry.issuerName = tx.issuerName;
    byTicker.set(tx.ticker, entry);
  }

  for (const [ticker, entry] of byTicker) {
    if (entry.netShares <= 0) {
      await prisma.trackerHolding.deleteMany({ where: { trackedEntityId, ticker } });
      continue;
    }

    const estimatedValue = entry.lastKnownPrice != null ? entry.netShares * entry.lastKnownPrice : 0;

    await prisma.trackerHolding.upsert({
      where: { trackedEntityId_ticker: { trackedEntityId, ticker } },
      update: {
        shares: entry.netShares,
        estimatedValue,
        issuerName: entry.issuerName,
        asOfDate: entry.latestDate ?? new Date(),
        isEstimate: true,
      },
      create: {
        trackedEntityId,
        ticker,
        shares: entry.netShares,
        issuerName: entry.issuerName,
        estimatedValue,
        asOfDate: entry.latestDate ?? new Date(),
        isEstimate: true,
      },
    });
  }
}
