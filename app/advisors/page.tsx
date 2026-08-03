"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, FileBarChart2, PieChart, Scale, Copy, Check } from "lucide-react";
import RevealOnScroll from "@/components/RevealOnScroll";
import { cardClass } from "@/lib/cardStyles";

// Single source for the address — both mailto hrefs below and the visible
// fallback text in CtaRow derive from this, so it only ever exists once in
// source.
const SUPPORT_EMAIL = "thenoblesupport@gmail.com";

// A separate front door for RIA/advisory-firm visitors — no TickerBar, no
// Sidebar, no AccountMenu (see components/ConditionalAppChrome.tsx), and
// deliberately no embedded product walkthroughs either. The four feature
// walkthroughs (ComplianceWalkthrough etc.) render real, if frozen/dated,
// price figures and chart UI — safe for their own signed-out feature pages,
// but not appropriate here given the unresolved provider-licensing question
// this page exists to stay clear of. Every sentence below is static
// prose adapted from those same walkthroughs' own already-accuracy-checked
// captions (and each feature's own page subtitle), not new claims.
//
// Revisited pre-launch (zero customers): the hero eyebrow/sub-headline, the
// Peer Benchmarking card's trend sentence, and the primary CTA were rewritten
// so the page doesn't read as software firms are already using — see the
// comment on CtaRow() below for the CTA specifically.
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
      "Build a peer set in minutes by searching real tickers, then see exactly how a core holding stacks up against its closest peers, metric by metric, with the best value in each row highlighted automatically — no manual spreadsheet comparison required. Every peer set is snapshotted daily, so a trend view builds in automatically as your firm uses it — showing how the comparison has moved, not just where it stands today.",
  },
] as const;

// The primary action is a mailto request, not a Link to /signup: a working
// self-serve signup exists but only creates a personal User account, not an
// Organization — real org creation is a separate, unlinked flow at
// /compliance's CreateOrgCard. Pointing this button at /signup would promise
// a one-click org setup that doesn't happen there, so it asks for early
// access instead until that gap is closed.
function CtaRow() {
  const [copied, setCopied] = useState(false);

  function copyEmail() {
    navigator.clipboard
      ?.writeText(SUPPORT_EMAIL)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Rejected (permission denied) or navigator.clipboard is undefined
        // (non-secure context) — the address text right next to this button
        // is already selectable by hand, so there's nothing further to fall
        // back to; this just prevents an unhandled rejection.
      });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=Noble%20for%20Advisors%20%E2%80%94%20early%20access`}
          className="rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Request early access
        </a>
        <Link
          href="/login"
          className="rounded-md border border-black/10 px-6 py-3 text-sm font-medium text-foreground/70 hover:text-foreground dark:border-white/15"
        >
          Sign in
        </Link>
      </div>
      {/* Guaranteed fallback for the mailto above — on a machine with no
          default mail client configured, clicking it does nothing at all,
          silently. This plain, always-visible, selectable text needs no JS,
          no clipboard permissions, no secure context — it's the actual
          "never fails" guarantee; the Copy button is a convenience on top of
          it, not a replacement. */}
      <p className="text-xs text-foreground/50">
        Or email us directly:{" "}
        <span className="whitespace-nowrap font-medium text-foreground select-all">{SUPPORT_EMAIL}</span>{" "}
        <button
          type="button"
          onClick={copyEmail}
          className="inline-flex items-center gap-1 whitespace-nowrap underline hover:no-underline"
        >
          {copied ? (
            <>
              <Check size={12} /> Copied
            </>
          ) : (
            <>
              <Copy size={12} /> Copy
            </>
          )}
        </button>
      </p>
    </div>
  );
}

export default function AdvisorsPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-16 p-8 pb-20 pt-16">
      <RevealOnScroll className="flex max-w-2xl flex-col items-center gap-4 text-center">
        <span className="rounded-full border border-black/10 bg-background px-3 py-1 text-xs font-medium text-foreground/50 shadow-sm dark:border-white/15">
          Early access
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Built for RIAs and advisory firms
        </h1>
        <p className="text-lg text-foreground/60">
          Compliance, reporting, model portfolios, and peer benchmarking — the tools an advisory firm
          needs, in one place for the whole team. Now opening to a limited set of early-access firms.
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
