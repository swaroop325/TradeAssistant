"use client";

import { motion } from "framer-motion";
import { Bell, Shield, Settings, Wifi } from "lucide-react";
import { useState } from "react";
import { useClock } from "@/hooks/useClock";
import { formatTime, getCurrentSession, SESSIONS, cn } from "@/lib/utils";
import { useMarketStore } from "@/lib/store";
import { getMarketStatus } from "@/lib/market-hours";
import { Badge } from "@/components/ui/badge";
import { SettingsPanel } from "@/components/settings-panel";
import { NotificationSheet } from "@/components/notification-sheet";

export function CommandBar() {
  const time = useClock();
  const heroAlert = useMarketStore((s) => s.heroAlert);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const marketStatus = getMarketStatus();
  const sgtTime = new Date(
    time.toLocaleString("en-US", { timeZone: "Asia/Singapore" })
  );
  const currentSession = getCurrentSession(sgtTime.getHours());
  const sessionName = marketStatus.status === "weekend"
    ? "Weekend"
    : currentSession
      ? SESSIONS[currentSession].name
      : "Pre-Market";
  const isOpen = marketStatus.status === "open";

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className="sticky top-0 z-50 glass-strong"
      >
        <div className="flex items-center justify-between px-4 py-3 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gold animate-pulse-glow" />
              <span className="text-sm font-semibold text-foreground tracking-tight hidden sm:inline">
                TradeAssistant
              </span>
              <span className="text-sm font-semibold text-foreground tracking-tight sm:hidden">
                TA
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground">SGT</span>
              <span className="text-sm font-mono font-medium tabular-nums text-foreground">
                {formatTime(time)}
              </span>
            </div>

            <div className="hidden sm:block h-6 w-px bg-border" />

            <Badge
              variant={isOpen ? "bullish" : marketStatus.status === "weekend" ? "neutral" : "warning"}
              className="hidden sm:inline-flex"
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isOpen ? "bg-bullish" : marketStatus.status === "weekend" ? "bg-muted-foreground" : "bg-warning"
                )}
              />
              {sessionName}
            </Badge>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setNotifOpen(true)}
                className="p-2 rounded-lg hover:bg-muted/60 transition-colors"
              >
                <Bell className="w-4 h-4 text-muted-foreground" />
              </button>
              <button className="p-2 rounded-lg hover:bg-muted/60 transition-colors">
                <Wifi className="w-4 h-4 text-bullish" />
              </button>
              <button className="p-2 rounded-lg hover:bg-muted/60 transition-colors hidden sm:flex">
                <Shield className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                className="p-2 rounded-lg hover:bg-muted/60 transition-colors"
              >
                <Settings className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        {heroAlert && (
          <div className="border-t border-border/50">
            <HeroTicker alert={heroAlert} />
          </div>
        )}
      </motion.header>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <NotificationSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}

function HeroTicker({ alert }: { alert: string }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      className="relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-critical/5 via-critical/10 to-critical/5" />
      <motion.div
        className="flex items-center justify-center gap-2 py-2 px-4"
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="w-2 h-2 rounded-full bg-critical animate-pulse" />
        <span className="text-xs sm:text-sm font-semibold text-critical tracking-wide">
          {alert}
        </span>
        <span className="w-2 h-2 rounded-full bg-critical animate-pulse" />
      </motion.div>
    </motion.div>
  );
}
