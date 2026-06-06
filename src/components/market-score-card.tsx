"use client";

import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useMarketStore } from "@/lib/store";
import { cn } from "@/lib/utils";

function AnimatedGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (score / 100) * circumference * 0.75;

  const getColor = (s: number) => {
    if (s >= 70) return "#10B981";
    if (s >= 40) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <div className="relative w-36 h-36 sm:w-44 sm:h-44 mx-auto">
      <svg className="w-full h-full -rotate-[135deg]" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.25}
          strokeLinecap="round"
        />
        <motion.circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={getColor(score)}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl sm:text-4xl font-bold tabular-nums"
          style={{ color: getColor(score) }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
        >
          {score}
        </motion.span>
        <span className="text-xs text-muted-foreground mt-0.5">/100</span>
      </div>
    </div>
  );
}

export function MarketScoreCard() {
  const { marketScore } = useMarketStore();

  const label =
    marketScore.score >= 70
      ? "Bullish"
      : marketScore.score >= 40
        ? "Neutral"
        : "Bearish";

  return (
    <Card glow={marketScore.score >= 70 ? "green" : "none"}>
      <div className="text-center mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Market Score
        </span>
        <h3 className="text-sm font-semibold text-foreground mt-0.5">
          {label}
        </h3>
      </div>

      <AnimatedGauge score={marketScore.score} />

      <div className="mt-4 space-y-2">
        <div className="space-y-1.5">
          {marketScore.drivers.map((driver, i) => (
            <motion.div
              key={driver}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + i * 0.1 }}
              className="flex items-center gap-2 text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-bullish shrink-0" />
              <span className="text-foreground/80">{driver}</span>
            </motion.div>
          ))}
        </div>

        {marketScore.risks.length > 0 && (
          <div className="pt-2 border-t border-border/50 space-y-1.5">
            {marketScore.risks.map((risk, i) => (
              <motion.div
                key={risk}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 + i * 0.1 }}
                className="flex items-center gap-2 text-xs"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
                <span className="text-foreground/80">{risk}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
