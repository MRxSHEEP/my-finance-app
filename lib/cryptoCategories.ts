// Filters and category tags for the "Top Movers" section on /crypto.
//
// CoinGecko's bulk /coins/markets endpoint (the single shared source for
// the whole page, see app/api/crypto/rankings/route.ts) doesn't return an
// exchange-listing count, and fetching per-coin ticker data for every coin
// to check "listed on multiple exchanges" isn't viable under CoinGecko's
// free-tier rate limit (confirmed live: a burst of a dozen requests 429'd
// after only 2 succeeded). Every coin in this dataset already has a
// non-null market_cap_rank, which CoinGecko only assigns to coins it
// tracks across multiple active markets — so requiring a rank plus the
// market-cap/volume floors below covers the "reputable, liquid" intent
// without fabricating a metric the API doesn't provide.
export const MIN_MARKET_CAP_USD = 100_000_000;
export const MIN_VOLUME_24H_USD = 5_000_000;
export const LARGE_CAP_THRESHOLD_USD = 10_000_000_000;

// CoinGecko ids for USD/EUR/gold-pegged stablecoins likely to appear in a
// top-100-by-market-cap pull. Curated by hand (not category-API-driven, to
// avoid extra rate-limited requests) — good enough to keep stablecoins out
// of a "movers" list, not meant as an exhaustive registry.
export const STABLECOIN_IDS = new Set([
  "tether",
  "usd-coin",
  "dai",
  "binance-usd",
  "true-usd",
  "usdd",
  "frax",
  "paxos-standard",
  "gemini-dollar",
  "first-digital-usd",
  "paypal-usd",
  "ethena-usde",
  "usds",
  "stasis-eurs",
  "tether-gold",
  "pax-gold",
  // Found live in the top-100 pull (confirmed trading within a cent of
  // $1) but not covered by the well-known set above.
  "usd1-wlfi",
  "global-dollar",
  "ripple-usd",
  "falcon-finance",
  "bfusd",
  "usdgo",
  "usual-usd",
  "gho",
  "ylds",
  "usx",
  "united-stables",
]);

export type CryptoCategory = "large-cap" | "all" | "defi" | "layer-1" | "ai" | "meme";

// Display order only — matchesCategory()'s per-category filtering logic
// below is keyed by `key`, not array position, so this order has no
// effect on which coins end up in each tab.
export const CATEGORY_TABS: Array<{ key: CryptoCategory; label: string }> = [
  { key: "all", label: "All Coins" },
  { key: "large-cap", label: "Large Cap" },
  { key: "defi", label: "DeFi" },
  { key: "layer-1", label: "Layer 1" },
  { key: "ai", label: "AI" },
  { key: "meme", label: "Meme" },
];

// Curated CoinGecko ids per category, validated against CoinGecko's
// /coins/list. Coins outside these sets simply won't appear under a niche
// tab (still shown under "All Coins"/"Large Cap") — a soft heuristic, not
// a correctness-critical classification.
const DEFI_IDS = new Set([
  "uniswap",
  "aave",
  "maker",
  "sky",
  "curve-dao-token",
  "compound-governance-token",
  "pancakeswap-token",
  "lido-dao",
  "havven", // Synthetix (SNX)
  "yearn-finance",
  "sushi",
  "balancer",
  "1inch",
  "dydx-chain",
  "gmx",
  "convex-finance",
  "frax-share",
  "injective-protocol",
  "thorchain",
  "kyber-network-crystal",
  "0x",
  "loopring",
  "jupiter-exchange-solana",
  "raydium",
  "jito-governance-token",
  "ondo-finance",
  "pendle",
  "ethena",
  "morpho",
  "aerodrome-finance",
]);

const LAYER1_IDS = new Set([
  "ethereum",
  "solana",
  "cardano",
  "avalanche-2",
  "polkadot",
  "cosmos",
  "near",
  "aptos",
  "sui",
  "algorand",
  "tezos",
  "tron",
  "fantom",
  "internet-computer",
  "hedera-hashgraph",
  "kaspa",
  "celestia",
  "sei-network",
  "stellar",
  "litecoin",
  "bitcoin-cash",
  "ripple",
  "matic-network",
  "polygon-ecosystem-token",
  "ethereum-classic",
  "monero",
  "vechain",
  "filecoin",
  "arweave",
  "quant-network",
  "hyperliquid",
  "arbitrum",
  "optimism",
  "starknet",
  "the-open-network",
]);

const AI_IDS = new Set([
  "render-token",
  "fetch-ai",
  "singularitynet",
  "bittensor",
  "akash-network",
  "ocean-protocol",
  "worldcoin-wld",
  "virtual-protocol",
  "ai16z",
]);

const MEME_IDS = new Set([
  "dogecoin",
  "shiba-inu",
  "pepe",
  "floki",
  "bonk",
  "dogwifcoin",
  "book-of-meme",
  "mog-coin",
  "based-brett",
  "popcat",
  "turbo",
  "pudgy-penguins",
  "official-trump",
]);

export function isStablecoin(id: string): boolean {
  return STABLECOIN_IDS.has(id);
}

export function passesLiquidityFloor(coin: { marketCap: number; totalVolume: number; marketCapRank: number | null }): boolean {
  return (
    coin.marketCapRank !== null &&
    coin.marketCap >= MIN_MARKET_CAP_USD &&
    coin.totalVolume >= MIN_VOLUME_24H_USD
  );
}

export function matchesCategory(coin: { id: string; marketCap: number }, category: CryptoCategory): boolean {
  switch (category) {
    case "large-cap":
      return coin.marketCap >= LARGE_CAP_THRESHOLD_USD;
    case "all":
      return true;
    case "defi":
      return DEFI_IDS.has(coin.id);
    case "layer-1":
      return LAYER1_IDS.has(coin.id);
    case "ai":
      return AI_IDS.has(coin.id);
    case "meme":
      return MEME_IDS.has(coin.id);
  }
}
