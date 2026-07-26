"use client";

import { useEffect, useRef } from "react";
import { AreaSeries, ColorType, createChart, type UTCTimestamp } from "lightweight-charts";

interface MiniLineChartProps {
  data: { time: number; value: number }[];
  height?: number;
}

// A compact, non-interactive sparkline — the same lightweight-charts setup
// used for the main stock chart (see app/stocks/page.tsx), stripped down to
// just a colored line with no axes/crosshair/scroll-zoom, sized to sit
// inside a small grid card.
export default function MiniLineChart({ data, height = 64 }: MiniLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "transparent",
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
      timeScale: { visible: false },
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

    const isUp = data[data.length - 1].value >= data[0].value;
    const color = isUp ? "#22c55e" : "#ef4444";

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

    series.setData(
      data.map((point) => ({ time: point.time as UTCTimestamp, value: point.value }))
    );
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [data]);

  return <div ref={containerRef} style={{ height }} className="w-full" />;
}
