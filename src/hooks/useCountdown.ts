"use client";

import { useState, useEffect } from "react";

export function useCountdown(targetTime: Date | number): number {
  const [seconds, setSeconds] = useState(() => {
    const target = typeof targetTime === "number" ? targetTime : targetTime.getTime();
    return Math.max(0, Math.floor((target - Date.now()) / 1000));
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const target = typeof targetTime === "number" ? targetTime : targetTime.getTime();
      const remaining = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setSeconds(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTime]);

  return seconds;
}
