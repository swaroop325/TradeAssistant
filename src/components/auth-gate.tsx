"use client";

import { motion } from "framer-motion";
import { Fingerprint, Shield, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { startAuthentication, startRegistration } from "@/lib/webauthn";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setAuthenticated, setRegistered } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <>{children}</>;
  }

  async function handleAuth() {
    setError(null);
    setLoading(true);

    try {
      // Always try login first
      const cred = await startAuthentication();
      if (cred) {
        setRegistered(true);
        setAuthenticated(true);
      } else {
        setError("Authentication cancelled");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";

      // If no credentials exist, try registration
      if (msg.includes("No credentials") || msg.includes("not found") || msg.includes("404")) {
        try {
          const cred = await startRegistration();
          if (cred) {
            setRegistered(true);
            setAuthenticated(true);
          } else {
            setError("Registration cancelled");
          }
        } catch (regErr) {
          setError(regErr instanceof Error ? regErr.message : "Registration failed");
        }
      } else {
        setError(msg || "Authentication failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className="w-full max-w-sm"
      >
        <div className="glass rounded-3xl p-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-6"
          >
            <Shield className="w-8 h-8 text-gold" />
          </motion.div>

          <h1 className="text-xl font-bold text-foreground mb-2">
            TradeAssistant
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            Authenticate with your passkey to continue
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-critical/10 text-critical rounded-xl p-3 mb-4 text-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <button
            onClick={handleAuth}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-gold/90 hover:bg-gold text-background font-semibold py-4 px-6 rounded-2xl transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Fingerprint className="w-5 h-5" />
            {loading ? "Waiting..." : "Sign In"}
          </button>

          <p className="text-[10px] text-muted-foreground mt-4">
            Uses Face ID, Touch ID, or device biometrics
          </p>
        </div>
      </motion.div>
    </div>
  );
}
