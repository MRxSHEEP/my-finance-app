"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Award, Check, Lock } from "lucide-react";
import { CERTIFICATION_PASS_THRESHOLD_PERCENT } from "@/lib/learning/certificationTracks";

interface TrackState {
  trackId: string;
  title: string;
  description: string;
  topicIds: string[];
  progress: {
    topicsCompleted: number;
    topicsTotal: number;
    scorePercent: number | null;
    eligible: boolean;
  };
  certificate: { shareId: string; scorePercent: number; recipientName: string; awardedAt: string } | null;
}

function TrackCard({ track }: { track: TrackState }) {
  const earned = !!track.certificate;
  const { topicsCompleted, topicsTotal, scorePercent } = track.progress;

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-5 ${
        earned ? "border-amber-400/30 bg-amber-400/[0.03]" : "border-black/10 dark:border-white/15"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-foreground">{track.title}</h3>
          <p className="text-xs text-foreground/50">{track.description}</p>
        </div>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            earned ? "bg-amber-400/10 text-amber-500" : "bg-foreground/5 text-foreground/30"
          }`}
        >
          {earned ? <Award size={18} /> : <Lock size={15} />}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-foreground/60">
        <span>
          {topicsCompleted}/{topicsTotal} courses complete
        </span>
        {scorePercent !== null && (
          <>
            <span className="text-foreground/30">·</span>
            <span>{scorePercent}% avg score</span>
          </>
        )}
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
        <div
          className="h-full rounded-full bg-foreground/40 transition-all duration-300 ease-out"
          style={{ width: `${topicsTotal > 0 ? (topicsCompleted / topicsTotal) * 100 : 0}%` }}
        />
      </div>

      {earned ? (
        <Link
          href={`/learning/certifications/${track.trackId}`}
          className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          <Check size={14} /> View certificate
        </Link>
      ) : (
        <p className="text-xs text-foreground/50">
          Complete every course in this track with an average quiz score of {CERTIFICATION_PASS_THRESHOLD_PERCENT}%
          or higher to earn this certificate.
        </p>
      )}
    </div>
  );
}

export default function CertificationsPage() {
  const { status } = useSession();
  const [tracks, setTracks] = useState<TrackState[] | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    fetch("/api/learning/certificates")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled) setTracks(Array.isArray(body?.tracks) ? body.tracks : []);
      })
      .catch(() => {
        if (!cancelled) setTracks([]);
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === "loading") {
    return <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16" />;
  }

  if (status !== "authenticated") {
    return (
      <main className="flex flex-1 flex-col items-center gap-4 p-8 pt-16 text-center">
        <h1 className="text-3xl font-bold text-foreground">My Certifications</h1>
        <p className="text-foreground/60">Sign in to track your certification progress and earned certificates.</p>
        <Link
          href="/login"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Sign In
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8 pt-16 pb-20">
      <div className="flex w-full max-w-3xl flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-bold text-foreground">My Certifications</h1>
        <p className="max-w-xl text-sm text-foreground/60">
          Related Learning courses are grouped into certification tracks. Complete every course in a track — slides
          and quiz checkpoints — with an average score of {CERTIFICATION_PASS_THRESHOLD_PERCENT}% or higher to earn
          that track&apos;s certificate.
        </p>
      </div>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {tracks === null &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg border border-black/10 bg-foreground/5 dark:border-white/15" />
          ))}
        {tracks?.map((track) => <TrackCard key={track.trackId} track={track} />)}
      </div>
    </main>
  );
}
