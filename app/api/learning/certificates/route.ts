import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { CERTIFICATION_TRACKS } from "@/lib/learning/certificationTracks";
import { summarizeTrackProgress } from "@/lib/learning/certification";

export const dynamic = "force-dynamic";

// Returns every track's state for the current user (earned, in-progress
// with a live score/completion summary, or not started) — not just the
// tracks already earned — so "My Certifications" can show locked/
// in-progress cards alongside earned ones without a second round trip.
export async function GET() {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const [progressRows, certificates] = await Promise.all([
    prisma.learningProgress.findMany({
      where: { userId: auth.userId },
      select: { topicId: true, completedAt: true, quizScores: true },
    }),
    prisma.userCertificate.findMany({ where: { userId: auth.userId } }),
  ]);

  const certByTrack = new Map(certificates.map((c) => [c.trackId, c]));

  const tracks = CERTIFICATION_TRACKS.map((track) => {
    const summary = summarizeTrackProgress(track.id, progressRows);
    const certificate = certByTrack.get(track.id) ?? null;

    return {
      trackId: track.id,
      title: track.title,
      description: track.description,
      topicIds: track.topicIds,
      progress: summary,
      certificate: certificate
        ? {
            shareId: certificate.shareId,
            scorePercent: certificate.scorePercent,
            recipientName: certificate.recipientName,
            awardedAt: certificate.awardedAt,
          }
        : null,
    };
  });

  return NextResponse.json({ tracks });
}
