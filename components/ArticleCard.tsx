import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { Article } from "@/components/NewsTicker";

export function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";

  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;

  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 4) return `${diffWeek} week${diffWeek === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// One accent per category, reusing each section's own established color
// identity (blue = stocks/markets, purple = crypto, amber = commodities)
// so the tag reads consistently with the rest of the app rather than
// introducing a new color language just for this eyebrow. Earnings/Economy
// are new — the general News feed is the only place they appear (see
// classifyCategory in lib/newsApi.ts) — given fresh, distinct colors of
// their own (green, cyan) rather than reusing one of the four above.
export const CATEGORY_STYLES: Record<string, string> = {
  Markets: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Stocks: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Crypto: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  Commodities: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Earnings: "bg-green-500/10 text-green-600 dark:text-green-400",
  Economy: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
};

// Same per-category identity as CATEGORY_STYLES above, but solid-filled —
// used for the News page's own filter tabs (app/news/page.tsx) so an
// active tab's color matches its badge color throughout the list below it.
export const CATEGORY_TAB_ACTIVE_STYLES: Record<string, string> = {
  Markets: "bg-blue-500 text-white",
  Stocks: "bg-blue-500 text-white",
  Crypto: "bg-purple-500 text-white",
  Commodities: "bg-amber-500 text-white",
  Earnings: "bg-green-500 text-white",
  Economy: "bg-cyan-500 text-white",
};

// Fixed display order for the filter tabs — broad-to-narrow, with the
// generic "Markets" catch-all last since it's the least specific bucket.
export const NEWS_CATEGORY_ORDER = ["Stocks", "Crypto", "Commodities", "Earnings", "Economy", "Markets"] as const;

// Deliberately not just "different text" from the plain source byline
// below (text-xs font-medium text-foreground/50, no fill, no icon) — a
// solid-filled gold badge with an icon so a user scanning the feed can
// tell a Noble Generated News item apart at a glance, not just on close
// reading. Same pill geometry as CategoryTag for rhythm, but everything
// else (fill, weight, icon) is intentionally distinct.
function NobleGeneratedLabel() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-black shadow-sm shadow-amber-500/30">
      <Sparkles size={11} strokeWidth={2.5} />
      Noble Generated News
    </span>
  );
}

function CategoryTag({ category }: { category?: string }) {
  if (!category) return null;
  const style = CATEGORY_STYLES[category] ?? "bg-foreground/10 text-foreground/60";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${style}`}>
      {category}
    </span>
  );
}

// A dense, text-forward row (MarketWatch's own list style) rather than a
// card with a large hero image — a small fixed-size thumbnail sits beside
// the text instead of dominating it, so a page of these reads as a
// scannable headline list, not a photo gallery.
export function ArticleCardSkeleton() {
  return (
    <div className="flex items-start gap-3 border-b border-black/5 py-3 dark:border-white/10">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="h-3 w-16 animate-pulse rounded-full bg-foreground/10" />
        <div className="h-4 w-full animate-pulse rounded bg-foreground/10" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-foreground/10" />
      </div>
      <div className="h-16 w-20 shrink-0 animate-pulse rounded bg-foreground/10" />
    </div>
  );
}

export function ArticleCard({ article }: { article: Article }) {
  const className =
    "group flex items-start gap-3 border-b border-black/5 py-3 text-sm transition-colors duration-150 ease-out hover:bg-foreground/[0.03] dark:border-white/10";

  const content = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryTag category={article.category} />
          {article.isAiGenerated ? (
            <NobleGeneratedLabel />
          ) : (
            <span className="truncate text-xs font-medium text-foreground/50">{article.source}</span>
          )}
          <span className="text-xs text-foreground/30">·</span>
          <span className="whitespace-nowrap text-xs text-foreground/50">
            {formatRelativeTime(article.publishedAt)}
          </span>
        </div>
        <h2 className="font-semibold leading-snug text-foreground group-hover:underline">
          {article.title}
        </h2>
        {article.description && (
          <p className="line-clamp-1 text-foreground/60">{article.description}</p>
        )}
      </div>

      {article.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl}
          alt=""
          width={96}
          height={72}
          className="h-[72px] w-24 shrink-0 rounded object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
    </>
  );

  // Noble Generated News articles have no external source to link out to
  // — they open the in-app detail page (app/news/generated/[id]/page.tsx)
  // that hosts the mandatory AI-disclosure disclaimer, instead of a new
  // tab.
  if (article.isAiGenerated) {
    return (
      <Link href={article.url} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <a href={article.url} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  );
}
