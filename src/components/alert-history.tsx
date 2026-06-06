"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Bell, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMarketStore, type Alert } from "@/lib/store";
import { formatTimeShort, cn } from "@/lib/utils";
import { useState } from "react";

const categoryIcons: Record<string, string> = {
  session: "S",
  economic: "E",
  price: "P",
  intelligence: "I",
};

function AlertRow({ alert }: { alert: Alert }) {
  const impactVariant = {
    low: "neutral",
    medium: "warning",
    high: "warning",
    critical: "critical",
  }[alert.impact] as "neutral" | "warning" | "critical";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-start gap-3 p-3 rounded-xl transition-colors",
        !alert.read ? "bg-muted/40" : "bg-transparent"
      )}
    >
      <div
        className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0",
          alert.impact === "critical" && "bg-critical/15 text-critical",
          alert.impact === "high" && "bg-warning/15 text-warning",
          alert.impact === "medium" && "bg-accent/15 text-accent",
          alert.impact === "low" && "bg-muted text-muted-foreground"
        )}
      >
        {categoryIcons[alert.category]}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-foreground truncate">
            {alert.title}
          </span>
          {!alert.read && (
            <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
          )}
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-1">
          {alert.summary}
        </p>
      </div>

      <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
        {formatTimeShort(alert.timestamp)}
      </span>
    </motion.div>
  );
}

export function AlertHistory() {
  const alerts = useMarketStore((s) => s.alerts);
  const [filter, setFilter] = useState<string | null>(null);

  const filtered = filter
    ? alerts.filter((a) => a.category === filter)
    : alerts;

  return (
    <Card className="col-span-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-accent" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Alert History
          </span>
        </div>

        <div className="flex items-center gap-1">
          {["session", "economic", "price", "intelligence"].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(filter === cat ? null : cat)}
              className={cn(
                "px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors",
                filter === cat
                  ? "bg-accent/20 text-accent"
                  : "text-muted-foreground hover:bg-muted/60"
              )}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1 max-h-64 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {filtered.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}
