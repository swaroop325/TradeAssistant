import { create } from "zustand";

export interface PriceData {
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  trend: "strong_up" | "up" | "neutral" | "down" | "strong_down";
  volatility: "low" | "average" | "above_average" | "high";
  bias: "bullish" | "bearish" | "neutral";
}

export interface MarketEvent {
  id: string;
  name: string;
  impact: "low" | "medium" | "high" | "critical";
  time: Date;
  forecast?: string;
  previous?: string;
  actual?: string;
}

export interface IntelligenceItem {
  id: string;
  timestamp: Date;
  type: "liquidity_sweep" | "volatility_spike" | "trend_shift" | "session_break" | "range_breakout" | "sharp_move";
  title: string;
  summary: string;
  confidence: number;
  impact: "bullish" | "bearish" | "neutral";
}

export interface Alert {
  id: string;
  timestamp: Date;
  category: "session" | "economic" | "price" | "intelligence";
  title: string;
  summary: string;
  impact: "low" | "medium" | "high" | "critical";
  read: boolean;
}

export interface DailyBriefing {
  bias: string;
  support: number[];
  resistance: number[];
  events: string[];
  volatilityOutlook: string;
  bestWindow: string;
}

export interface MarketScore {
  score: number;
  drivers: string[];
  risks: string[];
}

interface MarketStore {
  price: PriceData;
  priceHistory: number[];
  events: MarketEvent[];
  intelligence: IntelligenceItem[];
  alerts: Alert[];
  briefing: DailyBriefing;
  marketScore: MarketScore;
  heroAlert: string | null;
  setPrice: (price: PriceData) => void;
  addPriceHistory: (price: number) => void;
  setEvents: (events: MarketEvent[]) => void;
  setIntelligence: (items: IntelligenceItem[]) => void;
  addIntelligence: (item: IntelligenceItem) => void;
  addAlert: (alert: Alert) => void;
  markAlertRead: (id: string) => void;
  setBriefing: (briefing: DailyBriefing) => void;
  setMarketScore: (score: MarketScore) => void;
  setHeroAlert: (alert: string | null) => void;
}

export const useMarketStore = create<MarketStore>((set) => ({
  price: {
    price: 0,
    change: 0,
    changePercent: 0,
    high: 0,
    low: 0,
    open: 0,
    previousClose: 0,
    trend: "neutral",
    volatility: "low",
    bias: "neutral",
  },
  priceHistory: [],
  events: [],
  intelligence: [],
  alerts: [],
  briefing: {
    bias: "Neutral",
    support: [],
    resistance: [],
    events: [],
    volatilityOutlook: "Awaiting market data...",
    bestWindow: "—",
  },
  marketScore: {
    score: 50,
    drivers: [],
    risks: [],
  },
  heroAlert: null,
  setPrice: (price) => set({ price }),
  addPriceHistory: (p) =>
    set((state) => ({
      priceHistory: [...state.priceHistory.slice(-49), p],
    })),
  setEvents: (events) => set({ events }),
  setIntelligence: (items) => set({ intelligence: items.slice(0, 50) }),
  addIntelligence: (item) =>
    set((state) => ({
      intelligence: [item, ...state.intelligence].slice(0, 50),
    })),
  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 100),
    })),
  markAlertRead: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, read: true } : a
      ),
    })),
  setBriefing: (briefing) => set({ briefing }),
  setMarketScore: (marketScore) => set({ marketScore }),
  setHeroAlert: (heroAlert) => set({ heroAlert }),
}));
