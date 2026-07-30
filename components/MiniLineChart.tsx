"use client";

import { useEffect, useRef } from "react";
import { AreaSeries, ColorType, createChart, type UTCTimestamp } from "lightweight-charts";

interface MiniLineChartProps {
  // A null value is an explicit gap day (e.g. a missed provider snapshot).
  // IMPORTANT: a lightweight-charts "whitespace" point (time only, no
  // value) does NOT break the line — verified directly against the
  // library's own documented example: it still draws a smooth interpolated
  // line straight through consecutive whitespace points. The only technique
  // that actually produces a visual gap is rendering each contiguous
  // real-data run as its own separate series (see the segment-splitting
  // below) — confirmed the same way. Omitting a day entirely (rather than
  // passing null) still just skips it with no visual break either way, so
  // existing callers that already filter nulls out themselves are unaffected.
  data: { time: number; value: number | null }[];
  height?: number;
  // Off by default — every other consumer of this component (stock/
  // watchlist/sector sparklines) is intentionally axis-less and decorative.
  // Benchmarking's trend cards are a real analysis surface, not a
  // decorative sparkline, so they opt into a visible time axis instead.
  showTimeAxis?: boolean;
}

// A compact, non-interactive sparkline — the same lightweight-charts setup
// used for the main stock chart (see app/stocks/page.tsx), stripped down to
// just a colored line with no axes/crosshair/scroll-zoom, sized to sit
// inside a small grid card.
export default function MiniLineChart({ data, height = 64, showTimeAxis = false }: MiniLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: showTimeAxis ? "rgba(148,163,184,0.8)" : "transparent",
        // The default TradingView attribution mark is sized for a full
        // chart — at this card's ~64px height it reads as a stray glyph
        // sitting on top of the sparkline rather than a subtle watermark.
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: { visible: false },
      timeScale: { visible: showTimeAxis, timeVisible: showTimeAxis, secondsVisible: false },
      crosshair: {
        vertLine: { visible: false, labelVisible: false },
        horzLine: { visible: false, labelVisible: false },
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: false,
        horzTouchDrag: false,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: false,
        pinch: false,
        axisPressedMouseMove: false,
        axisDoubleClickReset: false,
      },
    });

    const realPoints = data.filter((p): p is { time: number; value: number } => p.value !== null);
    const isUp = realPoints.length > 0 && realPoints[realPoints.length - 1].value >= realPoints[0].value;
    const color = isUp ? "#22c55e" : "#ef4444";

    // Split into contiguous real-data runs at each null — one series per
    // run, nothing connecting between them, which is what actually
    // produces a visual break (see the prop comment above). All segments
    // share one color/style so the sparkline still reads as one continuous
    // trend, just with real gaps left open rather than bridged.
    const segments: { time: number; value: number }[][] = [];
    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      if (point.value === null) continue;
      const prevWasReal = i > 0 && data[i - 1].value !== null;
      if (prevWasReal && segments.length > 0) {
        segments[segments.length - 1].push({ time: point.time, value: point.value });
      } else {
        segments.push([{ time: point.time, value: point.value }]);
      }
    }

    for (const segment of segments) {
      // A gradient area fill (not a flat line) reads as "positive/negative
      // momentum" at a glance, matching the broader color-language pass —
      // solid near the line, fading to nothing toward the baseline.
      const series = chart.addSeries(AreaSeries, {
        lineColor: color,
        lineWidth: 2,
        topColor: isUp ? "rgba(34,197,94,0.32)" : "rgba(239,68,68,0.32)",
        bottomColor: isUp ? "rgba(34,197,94,0)" : "rgba(239,68,68,0)",
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      series.setData(segment.map((point) => ({ time: point.time as UTCTimestamp, value: point.value })));
    }
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [data, showTimeAxis]);

  return <div ref={containerRef} style={{ height }} className="w-full" />;
}
