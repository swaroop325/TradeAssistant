"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, BellOff, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { registerServiceWorker, subscribeToPush } from "@/lib/service-worker";
import { subscribePush } from "@/lib/api";

type PermissionState = "default" | "granted" | "denied" | "subscribing" | "subscribed";

interface NotificationSheetProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationSheet({ open, onClose }: NotificationSheetProps) {
  const [permission, setPermission] = useState<PermissionState>("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const current = Notification.permission;
      if (current === "granted") {
        navigator.serviceWorker?.ready.then((reg) => {
          reg.pushManager.getSubscription().then((sub) => {
            setPermission(sub ? "subscribed" : "granted");
          });
        });
      } else {
        setPermission(current as PermissionState);
      }
    }
  }, [open]);

  async function handleEnable() {
    setPermission("subscribing");
    try {
      const registration = await registerServiceWorker();
      if (!registration) {
        setPermission("denied");
        return;
      }

      const subscription = await subscribeToPush(registration);
      if (!subscription) {
        setPermission("denied");
        return;
      }

      await subscribePush(subscription);
      setPermission("subscribed");
    } catch {
      setPermission("denied");
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[60]"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-3xl z-[70] p-5 max-h-[80vh] overflow-y-auto"
          >
            <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-muted/60 transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {permission === "subscribed" && (
              <div className="flex items-center gap-3 bg-bullish/10 border border-bullish/20 rounded-xl p-4 mb-4">
                <CheckCircle2 className="w-5 h-5 text-bullish" />
                <div>
                  <span className="text-sm font-medium text-foreground block">
                    Push notifications active
                  </span>
                  <span className="text-xs text-muted-foreground">
                    You will receive alerts on this device
                  </span>
                </div>
              </div>
            )}

            {permission === "denied" && (
              <div className="flex items-center gap-3 bg-critical/10 border border-critical/20 rounded-xl p-4 mb-4">
                <BellOff className="w-5 h-5 text-critical" />
                <div>
                  <span className="text-sm font-medium text-foreground block">
                    Notifications blocked
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Enable in your browser/device settings
                  </span>
                </div>
              </div>
            )}

            {(permission === "default" || permission === "granted") && (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Bell className="w-7 h-7 text-accent" />
                </div>
                <h3 className="text-base font-semibold mb-1">Enable Push Alerts</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                  Get notified about session opens, economic events, and price alerts
                </p>
                <button
                  onClick={handleEnable}
                  className="w-full bg-accent hover:bg-accent/90 text-white font-semibold py-3.5 px-6 rounded-2xl transition-all active:scale-[0.97]"
                >
                  Enable Notifications
                </button>
              </div>
            )}

            {permission === "subscribing" && (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <Bell className="w-7 h-7 text-accent" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Requesting permission...
                </p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-border">
              <span className="text-[10px] text-muted-foreground block text-center">
                Notifications are sent via Web Push. Max 20 alerts/day.
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
