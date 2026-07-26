import { NextResponse } from "next/server";
import { STOCK_CATALOG } from "@/lib/stockCatalog";

// Sector/search filtering and "Load More" windowing all happen client-side
// now (StockCatalogSection.tsx) — the curated catalog is small enough
// (~130 static rows, no upstream API calls) that shipping the whole thing
// once and filtering it in the browser is simpler and snappier than
// re-fetching a server-paginated slice on every keystroke or sector change.
export async function GET() {
  return NextResponse.json({ entries: STOCK_CATALOG });
}
