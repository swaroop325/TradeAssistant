"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone, Trash2, Globe } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useState } from "react";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { deviceName, lastLogin, logout } = useAuthStore();
  const [timezone, setTimezone] = useState("Asia/Singapore");

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
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-card border-l border-border z-[70] overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]"
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Settings</h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-muted/60 transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Timezone */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
                    Timezone
                  </label>
                  <div className="flex items-center gap-2 bg-muted/30 rounded-xl p-3">
                    <Globe className="w-4 h-4 text-accent" />
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="bg-transparent text-sm text-foreground flex-1 outline-none"
                    >
                      <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                      <option value="America/New_York">America/New York (EST)</option>
                      <option value="Europe/London">Europe/London (GMT)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    </select>
                  </div>
                </div>

                {/* Device */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
                    Registered Device
                  </label>
                  <div className="bg-muted/30 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-accent" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-foreground block">
                          {deviceName || "This Device"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Last login: {lastLogin || "Now"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notification Preferences */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
                    Alert Preferences
                  </label>
                  <div className="space-y-2">
                    {[
                      { label: "Session Alerts", desc: "London/NY open reminders" },
                      { label: "Price Alerts", desc: "Range breaks, large moves" },
                      { label: "Economic Events", desc: "CPI, NFP, FOMC warnings" },
                      { label: "Intelligence", desc: "Liquidity sweeps, trend shifts" },
                    ].map((item) => (
                      <label
                        key={item.label}
                        className="flex items-center justify-between bg-muted/20 rounded-xl p-3 cursor-pointer"
                      >
                        <div>
                          <span className="text-sm text-foreground">{item.label}</span>
                          <span className="text-[10px] text-muted-foreground block">
                            {item.desc}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-4 h-4 rounded accent-accent"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Sign Out */}
                <button
                  onClick={() => {
                    logout();
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-critical/10 text-critical rounded-xl py-3 text-sm font-medium hover:bg-critical/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
