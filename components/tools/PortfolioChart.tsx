"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  createChart,
  IChartApi,
  ISeriesApi,
  LineSeries,
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
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

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
    seriesRef.current = chart.addSeries(LineSeries, {
      color: "#22c55e",
      lineWidth: 2,
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || data.length === 0) return;

    seriesRef.current.setData(
      data.map((point) => ({ time: toUnixTime(point.date), value: point.value }))
    );
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return <div ref={containerRef} className="h-full w-full" />;
}
