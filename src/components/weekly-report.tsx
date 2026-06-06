"use client";

import { motion } from "framer-motion";
import { BarChart3, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { fetchWeeklyReport } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ReportData {
  weekStart: string;
  weekEnd: string;
  priceOpen: number;
  priceClose: number;
  weekHigh: number;
  weekLow: number;
  weekChange: number;
  weekChangePercent: number;
  totalAlerts: number;
  alertBreakdown: { session: number; price: number; economic: number; intelligence: number };
  briefingAccuracy: string;
  keyEvents: string[];
  outlook: string;
}

export function WeeklyReport() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchWeeklyReport().then((data) => {
      if (data) setReport(data);
    });
  }, []);

  if (!report) return null;

  const isUp = report.weekChange > 0;

  return (
    <Card>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full mb-3"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Weekly Report
          </span>
          <Badge variant={isUp ? "bullish" : "bearish"} className="text-[9px]">
            {isUp ? "+" : ""}{report.weekChangePercent.toFixed(1)}%
          </Badge>
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
            <span className="text-[10px] text-muted-foreground">
              {report.weekStart} — {report.weekEnd}
            </span>
            <div className="flex items-center gap-1">
              {isUp ? (
                <TrendingUp className="w-3 h-3 text-bullish" />
              ) : (
                <TrendingDown className="w-3 h-3 text-bearish" />
              )}
              <span className={cn("text-xs font-mono font-semibold", isUp ? "text-bullish" : "text-bearish")}>
                {isUp ? "+" : ""}{report.weekChange.toFixed(1)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-lg p-2.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                Open → Close
              </span>
              <span className="text-xs font-mono tabular-nums text-foreground">
                {report.priceOpen.toFixed(0)} → {report.priceClose.toFixed(0)}
              </span>
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                Week Range
              </span>
              <span className="text-xs font-mono tabular-nums text-foreground">
                {report.weekLow.toFixed(0)} – {report.weekHigh.toFixed(0)}
              </span>
            </div>
          </div>

          <div className="bg-muted/30 rounded-lg p-2.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
              Alerts Fired
            </span>
            <div className="flex items-center gap-3 text-xs text-foreground/80">
              <span>{report.totalAlerts} total</span>
              <span className="text-muted-foreground">|</span>
              <span>Session: {report.alertBreakdown.session}</span>
              <span>Price: {report.alertBreakdown.price}</span>
            </div>
          </div>

          <div className="bg-muted/30 rounded-lg p-2.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
              Briefing Accuracy
            </span>
            <span className="text-xs text-foreground/80">{report.briefingAccuracy}</span>
          </div>

          {report.outlook && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-2.5">
              <span className="text-[10px] text-accent uppercase tracking-wider block mb-1">
                Next Week Outlook
              </span>
              <span className="text-xs text-foreground/80 leading-relaxed">{report.outlook}</span>
            </div>
          )}
        </div>
      </motion.div>
    </Card>
  );
}
