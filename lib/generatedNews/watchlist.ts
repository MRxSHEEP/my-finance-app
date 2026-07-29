// Fixed daily watchlist for the Noble Generated News cron
// (app/api/generated-news/ingest). Deliberately overlaps with
// lib/signals/watchlist.ts's own SIGNALS_WATCHLIST for the stock names,
// same "reuse the same major/liquid names rather than picking different
// tickers just to look independent" convention that file's own header
// already documents. Kept small (6 stocks, not all ~20 of /signals') since
// this cron also covers crypto and commodities, and every item pays the
// same full gather+generate+fact-check cost /signals pays per ticker.
export const GENERATED_NEWS_STOCK_TICKERS = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL"];

// CoinGecko ids — must have an entry in cryptoSymbolMap.ts's
// CRYPTO_ID_TO_MARKETAUX_SYMBOL for the news category to be populated.
export const GENERATED_NEWS_CRYPTO_IDS = ["bitcoin", "ethereum", "solana"];

// Provider symbols from lib/commodityNames.ts's COMMODITY_NAMES.
export const GENERATED_NEWS_COMMODITY_SYMBOLS = ["C:XAUUSD", "USO", "UNG"];
