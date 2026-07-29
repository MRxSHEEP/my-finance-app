// Marketaux's news search uses its own "XXXUSD" symbol format
// (MAJOR_CRYPTO_SYMBOLS in lib/newsApi.ts), distinct from the CoinGecko
// ids this app uses everywhere else for crypto (SimulatedHolding.symbol,
// WatchlistItem.symbol, /api/crypto/detail's ?id=). Scoped to exactly the
// coins already covered by MAJOR_CRYPTO_SYMBOLS ("BTCUSD,ETHUSD,BNBUSD,
// SOLUSD,XRPUSD,DOGEUSD,ADAUSD,AVAXUSD") — ids cross-checked against the
// ones already in active use elsewhere in this app (lib/cryptoCategories.ts).
// A CoinGecko id outside this map honestly skips the news category for its
// generated article rather than guessing a symbol.
export const CRYPTO_ID_TO_MARKETAUX_SYMBOL: Record<string, string> = {
  bitcoin: "BTCUSD",
  ethereum: "ETHUSD",
  binancecoin: "BNBUSD",
  solana: "SOLUSD",
  ripple: "XRPUSD",
  dogecoin: "DOGEUSD",
  cardano: "ADAUSD",
  "avalanche-2": "AVAXUSD",
};

export const CRYPTO_DISPLAY_NAMES: Record<string, string> = {
  bitcoin: "Bitcoin",
  ethereum: "Ethereum",
  binancecoin: "BNB",
  solana: "Solana",
  ripple: "XRP",
  dogecoin: "Dogecoin",
  cardano: "Cardano",
  "avalanche-2": "Avalanche",
};
