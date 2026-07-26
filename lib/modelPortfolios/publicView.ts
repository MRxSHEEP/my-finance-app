import { prisma } from "@/lib/prisma";
import { NOTIONAL_BASE, fetchHoldingPrices, computeValueFromPrices } from "@/lib/modelPortfolios/valuation";

// Deliberately minimal, explicitly-typed — every field is named here, never
// "whatever the internal model returns." Absent on purpose: the real
// ModelPortfolio.id, organizationId, createdByUserId/advisor name or email,
// priceAtCreation per holding (internal reference data), share-link id/
// active state, and anything about the advisor's OTHER portfolios (this
// query is scoped to exactly one row, by token — nothing else is ever
// fetched).
export interface PublicShareHolding {
  symbol: string;
  name: string | null;
  targetWeightPercent: number;
}

export interface PublicShareView {
  portfolioName: string;
  // The firm's name — the intended "who is this from." Never the
  // individual advisor's personal name or email.
  organizationName: string;
  holdings: PublicShareHolding[];
  performanceSeries: { date: string; value: number }[];
  totalValue: number;
  notionalBase: number;
  totalReturnPercent: number;
  asOfDate: string;
}

// Looks up by TOKEN ALONE — never by portfolio id, so there is no
// "id-with-token-as-an-afterthought" IDOR pattern to get wrong. Returns
// null (never a partial/degraded object) whenever the link doesn't exist
// OR is inactive, so a revoked link and a never-existed link are
// indistinguishable from the outside.
export async function getPublicShareView(token: string): Promise<PublicShareView | null> {
  const link = await prisma.modelPortfolioShareLink.findUnique({
    where: { token },
    select: {
      active: true,
      modelPortfolio: {
        select: {
          name: true,
          createdAt: true,
          organization: { select: { name: true } },
          holdings: {
            select: { assetType: true, symbol: true, name: true, targetWeightPercent: true, priceAtCreation: true },
          },
          snapshots: { select: { asOfDate: true, value: true }, orderBy: { asOfDate: "asc" } },
        },
      },
    },
  });

  if (!link || !link.active) return null;

  const mp = link.modelPortfolio;
  const prices = await fetchHoldingPrices(mp.holdings);
  const totalValue = computeValueFromPrices(mp.holdings, prices);

  const performanceSeries = [
    { date: mp.createdAt.toISOString(), value: NOTIONAL_BASE },
    ...mp.snapshots.map((s) => ({ date: s.asOfDate.toISOString(), value: s.value })),
    { date: new Date().toISOString(), value: totalValue },
  ];

  return {
    portfolioName: mp.name,
    organizationName: mp.organization.name,
    holdings: mp.holdings.map((h) => ({
      symbol: h.symbol,
      name: h.name,
      targetWeightPercent: h.targetWeightPercent,
    })),
    performanceSeries,
    totalValue,
    notionalBase: NOTIONAL_BASE,
    totalReturnPercent: ((totalValue - NOTIONAL_BASE) / NOTIONAL_BASE) * 100,
    asOfDate: new Date().toISOString(),
  };
}
