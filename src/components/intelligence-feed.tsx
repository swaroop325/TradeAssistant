"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, TrendingUp, BarChart3, ArrowUpRight, ArrowDownRight, ChevronDown } from "lucide-react";
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

const typeLabels: Record<string, string> = {
  liquidity_sweep: "Liquidity",
  volatility_spike: "Volatility",
  trend_shift: "Trend",
  session_break: "Session",
  range_breakout: "Breakout",
  sharp_move: "Sharp Move",
};

function isRecent(timestamp: Date): boolean {
  return Date.now() - new Date(timestamp).getTime() < 30 * 60 * 1000;
}

function IntelItem({ item, index }: { item: IntelligenceItem; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = typeIcons[item.type];
  const impactVariant = item.impact === "bullish" ? "bullish" : item.impact === "bearish" ? "bearish" : "neutral";
  const fresh = isRecent(item.timestamp);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 200 }}
      className="relative pl-6 pb-3 last:pb-0 cursor-pointer"
      onClick={() => setExpanded(!expanded)}
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
      {index < 5 && (
        <div className="absolute left-[5px] top-4 bottom-0 w-px bg-border" />
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium text-foreground truncate">
              {item.title}
            </span>
            {fresh && (
              <span className="text-[8px] bg-accent/20 text-accent px-1 rounded font-medium shrink-0">
                NEW
              </span>
            )}
          </div>

          <AnimatePresence>
            {expanded ? (
              <motion.p
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="text-[11px] text-muted-foreground leading-relaxed"
              >
                {item.summary}
              </motion.p>
            ) : (
              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-1">
                {item.summary}
              </p>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 mt-1">
            <Badge variant={impactVariant} className="text-[9px] px-1.5 py-0">
              {item.impact}
            </Badge>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {item.confidence}%
            </span>
            <span className="text-[9px] text-muted-foreground/60">
              {typeLabels[item.type]}
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
  const [showAll, setShowAll] = useState(false);

  const displayCount = showAll ? 12 : 5;
  const displayed = intelligence.slice(0, displayCount);
  const hasMore = intelligence.length > 5;

  return (
    <Card className="col-span-full lg:col-span-1">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Market Intelligence
          </span>
        </div>
        {intelligence.length > 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {intelligence.length} insights
          </span>
        )}
      </div>

      <div className="space-y-0 max-h-80 overflow-y-auto pr-1">
        {intelligence.length === 0 ? (
          <div className="text-center py-4">
            <span className="text-xs text-muted-foreground">Analyzing market data...</span>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {displayed.map((item, i) => (
              <IntelItem key={item.id} item={item} index={i} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full flex items-center justify-center gap-1 pt-3 text-[11px] text-accent hover:text-accent/80 transition-colors"
        >
          <ChevronDown className="w-3 h-3" />
          Show more
        </button>
      )}
    </Card>
  );
}
