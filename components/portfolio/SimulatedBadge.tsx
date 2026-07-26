// The persistent "this is not real money" marker — appears on every
// simulated-portfolio surface (tab, list cards, detail header). Reuses the
// rounded-full indigo type-pill convention from
// components/trackers/TrackerDetailView.tsx rather than the amber
// EstimateRangeBadge treatment, which this app reserves for numeric-
// estimate caveats specifically, a different meaning than "not real."
export default function SimulatedBadge() {
  return (
    <span className="rounded-full bg-indigo-400/10 px-2 py-0.5 text-xs font-medium text-indigo-400">
      Simulated
    </span>
  );
}
