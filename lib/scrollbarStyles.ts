// Matches the custom scrollbar treatment established for the Insider
// Activity list (components/stocks/InsiderActivityCard.tsx): thin,
// rounded, muted-foreground thumb that lightens on hover, transparent
// track, no default up/down arrow buttons. Exported as a shared string so
// every scrollable region renders an identical scrollbar instead of each
// one hand-rolling its own copy of this arbitrary-value chain.
//
// `scrollbar-color`/`scrollbar-width` style Firefox's native scrollbar;
// the `[&::-webkit-scrollbar*]` arbitrary variants style Chrome/Edge/
// Safari's. A browser supporting neither (very old/uncommon) just falls
// back to its own default scrollbar — never worse than what shipped
// before, so no further fallback handling is needed.
export const SCROLLBAR_THIN_CLASS =
  "[scrollbar-color:rgba(120,120,120,0.35)_transparent] [scrollbar-width:thin] " +
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 " +
  "[&::-webkit-scrollbar-button]:hidden " +
  "[&::-webkit-scrollbar-track]:bg-transparent " +
  "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/15 " +
  "[&::-webkit-scrollbar-thumb]:transition-colors hover:[&::-webkit-scrollbar-thumb]:bg-foreground/30";
