"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { CommandBar } from "@/components/command-bar";
import { GoldPriceCard } from "@/components/gold-price-card";
import { PriceChart } from "@/components/price-chart";
import { MarketScoreCard } from "@/components/market-score-card";
import { SessionMonitor } from "@/components/session-monitor";
import { EconomicCalendar } from "@/components/economic-calendar";
import { IntelligenceFeed } from "@/components/intelligence-feed";
import { DailyBriefing } from "@/components/daily-briefing";
import { WeeklyReport } from "@/components/weekly-report";
import { Correlations } from "@/components/correlations";
import { KeyLevels } from "@/components/key-levels";
import { registerServiceWorker } from "@/lib/service-worker";
import { useMarketPolling } from "@/hooks/useMarketPolling";
import { AuthGate } from "@/components/auth-gate";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 200, damping: 25 },
  },
};

export default function Dashboard() {
  useMarketPolling();

  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <AuthGate>
    <div className="min-h-dvh pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <CommandBar />

      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
        >
          <motion.div variants={fadeUp} className="col-span-full lg:col-span-2">
            <GoldPriceCard />
          </motion.div>

          <motion.div variants={fadeUp}>
            <MarketScoreCard />
          </motion.div>

          <motion.div variants={fadeUp} className="col-span-full">
            <PriceChart />
          </motion.div>

          <motion.div variants={fadeUp}>
            <SessionMonitor />
          </motion.div>

          <motion.div variants={fadeUp}>
            <Correlations />
          </motion.div>

          <motion.div variants={fadeUp}>
            <KeyLevels />
          </motion.div>

          <motion.div variants={fadeUp}>
            <EconomicCalendar />
          </motion.div>

          <motion.div variants={fadeUp}>
            <IntelligenceFeed />
          </motion.div>

          <motion.div variants={fadeUp} className="md:col-span-1">
            <DailyBriefing />
          </motion.div>

          <motion.div variants={fadeUp}>
            <WeeklyReport />
          </motion.div>

        </motion.div>
      </main>
    </div>
    </AuthGate>
  );
}
