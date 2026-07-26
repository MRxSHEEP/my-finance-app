import MiniLineChart from "@/components/MiniLineChart";

interface SparklineSlotProps {
  // undefined: the quote itself hasn't loaded yet — show the loading
  // skeleton, same as before. An empty/null array: the fetch completed
  // (we have a real answer) but there's genuinely no chart data — show a
  // clean flat-line fallback instead of leaving the loading skeleton
  // spinning forever, which is what previously made a real failure look
  // identical to "still loading." A non-empty array renders the real
  // sparkline, optionally flagged stale (last-known-good data served
  // because the live fetch failed — see lib/sparklineFetch.ts).
  history: { time: number; value: number }[] | null | undefined;
  height: number;
  stale?: boolean;
}

export default function SparklineSlot({ history, height, stale = false }: SparklineSlotProps) {
  if (history === undefined) {
    return <div className="w-full animate-pulse rounded bg-foreground/10" style={{ height }} />;
  }

  if (!history || history.length === 0) {
    return (
      <div
        className="flex w-full flex-col items-center justify-center gap-1 overflow-hidden rounded bg-foreground/[0.03]"
        style={{ height }}
        title="No chart data available"
      >
        <div className="h-px w-2/3 shrink-0 bg-foreground/15" />
        <span className="whitespace-nowrap text-[9px] leading-none text-foreground/30">No chart data</span>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <MiniLineChart data={history} height={height} />
      {stale && (
        <span
          className="absolute right-0 top-0 rounded-sm bg-foreground/10 px-1 py-px text-[8px] font-medium uppercase leading-none tracking-wide text-foreground/50"
          title="Showing the last available data — live data is temporarily unavailable"
        >
          Stale
        </span>
      )}
    </div>
  );
}
