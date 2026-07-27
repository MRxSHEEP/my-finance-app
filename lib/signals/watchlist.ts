// Fixed daily-signal watchlist — ~20 major/liquid mega-caps. Several
// names overlap deliberately with app/api/daily-briefing/route.ts's
// MAG7_SYMBOLS and lib/trackers/insiderForm4.ts's SEEDED_INSIDER_COMPANIES
// where they already do, rather than picking different tickers just to
// look independent.
export interface WatchlistEntry {
  ticker: string;
  companyName: string;
}

export const SIGNALS_WATCHLIST: WatchlistEntry[] = [
  { ticker: "AAPL", companyName: "Apple Inc." },
  { ticker: "MSFT", companyName: "Microsoft Corp." },
  { ticker: "GOOGL", companyName: "Alphabet Inc." },
  { ticker: "AMZN", companyName: "Amazon.com Inc." },
  { ticker: "NVDA", companyName: "NVIDIA Corp." },
  { ticker: "META", companyName: "Meta Platforms Inc." },
  { ticker: "TSLA", companyName: "Tesla Inc." },
  { ticker: "BRK.B", companyName: "Berkshire Hathaway Inc." },
  { ticker: "JPM", companyName: "JPMorgan Chase" },
  { ticker: "V", companyName: "Visa Inc." },
  { ticker: "UNH", companyName: "UnitedHealth Group" },
  { ticker: "XOM", companyName: "Exxon Mobil" },
  { ticker: "JNJ", companyName: "Johnson & Johnson" },
  { ticker: "WMT", companyName: "Walmart" },
  { ticker: "MA", companyName: "Mastercard Inc." },
  { ticker: "PG", companyName: "Procter & Gamble" },
  { ticker: "HD", companyName: "Home Depot" },
  { ticker: "CVX", companyName: "Chevron" },
  { ticker: "ABBV", companyName: "AbbVie Inc." },
  { ticker: "KO", companyName: "Coca-Cola Co." },
];
