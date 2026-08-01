import Link from "next/link";
import { ShieldCheck, FileBarChart2, PieChart, Scale } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";
import { cardClass } from "@/lib/cardStyles";

// A separate front door for RIA/advisory-firm visitors — no TickerBar, no
// Sidebar, no AccountMenu (see components/ConditionalAppChrome.tsx), and
// deliberately no embedded product walkthroughs either. The four feature
// walkthroughs (ComplianceWalkthrough etc.) render real, if frozen/dated,
// price figures and chart UI — safe for their own signed-out feature pages,
// but not appropriate here given the unresolved provider-licensing question
// this page exists to stay clear of. Every sentence below is static
// prose adapted from those same walkthroughs' own already-accuracy-checked
// captions (and each feature's own page subtitle), not new claims.
const FEATURES = [
  {
    key: "compliance",
    icon: ShieldCheck,
    name: "RIA Compliance",
    tagline: "Trade disclosures, pre-clearance, and audit logging in one place.",
    description:
      "Employees disclose trades and submit pre-clearance requests directly in the app. Each ticker is automatically matched against the firm's restricted list and recent insider-filing activity, surfacing a potential conflict the moment it's reported — not months later in an audit. Every approval, flag, and list change is logged to one immutable audit trail you can export any time.",
  },
  {
    key: "reporting",
    icon: FileBarChart2,
    name: "Reporting",
    tagline: "Branded client reports, valuation calculators, and AI-drafted commentary.",
    description:
      "Reports are built from a client's actual portfolio, not a generic template, with firm-grade valuation tools built in — no separate spreadsheet to build or numbers to copy by hand. Noble Commentary can draft a plain-language performance narrative in seconds, citing the same data an advisor would; every word stays editable, and nothing goes out until it's reviewed and approved. The client receives one polished, firm-branded document, with every AI-assisted paragraph clearly disclosed as advisor-reviewed.",
  },
  {
    key: "model-portfolios",
    icon: PieChart,
    name: "Model Portfolios",
    tagline: "Firm-wide target allocations, performance tracking, and client share links.",
    description:
      "Set a target allocation once, then apply it to every client who fits that model — instead of rebuilding the same spreadsheet for each of them. Performance tracking lives right alongside the allocation, no separate spreadsheet to maintain outside the app. A secure, no-login share link lets a client check in on their portfolio whenever they want: a clean, firm-branded, completely read-only view with no way to see anything else in the firm's account.",
  },
  {
    key: "benchmarking",
    icon: Scale,
    name: "Peer Benchmarking",
    tagline: "Peer comparisons, current metrics, and trend tracking.",
    description:
      "Build a peer set in minutes by searching real tickers, then see exactly how a core holding stacks up against its closest peers, metric by metric, with the best value in each row highlighted automatically — no manual spreadsheet comparison required. Trends build automatically over time, so a firm can show not just where a holding stands today, but where it's headed.",
  },
] as const;

function CtaRow() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Link
        href="/signup"
        className="rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        Create your organization
      </Link>
      <Link
        href="/login"
        className="rounded-md border border-black/10 px-6 py-3 text-sm font-medium text-foreground/70 hover:text-foreground dark:border-white/15"
      >
        Sign in
      </Link>
    </div>
  );
}

export default function AdvisorsPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-16 p-8 pb-20 pt-16">
      <RevealOnScroll className="flex max-w-2xl flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Built for RIAs and advisory firms
        </h1>
        <p className="text-lg text-foreground/60">
          Compliance, reporting, model portfolios, and peer benchmarking — the tools an advisory firm
          needs, in one place for the whole team.
        </p>
        <CtaRow />
      </RevealOnScroll>

      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2">
        {FEATURES.map((feature, index) => (
          <RevealOnScroll key={feature.key} delayMs={index * 80}>
            <section className={cardClass("neutral", { extra: "flex h-full flex-col gap-3 p-6" })}>
              <div className="flex items-center gap-3">
                <feature.icon size={22} className="text-foreground/70" />
                <h2 className="text-lg font-semibold text-foreground">{feature.name}</h2>
              </div>
              <p className="text-sm font-medium text-foreground/70">{feature.tagline}</p>
              <p className="text-sm leading-relaxed text-foreground/60">{feature.description}</p>
            </section>
          </RevealOnScroll>
        ))}
      </div>

      <RevealOnScroll className="flex flex-col items-center gap-4 text-center">
        <h2 className="text-2xl font-bold text-foreground">Ready to bring your firm on board?</h2>
        <CtaRow />
      </RevealOnScroll>
    </main>
  );
}
