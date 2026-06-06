"use client";

import { motion } from "framer-motion";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMarketStore } from "@/lib/store";
import { useState } from "react";

export function DailyBriefing() {
  const briefing = useMarketStore((s) => s.briefing);
  const [expanded, setExpanded] = useState(true);

  return (
    <Card>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full mb-3"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gold" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Daily Briefing
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      <motion.div
        initial={false}
        animate={{ height: expanded ? "auto" : 0, opacity: expanded ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Bias</span>
            <Badge variant={briefing.bias === "Bullish" ? "bullish" : briefing.bias === "Bearish" ? "bearish" : "neutral"}>
              {briefing.bias}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-lg p-2.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                Support
              </span>
              <div className="space-y-0.5">
                {briefing.support.map((s) => (
                  <span key={s} className="text-xs text-bullish font-mono tabular-nums block">
                    {s.toFixed(0)}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                Resistance
              </span>
              <div className="space-y-0.5">
                {briefing.resistance.map((r) => (
                  <span key={r} className="text-xs text-bearish font-mono tabular-nums block">
                    {r.toFixed(0)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-muted/30 rounded-lg p-2.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
              Volatility Outlook
            </span>
            <span className="text-xs text-foreground/80">{briefing.volatilityOutlook}</span>
          </div>

          <div className="bg-muted/30 rounded-lg p-2.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
              Best Window
            </span>
            <span className="text-xs text-accent font-medium">{briefing.bestWindow}</span>
          </div>

          <div className="bg-muted/30 rounded-lg p-2.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
              Key Events
            </span>
            <div className="space-y-0.5">
              {briefing.events.map((e) => (
                <span key={e} className="text-xs text-foreground/80 block">
                  {e}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </Card>
  );
}
