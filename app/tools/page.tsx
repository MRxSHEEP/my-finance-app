import Link from "next/link";

const TOOLS = [
  {
    title: "DCF Calculator",
    description: "Estimate intrinsic value from projected free cash flows.",
    href: "/tools/dcf",
  },
  {
    title: "EBITDA Calculator",
    description: "Calculate EBITDA and, optionally, EBITDA margin.",
    href: "/tools/ebitda",
  },
  {
    title: "EV/EBITDA Calculator",
    description: "Calculate enterprise value and the EV/EBITDA multiple.",
    href: "/tools/ev-ebitda",
  },
  {
    title: "DCA Simulator",
    description: "Simulate dollar-cost averaging into a stock over time.",
    href: "/tools/dca",
  },
  {
    title: "PEG Ratio Calculator",
    description: "Compare a P/E ratio against expected earnings growth.",
    href: "/tools/peg",
  },
];

export default function ToolsPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 pt-16">
      <h1 className="text-3xl font-bold text-foreground">Tools</h1>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="rounded-md border border-black/10 p-4 text-sm transition-colors hover:border-black/30 dark:border-white/15 dark:hover:border-white/30"
          >
            <h2 className="mb-1 font-semibold text-foreground">{tool.title}</h2>
            <p className="text-foreground/60">{tool.description}</p>
          </Link>
        ))}
      </div>

      <p className="w-full max-w-3xl text-xs text-foreground/60">
        These calculators are educational estimation tools meant to help you understand common
        valuation concepts. They are not investment advice — always do your own research or
        consult a financial professional before making investment decisions.
      </p>
    </main>
  );
}
