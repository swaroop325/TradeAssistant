"use client";

import { motion } from "framer-motion";
import { Link2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useMarketStore } from "@/lib/store";
import { cn } from "@/lib/utils";

function CorrRow({ label, data }: { label: string; data: { price: number; change: number; changePercent: number; signal: string } | null }) {
  if (!data) return null;

  const isUp = data.changePercent > 0;
  const isNeutral = Math.abs(data.changePercent) < 0.1;

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        {isNeutral ? (
          <Minus className="w-3 h-3 text-muted-foreground" />
        ) : isUp ? (
          <TrendingUp className="w-3 h-3 text-bullish" />
        ) : (
          <TrendingDown className="w-3 h-3 text-bearish" />
        )}
        <span className="text-xs text-foreground font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono tabular-nums text-foreground/80">
          {data.price.toFixed(label === "VIX" ? 1 : 2)}
        </span>
        <span className={cn(
          "text-[10px] font-mono tabular-nums",
          isUp ? "text-bullish" : isNeutral ? "text-muted-foreground" : "text-bearish"
        )}>
          {isUp ? "+" : ""}{data.changePercent.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

export function Correlations() {
  const correlations = useMarketStore((s) => s.price.correlations);

  if (!correlations) return null;
  if (!correlations.dxy && !correlations.tnx && !correlations.vix) return null;

  const signals = [correlations.dxy?.signal, correlations.tnx?.signal, correlations.vix?.signal].filter(Boolean);
  const bullishCount = signals.filter((s) => s?.toLowerCase().includes("bullish") || s?.toLowerCase().includes("tailwind") || s?.toLowerCase().includes("supportive")).length;
  const bearishCount = signals.filter((s) => s?.toLowerCase().includes("bearish") || s?.toLowerCase().includes("headwind")).length;

  const netSignal = bullishCount > bearishCount ? "Supportive" : bearishCount > bullishCount ? "Headwind" : "Mixed";

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-accent" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Correlations
          </span>
        </div>
        <span className={cn(
          "text-[10px] font-medium px-2 py-0.5 rounded-full",
          netSignal === "Supportive" && "bg-bullish/10 text-bullish",
          netSignal === "Headwind" && "bg-bearish/10 text-bearish",
          netSignal === "Mixed" && "bg-muted text-muted-foreground",
        )}>
          {netSignal}
        </span>
      </div>

      <div className="divide-y divide-border/50">
        <CorrRow label="DXY" data={correlations.dxy} />
        <CorrRow label="10Y Yield" data={correlations.tnx} />
        <CorrRow label="VIX" data={correlations.vix} />
      </div>

      <div className="mt-2 pt-2 border-t border-border/50">
        <div className="flex gap-2 flex-wrap">
          {correlations.dxy?.signal && (
            <span className="text-[9px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
              DXY: {correlations.dxy.signal}
            </span>
          )}
          {correlations.vix?.signal && (
            <span className="text-[9px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
              VIX: {correlations.vix.signal}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
