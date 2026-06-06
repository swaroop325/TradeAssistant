"use client";

import { cn } from "@/lib/utils";

interface BadgeProps {
  variant?: "default" | "bullish" | "bearish" | "warning" | "critical" | "neutral";
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
}

export function Badge({ variant = "default", children, className, pulse }: BadgeProps) {
  const variantStyles = {
    default: "bg-accent/15 text-accent",
    bullish: "bg-bullish/15 text-bullish",
    bearish: "bg-bearish/15 text-bearish",
    warning: "bg-warning/15 text-warning",
    critical: "bg-critical/15 text-critical",
    neutral: "bg-muted-foreground/15 text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        pulse && "animate-pulse-glow",
        className
      )}
    >
      {children}
    </span>
  );
}
