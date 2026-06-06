"use client";

import { Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useMarketStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function KeyLevels() {
  const { price, pivots, high, low } = useMarketStore((s) => s.price);

  if (!pivots || price === 0) return null;

  const levels = [
    { label: "R3", value: pivots.r3, type: "resistance" },
    { label: "R2", value: pivots.r2, type: "resistance" },
    { label: "R1", value: pivots.r1, type: "resistance" },
    { label: "PP", value: pivots.pp, type: "pivot" },
    { label: "S1", value: pivots.s1, type: "support" },
    { label: "S2", value: pivots.s2, type: "support" },
    { label: "S3", value: pivots.s3, type: "support" },
  ];

  // Find nearest support and resistance
  const nearestResistance = levels
    .filter((l) => l.type === "resistance" && l.value > price)
    .sort((a, b) => a.value - b.value)[0];

  const nearestSupport = levels
    .filter((l) => l.type === "support" && l.value < price)
    .sort((a, b) => b.value - a.value)[0];

  const distToHigh = high > 0 ? (high - price).toFixed(1) : null;
  const distToLow = low > 0 ? (price - low).toFixed(1) : null;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-warning" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Key Levels
        </span>
      </div>

      <div className="space-y-2">
        {/* Distance from daily H/L */}
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">From daily high</span>
          <span className="font-mono tabular-nums text-bearish">{distToHigh} pips</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">From daily low</span>
          <span className="font-mono tabular-nums text-bullish">{distToLow} pips</span>
        </div>

        <div className="h-px bg-border/50 my-1" />

        {/* Nearest levels */}
        {nearestResistance && (
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground">Next resistance ({nearestResistance.label})</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono tabular-nums text-bearish">{nearestResistance.value.toFixed(0)}</span>
              <span className="text-[9px] text-muted-foreground">({(nearestResistance.value - price).toFixed(0)}↑)</span>
            </div>
          </div>
        )}
        {nearestSupport && (
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground">Next support ({nearestSupport.label})</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono tabular-nums text-bullish">{nearestSupport.value.toFixed(0)}</span>
              <span className="text-[9px] text-muted-foreground">({(price - nearestSupport.value).toFixed(0)}↓)</span>
            </div>
          </div>
        )}

        <div className="h-px bg-border/50 my-1" />

        {/* All pivot levels */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {levels.map((l) => (
            <div key={l.label} className="flex flex-col">
              <span className={cn(
                "text-[8px] font-medium",
                l.type === "resistance" && "text-bearish",
                l.type === "support" && "text-bullish",
                l.type === "pivot" && "text-accent",
              )}>
                {l.label}
              </span>
              <span className="text-[9px] font-mono tabular-nums text-foreground/70">
                {l.value.toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
