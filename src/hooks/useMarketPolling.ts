"use client";

import { useEffect, useRef } from "react";
import { useMarketStore } from "@/lib/store";
import { fetchMarketData, fetchAlerts, fetchBriefing, fetchMarketScore } from "@/lib/api";
import { isMarketOpen } from "@/lib/market-hours";

export function useMarketPolling() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { setPrice, addPriceHistory, setHeroAlert } = useMarketStore.getState();

  useEffect(() => {
    async function poll() {
      if (!process.env.NEXT_PUBLIC_API_URL) return;

      try {
        const data = await fetchMarketData();
        if (data) {
          const trend = data.changePercent > 1
            ? "strong_up"
            : data.changePercent > 0.3
              ? "up"
              : data.changePercent > -0.3
                ? "neutral"
                : data.changePercent > -1
                  ? "down"
                  : "strong_down";

          const range = data.high - data.low;
          const volatility = range > 50
            ? "high"
            : range > 35
              ? "above_average"
              : range > 20
                ? "average"
                : "low";

          const bias = data.changePercent > 0.5
            ? "bullish"
            : data.changePercent < -0.5
              ? "bearish"
              : "neutral";

          useMarketStore.getState().setPrice({
            price: data.price,
            change: data.change,
            changePercent: data.changePercent,
            high: data.high,
            low: data.low,
            open: data.open,
            previousClose: data.previousClose,
            trend: trend as any,
            volatility: volatility as any,
            bias: bias as any,
          });

          useMarketStore.getState().addPriceHistory(data.price);
        }

        const scoreData = await fetchMarketScore();
        if (scoreData) {
          useMarketStore.getState().setMarketScore(scoreData);
        }

        const alertsData = await fetchAlerts();
        if (alertsData?.alerts) {
          const store = useMarketStore.getState();
          for (const alert of alertsData.alerts) {
            store.addAlert({
              id: alert.id,
              timestamp: new Date(alert.timestamp),
              category: alert.category as any,
              title: alert.title,
              summary: alert.summary,
              impact: alert.impact as any,
              read: alert.read,
            });
          }
        }
      } catch (err) {
        console.error("[Poll] Error:", err);
      }
    }

    // Initial fetch
    poll();

    // Poll every 60s when market open, 5min when closed
    const interval = isMarketOpen() ? 60_000 : 300_000;
    intervalRef.current = setInterval(poll, interval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Fetch briefing once on mount
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_API_URL) return;

    fetchBriefing().then((data) => {
      if (data) {
        useMarketStore.getState().setBriefing(data);
      }
    });
  }, []);
}
