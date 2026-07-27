"use client";

import { useEffect, useState } from "react";
import { Building2, Landmark, User } from "lucide-react";
import { getTrackerLogoUrl } from "@/lib/trackers/companyLogos";
import { getInvestorPhoto } from "@/lib/trackers/investorPhotos";
import { getCongressPhotoUrl } from "@/lib/trackers/congressPhotos";
import { fetchStockLogo } from "@/lib/stockLogoCache";

const TYPE_ICON: Record<string, typeof Building2> = {
  hedge_fund: Building2,
  investor: User,
  insider: Building2,
  congress: Landmark,
};

// Company Insiders trackers are named "<ticker>-insiders" (see
// app/api/trackers/seed/route.ts and lib/trackers/insiderForm4.ts, which
// auto-creates one of these per company as its Form 4 filings get
// ingested — confirmed live this set is already 22 companies, not a fixed
// handful). The ticker is recoverable directly from the slug, so these
// reuse the same Finnhub-backed, already-cached stock logo lookup the
// Stock Catalog/Watchlist use (lib/stockLogoCache.ts) instead of a
// hand-maintained domain list that would need updating every time
// ingestion adds a new company.
function tickerFromInsiderSlug(slug: string): string | null {
  const match = slug.match(/^(.+)-insiders$/);
  return match ? match[1].toUpperCase() : null;
}

interface EntityLogoProps {
  slug: string;
  type: string;
  // Only needed for type === "congress" — the official headshot lookup
  // is by name (see lib/trackers/congressPhotos.ts), since neither
  // congress ingestion pipeline captures a Bioguide ID of its own.
  name?: string;
  size?: number;
  className?: string;
}

// Google's favicon endpoint doesn't error when a domain has no real
// favicon — it silently returns the same generic 16x16 globe placeholder
// for every such domain (confirmed live: identical bytes for
// berkshirehathaway.com, whose own site genuinely has no favicon, and for
// a nonexistent domain used as a control). A real favicon this app
// requests at a larger size always comes back at its own native
// resolution instead, so a loaded image reporting exactly 16x16 is
// treated the same as "no logo found" rather than shown as if it were
// the company's real logo.
const GOOGLE_FALLBACK_SIZE = 16;

// Real company logo — Company Insiders via Finnhub (ticker derived from
// the slug), Hedge Funds via the curated slug->domain map in
// lib/trackers/companyLogos.ts — or a licensed Wikimedia photo (Famous
// Investors, lib/trackers/investorPhotos.ts), falling back to the
// existing generic type icon whenever none of those exist or the image
// fails to load — never a broken image in place of a real one. A photo's
// required CC attribution is exposed via the native `title` tooltip here;
// TrackerDetailView additionally renders a visible credit line of its own
// where there's room for one.
export default function EntityLogo({ slug, type, name, size = 40, className = "" }: EntityLogoProps) {
  const [insiderLogoUrl, setInsiderLogoUrl] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const Icon = TYPE_ICON[type] ?? Building2;

  const ticker = type === "insider" ? tickerFromInsiderSlug(slug) : null;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setImgFailed(false);
      if (!ticker) {
        setInsiderLogoUrl(null);
        return;
      }
      const url = await fetchStockLogo(ticker);
      if (!cancelled) setInsiderLogoUrl(url);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const photo = getInvestorPhoto(slug, type);
  const congressPhotoUrl = !photo && type === "congress" && name ? getCongressPhotoUrl(name) : null;
  const domainLogoUrl = photo || congressPhotoUrl ? null : getTrackerLogoUrl(slug);
  const imageSrc = photo?.url ?? congressPhotoUrl ?? domainLogoUrl ?? insiderLogoUrl;
  const isPersonPhoto = photo != null || congressPhotoUrl != null;
  const isDomainFavicon = !isPersonPhoto && domainLogoUrl != null;

  if (imageSrc && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSrc}
        alt=""
        title={photo ? `Photo: ${photo.photographer} — ${photo.license}` : undefined}
        width={size}
        height={size}
        className={`shrink-0 rounded-full ${isPersonPhoto ? "object-cover" : "bg-white object-contain p-1.5"} ${className}`}
        style={{ width: size, height: size }}
        onError={() => setImgFailed(true)}
        onLoad={(event) => {
          const img = event.currentTarget;
          if (isDomainFavicon && img.naturalWidth === GOOGLE_FALLBACK_SIZE && img.naturalHeight === GOOGLE_FALLBACK_SIZE) {
            setImgFailed(true);
          }
        }}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-foreground/10 ${className}`}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.45)} className="text-foreground/50" />
    </div>
  );
}
