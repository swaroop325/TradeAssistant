"use client";

import { cn } from "@/lib/utils";
import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

interface CardProps extends HTMLMotionProps<"div"> {
  glow?: "gold" | "blue" | "red" | "green" | "none";
  variant?: "default" | "glass" | "elevated";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, glow = "none", variant = "default", children, ...props }, ref) => {
    const glowClass = {
      gold: "glow-gold",
      blue: "glow-blue",
      red: "glow-red",
      green: "glow-green",
      none: "",
    }[glow];

    const variantClass = {
      default: "bg-card border border-border",
      glass: "glass",
      elevated: "bg-card border border-border shadow-lg shadow-black/20",
    }[variant];

    return (
      <motion.div
        ref={ref}
        className={cn(
          "rounded-2xl p-5",
          variantClass,
          glowClass,
          className
        )}
        whileHover={{ y: -2, scale: 1.005 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = "Card";
