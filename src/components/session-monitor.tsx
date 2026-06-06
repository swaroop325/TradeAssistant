"use client";

import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useClock } from "@/hooks/useClock";
import { SESSIONS, getCurrentSession, getSecondsUntilHour, formatCountdown, cn } from "@/lib/utils";
import { isMarketOpen } from "@/lib/market-hours";
import { useState, useEffect } from "react";

interface SessionRowProps {
  session: keyof typeof SESSIONS;
  currentSession: string | null;
  marketClosed: boolean;
}

function SessionRow({ session, currentSession, marketClosed }: SessionRowProps) {
  const info = SESSIONS[session];
  const isActive = currentSession === session;
  const [countdown, setCountdown] = useState(getSecondsUntilHour(info.open));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getSecondsUntilHour(info.open));
    }, 1000);
    return () => clearInterval(interval);
  }, [info.open]);

  return (
    <motion.div
      className={cn(
        "flex items-center justify-between p-3 rounded-xl transition-colors",
        isActive ? "bg-muted/60 border border-border/80" : "bg-muted/20"
      )}
      animate={
        isActive
          ? { borderColor: ["rgba(255,255,255,0.06)", "rgba(255,255,255,0.15)", "rgba(255,255,255,0.06)"] }
          : {}
      }
      transition={{ duration: 3, repeat: Infinity }}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-2.5 h-2.5 rounded-full",
            isActive ? "animate-pulse" : "opacity-40"
          )}
          style={{ backgroundColor: info.color }}
        />
        <div>
          <span className="text-sm font-medium text-foreground">
            {info.name}
          </span>
          <span className="text-[10px] text-muted-foreground block">
            {String(info.open).padStart(2, "0")}:00 -{" "}
            {String(info.close).padStart(2, "0")}:00 SGT
          </span>
        </div>
      </div>

      <div className="text-right">
        {isActive ? (
          <span className="text-xs font-medium text-bullish">Active</span>
        ) : marketClosed ? (
          <span className="text-xs text-muted-foreground">Closed</span>
        ) : (
          <span className="text-xs font-mono text-muted-foreground tabular-nums">
            {formatCountdown(countdown)}
          </span>
        )}
      </div>
    </motion.div>
  );
}

export function SessionMonitor() {
  const time = useClock();
  const sgtTime = new Date(
    time.toLocaleString("en-US", { timeZone: "Asia/Singapore" })
  );
  const marketOpen = isMarketOpen();
  const currentSession = marketOpen ? getCurrentSession(sgtTime.getHours()) : null;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-accent" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Session Monitor
        </span>
      </div>

      <div className="space-y-2">
        {(Object.keys(SESSIONS) as Array<keyof typeof SESSIONS>).map(
          (session) => (
            <SessionRow
              key={session}
              session={session}
              currentSession={currentSession}
              marketClosed={!marketOpen}
            />
          )
        )}
      </div>
    </Card>
  );
}
