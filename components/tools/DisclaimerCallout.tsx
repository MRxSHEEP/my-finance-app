import { Info } from "lucide-react";

// Restyled from the old plain "text-xs text-foreground/60" paragraph
// every tool page used to end with — same message, but styled as an
// intentional callout (icon + bordered box) rather than looking like an
// afterthought.
export default function DisclaimerCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full max-w-2xl items-start gap-2.5 rounded-md border border-amber-400/20 bg-amber-400/[0.04] p-3.5 text-xs text-foreground/60">
      <Info size={15} className="mt-0.5 shrink-0 text-amber-400/80" />
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}
