import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { getCurrentPrice, type AssetType } from "@/lib/simulatedTrading/pricing";

export const dynamic = "force-dynamic";

const VALID_ASSET_TYPES: AssetType[] = ["stock", "commodity", "crypto"];
const VALID_TX_TYPES = ["buy", "sell"] as const;
// Below this, a sell is treated as "fully closed the position" rather than
// leaving a dust-sized quantity behind from Float rounding.
const QUANTITY_EPSILON = 1e-9;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const assetType = body?.assetType;
  const symbol = typeof body?.symbol === "string" ? body.symbol.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : null;
  const transactionType = body?.transactionType;
  const quantity = Number(body?.quantity);

  if (!VALID_ASSET_TYPES.includes(assetType)) {
    return NextResponse.json({ error: `assetType must be one of: ${VALID_ASSET_TYPES.join(", ")}` }, { status: 400 });
  }
  if (!symbol) {
    return NextResponse.json({ error: "Missing required field: symbol" }, { status: 400 });
  }
  if (!VALID_TX_TYPES.includes(transactionType)) {
    return NextResponse.json({ error: `transactionType must be one of: ${VALID_TX_TYPES.join(", ")}` }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "quantity must be a positive number" }, { status: 400 });
  }

  const portfolio = await prisma.simulatedPortfolio.findUnique({ where: { id } });
  if (!portfolio || portfolio.userId !== auth.userId) {
    return NextResponse.json({ error: "Simulated portfolio not found" }, { status: 404 });
  }

  // Fetched BEFORE the DB transaction below — an external HTTP call has no
  // business holding a database transaction open for its duration.
  const priceResult = await getCurrentPrice(assetType, symbol);
  if (!priceResult) {
    return NextResponse.json(
      { error: "Current price is unavailable for this asset right now — try again shortly" },
      { status: 503 }
    );
  }
  const price = priceResult.price;
  const totalValue = quantity * price;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-read fresh, inside the transaction — protects against a race
      // between two rapid trade requests both reading a stale cash
      // balance or holding quantity (e.g. a double-click).
      const freshPortfolio = await tx.simulatedPortfolio.findUniqueOrThrow({ where: { id } });
      const existingHolding = await tx.simulatedHolding.findUnique({
        where: { portfolioId_assetType_symbol: { portfolioId: id, assetType, symbol } },
      });

      if (transactionType === "buy") {
        if (totalValue > freshPortfolio.cashBalance) {
          throw new TradeError("Insufficient simulated cash balance for this purchase");
        }

        const existingQty = existingHolding?.quantity ?? 0;
        const existingCost = existingHolding?.averageCostBasis ?? 0;
        const newQty = existingQty + quantity;
        const newAvgCost = (existingQty * existingCost + quantity * price) / newQty;

        await tx.simulatedPortfolio.update({
          where: { id },
          data: { cashBalance: freshPortfolio.cashBalance - totalValue },
        });
        await tx.simulatedHolding.upsert({
          where: { portfolioId_assetType_symbol: { portfolioId: id, assetType, symbol } },
          update: { quantity: newQty, averageCostBasis: newAvgCost, name: name ?? existingHolding?.name },
          create: { portfolioId: id, assetType, symbol, name, quantity: newQty, averageCostBasis: newAvgCost },
        });
      } else {
        if (!existingHolding || existingHolding.quantity < quantity - QUANTITY_EPSILON) {
          throw new TradeError("Cannot sell more than you currently hold");
        }

        const remainingQty = existingHolding.quantity - quantity;
        await tx.simulatedPortfolio.update({
          where: { id },
          data: { cashBalance: freshPortfolio.cashBalance + totalValue },
        });
        if (remainingQty <= QUANTITY_EPSILON) {
          await tx.simulatedHolding.delete({ where: { id: existingHolding.id } });
        } else {
          await tx.simulatedHolding.update({ where: { id: existingHolding.id }, data: { quantity: remainingQty } });
        }
      }

      const created = await tx.simulatedTransaction.create({
        data: { portfolioId: id, assetType, symbol, name, transactionType, quantity, price, totalValue },
      });

      return created;
    });

    return NextResponse.json({ transaction: result }, { status: 201 });
  } catch (err) {
    if (err instanceof TradeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

class TradeError extends Error {}
