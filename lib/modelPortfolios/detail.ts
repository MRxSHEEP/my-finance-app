import { prisma } from "@/lib/prisma";
import { NOTIONAL_BASE, fetchHoldingPrices, computeValueFromPrices } from "@/lib/modelPortfolios/valuation";

export interface ModelPortfolioHoldingOut {
  id: string;
  assetType: string;
  symbol: string;
  name: string | null;
  targetWeightPercent: number;
  priceAtCreation: number;
  currentPrice: number | null;
  priceUnavailable: boolean;
}

export interface ModelPortfolioDetail {
  modelPortfolio: {
    id: string;
    organizationId: string;
    createdByUserId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  };
  holdings: ModelPortfolioHoldingOut[];
  totalValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  performanceSeries: { date: string; value: number }[];
  shareLink: { token: string; active: boolean } | null;
}

// The AUTHENTICATED owner/admin view — every field, including internal
// reference data (priceAtCreation) and share-link status. Contrast with
// lib/modelPortfolios/publicView.ts's getPublicShareView, which returns a
// deliberately minimal, explicitly-typed subset for the public route. Both
// call the same computeValueFromPrices formula so the numbers can never
// drift between the two surfaces — mirrors getSimulatedPortfolioDetail's
// "one shared computation, multiple differently-scoped callers" precedent.
export async function getModelPortfolioDetail(id: string): Promise<ModelPortfolioDetail | null> {
  const mp = await prisma.modelPortfolio.findUnique({
    where: { id },
    include: {
      holdings: true,
      snapshots: { orderBy: { asOfDate: "asc" } },
      shareLink: true,
    },
  });
  if (!mp) return null;

  const prices = await fetchHoldingPrices(mp.holdings);
  const totalValue = computeValueFromPrices(mp.holdings, prices);

  const holdings: ModelPortfolioHoldingOut[] = mp.holdings.map((h, i) => ({
    id: h.id,
    assetType: h.assetType,
    symbol: h.symbol,
    name: h.name,
    targetWeightPercent: h.targetWeightPercent,
    priceAtCreation: h.priceAtCreation,
    currentPrice: prices[i],
    priceUnavailable: prices[i] == null,
  }));

  const totalReturn = totalValue - NOTIONAL_BASE;
  const totalReturnPercent = (totalReturn / NOTIONAL_BASE) * 100;

  // Always at least 2 points (creation baseline + right now) even before
  // the daily snapshot cron has ever run — mirrors
  // getSimulatedPortfolioDetail's own performanceSeries construction.
  const performanceSeries = [
    { date: mp.createdAt.toISOString(), value: NOTIONAL_BASE },
    ...mp.snapshots.map((s) => ({ date: s.asOfDate.toISOString(), value: s.value })),
    { date: new Date().toISOString(), value: totalValue },
  ];

  return {
    modelPortfolio: {
      id: mp.id,
      organizationId: mp.organizationId,
      createdByUserId: mp.createdByUserId,
      name: mp.name,
      createdAt: mp.createdAt.toISOString(),
      updatedAt: mp.updatedAt.toISOString(),
    },
    holdings,
    totalValue,
    totalReturn,
    totalReturnPercent,
    performanceSeries,
    shareLink: mp.shareLink ? { token: mp.shareLink.token, active: mp.shareLink.active } : null,
  };
}
