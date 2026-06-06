import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return price.toFixed(2);
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Singapore",
  });
}

export function formatTimeShort(date: Date): string {
  return date.toLocaleTimeString("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Singapore",
  });
}

export function getSGTDate(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Singapore" })
  );
}

export type Session = "tokyo" | "london" | "newyork";

export interface SessionInfo {
  name: string;
  open: number;
  close: number;
  color: string;
}

export const SESSIONS: Record<Session, SessionInfo> = {
  tokyo: { name: "Tokyo", open: 8, close: 16, color: "#F59E0B" },
  london: { name: "London", open: 15, close: 0, color: "#3B82F6" },
  newyork: { name: "New York", open: 20, close: 5, color: "#10B981" },
};

export function getCurrentSession(hour: number): Session | null {
  if (hour >= 8 && hour < 16) return "tokyo";
  if (hour >= 15 && hour < 24) return "london";
  if (hour >= 20 || hour < 5) return "newyork";
  return null;
}

export function getSecondsUntilHour(targetHour: number): number {
  const now = getSGTDate();
  const target = new Date(now);
  target.setHours(targetHour, 0, 0, 0);
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  return Math.floor((target.getTime() - now.getTime()) / 1000);
}
