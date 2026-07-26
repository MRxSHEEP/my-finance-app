import { NextResponse } from "next/server";
import { fetchStockSymbolUniverse } from "@/lib/stockSymbols";

// Deliberately separate from /api/stock/catalog — this is the broad,
// unsectored NYSE/NASDAQ symbol universe (~6,100 entries) used only to
// extend the Stock Catalog's search beyond its curated ~130-ticker list,
// fetched lazily by the client on first search rather than on every page
// load (see components/stocks/StockCatalogSection.tsx).
export async function GET() {
  const entries = await fetchStockSymbolUniverse();
  return NextResponse.json({ entries });
}
