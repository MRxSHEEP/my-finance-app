import {
  Laptop,
  Cpu,
  Brain,
  HeartPulse,
  Zap,
  Landmark,
  ShoppingBag,
  ShoppingCart,
  Factory,
  Building2,
  Lightbulb,
  Mountain,
  Radio,
  type LucideIcon,
} from "lucide-react";

export interface CatalogEntry {
  symbol: string;
  name: string;
  // Single primary sector — kept as the one-classification-per-company
  // field for consumers that need exactly one bucket per holding (e.g.
  // lib/trackers/profile.ts's sector-allocation pie chart, where a
  // holding can only ever be one slice).
  sector: string;
  // Additional sectors this company reasonably also belongs to, for
  // *filtering* surfaces only (Stock Catalog's sector dropdown, Earnings
  // Calendar's sector filter) — never used for allocation/pie-chart math,
  // where double-counting a holding across two slices would be wrong.
  // Deliberately sparse: only added for mega-caps whose public identity
  // genuinely spans categories a user would reasonably filter by, not an
  // exhaustive re-tagging of all ~130 tickers (see the per-entry comments
  // below for the specific reasoning on each one).
  secondarySectors?: string[];
}

// Custom, somewhat narrative sector labels (not strict GICS) since the
// catalog is meant to be a browsable, thematic discovery tool rather than
// a formal classification — "Artificial Intelligence" and
// "Semiconductors" are split out from "Technology" for exactly that reason.
export const CATALOG_SECTORS = [
  "Technology",
  "Semiconductors",
  "Artificial Intelligence",
  "Healthcare",
  "Energy",
  "Financials",
  "Consumer Discretionary",
  "Consumer Staples",
  "Industrials",
  "Real Estate",
  "Utilities",
  "Materials",
  "Communication Services",
] as const;

export type CatalogSector = (typeof CATALOG_SECTORS)[number];

// One representative icon per sector — shown next to each option in the
// sector filter dropdown and as a small badge on each catalog row, so
// sector browsing reads visually rather than as plain text.
export const CATALOG_SECTOR_ICONS: Record<CatalogSector, LucideIcon> = {
  Technology: Laptop,
  Semiconductors: Cpu,
  "Artificial Intelligence": Brain,
  Healthcare: HeartPulse,
  Energy: Zap,
  Financials: Landmark,
  "Consumer Discretionary": ShoppingBag,
  "Consumer Staples": ShoppingCart,
  Industrials: Factory,
  "Real Estate": Building2,
  Utilities: Lightbulb,
  Materials: Mountain,
  "Communication Services": Radio,
};

export interface SectorColorClasses {
  // Icon tint, used both on the dropdown's own trigger/options and
  // anywhere else a sector needs its own identity color.
  icon: string;
  border: string;
  borderHover: string;
  borderFocus: string;
  // Non-selected list option hover tint.
  optionHover: string;
  // Selected/active state (the dropdown's trigger once a sector is picked,
  // and that sector's row in the open list).
  selectedBg: string;
  selectedText: string;
}

// The resting fill for the Search input and the Sector dropdown trigger —
// deliberately a single neutral shared by every sector (not part of
// SectorColorClasses) so a sector's accent color only ever shows up in its
// border, focus ring, icon, and hover/selected states, never as the
// dominant surface color of the control itself. Matches the tint already
// used for other neutral container surfaces (see NewsTicker's own card).
export const CATALOG_INPUT_BG = "bg-foreground/5";

// One accent color per sector, all pulled from a single source of truth so
// a given sector always renders identically everywhere it's shown (sector
// dropdown icons, the active-filter highlight, and any future sector
// badge) rather than each consumer picking its own shade. Hues are chosen
// to both evoke the sector and stay clear of meanings already spoken for
// elsewhere in the app: Healthcare uses rose (not red) and Financials uses
// emerald (not green) so neither is mistaken for the red/green price-move
// convention used on quote rows, and "All Sectors" deliberately stays out
// of this map — it keeps the app's original purple as a neutral, non-
// sector-specific default (see DEFAULT_SECTOR_COLOR below).
export const CATALOG_SECTOR_COLORS: Record<CatalogSector, SectorColorClasses> = {
  Technology: {
    icon: "text-blue-400",
    border: "border-blue-400/30",
    borderHover: "hover:border-blue-400/50",
    borderFocus: "focus:border-blue-400/60",
    optionHover: "hover:bg-blue-400/10",
    selectedBg: "bg-blue-400/10",
    selectedText: "text-blue-300",
  },
  Semiconductors: {
    icon: "text-cyan-400",
    border: "border-cyan-400/30",
    borderHover: "hover:border-cyan-400/50",
    borderFocus: "focus:border-cyan-400/60",
    optionHover: "hover:bg-cyan-400/10",
    selectedBg: "bg-cyan-400/10",
    selectedText: "text-cyan-300",
  },
  "Artificial Intelligence": {
    icon: "text-fuchsia-400",
    border: "border-fuchsia-400/30",
    borderHover: "hover:border-fuchsia-400/50",
    borderFocus: "focus:border-fuchsia-400/60",
    optionHover: "hover:bg-fuchsia-400/10",
    selectedBg: "bg-fuchsia-400/10",
    selectedText: "text-fuchsia-300",
  },
  Healthcare: {
    icon: "text-rose-400",
    border: "border-rose-400/30",
    borderHover: "hover:border-rose-400/50",
    borderFocus: "focus:border-rose-400/60",
    optionHover: "hover:bg-rose-400/10",
    selectedBg: "bg-rose-400/10",
    selectedText: "text-rose-300",
  },
  Energy: {
    icon: "text-amber-400",
    border: "border-amber-400/30",
    borderHover: "hover:border-amber-400/50",
    borderFocus: "focus:border-amber-400/60",
    optionHover: "hover:bg-amber-400/10",
    selectedBg: "bg-amber-400/10",
    selectedText: "text-amber-300",
  },
  Financials: {
    icon: "text-emerald-400",
    border: "border-emerald-400/30",
    borderHover: "hover:border-emerald-400/50",
    borderFocus: "focus:border-emerald-400/60",
    optionHover: "hover:bg-emerald-400/10",
    selectedBg: "bg-emerald-400/10",
    selectedText: "text-emerald-300",
  },
  "Consumer Discretionary": {
    icon: "text-orange-400",
    border: "border-orange-400/30",
    borderHover: "hover:border-orange-400/50",
    borderFocus: "focus:border-orange-400/60",
    optionHover: "hover:bg-orange-400/10",
    selectedBg: "bg-orange-400/10",
    selectedText: "text-orange-300",
  },
  // Shifted a tier darker/muted than the rest of the palette (600/500
  // instead of 400/300) so it reads as an understated olive rather than a
  // bright neon lime, per the "everyday goods, less flashy" brief.
  "Consumer Staples": {
    icon: "text-lime-600",
    border: "border-lime-600/30",
    borderHover: "hover:border-lime-600/50",
    borderFocus: "focus:border-lime-600/60",
    optionHover: "hover:bg-lime-600/10",
    selectedBg: "bg-lime-600/10",
    selectedText: "text-lime-500",
  },
  Industrials: {
    icon: "text-slate-400",
    border: "border-slate-400/30",
    borderHover: "hover:border-slate-400/50",
    borderFocus: "focus:border-slate-400/60",
    optionHover: "hover:bg-slate-400/10",
    selectedBg: "bg-slate-400/10",
    selectedText: "text-slate-300",
  },
  "Real Estate": {
    icon: "text-indigo-400",
    border: "border-indigo-400/30",
    borderHover: "hover:border-indigo-400/50",
    borderFocus: "focus:border-indigo-400/60",
    optionHover: "hover:bg-indigo-400/10",
    selectedBg: "bg-indigo-400/10",
    selectedText: "text-indigo-300",
  },
  Utilities: {
    icon: "text-yellow-400",
    border: "border-yellow-400/30",
    borderHover: "hover:border-yellow-400/50",
    borderFocus: "focus:border-yellow-400/60",
    optionHover: "hover:bg-yellow-400/10",
    selectedBg: "bg-yellow-400/10",
    selectedText: "text-yellow-300",
  },
  Materials: {
    icon: "text-stone-400",
    border: "border-stone-400/30",
    borderHover: "hover:border-stone-400/50",
    borderFocus: "focus:border-stone-400/60",
    optionHover: "hover:bg-stone-400/10",
    selectedBg: "bg-stone-400/10",
    selectedText: "text-stone-300",
  },
  "Communication Services": {
    icon: "text-sky-400",
    border: "border-sky-400/30",
    borderHover: "hover:border-sky-400/50",
    borderFocus: "focus:border-sky-400/60",
    optionHover: "hover:bg-sky-400/10",
    selectedBg: "bg-sky-400/10",
    selectedText: "text-sky-300",
  },
};

// The neutral default for "All Sectors" — the app's original accent,
// deliberately left as-is since "All" isn't itself a sector.
export const DEFAULT_SECTOR_COLOR: SectorColorClasses = {
  icon: "text-purple-400",
  border: "border-purple-400/30",
  borderHover: "hover:border-purple-400/50",
  borderFocus: "focus:border-purple-400/60",
  optionHover: "hover:bg-purple-400/10",
  selectedBg: "bg-purple-400/10",
  selectedText: "text-purple-300",
};

// A curated, static ticker -> sector mapping (~130 well-known tickers).
// Free-tier APIs don't support live sector-based bulk screening, so this
// is hand-assigned rather than fetched — each ticker has one primary
// sector, plus `secondarySectors` (see CatalogEntry above) for the small,
// deliberately bounded set of mega-caps whose public identity genuinely
// spans categories (Alphabet, Meta, Amazon, Microsoft, NVIDIA — see each
// entry's own comment for the specific reasoning). This is NOT an
// exhaustive multi-sector re-tagging of every ticker here — most
// companies still have a real single best-fit sector, and over-tagging
// (e.g. adding "Technology" to every AI/Semiconductors name too) would
// dilute those filters into meaninglessness.
//
// Note on scope: SpaceX is not and cannot be included here — it's a
// private company with no publicly traded ticker, so there's no valid
// symbol to add it under regardless of sector. This is a genuine data-
// availability limit, not a classification bug.
export const STOCK_CATALOG: CatalogEntry[] = [
  // Technology
  { symbol: "AAPL", name: "Apple Inc.", sector: "Technology" },
  // Also tagged Artificial Intelligence: Copilot across its own product
  // line plus its multibillion-dollar OpenAI partnership/Azure AI
  // infrastructure make Microsoft one of the names a user filtering by
  // "Artificial Intelligence" would reasonably expect to find.
  { symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology", secondarySectors: ["Artificial Intelligence"] },
  { symbol: "ORCL", name: "Oracle Corp.", sector: "Technology" },
  { symbol: "CRM", name: "Salesforce Inc.", sector: "Technology" },
  { symbol: "ADBE", name: "Adobe Inc.", sector: "Technology" },
  { symbol: "IBM", name: "International Business Machines", sector: "Technology" },
  { symbol: "NOW", name: "ServiceNow Inc.", sector: "Technology" },
  { symbol: "INTU", name: "Intuit Inc.", sector: "Technology" },
  { symbol: "SAP", name: "SAP SE", sector: "Technology" },
  { symbol: "CSCO", name: "Cisco Systems Inc.", sector: "Technology" },

  // Semiconductors
  // Also tagged Artificial Intelligence: NVIDIA's GPUs are the dominant
  // hardware behind nearly every frontier AI training/inference workload
  // today — arguably the single most publicly-identified "AI stock,"
  // and a user filtering that category would be surprised not to find it.
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Semiconductors", secondarySectors: ["Artificial Intelligence"] },
  { symbol: "AMD", name: "Advanced Micro Devices Inc.", sector: "Semiconductors" },
  { symbol: "INTC", name: "Intel Corp.", sector: "Semiconductors" },
  { symbol: "TXN", name: "Texas Instruments Inc.", sector: "Semiconductors" },
  { symbol: "QCOM", name: "Qualcomm Inc.", sector: "Semiconductors" },
  { symbol: "AVGO", name: "Broadcom Inc.", sector: "Semiconductors" },
  { symbol: "MU", name: "Micron Technology Inc.", sector: "Semiconductors" },
  { symbol: "AMAT", name: "Applied Materials Inc.", sector: "Semiconductors" },
  { symbol: "LRCX", name: "Lam Research Corp.", sector: "Semiconductors" },
  { symbol: "ASML", name: "ASML Holding N.V.", sector: "Semiconductors" },

  // Artificial Intelligence
  { symbol: "PLTR", name: "Palantir Technologies Inc.", sector: "Artificial Intelligence" },
  { symbol: "AI", name: "C3.ai Inc.", sector: "Artificial Intelligence" },
  { symbol: "SNOW", name: "Snowflake Inc.", sector: "Artificial Intelligence" },
  { symbol: "SMCI", name: "Super Micro Computer Inc.", sector: "Artificial Intelligence" },
  { symbol: "ARM", name: "Arm Holdings plc", sector: "Artificial Intelligence" },
  { symbol: "PATH", name: "UiPath Inc.", sector: "Artificial Intelligence" },
  { symbol: "SOUN", name: "SoundHound AI Inc.", sector: "Artificial Intelligence" },
  { symbol: "CRWD", name: "CrowdStrike Holdings Inc.", sector: "Artificial Intelligence" },
  { symbol: "DDOG", name: "Datadog Inc.", sector: "Artificial Intelligence" },
  { symbol: "NET", name: "Cloudflare Inc.", sector: "Artificial Intelligence" },

  // Healthcare
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
  { symbol: "UNH", name: "UnitedHealth Group Inc.", sector: "Healthcare" },
  { symbol: "PFE", name: "Pfizer Inc.", sector: "Healthcare" },
  { symbol: "MRK", name: "Merck & Co. Inc.", sector: "Healthcare" },
  { symbol: "ABBV", name: "AbbVie Inc.", sector: "Healthcare" },
  { symbol: "LLY", name: "Eli Lilly and Co.", sector: "Healthcare" },
  { symbol: "TMO", name: "Thermo Fisher Scientific Inc.", sector: "Healthcare" },
  { symbol: "ABT", name: "Abbott Laboratories", sector: "Healthcare" },
  { symbol: "BMY", name: "Bristol-Myers Squibb Co.", sector: "Healthcare" },
  { symbol: "GILD", name: "Gilead Sciences Inc.", sector: "Healthcare" },

  // Energy
  { symbol: "XOM", name: "Exxon Mobil Corp.", sector: "Energy" },
  { symbol: "CVX", name: "Chevron Corp.", sector: "Energy" },
  { symbol: "COP", name: "ConocoPhillips", sector: "Energy" },
  { symbol: "SLB", name: "Schlumberger N.V.", sector: "Energy" },
  { symbol: "EOG", name: "EOG Resources Inc.", sector: "Energy" },
  { symbol: "PSX", name: "Phillips 66", sector: "Energy" },
  { symbol: "VLO", name: "Valero Energy Corp.", sector: "Energy" },
  { symbol: "OXY", name: "Occidental Petroleum Corp.", sector: "Energy" },
  { symbol: "MPC", name: "Marathon Petroleum Corp.", sector: "Energy" },
  { symbol: "WMB", name: "Williams Companies Inc.", sector: "Energy" },

  // Financials
  { symbol: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials" },
  { symbol: "BAC", name: "Bank of America Corp.", sector: "Financials" },
  { symbol: "WFC", name: "Wells Fargo & Co.", sector: "Financials" },
  { symbol: "GS", name: "Goldman Sachs Group Inc.", sector: "Financials" },
  { symbol: "MS", name: "Morgan Stanley", sector: "Financials" },
  { symbol: "C", name: "Citigroup Inc.", sector: "Financials" },
  { symbol: "AXP", name: "American Express Co.", sector: "Financials" },
  { symbol: "SCHW", name: "Charles Schwab Corp.", sector: "Financials" },
  { symbol: "BLK", name: "BlackRock Inc.", sector: "Financials" },
  { symbol: "USB", name: "U.S. Bancorp", sector: "Financials" },

  // Consumer Discretionary
  // Also tagged Technology: AWS is the world's largest cloud
  // infrastructure provider — a genuinely separate, massive technology
  // business, not just an e-commerce company's side project.
  { symbol: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Discretionary", secondarySectors: ["Technology"] },
  { symbol: "TSLA", name: "Tesla Inc.", sector: "Consumer Discretionary" },
  { symbol: "HD", name: "Home Depot Inc.", sector: "Consumer Discretionary" },
  { symbol: "NKE", name: "Nike Inc.", sector: "Consumer Discretionary" },
  { symbol: "MCD", name: "McDonald's Corp.", sector: "Consumer Discretionary" },
  { symbol: "SBUX", name: "Starbucks Corp.", sector: "Consumer Discretionary" },
  { symbol: "LOW", name: "Lowe's Companies Inc.", sector: "Consumer Discretionary" },
  { symbol: "TJX", name: "TJX Companies Inc.", sector: "Consumer Discretionary" },
  { symbol: "BKNG", name: "Booking Holdings Inc.", sector: "Consumer Discretionary" },
  { symbol: "CMG", name: "Chipotle Mexican Grill Inc.", sector: "Consumer Discretionary" },

  // Consumer Staples
  { symbol: "PG", name: "Procter & Gamble Co.", sector: "Consumer Staples" },
  { symbol: "KO", name: "Coca-Cola Co.", sector: "Consumer Staples" },
  { symbol: "PEP", name: "PepsiCo Inc.", sector: "Consumer Staples" },
  { symbol: "WMT", name: "Walmart Inc.", sector: "Consumer Staples" },
  { symbol: "COST", name: "Costco Wholesale Corp.", sector: "Consumer Staples" },
  { symbol: "MDLZ", name: "Mondelez International Inc.", sector: "Consumer Staples" },
  { symbol: "CL", name: "Colgate-Palmolive Co.", sector: "Consumer Staples" },
  { symbol: "KMB", name: "Kimberly-Clark Corp.", sector: "Consumer Staples" },
  { symbol: "GIS", name: "General Mills Inc.", sector: "Consumer Staples" },
  { symbol: "STZ", name: "Constellation Brands Inc.", sector: "Consumer Staples" },

  // Industrials
  { symbol: "BA", name: "Boeing Co.", sector: "Industrials" },
  { symbol: "CAT", name: "Caterpillar Inc.", sector: "Industrials" },
  { symbol: "GE", name: "GE Aerospace", sector: "Industrials" },
  { symbol: "HON", name: "Honeywell International Inc.", sector: "Industrials" },
  { symbol: "UPS", name: "United Parcel Service Inc.", sector: "Industrials" },
  { symbol: "LMT", name: "Lockheed Martin Corp.", sector: "Industrials" },
  { symbol: "RTX", name: "RTX Corp.", sector: "Industrials" },
  { symbol: "DE", name: "Deere & Co.", sector: "Industrials" },
  { symbol: "MMM", name: "3M Co.", sector: "Industrials" },
  { symbol: "UNP", name: "Union Pacific Corp.", sector: "Industrials" },

  // Real Estate
  { symbol: "PLD", name: "Prologis Inc.", sector: "Real Estate" },
  { symbol: "AMT", name: "American Tower Corp.", sector: "Real Estate" },
  { symbol: "EQIX", name: "Equinix Inc.", sector: "Real Estate" },
  { symbol: "SPG", name: "Simon Property Group Inc.", sector: "Real Estate" },
  { symbol: "O", name: "Realty Income Corp.", sector: "Real Estate" },
  { symbol: "PSA", name: "Public Storage", sector: "Real Estate" },
  { symbol: "DLR", name: "Digital Realty Trust Inc.", sector: "Real Estate" },
  { symbol: "WELL", name: "Welltower Inc.", sector: "Real Estate" },
  { symbol: "AVB", name: "AvalonBay Communities Inc.", sector: "Real Estate" },
  { symbol: "EQR", name: "Equity Residential", sector: "Real Estate" },

  // Utilities
  { symbol: "NEE", name: "NextEra Energy Inc.", sector: "Utilities" },
  { symbol: "DUK", name: "Duke Energy Corp.", sector: "Utilities" },
  { symbol: "SO", name: "Southern Co.", sector: "Utilities" },
  { symbol: "D", name: "Dominion Energy Inc.", sector: "Utilities" },
  { symbol: "AEP", name: "American Electric Power Co.", sector: "Utilities" },
  { symbol: "EXC", name: "Exelon Corp.", sector: "Utilities" },
  { symbol: "SRE", name: "Sempra", sector: "Utilities" },
  { symbol: "XEL", name: "Xcel Energy Inc.", sector: "Utilities" },
  { symbol: "ED", name: "Consolidated Edison Inc.", sector: "Utilities" },
  { symbol: "PEG", name: "Public Service Enterprise Group Inc.", sector: "Utilities" },

  // Materials
  { symbol: "LIN", name: "Linde plc", sector: "Materials" },
  { symbol: "SHW", name: "Sherwin-Williams Co.", sector: "Materials" },
  { symbol: "APD", name: "Air Products and Chemicals Inc.", sector: "Materials" },
  { symbol: "ECL", name: "Ecolab Inc.", sector: "Materials" },
  { symbol: "FCX", name: "Freeport-McMoRan Inc.", sector: "Materials" },
  { symbol: "NEM", name: "Newmont Corp.", sector: "Materials" },
  { symbol: "DD", name: "DuPont de Nemours Inc.", sector: "Materials" },
  { symbol: "NUE", name: "Nucor Corp.", sector: "Materials" },
  { symbol: "VMC", name: "Vulcan Materials Co.", sector: "Materials" },
  { symbol: "MLM", name: "Martin Marietta Materials Inc.", sector: "Materials" },

  // Communication Services
  // Also tagged Technology + Artificial Intelligence: Meta's primary
  // classification (Communication Services) matches real-world GICS
  // convention, same as the other social/media names in this section —
  // but Meta is also a first-tier AI research lab (FAIR, the Llama model
  // family) and builds its own AI/AR hardware, so it belongs in both
  // filters a user would reasonably reach for.
  {
    symbol: "META",
    name: "Meta Platforms Inc.",
    sector: "Communication Services",
    secondarySectors: ["Technology", "Artificial Intelligence"],
  },
  // Also tagged Technology + Artificial Intelligence: same reasoning as
  // Meta above — Alphabet's primary GICS-style classification is
  // Communication Services (Google Search/YouTube ad revenue), but it's
  // also one of the handful of frontier AI labs (DeepMind, Gemini, its
  // own TPU silicon) and a genuine technology conglomerate (Android,
  // Chrome, Google Cloud). Confirmed live: this was the specific reported
  // bug — Alphabet was previously excluded from both Technology and
  // Artificial Intelligence entirely, only ever appearing under
  // Communication Services.
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    sector: "Communication Services",
    secondarySectors: ["Technology", "Artificial Intelligence"],
  },
  { symbol: "NFLX", name: "Netflix Inc.", sector: "Communication Services" },
  { symbol: "CMCSA", name: "Comcast Corp.", sector: "Communication Services" },
  { symbol: "VZ", name: "Verizon Communications Inc.", sector: "Communication Services" },
  { symbol: "T", name: "AT&T Inc.", sector: "Communication Services" },
  { symbol: "DIS", name: "Walt Disney Co.", sector: "Communication Services" },
  { symbol: "TMUS", name: "T-Mobile US Inc.", sector: "Communication Services" },
  { symbol: "EA", name: "Electronic Arts Inc.", sector: "Communication Services" },
  { symbol: "WBD", name: "Warner Bros. Discovery Inc.", sector: "Communication Services" },
];

