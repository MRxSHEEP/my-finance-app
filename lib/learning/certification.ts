import { prisma } from "@/lib/prisma";
import { getTrackForTopic, summarizeTrackProgress, type TrackProgressSummary } from "./certificationTracks";

// Re-exported so existing server-side callers (the progress/certificates
// API routes) don't need to change their imports — the actual logic now
// lives in certificationTracks.ts (prisma-free) so client components can
// share it too. This file is left holding only what genuinely needs
// prisma: the award side-effect below.
export {
  CERTIFICATION_PASS_THRESHOLD_PERCENT,
  parseQuizScores,
  mergeQuizScore,
  summarizeTrackProgress,
  type QuizScoreEntry,
  type TrackProgressSummary,
} from "./certificationTracks";

// Called after every progress save (see app/api/learning/progress/route.ts).
// Awards a certificate the moment a track first crosses the threshold —
// idempotent via the @@unique([userId, trackId]) constraint, and never
// re-evaluated to revoke an award later even if a subsequent retake drops
// the rolling average (the row is a durable, one-time record — see the
// schema's own comment on UserCertificate).
export async function checkAndAwardCertificates(
  userId: string,
  topicId: string
): Promise<TrackProgressSummary | null> {
  const track = getTrackForTopic(topicId);
  if (!track) return null;

  const existing = await prisma.userCertificate.findUnique({
    where: { userId_trackId: { userId, trackId: track.id } },
  });
  if (existing) return null;

  const rows = await prisma.learningProgress.findMany({
    where: { userId, topicId: { in: track.topicIds } },
    select: { topicId: true, completedAt: true, quizScores: true },
  });

  const summary = summarizeTrackProgress(track.id, rows);
  if (!summary.eligible || summary.scorePercent === null) return null;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  const recipientName = user?.name?.trim() || user?.email || "Noble Learner";

  await prisma.userCertificate.create({
    data: { userId, trackId: track.id, scorePercent: summary.scorePercent, recipientName },
  });

  return summary;
}
