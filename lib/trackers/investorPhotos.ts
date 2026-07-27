export interface InvestorPhoto {
  url: string;
  photographer: string;
  photographerUrl?: string;
  license: string;
  licenseUrl: string;
  // The Commons file description page — kept alongside the license fields
  // specifically so this table stays auditable: anyone can re-verify the
  // license/attribution claim below against the actual source page later.
  sourceUrl: string;
}

// Curated, hand-verified Wikimedia Commons photo for the fixed small set
// of individually-tracked Famous Investors (see lib/trackers/thirteenF.ts's
// SEEDED_FUNDS, type: "investor" entries) — not a live per-request Commons
// search, so a mismatched photo or an unclear license can never silently
// appear. Each entry below was confirmed live against Commons' own API
// (action=query&prop=imageinfo&iiprop=extmetadata on the file page) on
// 2026-07-26, and only added here because that lookup returned a real,
// commercial-use-permitting CC license with clear attribution:
//
// - Bill Ackman: File:Bill_Ackman_(26410186110)_(cropped).jpg — cropped
//   from a 2016 US Senate Special Committee on Aging hearing photo
//   published by the Senate Democrats' Flickr account, CC BY 2.0.
// - Cathie Wood: File:Cathie_Wood_ARK_Invest_Photo.jpg — "own work"
//   uploaded by Commons user 3948wmc (Caroline Wood), CC BY-SA 4.0.
//
// Michael Burry has no entry — confirmed via both a Commons intitle
// search ("Michael Burry", zero hits in File: namespace) and his English
// Wikipedia article (zero images used at all) that no usable photo of him
// exists there; the app falls back to the generic person icon for him
// rather than sourcing a photo from anywhere else.
export const INVESTOR_PHOTOS: Record<string, InvestorPhoto> = {
  "bill-ackman-pershing-square": {
    url: "https://upload.wikimedia.org/wikipedia/commons/d/d8/Bill_Ackman_%2826410186110%29_%28cropped%29.jpg",
    photographer: "Senate Democrats",
    photographerUrl: "https://www.flickr.com/people/32619231@N02",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Bill_Ackman_(26410186110)_(cropped).jpg",
  },
  "cathie-wood-ark": {
    url: "https://upload.wikimedia.org/wikipedia/commons/4/44/Cathie_Wood_ARK_Invest_Photo.jpg",
    photographer: "Caroline Wood",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Cathie_Wood_ARK_Invest_Photo.jpg",
  },
};

export function getInvestorPhoto(slug: string, type: string): InvestorPhoto | null {
  return type === "investor" ? (INVESTOR_PHOTOS[slug] ?? null) : null;
}
