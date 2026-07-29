import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  stock: "Stocks",
  crypto: "Crypto",
  commodity: "Commodities",
};

function formatGeneratedAt(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Prominent, persistent, non-dismissible — same amber caution treatment
// app/signals/page.tsx's SignalsDisclaimer uses for its own AI-generated
// content, extended here with the two things unique to this feature: no
// human review before publishing, and grounding in the real data shown
// above (not general/training knowledge about the company).
function GeneratedArticleDisclaimer() {
  return (
    <div className="flex w-full items-start gap-3 rounded-lg border border-amber-400/30 bg-amber-400/5 p-4">
      <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-500" />
      <p className="text-sm leading-relaxed text-foreground/80">
        <span className="font-semibold text-amber-500">AI-generated educational content, not investment advice.</span>{" "}
        This article was written automatically by an AI model from real market data already tracked elsewhere in
        Noble, with no human review before publishing, and does not reflect the opinions, analysis, or judgment of a
        human analyst. Noble does not execute trades, place orders, or connect to any brokerage account — nothing
        here is personalized to you or a recommendation to buy or sell anything.
      </p>
    </div>
  );
}

export default async function GeneratedArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const article = await prisma.generatedNewsArticle.findUnique({ where: { id } });
  if (!article) notFound();

  const paragraphs = article.body
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16 pb-20">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <Link href="/news" className="flex w-fit items-center gap-1 text-sm text-foreground/50 hover:text-foreground">
          <ArrowLeft size={14} />
          Back to News
        </Link>

        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-black shadow-sm shadow-amber-500/30">
          <Sparkles size={11} strokeWidth={2.5} />
          Noble Generated News
        </span>

        <h1 className="text-3xl font-bold leading-tight text-foreground">{article.title}</h1>

        <p className="text-xs text-foreground/50">
          {CATEGORY_LABELS[article.assetType] ?? article.assetType} · {article.displayName} ({article.ticker}) ·
          Generated {formatGeneratedAt(article.generatedAt)}
        </p>

        <div className="flex flex-col gap-4 text-base leading-relaxed text-foreground/90">
          {paragraphs.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        <GeneratedArticleDisclaimer />
      </div>
    </main>
  );
}
