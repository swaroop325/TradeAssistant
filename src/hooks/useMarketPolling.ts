"use client";

import { useEffect, useRef } from "react";
import { useMarketStore } from "@/lib/store";
import { fetchMarketData, fetchAlerts, fetchBriefing, fetchMarketScore, fetchEvents, fetchIntelligence } from "@/lib/api";
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
            rangeConsumed: (data as any).rangeConsumed || 0,
            pivots: (data as any).pivots || null,
            correlations: (data as any).correlations || null,
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

        const eventsData = await fetchEvents();
        if (eventsData?.events) {
          useMarketStore.getState().setEvents(
            eventsData.events.map((e) => ({
              id: e.id,
              name: e.name,
              impact: e.impact as any,
              time: new Date(e.time),
              forecast: e.forecast,
              previous: e.previous,
            }))
          );
        }

        const intelData = await fetchIntelligence();
        if (intelData?.intelligence && intelData.intelligence.length > 0) {
          useMarketStore.getState().setIntelligence(
            intelData.intelligence.map((item) => ({
              id: item.id,
              timestamp: new Date(item.timestamp),
              type: item.type as any,
              title: item.title,
              summary: item.summary,
              confidence: item.confidence,
              impact: item.impact as any,
            }))
          );
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

    // Re-fetch when user returns to the page
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        poll();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
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
