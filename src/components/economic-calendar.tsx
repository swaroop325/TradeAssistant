"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMarketStore } from "@/lib/store";
import { useCountdown } from "@/hooks/useCountdown";
import { formatCountdown, cn } from "@/lib/utils";

const goldCorrelation: Record<string, string> = {
  "Non-Farm Payrolls": "Strong jobs = USD up = gold down",
  "CPI": "Hot inflation = gold up (hedge demand)",
  "FOMC": "Hawkish = gold down, Dovish = gold up",
  "Fed Rate Decision": "Rate hike = gold down, cut = gold up",
  "PPI": "Producer inflation signals CPI direction",
  "Retail Sales": "Strong consumer = USD up = gold pressure",
  "GDP": "Strong growth = less safe-haven demand",
  "Unemployment Claims": "Weak labor = dovish Fed = gold up",
  "ISM Manufacturing": "Below 50 = recession fear = gold up",
  "ADP Employment": "Previews NFP direction",
  "PCE": "Fed's preferred inflation gauge",
  "Consumer Confidence": "Weak confidence = risk-off = gold up",
};

function getGoldNote(eventName: string): string | null {
  for (const [key, note] of Object.entries(goldCorrelation)) {
    if (eventName.toLowerCase().includes(key.toLowerCase())) return note;
  }
  return null;
}

function EventRow({ event, defaultExpanded }: { event: { id: string; name: string; impact: string; time: Date; forecast?: string; previous?: string; actual?: string }; defaultExpanded?: boolean }) {
  const seconds = useCountdown(event.time);
  const [expanded, setExpanded] = useState(defaultExpanded || false);

  const impactVariant = {
    low: "neutral",
    medium: "warning",
    high: "warning",
    critical: "critical",
  }[event.impact] as "neutral" | "warning" | "critical";

  const isImminent = seconds < 15 * 60;
  const isPast = seconds <= 0;
  const goldNote = getGoldNote(event.name);

  return (
    <motion.div
      className={cn(
        "rounded-xl transition-all cursor-pointer",
        isImminent && !isPast ? "bg-critical/5 border border-critical/20" : "bg-muted/20",
        isPast && "opacity-50"
      )}
      animate={isImminent && !isPast ? { borderColor: ["rgba(220,38,38,0.1)", "rgba(220,38,38,0.4)", "rgba(220,38,38,0.1)"] } : {}}
      transition={isImminent && !isPast ? { duration: 2, repeat: Infinity } : {}}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-3">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground truncate">
              {event.name}
            </span>
            <Badge variant={impactVariant}>
              {event.impact}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 ml-2 shrink-0">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span
              className={cn(
                "text-xs font-mono tabular-nums",
                isImminent && !isPast ? "text-critical font-semibold" : "text-muted-foreground"
              )}
            >
              {isPast ? "Done" : formatCountdown(seconds)}
            </span>
            {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2">
              <div className="flex gap-4 text-[11px]">
                {event.forecast && (
                  <span className="text-muted-foreground">
                    Forecast: <span className="text-foreground font-medium">{event.forecast}</span>
                  </span>
                )}
                {event.previous && (
                  <span className="text-muted-foreground">
                    Previous: <span className="text-foreground font-medium">{event.previous}</span>
                  </span>
                )}
                {event.actual && (
                  <span className="text-muted-foreground">
                    Actual: <span className="text-foreground font-medium">{event.actual}</span>
                  </span>
                )}
              </div>
              {goldNote && (
                <div className="text-[11px] text-warning/80 bg-warning/5 rounded-lg px-2 py-1.5">
                  ⚡ {goldNote}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function EconomicCalendar() {
  const events = useMarketStore((s) => s.events);
  const [showAll, setShowAll] = useState(false);

  const futureEvents = events.filter((e) => new Date(e.time).getTime() > Date.now() - 300000);
  const displayEvents = showAll ? futureEvents : futureEvents.slice(0, 4);
  const hasMore = futureEvents.length > 4;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-warning" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Economic Calendar
          </span>
        </div>
        {events.length > 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {futureEvents.length} upcoming
          </span>
        )}
      </div>

      <div className="space-y-2">
        {events.length === 0 ? (
          <div className="text-center py-4">
            <span className="text-xs text-muted-foreground">No upcoming events</span>
          </div>
        ) : (
          <>
            {displayEvents.map((event, i) => (
              <EventRow key={event.id} event={event} defaultExpanded={i === 0} />
            ))}
            {hasMore && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full text-center py-2 text-[11px] text-accent hover:text-accent/80 transition-colors"
              >
                {showAll ? "Show less" : `Show all ${futureEvents.length} events`}
              </button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
