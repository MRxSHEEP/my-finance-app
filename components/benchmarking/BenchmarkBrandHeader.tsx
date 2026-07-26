const DEFAULT_BRAND_COLOR = "#6366f1";

interface BenchmarkBrandHeaderProps {
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
}

// Renders the firm's branding directly into the live dashboard DOM (not
// just the server-side PDF) — the html-to-image PNG export rasterizes
// whatever's on screen, so branding needs to be visibly present here for
// it to appear "for free" in the PNG capture. Plain <img>, not next/image
// — matches components/learning/CertificateView.tsx's documented reason:
// html-to-image needs a direct, unoptimized same-origin URL.
export default function BenchmarkBrandHeader({ name, logoUrl, brandColor }: BenchmarkBrandHeaderProps) {
  const accent = brandColor ?? DEFAULT_BRAND_COLOR;

  return (
    <div className="flex flex-col gap-2">
      <div className="h-1 w-full rounded-full" style={{ backgroundColor: accent }} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{name}</span>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={`${name} logo`} className="h-8 w-auto object-contain" />
        )}
      </div>
    </div>
  );
}
