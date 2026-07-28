import { prisma } from "@/lib/prisma";
import type { PreclearanceReviewContext, PriorActivityEntry } from "@/lib/complianceCopilot/types";

// Same rolling window lib/trackers/byTicker.ts's getNotableHoldersForTicker
// uses for "recent activity" — reused here for consistency rather than
// picking a new number, even though the underlying query is different.
const PRIOR_ACTIVITY_WINDOW_DAYS = 180;
const MAX_PRIOR_ACTIVITY = 10;

// Read-only — gathers exactly what already exists for this request (the
// restricted list, the ComplianceFlag rows lib/compliance/flagging.ts
// already created at submission time, and this employee's own recent
// trade/preclearance history in the same ticker) without creating or
// modifying anything. Returns null only when the request itself can't be
// found in this org (never partially — every other field degrades to
// null/empty on its own if that specific lookup comes up empty).
export async function gatherPreclearanceContext(requestId: string, organizationId: string): Promise<PreclearanceReviewContext | null> {
  const request = await prisma.preclearanceRequest.findFirst({
    where: { id: requestId, organizationId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!request) return null;

  const ticker = request.ticker;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - PRIOR_ACTIVITY_WINDOW_DAYS);

  const [restrictedListEntry, existingFlags, priorDisclosures, priorRequests] = await Promise.all([
    prisma.restrictedListEntry.findFirst({ where: { organizationId, ticker, removedAt: null } }),
    prisma.complianceFlag.findMany({
      where: { organizationId, sourceType: "preclearance_request", sourceId: requestId },
    }),
    prisma.tradeDisclosure.findMany({
      where: { organizationId, userId: request.userId, ticker, tradeDate: { gte: cutoff } },
      orderBy: { tradeDate: "desc" },
      take: MAX_PRIOR_ACTIVITY,
    }),
    prisma.preclearanceRequest.findMany({
      where: { organizationId, userId: request.userId, ticker, id: { not: requestId }, proposedTradeDate: { gte: cutoff } },
      orderBy: { proposedTradeDate: "desc" },
      take: MAX_PRIOR_ACTIVITY,
    }),
  ]);

  const priorActivitySameTicker: PriorActivityEntry[] = [
    ...priorDisclosures.map(
      (d): PriorActivityEntry => ({
        source: "trade_disclosure",
        transactionType: d.transactionType,
        quantity: d.quantity,
        date: d.tradeDate.toISOString(),
      })
    ),
    ...priorRequests.map(
      (r): PriorActivityEntry => ({
        source: "preclearance_request",
        transactionType: r.transactionType,
        quantity: r.quantity,
        date: r.proposedTradeDate.toISOString(),
        status: r.status,
      })
    ),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_PRIOR_ACTIVITY);

  return {
    request: {
      ticker,
      transactionType: request.transactionType,
      quantity: request.quantity,
      proposedTradeDate: request.proposedTradeDate.toISOString(),
      notes: request.notes,
      employeeName: request.user.name ?? request.user.email,
    },
    restrictedListEntry: restrictedListEntry
      ? {
          ticker: restrictedListEntry.ticker,
          companyName: restrictedListEntry.companyName,
          notes: restrictedListEntry.notes,
          addedAt: restrictedListEntry.addedAt.toISOString(),
        }
      : null,
    existingFlags: existingFlags.map((f) => ({ flagType: f.flagType, details: f.details })),
    priorActivitySameTicker,
  };
}
