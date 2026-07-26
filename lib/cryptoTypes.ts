// Shared between /api/crypto/rankings, /api/crypto/global, and every
// /crypto page component that reads their data — centralized here since
// this is now the one shared price/market source for the whole page
// (see the comment atop app/api/crypto/rankings/route.ts for why), so
// every consumer needs to agree on exactly one shape rather than each
// redeclaring its own copy.
export interface CoinRanking {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  marketCap: number;
  marketCapRank: number | null;
  totalVolume: number;
  priceChange24h: number | null;
  percentChange1h: number | null;
  percentChange24h: number | null;
  percentChange7d: number | null;
  sparkline7d: number[] | null;
  circulatingSupply: number | null;
}

export interface GlobalMarketStats {
  totalMarketCap: number;
  totalVolume: number;
  btcDominance: number;
  ethDominance: number;
  marketCapChangePercentage24h: number | null;
}
