export interface CertificationTrack {
  id: string;
  title: string;
  description: string;
  topicIds: string[];
}

// A course can show 100% complete on the hub with a mediocre quiz score —
// certification is a deliberately separate, higher bar. 80% maps to a
// clean, statable "miss at most one" rule against each course's fixed
// 9-question total, communicated up front on the certifications page
// rather than sprung on the user after the fact. Lives here (not
// certification.ts, which imports lib/prisma and is therefore server-only)
// so client components can reference the same number without pulling in
// server-only code.
export const CERTIFICATION_PASS_THRESHOLD_PERCENT = 80;

// Every existing Learning topic is grouped into exactly one track — sizes
// are deliberately uneven (4/3/3/2) since nothing requires parity, only
// that the grouping reads as a coherent theme. "Valuation Fundamentals"
// and "Advanced Valuation" split what would otherwise be one 7-topic
// mega-track into "share-price arithmetic" (P/E, PEG, EPS, Market Cap)
// versus "enterprise-value/cash-flow methods" (EBITDA, EV/EBITDA, DCF —
// also the three topics with a matching Tools calculator, a natural
// "now go build a model" pairing). "Risk & Analysis" and "Trading
// Concepts" match the user's own example track names verbatim.
//
// This is the single source of truth for track groupings — both the
// Learning hub (app/learning/page.tsx, grouped section headers) and the
// Certifications page (app/learning/certifications/page.tsx) read from
// this same array, so the two can never drift out of sync with each
// other.
export const CERTIFICATION_TRACKS: CertificationTrack[] = [
  {
    id: "valuation-fundamentals",
    title: "Valuation Fundamentals",
    description: "The core share-price metrics behind almost every stock valuation conversation.",
    topicIds: ["pe-ratio", "peg-ratio", "eps", "market-cap"],
  },
  {
    id: "advanced-valuation",
    title: "Advanced Valuation",
    description: "Enterprise-value and cash-flow-based methods used to build a real valuation model.",
    topicIds: ["ebitda", "ev-ebitda", "dcf"],
  },
  {
    id: "risk-and-analysis",
    title: "Risk & Analysis",
    description: "How the market prices risk and reads sentiment beyond a single valuation number.",
    topicIds: ["beta", "dividend-yield", "analyst-ratings"],
  },
  {
    id: "trading-concepts",
    title: "Trading Concepts",
    description: "Behavior and strategy concepts every active investor runs into.",
    topicIds: ["insider-trading", "dca"],
  },
];

export function getTrack(trackId: string): CertificationTrack | undefined {
  return CERTIFICATION_TRACKS.find((t) => t.id === trackId);
}

export function getTrackForTopic(topicId: string): CertificationTrack | undefined {
  return CERTIFICATION_TRACKS.find((t) => t.topicIds.includes(topicId));
}

// ---------------------------------------------------------------------
// Quiz score ledger — pure functions, no prisma dependency, so both
// server routes and client components (the Learning hub's per-course
// score badge, the Certifications page's per-track average) can compute
// from the exact same logic rather than each re-deriving their own.
// ---------------------------------------------------------------------

export interface QuizScoreEntry {
  quizIndex: number;
  correct: number;
  total: number;
}

function isQuizScoreEntry(value: unknown): value is QuizScoreEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).quizIndex === "number" &&
    typeof (value as Record<string, unknown>).correct === "number" &&
    typeof (value as Record<string, unknown>).total === "number"
  );
}

export function parseQuizScores(raw: unknown): QuizScoreEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isQuizScoreEntry);
}

// Merges a freshly-finished checkpoint's score into the existing ledger —
// keyed by quizIndex, keeping whichever attempt scored higher rather than
// always overwriting with the latest (matches highestSlideIndex's own
// "never regress saved progress" convention elsewhere in this model).
export function mergeQuizScore(existing: QuizScoreEntry[], incoming: QuizScoreEntry): QuizScoreEntry[] {
  const prior = existing.find((e) => e.quizIndex === incoming.quizIndex);
  const priorRate = prior ? prior.correct / Math.max(prior.total, 1) : -1;
  const incomingRate = incoming.correct / Math.max(incoming.total, 1);
  const best = priorRate >= incomingRate && prior ? prior : incoming;

  const next = existing.filter((e) => e.quizIndex !== incoming.quizIndex);
  next.push(best);
  return next.sort((a, b) => a.quizIndex - b.quizIndex);
}

// A single course's own score (pooled correct/total across just its own
// quiz checkpoints) — what the Learning hub's per-course score badge
// shows. null until at least one checkpoint has been answered.
export function computeCourseScorePercent(quizScores: unknown): number | null {
  const scores = parseQuizScores(quizScores);
  if (scores.length === 0) return null;
  const totalCorrect = scores.reduce((sum, s) => sum + s.correct, 0);
  const totalQuestions = scores.reduce((sum, s) => sum + s.total, 0);
  return totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null;
}

export interface TrackProgressSummary {
  trackId: string;
  topicsCompleted: number;
  topicsTotal: number;
  totalCorrect: number;
  totalQuestions: number;
  // null until at least one question has been answered anywhere in the track.
  scorePercent: number | null;
  eligible: boolean;
}

type ProgressRow = { topicId: string; completedAt: Date | string | null; quizScores: unknown };

// Score is the pooled correct/total across every quiz checkpoint in every
// topic in the track (not an average-of-per-topic-averages) — a simpler,
// more statistically sound single number than weighting each topic's own
// average equally regardless of how many questions it contributed.
export function summarizeTrackProgress(trackId: string, progressRows: ProgressRow[]): TrackProgressSummary {
  const track = getTrack(trackId);
  const topicIds = track?.topicIds ?? [];
  const rowByTopic = new Map(progressRows.map((r) => [r.topicId, r]));

  let topicsCompleted = 0;
  let totalCorrect = 0;
  let totalQuestions = 0;

  for (const topicId of topicIds) {
    const row = rowByTopic.get(topicId);
    if (row?.completedAt) topicsCompleted++;
    for (const s of parseQuizScores(row?.quizScores)) {
      totalCorrect += s.correct;
      totalQuestions += s.total;
    }
  }

  const scorePercent = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null;
  const eligible =
    topicIds.length > 0 &&
    topicsCompleted === topicIds.length &&
    scorePercent !== null &&
    scorePercent >= CERTIFICATION_PASS_THRESHOLD_PERCENT;

  return { trackId, topicsCompleted, topicsTotal: topicIds.length, totalCorrect, totalQuestions, scorePercent, eligible };
}
