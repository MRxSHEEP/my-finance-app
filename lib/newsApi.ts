export const NEWS_QUERY =
  "stock market OR economy OR federal reserve OR inflation OR global markets";

// The main grid's page size — exported so the ticker route can compute a
// page offset that lands past the grid's first page, since both routes
// query the same underlying NewsAPI corpus with the same sort.
export const GRID_PAGE_SIZE = 20;

export type NewsArticle = {
  title: string;
  description: string | null;
  source: string;
  publishedAt: string | null;
  url: string;
  imageUrl: string | null;
};

export type SourceResult = { articles: NewsArticle[]; ok: boolean };

// ---------------------------------------------------------------------
// NewsAPI (https://newsapi.org/v2/everything)
// ---------------------------------------------------------------------

type RawNewsApiArticle = {
  source?: { name?: string };
  title?: string;
  description?: string | null;
  url?: string;
  urlToImage?: string | null;
  publishedAt?: string;
};

function cleanNewsApiArticles(raw: RawNewsApiArticle[]): NewsArticle[] {
  return raw
    .filter((a) => a.title && a.title !== "[Removed]" && a.url)
    .map((a) => ({
      title: a.title as string,
      description: a.description ?? null,
      source: a.source?.name ?? "Unknown",
      publishedAt: a.publishedAt ?? null,
      url: a.url as string,
      imageUrl: a.urlToImage ?? null,
    }));
}

async function fetchNewsApi(
  apiKey: string,
  params: Record<string, string>
): Promise<Response> {
  const search = new URLSearchParams({ q: NEWS_QUERY, ...params, apiKey });
  return fetch(`https://newsapi.org/v2/everything?${search.toString()}`);
}

// Fetches + cleans NewsAPI results, swallowing any failure into
// `{ articles: [], ok: false }` (with a server-side warning) instead of
// throwing, so a NewsAPI outage never breaks the combined response —
// whatever Marketaux returned is still shown.
export async function fetchAndCleanNewsApi(
  apiKey: string | undefined,
  params: Record<string, string>
): Promise<SourceResult> {
  if (!apiKey) {
    console.warn("[news] NEWSAPI_KEY not configured — skipping NewsAPI");
    return { articles: [], ok: false };
  }

  try {
    const response = await fetchNewsApi(apiKey, params);
    if (!response.ok) {
      console.warn(`[news] NewsAPI request failed (status ${response.status})`);
      return { articles: [], ok: false };
    }
    const body = await response.json().catch(() => null);
    const raw = Array.isArray(body?.articles) ? body.articles : [];
    return { articles: cleanNewsApiArticles(raw), ok: true };
  } catch (err) {
    console.warn("[news] NewsAPI request threw:", err);
    return { articles: [], ok: false };
  }
}

// ---------------------------------------------------------------------
// Marketaux (https://api.marketaux.com/v1/news/all)
// ---------------------------------------------------------------------

type RawMarketauxArticle = {
  title?: string;
  description?: string | null;
  url?: string;
  image_url?: string | null;
  published_at?: string;
  source?: string;
};

function cleanMarketauxArticles(raw: RawMarketauxArticle[]): NewsArticle[] {
  return raw
    .filter((a) => a.title && a.url)
    .map((a) => ({
      title: a.title as string,
      description: a.description ?? null,
      source: a.source ?? "Unknown",
      publishedAt: a.published_at ?? null,
      url: a.url as string,
      imageUrl: a.image_url ?? null,
    }));
}

async function fetchMarketaux(
  apiKey: string,
  params: Record<string, string>
): Promise<Response> {
  const search = new URLSearchParams({
    search: NEWS_QUERY,
    sort: "published_at",
    language: "en",
    ...params,
    api_token: apiKey,
  });
  return fetch(`https://api.marketaux.com/v1/news/all?${search.toString()}`);
}

// Same graceful-failure contract as fetchAndCleanNewsApi.
export async function fetchAndCleanMarketaux(
  apiKey: string | undefined,
  params: Record<string, string>
): Promise<SourceResult> {
  if (!apiKey) {
    console.warn("[news] MARKETAUX_API_KEY not configured — skipping Marketaux");
    return { articles: [], ok: false };
  }

  try {
    const response = await fetchMarketaux(apiKey, params);
    if (!response.ok) {
      console.warn(`[news] Marketaux request failed (status ${response.status})`);
      return { articles: [], ok: false };
    }
    const body = await response.json().catch(() => null);
    const raw = Array.isArray(body?.data) ? body.data : [];
    return { articles: cleanMarketauxArticles(raw), ok: true };
  } catch (err) {
    console.warn("[news] Marketaux request threw:", err);
    return { articles: [], ok: false };
  }
}

// ---------------------------------------------------------------------
// Merge + dedupe
// ---------------------------------------------------------------------

// Lowercase, strip punctuation, collapse whitespace, and take the first 50
// characters — a cheap fingerprint for "is this the same story" across
// two providers that word titles slightly differently.
function titleFingerprint(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
}

// Merges two already-normalized article lists, dropping duplicates
// (matched by exact URL or title fingerprint) and filling in whichever
// fields one version is missing (description/image) from the other, then
// sorts the result by publishedAt descending.
export function mergeArticleSources(
  primary: NewsArticle[],
  secondary: NewsArticle[]
): NewsArticle[] {
  const merged: NewsArticle[] = [];
  const urlIndex = new Map<string, number>();
  const fingerprintIndex = new Map<string, number>();

  function addOrMerge(article: NewsArticle) {
    const fingerprint = titleFingerprint(article.title);
    const existingIndex = urlIndex.get(article.url) ?? fingerprintIndex.get(fingerprint);

    if (existingIndex === undefined) {
      const index = merged.length;
      merged.push(article);
      urlIndex.set(article.url, index);
      fingerprintIndex.set(fingerprint, index);
      return;
    }

    const existing = merged[existingIndex];
    merged[existingIndex] = {
      ...existing,
      description: existing.description ?? article.description,
      imageUrl: existing.imageUrl ?? article.imageUrl,
    };
  }

  for (const article of [...primary, ...secondary]) {
    addOrMerge(article);
  }

  return merged.sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bTime - aTime;
  });
}
