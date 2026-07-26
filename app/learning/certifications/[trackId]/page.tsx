"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChevronLeft, Link as LinkIcon, Check } from "lucide-react";
import CertificateView from "@/components/learning/CertificateView";

interface TrackState {
  trackId: string;
  title: string;
  certificate: { shareId: string; scorePercent: number; recipientName: string; awardedAt: string } | null;
}

export default function CertificateDetailPage() {
  const { trackId } = useParams<{ trackId: string }>();
  const { status } = useSession();
  const [track, setTrack] = useState<TrackState | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    fetch("/api/learning/certificates")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled) return;
        const tracks: TrackState[] = Array.isArray(body?.tracks) ? body.tracks : [];
        setTrack(tracks.find((t) => t.trackId === trackId) ?? null);
      })
      .catch(() => {
        if (!cancelled) setTrack(null);
      });

    return () => {
      cancelled = true;
    };
  }, [status, trackId]);

  function handleCopyLink() {
    if (!track?.certificate) return;
    const url = `${window.location.origin}/certificates/${track.certificate.shareId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (status === "loading" || track === undefined) {
    return <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16" />;
  }

  if (status !== "authenticated") {
    return (
      <main className="flex flex-1 flex-col items-center gap-4 p-8 pt-16 text-center">
        <p className="text-foreground/60">Sign in to view your certificates.</p>
        <Link href="/login" className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90">
          Sign In
        </Link>
      </main>
    );
  }

  if (!track?.certificate) {
    return (
      <main className="flex flex-1 flex-col items-center gap-4 p-8 pt-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Certificate not yet earned</h1>
        <p className="max-w-md text-sm text-foreground/60">
          Complete every course in this track with a passing quiz score to unlock its certificate.
        </p>
        <Link href="/learning/certifications" className="text-sm font-medium text-foreground hover:underline">
          Back to My Certifications
        </Link>
      </main>
    );
  }

  const cert = track.certificate;

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16 pb-20">
      <div className="flex w-full max-w-2xl items-center justify-between">
        <Link
          href="/learning/certifications"
          className="inline-flex items-center gap-1 text-sm text-foreground/60 transition-colors hover:text-foreground"
        >
          <ChevronLeft size={16} />
          My Certifications
        </Link>
      </div>

      <div className="w-full max-w-2xl">
        <CertificateView
          recipientName={cert.recipientName}
          trackTitle={track.title}
          scorePercent={cert.scorePercent}
          awardedAt={cert.awardedAt}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={handleCopyLink}
          className="inline-flex items-center gap-1.5 rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground dark:border-white/15"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <LinkIcon size={14} />}
          {copied ? "Link copied!" : "Copy shareable link"}
        </button>
      </div>

      <div className="w-full max-w-2xl">
        <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-foreground/40">
          LinkedIn-formatted version
        </p>
        <CertificateView
          recipientName={cert.recipientName}
          trackTitle={track.title}
          scorePercent={cert.scorePercent}
          awardedAt={cert.awardedAt}
          variant="linkedin"
        />
      </div>
    </main>
  );
}
