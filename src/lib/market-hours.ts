import { getSGTDate } from "./utils";

export type MarketStatus = "open" | "closed" | "pre_market" | "weekend";

export function getMarketStatus(): { status: MarketStatus; label: string } {
  const now = getSGTDate();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const hour = now.getHours();

  // Forex market closed: Friday 5pm NY (Sat 5am SGT) to Sunday 5pm NY (Mon 5am SGT)
  if (day === 6) {
    if (hour >= 5) return { status: "weekend", label: "Weekend — Markets Closed" };
  }
  if (day === 0) {
    return { status: "weekend", label: "Weekend — Markets Closed" };
  }
  if (day === 1 && hour < 5) {
    return { status: "weekend", label: "Weekend — Opens Mon 05:00 SGT" };
  }

  // Active sessions (SGT times)
  if (hour >= 8 && hour < 16) return { status: "open", label: "Tokyo Session" };
  if (hour >= 15 && hour < 24) return { status: "open", label: "London Session" };
  if (hour >= 20 || hour < 5) return { status: "open", label: "New York Session" };

  // Between sessions
  if (hour >= 5 && hour < 8) return { status: "pre_market", label: "Pre-Tokyo" };

  return { status: "open", label: "Market Open" };
}

export function isMarketOpen(): boolean {
  const { status } = getMarketStatus();
  return status === "open" || status === "pre_market";
}

export function getNextMarketOpen(): Date | null {
  const now = getSGTDate();
  const day = now.getDay();

  if (day === 6) {
    // Saturday → Monday 5am SGT
    const next = new Date(now);
    next.setDate(next.getDate() + 2);
    next.setHours(5, 0, 0, 0);
    return next;
  }
  if (day === 0) {
    // Sunday → Monday 5am SGT
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(5, 0, 0, 0);
    return next;
  }

  return null;
}
