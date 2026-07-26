import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth-helpers";
import { getCourse } from "@/lib/learning/courses";
import { checkAndAwardCertificates, mergeQuizScore, parseQuizScores } from "@/lib/learning/certification";
import { getTrack } from "@/lib/learning/certificationTracks";

// Same reasoning as the watchlist/portfolio routes: auth() reads cookies
// internally in a way Next's static analysis can't see, so without this
// the route risks being cached and serving stale progress across users.
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const progress = await prisma.learningProgress.findMany({
    where: { userId: auth.userId },
  });

  return NextResponse.json({ progress });
}

export async function POST(request: NextRequest) {
  const auth = await requireUserId();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const topicId = typeof body?.topicId === "string" ? body.topicId : "";
  const highestSlideIndex = Number(body?.highestSlideIndex);
  const quizzesCompleted = Number(body?.quizzesCompleted);
  const rawQuizResult = body?.quizResult;
  const quizResult =
    rawQuizResult &&
    typeof rawQuizResult.quizIndex === "number" &&
    typeof rawQuizResult.correct === "number" &&
    typeof rawQuizResult.total === "number"
      ? { quizIndex: rawQuizResult.quizIndex, correct: rawQuizResult.correct, total: rawQuizResult.total }
      : null;

  const course = getCourse(topicId);
  if (!course) {
    return NextResponse.json({ error: "Unknown topic" }, { status: 400 });
  }
  if (!Number.isFinite(highestSlideIndex) || !Number.isFinite(quizzesCompleted)) {
    return NextResponse.json(
      { error: "highestSlideIndex and quizzesCompleted must be numbers" },
      { status: 400 }
    );
  }

  const lastIndex = course.slides.length - 1;
  const clampedSlideIndex = Math.max(0, Math.min(lastIndex, Math.round(highestSlideIndex)));
  const clampedQuizzes = Math.max(0, Math.min(3, Math.round(quizzesCompleted)));

  const existing = await prisma.learningProgress.findUnique({
    where: { userId_topicId: { userId: auth.userId, topicId } },
  });

  // Never regress previously saved progress — e.g. navigating back to an
  // earlier slide shouldn't lower the furthest point already reached.
  const nextSlideIndex = Math.max(existing?.highestSlideIndex ?? 0, clampedSlideIndex);
  const nextQuizzes = Math.max(existing?.quizzesCompleted ?? 0, clampedQuizzes);
  const isNowComplete = nextSlideIndex >= lastIndex && nextQuizzes >= 3;
  const completedAt = existing?.completedAt ?? (isNowComplete ? new Date() : null);

  const existingScores = parseQuizScores(existing?.quizScores);
  // Prisma's Json input type wants a plain JSON-serializable value, not a
  // typed array — same cast-through-object[] pattern already used for
  // ParsedFilingCache.unparsedDetail elsewhere in this codebase.
  const nextScores = (quizResult ? mergeQuizScore(existingScores, quizResult) : existingScores) as unknown as object[];

  const record = await prisma.learningProgress.upsert({
    where: { userId_topicId: { userId: auth.userId, topicId } },
    update: { highestSlideIndex: nextSlideIndex, quizzesCompleted: nextQuizzes, completedAt, quizScores: nextScores },
    create: {
      userId: auth.userId,
      topicId,
      highestSlideIndex: nextSlideIndex,
      quizzesCompleted: nextQuizzes,
      completedAt,
      quizScores: nextScores,
    },
  });

  // Cheap and idempotent (bails immediately if this track's certificate
  // already exists) — safe to call on every save, not just quiz saves, so
  // the exact save that finally crosses the threshold is never missed.
  const awardResult = await checkAndAwardCertificates(auth.userId, topicId);
  const certificateAwarded = awardResult
    ? { trackId: awardResult.trackId, trackTitle: getTrack(awardResult.trackId)?.title ?? awardResult.trackId }
    : null;

  return NextResponse.json({ progress: record, certificateAwarded });
}
