"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Zap, TrendingUp, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMarketStore, type IntelligenceItem } from "@/lib/store";
import { formatTimeShort, cn } from "@/lib/utils";

const typeIcons = {
  liquidity_sweep: Zap,
  volatility_spike: BarChart3,
  trend_shift: TrendingUp,
  session_break: ArrowUpRight,
  range_breakout: ArrowUpRight,
  sharp_move: ArrowDownRight,
};

const typeLabels = {
  liquidity_sweep: "Liquidity",
  volatility_spike: "Volatility",
  trend_shift: "Trend",
  session_break: "Session",
  range_breakout: "Breakout",
  sharp_move: "Sharp Move",
};

function IntelItem({ item, index }: { item: IntelligenceItem; index: number }) {
  const Icon = typeIcons[item.type];
  const impactVariant = item.impact === "bullish" ? "bullish" : item.impact === "bearish" ? "bearish" : "neutral";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 200 }}
      className="relative pl-6 pb-4 last:pb-0"
    >
      <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-muted flex items-center justify-center">
        <div
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            item.impact === "bullish" && "bg-bullish",
            item.impact === "bearish" && "bg-bearish",
            item.impact === "neutral" && "bg-accent"
          )}
        />
      </div>
      {index < 3 && (
        <div className="absolute left-[5px] top-4 bottom-0 w-px bg-border" />
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-foreground">
              {item.title}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
            {item.summary}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant={impactVariant} className="text-[9px] px-1.5 py-0">
              {item.impact}
            </Badge>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {item.confidence}% conf
            </span>
          </div>
        </div>

        <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
          {formatTimeShort(item.timestamp)}
        </span>
      </div>
    </motion.div>
  );
}

export function IntelligenceFeed() {
  const intelligence = useMarketStore((s) => s.intelligence);

  return (
    <Card className="col-span-full lg:col-span-1">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-accent" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Market Intelligence
        </span>
      </div>

      <div className="space-y-0 max-h-72 overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout">
          {intelligence.slice(0, 6).map((item, i) => (
            <IntelItem key={item.id} item={item} index={i} />
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}
