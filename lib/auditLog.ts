import { prisma } from "@/lib/prisma";

export interface LogActionParams {
  organizationId: string;
  actorUserId: string;
  featureArea: string;
  action: string;
  targetType?: string;
  targetId?: string;
  ticker?: string;
  details?: object;
}

// Generic, feature-agnostic audit log — every B2B feature writes here
// instead of inventing its own logging table. Compliance's own
// logComplianceAction() (lib/compliance/auditLog.ts) is a thin wrapper
// around this that always passes featureArea:"compliance".
export async function logAction(params: LogActionParams): Promise<void> {
  await prisma.auditLogEntry.create({
    data: {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      featureArea: params.featureArea,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      ticker: params.ticker,
      details: params.details as object | undefined,
    },
  });
}

export interface QueryAuditLogParams {
  organizationId: string;
  featureArea?: string;
  action?: string;
  ticker?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 25;

// Shared filter/pagination logic — factored out of what was previously
// app/api/compliance/audit-log/route.ts's own hand-rolled query, so any
// future feature's audit-log view reuses the exact same shape instead of
// re-deriving it.
export async function queryAuditLog(params: QueryAuditLogParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const where = {
    organizationId: params.organizationId,
    featureArea: params.featureArea,
    action: params.action,
    ticker: params.ticker,
    createdAt:
      params.from || params.to
        ? {
            gte: params.from && !Number.isNaN(params.from.getTime()) ? params.from : undefined,
            lte: params.to && !Number.isNaN(params.to.getTime()) ? params.to : undefined,
          }
        : undefined,
  };

  const [total, entries] = await Promise.all([
    prisma.auditLogEntry.count({ where }),
    prisma.auditLogEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const actorIds = [...new Set(entries.map((e) => e.actorUserId))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
    : [];
  const actorById = new Map(actors.map((a) => [a.id, a]));

  return {
    entries: entries.map((e) => ({ ...e, actor: actorById.get(e.actorUserId) ?? null })),
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
