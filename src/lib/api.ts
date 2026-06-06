const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function apiFetch<T>(path: string): Promise<T | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchMarketData() {
  return apiFetch<{
    price: number;
    change: number;
    changePercent: number;
    high: number;
    low: number;
    open: number;
    previousClose: number;
    timestamp: string;
  }>("/market/data");
}

export async function fetchMarketScore() {
  return apiFetch<{
    score: number;
    drivers: string[];
    risks: string[];
  }>("/market/score");
}

export async function fetchAlerts() {
  return apiFetch<{
    alerts: Array<{
      id: string;
      title: string;
      summary: string;
      impact: string;
      category: string;
      timestamp: string;
      read: boolean;
    }>;
  }>("/alerts");
}

export async function fetchBriefing() {
  return apiFetch<{
    bias: string;
    support: number[];
    resistance: number[];
    events: string[];
    volatilityOutlook: string;
    bestWindow: string;
  }>("/briefing");
}

export async function fetchEvents() {
  return apiFetch<{
    events: Array<{
      id: string;
      name: string;
      impact: string;
      time: string;
      currency: string;
      forecast?: string;
      previous?: string;
      actual?: string;
    }>;
  }>("/market/events");
}

export async function fetchIntelligence() {
  return apiFetch<{
    intelligence: Array<{
      id: string;
      timestamp: string;
      type: string;
      title: string;
      summary: string;
      confidence: number;
      impact: string;
    }>;
  }>("/market/intelligence");
}

export async function subscribePush(subscription: PushSubscription) {
  if (!API_BASE) return false;
  try {
    const res = await fetch(`${API_BASE}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
