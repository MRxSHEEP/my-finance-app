"use client";

import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { toPng } from "html-to-image";

interface CertificateViewProps {
  recipientName: string;
  trackTitle: string;
  scorePercent: number;
  awardedAt: string | Date;
  // "linkedin" uses a 1200×630 social-share aspect ratio instead of a
  // traditional certificate ratio — same content, sized for a link
  // preview/share image rather than an in-app display or printout.
  variant?: "certificate" | "linkedin";
  showDownload?: boolean;
}

function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// Deliberately fixed dark/gold theme regardless of the site's own light/dark
// mode — a certificate should look identical whether downloaded, shared, or
// viewed by anyone on any device, not shift with the viewer's own theme
// preference the way the rest of the app does. A plain <img> (not
// next/image) is used for the crown logo so html-to-image's canvas
// rasterization has a direct, unoptimized same-origin URL to work with,
// same reasoning ArticleCard.tsx already documents for its own <img> use.
export default function CertificateView({
  recipientName,
  trackTitle,
  scorePercent,
  awardedAt,
  variant = "certificate",
  showDownload = true,
}: CertificateViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const isLinkedIn = variant === "linkedin";

  async function handleDownload() {
    if (!ref.current || downloading) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(ref.current, { pixelRatio: 2 });
      const link = document.createElement("a");
      const slug = trackTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      link.download = `noble-certificate-${slug}${isLinkedIn ? "-linkedin" : ""}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // Swallow — the certificate is still visible on-screen even if export fails.
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        ref={ref}
        className="relative flex w-full flex-col items-center justify-center gap-5 overflow-hidden border-[3px] border-amber-400/60 bg-[#0b0f1a] p-10 text-center"
        style={{
          aspectRatio: isLinkedIn ? "1200 / 630" : "1.4 / 1",
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(251,191,36,0.10), transparent 60%), radial-gradient(circle at 50% 100%, rgba(251,191,36,0.06), transparent 60%)",
        }}
      >
        <div className="pointer-events-none absolute inset-3 rounded-sm border border-amber-400/25" />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/crown(1).webp.webp" alt="" width={40} height={40} style={{ width: 40, height: 40 }} />

        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400/80">Noble Certified</p>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{trackTitle}</h1>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-widest text-white/40">Awarded to</p>
          <p className="text-xl font-semibold text-white sm:text-2xl">{recipientName}</p>
        </div>

        <div className="flex items-center gap-6 text-xs text-white/50">
          <span>Completed {formatDate(awardedAt)}</span>
          <span className="h-3 w-px bg-white/20" />
          <span>Score: {scorePercent}%</span>
        </div>

        <p className="max-w-md text-[11px] leading-relaxed text-white/30">
          This certificate confirms completion of every course in the {trackTitle} track on Noble, including a
          passing score across all quiz checkpoints.
        </p>
      </div>

      {showDownload && (
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground disabled:opacity-50 dark:border-white/15"
        >
          <Download size={14} />
          {downloading ? "Preparing…" : isLinkedIn ? "Download for LinkedIn" : "Download certificate"}
        </button>
      )}
    </div>
  );
}
