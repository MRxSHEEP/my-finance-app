"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Building2, Clock, Landmark, Search, Sparkles, User } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";
import { cardClass } from "@/lib/cardStyles";
import EntityLogo from "@/components/trackers/EntityLogo";
import PaginationControls from "@/components/Pagination";
import SectorFilterDropdown, { type SectorFilter } from "@/components/SectorFilterDropdown";
import { STOCK_CATALOG } from "@/lib/stockCatalog";

const CONGRESS_PAGE_SIZE = 12;
const INSIDER_PAGE_SIZE = 12;

// Company Insiders entities are named "<ticker>-insiders" (see
// lib/trackers/insiderForm4.ts) — the ticker is recoverable directly from
// the slug, same as components/trackers/EntityLogo.tsx's own
// tickerFromInsiderSlug, so the sector filter can reuse the Stock
// Catalog's existing ticker->sector taxonomy instead of building a second one.
function tickerFromInsiderSlug(slug: string): string | null {
  const match = slug.match(/^(.+)-insiders$/);
  return match ? match[1].toUpperCase() : null;
}

const SECTOR_BY_TICKER = new Map(STOCK_CATALOG.map((entry) => [entry.symbol, entry.sector]));

interface TrackerListEntry {
  slug: string;
  type: string;
  name: string;
  title: string | null;
  holdingsCount: number;
  transactionsCount: number;
  latestActivity: string | null;
}

// The profile route (app/trackers/[type]/[slug]/page.tsx) only ever reads
// its `slug` param — `type` in the URL is purely a readable label, so any
// consistent hyphenated form works.
function typeUrlSegment(type: string): string {
  return type.replace(/_/g, "-");
}

function formatDate(iso: string | null): string {
  if (!iso) return "No activity yet";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function EntityCard({ entity }: { entity: TrackerListEntry }) {
  return (
    <Link
      href={`/trackers/${typeUrlSegment(entity.type)}/${entity.slug}`}
      className={cardClass("neutral", { interactive: true, extra: "flex items-center gap-3 p-4" })}
    >
      <EntityLogo slug={entity.slug} type={entity.type} name={entity.name} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{entity.name}</p>
        {entity.title && <p className="truncate text-xs text-foreground/60">{entity.title}</p>}
      </div>
      <div className="shrink-0 text-right text-xs text-foreground/50">
        <p>{entity.holdingsCount > 0 ? `${entity.holdingsCount} holdings` : `${entity.transactionsCount} transactions`}</p>
        <p>{formatDate(entity.latestActivity)}</p>
      </div>
    </Link>
  );
}

function ComingSoonCard({ reason }: { reason: string }) {
  return (
    <div className={cardClass("neutral", { extra: "flex items-center gap-3 p-4 text-foreground/50" })}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/5">
        <Clock size={18} />
      </div>
      <p className="text-sm">{reason}</p>
    </div>
  );
}

interface CategorySectionProps {
  icon: typeof Building2;
  title: string;
  description: string;
  entities?: TrackerListEntry[];
  comingSoonReason?: string;
  // Not yet used by the other three real sections (Hedge Funds/Famous
  // Investors/Company Insiders currently carry no disclaimer of their
  // own) — added here specifically for Members of Congress, whose data
  // is more legally/politically sensitive, using this app's existing
  // disclaimer phrasing (see app/page.tsx's SPY Drivers section).
  disclaimer?: string;
  // Only Members of Congress is large enough to need this (144 real
  // members vs. single digits for the other three sections) — a rendered
  // footer rather than baked-in page state, so this generic section
  // component doesn't need to know anything about pagination itself.
  pagination?: ReactNode;
  // Rendered above the grid, below the description — only Company
  // Insiders uses this today (its sector filter).
  filters?: ReactNode;
  // Overrides the "hide entirely on zero entities" auto-behavior below.
  // Needed once a section has its own internal sub-filter (Company
  // Insiders' sector dropdown): the section should stay visible — filter
  // control included — when the sub-filter alone narrows it to zero, and
  // only actually disappear when the *global search* itself matched zero
  // entities in this category. Sections with no sub-filter never pass
  // this, so their old auto-hide-on-empty behavior is unchanged.
  forceShow?: boolean;
}

function CategorySection({
  icon: Icon,
  title,
  description,
  entities,
  comingSoonReason,
  disclaimer,
  pagination,
  filters,
  forceShow,
}: CategorySectionProps) {
  // A real category hidden entirely by an active search (zero matches)
  // rather than shown with an empty grid — an empty "Hedge Funds" section
  // during a search for "Pelosi" would just read as a bug.
  if (!forceShow && entities && entities.length === 0) return null;

  return (
    <RevealOnScroll className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon size={20} className="text-indigo-400" />
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
      </div>
      <p className="-mt-2 text-sm text-foreground/50">{description}</p>

      {filters && !comingSoonReason && <div className="flex flex-wrap items-center gap-3">{filters}</div>}

      {comingSoonReason ? (
        <ComingSoonCard reason={comingSoonReason} />
      ) : entities && entities.length === 0 ? (
        <p className="rounded-md bg-foreground/5 px-3 py-3 text-sm text-foreground/50">No matches for this filter.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entities!.map((entity) => (
            <EntityCard key={entity.slug} entity={entity} />
          ))}
        </div>
      )}
      {pagination && !comingSoonReason && <div className="pt-1">{pagination}</div>}
      {disclaimer && !comingSoonReason && <p className="text-xs text-foreground/40">{disclaimer}</p>}
    </RevealOnScroll>
  );
}

export default function TrackersPage() {
  const [entities, setEntities] = useState<TrackerListEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [congressPage, setCongressPage] = useState(1);
  const [insiderSector, setInsiderSector] = useState<SectorFilter>("All");
  const [insiderVisibleCount, setInsiderVisibleCount] = useState(INSIDER_PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/trackers");
        const body = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok || !Array.isArray(body?.entities)) {
          setError("Failed to load trackers");
          return;
        }
        setEntities(body.entities);
      } catch {
        if (!cancelled) setError("Failed to load trackers");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return entities ?? [];
    return (entities ?? []).filter(
      (e) => e.name.toLowerCase().includes(term) || (e.title ?? "").toLowerCase().includes(term)
    );
  }, [entities, search]);

  const congressMembers = filtered.filter((e) => e.type === "congress");
  const hedgeFunds = filtered.filter((e) => e.type === "hedge_fund");
  const investors = filtered.filter((e) => e.type === "investor");
  const insiders = filtered.filter((e) => e.type === "insider");

  // Reset to page 1 whenever the search term changes — adjusted during
  // render (React's own recommended pattern for "reset state when a prop
  // changes") rather than in an effect, which would cost an extra render
  // for no benefit here.
  const [prevSearch, setPrevSearch] = useState(search);
  if (search !== prevSearch) {
    setPrevSearch(search);
    setCongressPage(1);
    setInsiderVisibleCount(INSIDER_PAGE_SIZE);
  }

  const congressTotalPages = Math.max(1, Math.ceil(congressMembers.length / CONGRESS_PAGE_SIZE));
  const effectiveCongressPage = Math.min(congressPage, congressTotalPages);
  const paginatedCongressMembers = congressMembers.slice(
    (effectiveCongressPage - 1) * CONGRESS_PAGE_SIZE,
    effectiveCongressPage * CONGRESS_PAGE_SIZE
  );

  // Sector filter narrows the list *before* pagination — "Load more"
  // continues within this filtered set, not the full unfiltered one.
  const sectorFilteredInsiders =
    insiderSector === "All"
      ? insiders
      : insiders.filter((e) => {
          const ticker = tickerFromInsiderSlug(e.slug);
          return ticker ? SECTOR_BY_TICKER.get(ticker) === insiderSector : false;
        });

  const [prevInsiderSector, setPrevInsiderSector] = useState(insiderSector);
  if (insiderSector !== prevInsiderSector) {
    setPrevInsiderSector(insiderSector);
    setInsiderVisibleCount(INSIDER_PAGE_SIZE);
  }

  const visibleInsiders = sectorFilteredInsiders.slice(0, insiderVisibleCount);

  const isSearching = search.trim().length > 0;

  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8 pt-16">
      <div className="flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Trackers</h1>
            <p className="text-sm text-foreground/50">
              Follow real portfolio activity from members of Congress, hedge funds, famous investors, and company insiders.
            </p>
          </div>

          <label className="flex flex-col gap-1 text-xs text-foreground/60">
            Search
            <div className="relative flex items-center">
              <Search size={14} className="pointer-events-none absolute left-3 text-indigo-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Investor, fund, company, or ticker"
                className="w-72 rounded-md border border-indigo-400/30 bg-foreground/[0.02] py-1.5 pl-8 pr-3 text-sm text-foreground outline-none transition-colors duration-200 ease-out placeholder:text-foreground/40 hover:border-indigo-400/50 focus:border-indigo-400/60"
              />
            </div>
          </label>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {entities === null && !error && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 w-full animate-pulse rounded-lg bg-foreground/10" />
            ))}
          </div>
        )}

        {entities !== null && (
          <>
            <CategorySection
              icon={Landmark}
              title="Members of Congress"
              description="Periodic Transaction Reports from the House Clerk and Senate eFD systems."
              entities={paginatedCongressMembers}
              disclaimer="For informational purposes only — not investment advice."
              pagination={
                congressTotalPages > 1 ? (
                  <PaginationControls page={effectiveCongressPage} totalPages={congressTotalPages} onPageChange={setCongressPage} />
                ) : undefined
              }
            />

            <CategorySection
              icon={Building2}
              title="Hedge Funds"
              description="Quarterly 13F institutional holdings, sourced directly from SEC EDGAR."
              entities={hedgeFunds}
            />

            <CategorySection
              icon={User}
              title="Famous Investors"
              description="Quarterly 13F holdings for individually well-known investors."
              entities={investors}
            />

            <CategorySection
              icon={Building2}
              title="Company Insiders"
              description="Form 4 insider buy/sell activity, sourced directly from SEC EDGAR."
              entities={visibleInsiders}
              forceShow={insiders.length > 0}
              filters={
                <SectorFilterDropdown sector={insiderSector} onChange={setInsiderSector} label="Filter by sector" />
              }
              pagination={
                sectorFilteredInsiders.length > insiderVisibleCount ? (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setInsiderVisibleCount((count) => count + INSIDER_PAGE_SIZE)}
                      className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-foreground/70 transition-colors duration-200 ease-out hover:border-black/25 hover:text-foreground dark:border-white/15 dark:hover:border-white/30"
                    >
                      Load more ({sectorFilteredInsiders.length - insiderVisibleCount} more)
                    </button>
                  </div>
                ) : undefined
              }
            />

            {!isSearching && (
              <CategorySection
                icon={Sparkles}
                title="Custom Thematic Strategies"
                description="Curated baskets built around a theme rather than a single filer."
                comingSoonReason="Coming soon."
              />
            )}

            {isSearching && filtered.length === 0 && (
              <p className="text-sm text-foreground/60">No trackers found for &quot;{search}&quot;.</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
