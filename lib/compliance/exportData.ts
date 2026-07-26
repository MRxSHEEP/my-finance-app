import { prisma } from "@/lib/prisma";

export type ReportKey = "disclosures" | "preclearance" | "flags" | "restricted-list" | "audit-log";

export const REPORT_KEYS: ReportKey[] = ["disclosures", "preclearance", "flags", "restricted-list", "audit-log"];

export interface ReportTable {
  title: string;
  columns: string[];
  rows: string[][];
}

function formatDate(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

function formatDateTime(value: Date | null | undefined): string {
  return value ? value.toISOString().replace("T", " ").slice(0, 19) : "";
}

async function resolveUserNames(userIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, name: true, email: true } });
  return new Map(users.map((u) => [u.id, u.name ?? u.email]));
}

// Builds a plain {title, columns, rows} table shared by both the CSV and
// PDF export routes, so the two formats never drift out of sync with each
// other or re-derive the same Prisma queries/formatting twice.
export async function buildReportTable(organizationId: string, report: ReportKey): Promise<ReportTable | null> {
  if (report === "disclosures") {
    const rows = await prisma.tradeDisclosure.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    const names = await resolveUserNames(rows.map((r) => r.userId));
    return {
      title: "Trade Disclosures",
      columns: ["Employee", "Ticker", "Type", "Quantity", "Trade Date", "Disclosed", "Notes"],
      rows: rows.map((r) => [
        names.get(r.userId) ?? r.userId,
        r.ticker,
        r.transactionType,
        String(r.quantity),
        formatDate(r.tradeDate),
        formatDateTime(r.createdAt),
        r.notes ?? "",
      ]),
    };
  }

  if (report === "preclearance") {
    const rows = await prisma.preclearanceRequest.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    const names = await resolveUserNames([...rows.map((r) => r.userId), ...rows.map((r) => r.decidedByUserId).filter((id): id is string => Boolean(id))]);
    return {
      title: "Pre-Clearance Requests",
      columns: ["Employee", "Ticker", "Type", "Quantity", "Proposed Date", "Status", "Decided By", "Decision Notes"],
      rows: rows.map((r) => [
        names.get(r.userId) ?? r.userId,
        r.ticker,
        r.transactionType,
        String(r.quantity),
        formatDate(r.proposedTradeDate),
        r.status,
        r.decidedByUserId ? names.get(r.decidedByUserId) ?? r.decidedByUserId : "",
        r.decisionNotes ?? "",
      ]),
    };
  }

  if (report === "flags") {
    const rows = await prisma.complianceFlag.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    const names = await resolveUserNames(rows.map((r) => r.userId));
    return {
      title: "Compliance Flags",
      columns: ["Employee", "Ticker", "Flag Type", "Trade Date", "Status", "Flagged At"],
      rows: rows.map((r) => [
        names.get(r.userId) ?? r.userId,
        r.ticker,
        r.flagType,
        formatDate(r.tradeDate),
        r.status,
        formatDateTime(r.createdAt),
      ]),
    };
  }

  if (report === "restricted-list") {
    const rows = await prisma.restrictedListEntry.findMany({
      where: { organizationId },
      orderBy: { addedAt: "desc" },
    });
    const names = await resolveUserNames([...rows.map((r) => r.addedByUserId), ...rows.map((r) => r.removedByUserId).filter((id): id is string => Boolean(id))]);
    return {
      title: "Restricted List",
      columns: ["Ticker", "Company", "Added By", "Added", "Removed By", "Removed", "Notes"],
      rows: rows.map((r) => [
        r.ticker,
        r.companyName ?? "",
        names.get(r.addedByUserId) ?? r.addedByUserId,
        formatDateTime(r.addedAt),
        r.removedByUserId ? names.get(r.removedByUserId) ?? r.removedByUserId : "",
        formatDateTime(r.removedAt),
        r.notes ?? "",
      ]),
    };
  }

  if (report === "audit-log") {
    const rows = await prisma.auditLogEntry.findMany({
      where: { organizationId, featureArea: "compliance" },
      orderBy: { createdAt: "desc" },
    });
    const names = await resolveUserNames(rows.map((r) => r.actorUserId));
    return {
      title: "Audit Log",
      columns: ["When", "Actor", "Action", "Ticker"],
      rows: rows.map((r) => [
        formatDateTime(r.createdAt),
        names.get(r.actorUserId) ?? r.actorUserId,
        r.action,
        r.ticker ?? "",
      ]),
    };
  }

  return null;
}
