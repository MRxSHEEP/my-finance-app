import { prisma } from "@/lib/prisma";
import { logComplianceAction } from "@/lib/compliance/auditLog";
import type { ComplianceFlag } from "@/lib/generated/prisma/client";

// How close (in days, either direction) an employee's trade date has to
// fall to any company insider's own disclosed Form 4 transaction in the
// same ticker to count as a proximity match — a named constant so it's a
// one-line change to tune later, not a decision buried in query code.
const INSIDER_PROXIMITY_WINDOW_DAYS = 7;

interface EvaluateTradeInput {
  organizationId: string;
  userId: string;
  ticker: string;
  tradeDate: Date;
  sourceType: "trade_disclosure" | "preclearance_request";
  sourceId: string;
}

// Called synchronously right after a TradeDisclosure/PreclearanceRequest is
// created — no cron/background job. Checks the org's own restricted list
// first, then this app's existing EDGAR-sourced insider Form 4 data
// (TrackerTransaction rows with sourceType:"insider_form4" — ingested by
// lib/trackers/insiderForm4.ts, no new data source here). At most one flag
// per check (2 total), each carrying every match in `details` rather than
// one row per matched filing, so a ticker with several insiders filing in
// the same window doesn't spam the dashboard with near-duplicate flags.
export async function evaluateTradeForFlags(input: EvaluateTradeInput): Promise<ComplianceFlag[]> {
  const ticker = input.ticker.toUpperCase();
  const flags: ComplianceFlag[] = [];

  const restricted = await prisma.restrictedListEntry.findFirst({
    where: { organizationId: input.organizationId, ticker, removedAt: null },
  });
  if (restricted) {
    flags.push(
      await prisma.complianceFlag.create({
        data: {
          organizationId: input.organizationId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          userId: input.userId,
          ticker,
          tradeDate: input.tradeDate,
          flagType: "restricted_list",
          details: {
            restrictedListEntryId: restricted.id,
            addedByUserId: restricted.addedByUserId,
            addedAt: restricted.addedAt.toISOString(),
            notes: restricted.notes,
          },
        },
      })
    );
  }

  // Reuses TrackerTransaction's existing @@index([ticker]) — same query
  // shape as lib/trackers/byTicker.ts's getNotableHoldersForTicker, scoped
  // to a tight window around this one trade date instead of a rolling cutoff.
  const windowStart = new Date(input.tradeDate);
  windowStart.setUTCDate(windowStart.getUTCDate() - INSIDER_PROXIMITY_WINDOW_DAYS);
  const windowEnd = new Date(input.tradeDate);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + INSIDER_PROXIMITY_WINDOW_DAYS);

  const insiderMatches = await prisma.trackerTransaction.findMany({
    where: {
      ticker,
      sourceType: "insider_form4",
      OR: [
        { tradeDate: { gte: windowStart, lte: windowEnd } },
        { reportedDate: { gte: windowStart, lte: windowEnd } },
      ],
    },
    orderBy: [{ tradeDate: "desc" }, { reportedDate: "desc" }],
    take: 10,
  });

  if (insiderMatches.length > 0) {
    flags.push(
      await prisma.complianceFlag.create({
        data: {
          organizationId: input.organizationId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          userId: input.userId,
          ticker,
          tradeDate: input.tradeDate,
          flagType: "insider_proximity",
          details: {
            windowDays: INSIDER_PROXIMITY_WINDOW_DAYS,
            matches: insiderMatches.map((tx) => ({
              transactionId: tx.id,
              reportingPersonName: tx.reportingPersonName,
              reportingPersonRole: tx.reportingPersonRole,
              transactionType: tx.transactionType,
              tradeDate: tx.tradeDate?.toISOString() ?? null,
              reportedDate: tx.reportedDate?.toISOString() ?? null,
              sourceUrl: tx.sourceUrl,
            })),
          },
        },
      })
    );
  }

  for (const flag of flags) {
    await logComplianceAction({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      action: "flag_created",
      targetType: "ComplianceFlag",
      targetId: flag.id,
      ticker,
      details: { flagType: flag.flagType },
    });
  }

  return flags;
}
