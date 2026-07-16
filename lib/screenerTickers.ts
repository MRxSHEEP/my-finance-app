// A curated sample of well-known, liquid tickers spanning most major
// sectors — a practical stand-in for a full market database, which isn't
// feasible to fetch live against Finnhub's free-tier rate limit (see
// app/api/screener/route.ts). Sector labels for filtering come live from
// each ticker's own Finnhub profile rather than being hand-assigned here,
// so this list only needs to name the tickers.
export const SCREENER_TICKERS: string[] = [
  // Mega-cap tech ("Mag 7")
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
  // Technology / software / semiconductors
  "ORCL", "CRM", "ADBE", "INTC", "AMD", "CSCO", "IBM", "QCOM", "AVGO", "TXN", "NOW", "PANW",
  // Financials
  "JPM", "BAC", "WFC", "GS", "MS", "V", "MA", "AXP", "SCHW", "BLK",
  // Healthcare
  "JNJ", "UNH", "PFE", "ABBV", "MRK", "LLY", "TMO", "ABT",
  // Consumer
  "PG", "KO", "PEP", "WMT", "COST", "MCD", "NKE", "HD", "DIS", "SBUX",
  // Energy
  "XOM", "CVX", "COP", "SLB",
  // Industrials
  "BA", "CAT", "GE", "HON", "UPS", "LMT",
  // Communication / telecom
  "T", "VZ", "CMCSA", "NFLX",
  // Utilities
  "NEE", "DUK", "SO",
  // Materials
  "LIN", "SHW",
  // Real estate
  "PLD", "AMT",
];
