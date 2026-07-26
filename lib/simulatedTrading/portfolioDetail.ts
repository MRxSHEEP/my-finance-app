import { prisma } from "@/lib/prisma";
import { getCurrentPrice, type AssetType } from "@/lib/simulatedTrading/pricing";

export interface HoldingOut {
  assetType: string;
  symbol: string;
  name: string | null;
  quantity: number;
  averageCostBasis: number;
  currentPrice: number | null;
  currentValue: number;
  unrealizedGainLoss: number | null;
  unrealizedGainLossPercent: number | null;
  percentOfPortfolio: number;
  priceUnavailable: boolean;
}

export interface SimulatedPortfolioDetail {
  portfolio: {
    id: string;
    tier: string;
    startingBalance: number;
    cashBalance: number;
    createdAt: string;
  };
  totalValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  holdings: HoldingOut[];
  performanceSeries: { date: string; value: number }[];
  recentTransactions: ReturnType<typeof mapTransaction>[];
  allTransactions: ReturnType<typeof mapTransaction>[];
}

function mapTransaction(t: {
  id: string;
  assetType: string;
  symbol: string;
  name: string | null;
  transactionType: string;
  quantity: number;
  price: number;
  totalValue: number;
  createdAt: Date;
}) {
  return {
    id: t.id,
    assetType: t.assetType,
    symbol: t.symbol,
    name: t.name,
    transactionType: t.transactionType,
    quantity: t.quantity,
    price: t.price,
    totalValue: t.totalValue,
    createdAt: t.createdAt.toISOString(),
  };
}

// Extracted from app/api/simulated-portfolio/[id]/route.ts's post-ownership-
// check computation (price-fetch/valuation/holdings-shaping), unchanged —
// that route still does its own same-user ownership check before calling
// this, and remains the only strictly-owner-scoped caller. The Reporting
// PDF route (White-Label Branded Reporting) is the second caller: it needs
// to render a report referencing another org member's SimulatedPortfolio
// under an Admin's oversight, which this route's ownership check would
// otherwise block — Report-level authorization (creator-or-org-admin)
// already covers that access instead, so the PDF route calls this helper
// directly, skipping the ownership check entirely rather than weakening it.
export async function getSimulatedPortfolioDetail(portfolioId: string): Promise<SimulatedPortfolioDetail | null> {
  const portfolio = await prisma.simulatedPortfolio.findUnique({
    where: { id: portfolioId },
    include: {
      holdings: true,
      transactions: { orderBy: [{ createdAt: "desc" }] },
      snapshots: { orderBy: { asOfDate: "asc" } },
    },
  });

  if (!portfolio) return null;

  const priceResults = await Promise.all(
    portfolio.holdings.map((h) => getCurrentPrice(h.assetType as AssetType, h.symbol))
  );

  // A holding whose live price couldn't be fetched right now still needs
  // *some* value to sum into the portfolio total — its own book value
  // (quantity * average cost basis) stands in, flagged via
  // `priceUnavailable` rather than silently treated as $0 or omitted.
  const bookValueSubtotal = portfolio.holdings.reduce((sum, h, i) => {
    if (priceResults[i]) return sum;
    return sum + h.quantity * h.averageCostBasis;
  }, 0);
  const liveValueSubtotal = portfolio.holdings.reduce((sum, h, i) => {
    const priceResult = priceResults[i];
    return sum + (priceResult ? h.quantity * priceResult.price : 0);
  }, 0);
  const totalHoldingsValue = liveValueSubtotal + bookValueSubtotal;
  const totalValue = portfolio.cashBalance + totalHoldingsValue;

  const holdings: HoldingOut[] = portfolio.holdings.map((h, i) => {
    const priceResult = priceResults[i];
    const currentPrice = priceResult?.price ?? null;
    const currentValue = currentPrice != null ? h.quantity * currentPrice : h.quantity * h.averageCostBasis;
    const costTotal = h.quantity * h.averageCostBasis;
    const unrealizedGainLoss = currentPrice != null ? currentValue - costTotal : null;
    const unrealizedGainLossPercent =
      unrealizedGainLoss != null && costTotal > 0 ? (unrealizedGainLoss / costTotal) * 100 : null;

    return {
      assetType: h.assetType,
      symbol: h.symbol,
      name: h.name,
      quantity: h.quantity,
      averageCostBasis: h.averageCostBasis,
      currentPrice,
      currentValue,
      unrealizedGainLoss,
      unrealizedGainLossPercent,
      percentOfPortfolio: totalValue > 0 ? (currentValue / totalValue) * 100 : 0,
      priceUnavailable: currentPrice == null,
    };
  });

  const totalReturn = totalValue - portfolio.startingBalance;
  const totalReturnPercent = portfolio.startingBalance > 0 ? (totalReturn / portfolio.startingBalance) * 100 : 0;

  // Always at least 2 points (creation baseline + right now) even before
  // the daily snapshot cron has ever run for this portfolio — see
  // app/api/simulated-portfolio/snapshot/route.ts.
  const performanceSeries = [
    { date: portfolio.createdAt.toISOString(), value: portfolio.startingBalance },
    ...portfolio.snapshots.map((s) => ({ date: s.asOfDate.toISOString(), value: s.totalValue })),
    { date: new Date().toISOString(), value: totalValue },
  ];

  const transactionsOut = portfolio.transactions.map(mapTransaction);

  return {
    portfolio: {
      id: portfolio.id,
      tier: portfolio.tier,
      startingBalance: portfolio.startingBalance,
      cashBalance: portfolio.cashBalance,
      createdAt: portfolio.createdAt.toISOString(),
    },
    totalValue,
    totalReturn,
    totalReturnPercent,
    holdings,
    performanceSeries,
    recentTransactions: transactionsOut.slice(0, 10),
    allTransactions: transactionsOut,
  };
}
