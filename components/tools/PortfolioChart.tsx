"use client";

import { useEffect, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  createChart,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from "lightweight-charts";

function toUnixTime(dateStr: string): UTCTimestamp {
  const iso = dateStr.includes(" ")
    ? `${dateStr.replace(" ", "T")}Z`
    : `${dateStr}T00:00:00Z`;
  return Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp;
}

export default function PortfolioChart({
  data,
}: {
  data: { date: string; value: number }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  // A brief opacity fade-in on first data arrival — lightweight-charts has
  // no built-in draw-in tween for a freshly-set series (see PriceChart's
  // own comment on this same library limitation), so this is the
  // equivalent "entrance" treatment for this chart.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "rgba(128,128,128,0.1)" },
        horzLines: { color: "rgba(128,128,128,0.1)" },
      },
      timeScale: { timeVisible: false, secondsVisible: false },
    });

    chartRef.current = chart;
    seriesRef.current = chart.addSeries(AreaSeries, {
      lineColor: "#22c55e",
      lineWidth: 2,
      topColor: "rgba(34,197,94,0.28)",
      bottomColor: "rgba(34,197,94,0)",
      priceLineVisible: false,
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || data.length === 0) return;

    setVisible(false);
    seriesRef.current.setData(
      data.map((point) => ({ time: toUnixTime(point.date), value: point.value }))
    );
    chartRef.current?.timeScale().fitContent();
    const timer = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(timer);
  }, [data]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full transition-opacity duration-500 ease-out"
      style={{ opacity: visible ? 1 : 0 }}
    />
  );
}
