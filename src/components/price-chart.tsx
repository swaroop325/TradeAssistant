"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi, ColorType } from "lightweight-charts";
import { Card } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

type Timeframe = "1m" | "5m" | "15m" | "1h";

const TIMEFRAMES: { label: string; value: Timeframe; range: string }[] = [
  { label: "1M", value: "1m", range: "1d" },
  { label: "5M", value: "5m", range: "5d" },
  { label: "15M", value: "15m", range: "5d" },
  { label: "1H", value: "1h", range: "1mo" },
];

async function fetchCandles(interval: string, range: string): Promise<Candle[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) return [];
  try {
    const res = await fetch(`${apiBase}/market/candles?interval=${interval}&range=${range}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.candles || [];
  } catch {
    return [];
  }
}

export function PriceChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null) as any;
  const [timeframe, setTimeframe] = useState<Timeframe>("5m");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255, 255, 255, 0.5)",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.03)" },
        horzLines: { color: "rgba(255, 255, 255, 0.03)" },
      },
      crosshair: {
        vertLine: { color: "rgba(255, 255, 255, 0.2)", labelBackgroundColor: "#1a1a2e" },
        horzLine: { color: "rgba(255, 255, 255, 0.2)", labelBackgroundColor: "#1a1a2e" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "rgba(255, 255, 255, 0.05)",
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.05)",
      },
      handleScroll: { vertTouchDrag: false },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10B981",
      downColor: "#EF4444",
      borderUpColor: "#10B981",
      borderDownColor: "#EF4444",
      wickUpColor: "#10B981",
      wickDownColor: "#EF4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(chartContainerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const tf = TIMEFRAMES.find((t) => t.value === timeframe)!;
    setLoading(true);

    fetchCandles(tf.value, tf.range).then((candles) => {
      if (seriesRef.current && candles.length > 0) {
        seriesRef.current.setData(
          candles.map((c) => ({
            time: c.time as any,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );
        chartRef.current?.timeScale().fitContent();
      }
      setLoading(false);
    });
  }, [timeframe]);

  return (
    <Card className="col-span-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            XAUUSD Chart
          </span>
        </div>
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                timeframe === tf.value
                  ? "bg-accent/20 text-accent"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-48 sm:h-56" />
      </div>
    </Card>
  );
}
