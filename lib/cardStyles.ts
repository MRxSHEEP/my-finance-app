export type CardAccent = "neutral" | "blue" | "indigo" | "purple";

// One shared card language for /stocks (ETF/Mag7 tiles, watchlist cards,
// catalog rows, Deep Dive research cards, the overview/chart/fundamentals
// cards) — radius, resting border, background tint, and hover treatment
// all come from here so cards built across many separate feature passes
// read as one design system rather than visually mismatched pieces.
// "purple" is reserved for the stock catalog's own sector-browsing accent
// (see lib/stockCatalog.ts's CATALOG_SECTOR_ICONS), and amber is reserved
// for the watchlist star (components/WatchlistStar.tsx renders a filled
// gold star when saved) — other features should use "indigo" rather than
// either of those so accent hues don't carry two different meanings on
// the same page.
const ACCENT_STYLES: Record<CardAccent, string> = {
  neutral:
    "border-black/10 dark:border-white/15 hover:border-black/20 dark:hover:border-white/25 hover:shadow-black/5 dark:hover:shadow-white/5",
  blue: "border-blue-400/20 hover:border-blue-400/50 hover:shadow-blue-400/10",
  indigo: "border-indigo-400/20 hover:border-indigo-400/50 hover:shadow-indigo-400/10",
  purple: "border-purple-400/20 hover:border-purple-400/50 hover:shadow-purple-400/10",
};

interface CardClassOptions {
  // Whole-card affordances (translate lift + stronger shadow) are reserved
  // for cards that are themselves a single click target (a Link wrapping
  // the whole card) — a purely informational card (Deep Dive tables, the
  // fundamentals grid) getting a hover lift would imply clickability that
  // isn't there.
  interactive?: boolean;
  extra?: string;
}

export function cardClass(accent: CardAccent = "neutral", { interactive = false, extra = "" }: CardClassOptions = {}): string {
  return [
    "rounded-lg border bg-foreground/[0.02] transition-all duration-200 ease-out",
    ACCENT_STYLES[accent],
    interactive ? "hover:-translate-y-0.5 hover:shadow-lg" : "hover:shadow-md",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}
