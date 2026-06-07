"use client";

import { motion } from "framer-motion";
import { Bell, Shield, Settings, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useClock } from "@/hooks/useClock";
import { formatTime, getCurrentSession, SESSIONS, cn } from "@/lib/utils";
import { useMarketStore } from "@/lib/store";
import { getMarketStatus } from "@/lib/market-hours";
import { fetchMarketData, fetchMarketScore, fetchEvents, fetchIntelligence } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { SettingsPanel } from "@/components/settings-panel";
import { NotificationSheet } from "@/components/notification-sheet";

export function CommandBar() {
  const time = useClock();
  const heroAlert = useMarketStore((s) => s.heroAlert);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const [data, score, events, intel] = await Promise.all([
        fetchMarketData(),
        fetchMarketScore(),
        fetchEvents(),
        fetchIntelligence(),
      ]);
      const store = useMarketStore.getState();
      if (data) {
        const trend = data.changePercent > 1 ? "strong_up" : data.changePercent > 0.3 ? "up" : data.changePercent > -0.3 ? "neutral" : data.changePercent > -1 ? "down" : "strong_down";
        const range = data.high - data.low;
        const volatility = range > 50 ? "high" : range > 35 ? "above_average" : range > 20 ? "average" : "low";
        const bias = data.changePercent > 0.5 ? "bullish" : data.changePercent < -0.5 ? "bearish" : "neutral";
        store.setPrice({ price: data.price, change: data.change, changePercent: data.changePercent, high: data.high, low: data.low, open: data.open, previousClose: data.previousClose, trend: trend as any, volatility: volatility as any, bias: bias as any, rangeConsumed: (data as any).rangeConsumed || 0, pivots: (data as any).pivots || null, correlations: (data as any).correlations || null });
        store.addPriceHistory(data.price);
      }
      if (score) store.setMarketScore(score);
      if (events?.events) store.setEvents(events.events.map((e) => ({ id: e.id, name: e.name, impact: e.impact as any, time: new Date(e.time), forecast: e.forecast, previous: e.previous })));
      if (intel?.intelligence && intel.intelligence.length > 0) store.setIntelligence(intel.intelligence.map((item) => ({ id: item.id, timestamp: new Date(item.timestamp), type: item.type as any, title: item.title, summary: item.summary, confidence: item.confidence, impact: item.impact as any })));
    } catch (err) {
      console.error("[Refresh] Error:", err);
    } finally {
      setRefreshing(false);
    }
  }

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
      <div className="fixed top-0 left-0 right-0 h-[env(safe-area-inset-top)] bg-background z-[51]" />
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className="sticky top-[env(safe-area-inset-top)] z-50 glass-strong"
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
              <button
                onClick={handleRefresh}
                className="p-2 rounded-lg hover:bg-muted/60 transition-colors"
                disabled={refreshing}
              >
                <RefreshCw className={cn("w-4 h-4 text-muted-foreground", refreshing && "animate-spin text-accent")} />
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
