import { NextRequest, NextResponse } from "next/server";
import { withCache } from "@/lib/newsCache";

export const dynamic = "force-dynamic";

// CoinGecko's /derivatives endpoint is a real, free, no-key listing of
// perpetual/futures contracts across exchanges — genuine funding rate and
// open interest data, unlike liquidations/exchange-inflows/on-chain
// activity (see the route's response below), which no provider currently
// configured in this app actually supplies.
const CACHE_TTL_MS = 5 * 60_000;
const MAX_CONTRACTS = 8;

interface RawContract {
  market: string;
  symbol: string;
  index_id: string | null;
  contract_type: string;
  funding_rate: number | null;
  open_interest: number | null;
  volume_24h: number | null;
}

interface DerivativesResponse {
  available: boolean;
  contractCount: number;
  avgFundingRate: number | null;
  totalOpenInterest: number | null;
  totalVolume24h: number | null;
  topContracts: Array<{
    market: string;
    symbol: string;
    contractType: string;
    fundingRate: number | null;
    openInterest: number | null;
    volume24h: number | null;
  }>;
}

async function fetchAllContracts(): Promise<RawContract[]> {
  return withCache("crypto:derivatives:raw", CACHE_TTL_MS, async (): Promise<RawContract[]> => {
    const response = await fetch("https://api.coingecko.com/api/v3/derivatives").catch(() => null);
    if (!response?.ok) return [];
    const body = await response.json().catch(() => null);
    return Array.isArray(body) ? body : [];
  });
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: "Missing required query parameter: symbol" }, { status: 400 });
  }

  const all = await fetchAllContracts();
  const matches = all.filter((contract) => (contract.index_id ?? "").toUpperCase() === symbol);

  if (matches.length === 0) {
    const empty: DerivativesResponse = {
      available: false,
      contractCount: 0,
      avgFundingRate: null,
      totalOpenInterest: null,
      totalVolume24h: null,
      topContracts: [],
    };
    return NextResponse.json(empty);
  }

  const fundingRates = matches.map((c) => c.funding_rate).filter((v): v is number => v !== null);
  const avgFundingRate =
    fundingRates.length > 0 ? fundingRates.reduce((sum, v) => sum + v, 0) / fundingRates.length : null;
  const totalOpenInterest = matches.reduce((sum, c) => sum + (c.open_interest ?? 0), 0);
  const totalVolume24h = matches.reduce((sum, c) => sum + (c.volume_24h ?? 0), 0);

  const topContracts = [...matches]
    .sort((a, b) => (b.open_interest ?? 0) - (a.open_interest ?? 0))
    .slice(0, MAX_CONTRACTS)
    .map((c) => ({
      market: c.market,
      symbol: c.symbol,
      contractType: c.contract_type,
      fundingRate: c.funding_rate,
      openInterest: c.open_interest,
      volume24h: c.volume_24h,
    }));

  const data: DerivativesResponse = {
    available: true,
    contractCount: matches.length,
    avgFundingRate,
    totalOpenInterest,
    totalVolume24h,
    topContracts,
  };

  return NextResponse.json(data);
}
