"use client";

import { motion } from "framer-motion";
import { Calendar, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMarketStore } from "@/lib/store";
import { useCountdown } from "@/hooks/useCountdown";
import { formatCountdown, cn } from "@/lib/utils";

function EventRow({ event }: { event: { id: string; name: string; impact: string; time: Date; forecast?: string; previous?: string } }) {
  const seconds = useCountdown(event.time);

  const impactVariant = {
    low: "neutral",
    medium: "warning",
    high: "warning",
    critical: "critical",
  }[event.impact] as "neutral" | "warning" | "critical";

  const isImminent = seconds < 15 * 60;

  return (
    <motion.div
      className={cn(
        "p-3 rounded-xl transition-all",
        isImminent ? "bg-critical/5 border border-critical/20" : "bg-muted/20"
      )}
      animate={isImminent ? { borderColor: ["rgba(220,38,38,0.1)", "rgba(220,38,38,0.4)", "rgba(220,38,38,0.1)"] } : {}}
      transition={isImminent ? { duration: 2, repeat: Infinity } : {}}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-sm font-medium text-foreground">
            {event.name}
          </span>
          <Badge variant={impactVariant} className="ml-2">
            {event.impact}
          </Badge>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-[10px] text-muted-foreground">
          {event.forecast && (
            <span>
              F: <span className="text-foreground/80">{event.forecast}</span>
            </span>
          )}
          {event.previous && (
            <span>
              P: <span className="text-foreground/80">{event.previous}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span
            className={cn(
              "text-xs font-mono tabular-nums",
              isImminent ? "text-critical font-semibold" : "text-muted-foreground"
            )}
          >
            {formatCountdown(seconds)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function EconomicCalendar() {
  const events = useMarketStore((s) => s.events);

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-4 h-4 text-warning" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Economic Calendar
        </span>
      </div>

      <div className="space-y-2">
        {events.length === 0 ? (
          <div className="text-center py-4">
            <span className="text-xs text-muted-foreground">No upcoming events</span>
          </div>
        ) : (
          events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))
        )}
      </div>
    </Card>
  );
}
