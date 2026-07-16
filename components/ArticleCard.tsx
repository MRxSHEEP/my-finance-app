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

export function ArticleCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-black/10 dark:border-white/15">
      <div className="h-40 w-full animate-pulse bg-foreground/10" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-3 w-20 animate-pulse rounded bg-foreground/10" />
        <div className="h-4 w-full animate-pulse rounded bg-foreground/10" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-foreground/10" />
        <div className="h-3 w-16 animate-pulse rounded bg-foreground/10" />
      </div>
    </div>
  );
}

export function ArticleCard({ article }: { article: Article }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col overflow-hidden rounded-md border border-black/10 text-sm transition-colors hover:border-black/30 dark:border-white/15 dark:hover:border-white/30"
    >
      {article.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl}
          alt=""
          className="h-40 w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-xs font-medium text-foreground/60">
          {article.source}
        </span>
        <h2 className="font-semibold text-foreground">{article.title}</h2>
        {article.description && (
          <p className="line-clamp-3 text-foreground/60">
            {article.description}
          </p>
        )}
        <span className="mt-auto pt-2 text-xs text-foreground/60">
          {formatRelativeTime(article.publishedAt)}
        </span>
      </div>
    </a>
  );
}
