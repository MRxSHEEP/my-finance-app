// Shared, small presentational pieces used everywhere a tracker page shows
// a date, a value, or a derived figure that isn't a plain precise fact —
// per the task's own non-negotiable rule: never show a number derived
// from incomplete/estimated data without a visible indicator that it's an
// estimate. Kept as focused one-purpose components rather than one big
// configurable one, so each call site stays readable about which specific
// caveat applies.

export function EstimateRangeBadge({ low, high }: { low: number | null; high: number | null }) {
  if (low == null && high == null) return null;
  const text =
    low != null && high != null
      ? `Est. $${low.toLocaleString()}–$${high.toLocaleString()}`
      : `Est. $${(low ?? high)!.toLocaleString()}+`;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-500"
      title="Congressional disclosures report a dollar VALUE RANGE, never an exact amount — this is that range, not a precise figure."
    >
      {text}
    </span>
  );
}

export function DateComparison({
  reportedDate,
  tradeDate,
  disclosureDate,
}: {
  reportedDate: string | null;
  tradeDate: string | null;
  disclosureDate: string | null;
}) {
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  // Reported and trade dates are only shown as two separate lines when
  // they're actually known to differ — most sources only ever give one
  // of the two, so showing both as identical would imply a precision the
  // data doesn't have.
  const showBoth = tradeDate && reportedDate && tradeDate !== reportedDate;
  const disclosureDelayDays =
    disclosureDate && (tradeDate ?? reportedDate)
      ? Math.round(
          (new Date(disclosureDate).getTime() - new Date((tradeDate ?? reportedDate)!).getTime()) / 86_400_000
        )
      : null;

  return (
    <div className="flex flex-col gap-0.5 text-xs text-foreground/60">
      {showBoth ? (
        <>
          <span>Trade date: {fmt(tradeDate!)}</span>
          <span>Reported date: {fmt(reportedDate!)}</span>
        </>
      ) : (
        <span>{reportedDate ? `Reported: ${fmt(reportedDate)}` : tradeDate ? `Trade date: ${fmt(tradeDate)}` : "Date unknown"}</span>
      )}
      {disclosureDate && (
        <span>
          Disclosed: {fmt(disclosureDate)}
          {disclosureDelayDays != null && disclosureDelayDays >= 0 && (
            <span className="text-foreground/40"> ({disclosureDelayDays}-day delay)</span>
          )}
        </span>
      )}
    </div>
  );
}

export function DividendsExcludedNote() {
  return <span className="text-[11px] italic text-foreground/40">Excludes dividends</span>;
}

export function MethodologyNote({ text }: { text: string }) {
  if (!text) return null;
  return <p className="text-[11px] leading-relaxed text-foreground/40">{text}</p>;
}

export function NoDataYetNote({ reason }: { reason: string }) {
  return (
    <p className="rounded-md bg-foreground/5 px-3 py-2 text-xs text-foreground/50">
      Not enough data yet — {reason}
    </p>
  );
}

export function ShareBasedEstimateBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-500"
      title="Accumulated from real reported share counts across ingested disclosures — a best-effort running total from the transactions ingested so far, not a verified starting position, so treat this as an estimate rather than a confirmed exact holding."
    >
      Est. from activity
    </span>
  );
}

export function UnresolvedHoldingsNote({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <p
      className="text-[11px] italic text-foreground/40"
      title="These issuer names from the filing couldn't be automatically matched to a ticker — never guessed at, so they're left out of the priced holdings list above."
    >
      +{count} additional reported position{count === 1 ? "" : "s"} couldn&apos;t be matched to a ticker and{" "}
      {count === 1 ? "isn't" : "aren't"} shown above.
    </p>
  );
}
