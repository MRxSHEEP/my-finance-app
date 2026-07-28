// Shared shapes for the report narrative-commentary draft feature — an
// assistive, non-persisting AI draft layer over the existing White-Label
// Reporting flow (see app/api/reporting/reports/draft-narrative/route.ts
// and components/reporting/ReportGeneratorForm.tsx). Nothing here is ever
// written to the database on its own; it's gathered fresh per request and
// discarded once the response is sent. Only the advisor's own
// edited/approved text (Report.narrativeCommentary) is ever persisted.

// Reused verbatim when a holding's ticker already has a real /signals
// TradeSignal row — same shape as lib/signals/types.ts's GeneratedSignal,
// minus the fields this feature has no use for.
export interface ExistingSignalContext {
  direction: string;
  confidence: number;
  rationale: string;
  generatedAt: string;
}

// Condensed from lib/signals/types.ts's SignalDataSnapshot — only the
// categories worth citing in a short portfolio-commentary paragraph, not
// the full technical/news/insider detail /signals itself renders.
export interface FreshTickerContext {
  latestClose: number | null;
  smaTrend: "above" | "below" | null; // latest close vs. 50-day SMA
  nextEarningsDate: string | null;
  lastEarningsSurprisePercent: number | null;
  topNewsHeadline: string | null;
}

export interface SimulatedHoldingContext {
  ticker: string;
  companyName: string | null;
  assetType: string; // "stock" | "commodity" | "crypto" — see lib/simulatedTrading/pricing.ts
  currentValue: number;
  percentOfPortfolio: number;
  unrealizedGainLossPercent: number | null;
  // Condensed factual data points — populated from a real TradeSignal row's
  // stored dataSnapshot when one exists for this ticker, otherwise from a
  // fresh lib/signals/gather.ts call. Null only when neither source
  // produced anything (e.g. a crypto/commodity holding, where these
  // stock-specific categories don't apply).
  freshData: FreshTickerContext | null;
  // Populated ONLY when a real, persisted TradeSignal row exists for this
  // ticker — i.e. the actual live /signals feature already produced a
  // verdict for it, not a lookalike regenerated for this feature.
  existingSignal: ExistingSignalContext | null;
}

export interface ManualHoldingContext {
  label: string;
  value: number;
  percentOfPortfolio: number;
}

export interface ReportNarrativeContext {
  clientName: string;
  totalValue: number;
  // Exactly one of these two is non-null, matching Report.portfolioSource's
  // existing "none" | "simulated" | "manual" split — "none" never reaches
  // this feature at all (see the draft-narrative route's own guard).
  simulatedHoldings: SimulatedHoldingContext[] | null;
  manualHoldings: ManualHoldingContext[] | null;
}

export interface ReportNarrativeDraft {
  narrative: string;
}
