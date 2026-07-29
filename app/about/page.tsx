import type { Metadata } from "next";
import Image from "next/image";
import { LayoutDashboard, Target, UserSearch, CalendarClock, Calculator, Eye, Building2 } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";
import { cardClass } from "@/lib/cardStyles";

// No "use client" — unlike every other top-level page in this app, this
// one has no interactivity or data fetching at all (RevealOnScroll is
// itself a client component, but a server component can render one just
// fine), so it doesn't need to be a client component the way e.g.
// /compliance or /trackers do.
export const metadata: Metadata = {
  title: "About — Noble",
  description: "Market intelligence, made honest — what Noble is and why it exists.",
};

const FEATURES = [
  {
    icon: LayoutDashboard,
    name: "Market Digest",
    description:
      "A configurable home dashboard with sector performance, earnings, market movers, and news, personalized to what you actually hold or watch.",
  },
  {
    icon: Target,
    name: "Analyst rating spectrum",
    description:
      "A 5-tier gradient from Sell now to Good buy, with real buy/sell strength percentages, instead of a vague star rating.",
  },
  {
    icon: UserSearch,
    name: "Insider & Congressional trading trackers",
    description:
      "Sortable, filterable disclosure data most platforms hide behind paywalls or don't offer at all.",
  },
  {
    icon: CalendarClock,
    name: "Earnings visualization",
    description: "Clean, at-a-glance EPS trends instead of dense bar charts that bury the story.",
  },
  {
    icon: Calculator,
    name: "Tools & calculators",
    description: "Practical portfolio and planning tools you can actually act on.",
  },
] as const;

const ADVISOR_CAPABILITIES = ["White-Label Reporting", "Model Portfolios", "Peer Benchmarking", "Compliance Workflows"];

export default function AboutPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-10 p-8 pt-16 pb-20">
      <RevealOnScroll className="flex w-full max-w-2xl flex-col items-center gap-3 text-center">
        <Image
          src="/crown(1).webp.webp"
          alt="Noble"
          width={64}
          height={64}
          style={{ width: "auto", height: "64px" }}
        />
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Market intelligence, made honest.</h1>
        <p className="text-sm leading-relaxed text-foreground/60 sm:text-base">
          Retail investors are drowning in noise. Star ratings that don&apos;t explain themselves. Price targets
          nobody can trace. Insider and congressional trading data buried in filings nobody reads. Most investing
          apps either dumb the data down until it&apos;s useless, or dump raw data on you with no context.
        </p>
        <p className="text-sm leading-relaxed text-foreground/60 sm:text-base">
          Noble exists to close that gap — a market intelligence dashboard built for people who want to actually
          understand what they&apos;re looking at, not just be told what to think.
        </p>
      </RevealOnScroll>

      <RevealOnScroll className="w-full max-w-3xl" delayMs={60}>
        <div className={cardClass("indigo", { extra: "flex flex-col gap-3 p-6" })}>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Eye size={18} className="text-indigo-400" />
            What we believe
          </h2>
          <p className="text-sm leading-relaxed text-foreground/70">
            Every rating, every chart, every data point should be labeled honestly. If a price target is
            illustrative rather than real, you should know that. If a rating system is going to grade a stock, it
            should show its work — not just slap on a star count and move on. That principle runs through
            everything we build.
          </p>
        </div>
      </RevealOnScroll>

      <RevealOnScroll className="flex w-full max-w-4xl flex-col gap-4" delayMs={120}>
        <h2 className="text-xl font-bold text-foreground">What&apos;s inside</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.name} className={cardClass("neutral", { extra: "flex flex-col gap-2 p-4" })}>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <feature.icon size={16} className="shrink-0 text-indigo-400" />
                {feature.name}
              </h3>
              <p className="text-sm leading-relaxed text-foreground/60">{feature.description}</p>
            </div>
          ))}
        </div>
      </RevealOnScroll>

      <RevealOnScroll className="w-full max-w-3xl" delayMs={180}>
        <div className={cardClass("neutral", { extra: "flex flex-col gap-3 p-6" })}>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Building2 size={18} className="text-foreground/40" />
            Built for advisors too
          </h2>
          <p className="text-sm leading-relaxed text-foreground/70">
            The same data infrastructure that powers Noble for individual investors also supports registered
            investment advisors (RIAs) — white-label branded client reporting, model portfolio building, peer
            benchmarking, and compliance workflows designed to reduce the friction that causes trades to go
            unreported. One platform, built on one principle: show your work.
          </p>
          <div className="flex flex-wrap gap-2">
            {ADVISOR_CAPABILITIES.map((capability) => (
              <span
                key={capability}
                className="rounded-full bg-indigo-400/10 px-2.5 py-1 text-xs font-medium text-indigo-400"
              >
                {capability}
              </span>
            ))}
          </div>
        </div>
      </RevealOnScroll>

      <RevealOnScroll delayMs={220}>
        <p className="text-center text-sm text-foreground/60">
          Have questions or want to get in touch? Reach us at{" "}
          <a href="mailto:thenoblesupport@gmail.com" className="font-medium text-foreground hover:underline">
            thenoblesupport@gmail.com
          </a>
        </p>
      </RevealOnScroll>
    </main>
  );
}
