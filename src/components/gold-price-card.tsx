"use client";

import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMarketStore } from "@/lib/store";
import { formatPrice, formatPercent, cn } from "@/lib/utils";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";
import { useEffect, useState, useRef } from "react";

function AnimatedPrice({ value, className }: { value: number; className?: string }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      setFlash(value > prevValue.current ? "up" : "down");
      const timer = setTimeout(() => setFlash(null), 600);
      prevValue.current = value;

      const start = displayValue;
      const diff = value - start;
      const duration = 400;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(start + diff * eased);
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);

      return () => clearTimeout(timer);
    }
  }, [value]);

  return (
    <span
      className={cn(
        "transition-colors duration-300 tabular-nums",
        flash === "up" && "text-bullish",
        flash === "down" && "text-bearish",
        className
      )}
    >
      {formatPrice(displayValue)}
    </span>
  );
}

export function GoldPriceCard() {
  const { price, priceHistory } = useMarketStore();
  const isLoading = price.price === 0;
  const isBullish = price.changePercent >= 0;

  const chartData = priceHistory.map((p, i) => ({ value: p, idx: i }));

  const trendLabel = {
    strong_up: "Strong Uptrend",
    up: "Uptrend",
    neutral: "Neutral",
    down: "Downtrend",
    strong_down: "Strong Downtrend",
  }[price.trend];

  const volatilityLabel = {
    low: "Low",
    average: "Average",
    above_average: "Above Average",
    high: "High",
  }[price.volatility];

  return (
    <Card
      glow={isLoading ? "none" : isBullish ? "gold" : "red"}
      className="col-span-full lg:col-span-2"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              XAUUSD
            </span>
            {!isLoading && (
              <Badge variant={isBullish ? "bullish" : "bearish"}>
                {price.bias.charAt(0).toUpperCase() + price.bias.slice(1)}
              </Badge>
            )}
          </div>
          {isLoading ? (
            <div className="text-3xl sm:text-4xl font-bold text-muted-foreground animate-pulse">
              —
            </div>
          ) : (
            <AnimatedPrice
              value={price.price}
              className="text-3xl sm:text-4xl font-bold"
            />
          )}
          <div className="flex items-center gap-2 mt-1">
            {isBullish ? (
              <TrendingUp className="w-4 h-4 text-bullish" />
            ) : (
              <TrendingDown className="w-4 h-4 text-bearish" />
            )}
            <span
              className={cn(
                "text-sm font-medium tabular-nums",
                isBullish ? "text-bullish" : "text-bearish"
              )}
            >
              {formatPercent(price.changePercent)} ({isBullish ? "+" : ""}
              {price.change.toFixed(2)})
            </span>
          </div>
        </div>

        <div className="text-right space-y-1">
          <div className="text-xs text-muted-foreground">
            H: <span className="text-foreground font-medium tabular-nums">{formatPrice(price.high)}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            L: <span className="text-foreground font-medium tabular-nums">{formatPrice(price.low)}</span>
          </div>
        </div>
      </div>

      <div className="h-24 sm:h-32 -mx-2 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={isBullish ? "#10B981" : "#EF4444"}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={isBullish ? "#10B981" : "#EF4444"}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <YAxis domain={["dataMin - 5", "dataMax + 5"]} hide />
            <Area
              type="monotone"
              dataKey="value"
              stroke={isBullish ? "#10B981" : "#EF4444"}
              strokeWidth={2}
              fill="url(#priceGradient)"
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/40 rounded-xl px-3 py-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
            Trend
          </span>
          <span className="text-xs font-medium text-foreground">{trendLabel}</span>
        </div>
        <div className="bg-muted/40 rounded-xl px-3 py-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
            Volatility
          </span>
          <span className="text-xs font-medium text-foreground flex items-center gap-1">
            <Activity className="w-3 h-3" />
            {volatilityLabel}
          </span>
        </div>
        <div className="bg-muted/40 rounded-xl px-3 py-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
            Range
          </span>
          <span className="text-xs font-medium text-foreground tabular-nums">
            {(price.high - price.low).toFixed(0)} pips
          </span>
        </div>
      </div>
    </Card>
  );
}
