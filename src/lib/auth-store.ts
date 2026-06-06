import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  isAuthenticated: boolean;
  isRegistered: boolean;
  deviceName: string | null;
  lastLogin: string | null;
  setAuthenticated: (value: boolean) => void;
  setRegistered: (value: boolean) => void;
  setDeviceName: (name: string) => void;
  setLastLogin: (date: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      isRegistered: false,
      deviceName: null,
      lastLogin: null,
      setAuthenticated: (value) => set({ isAuthenticated: value }),
      setRegistered: (value) => set({ isRegistered: value }),
      setDeviceName: (name) => set({ deviceName: name }),
      setLastLogin: (date) => set({ lastLogin: date }),
      logout: () => set({ isAuthenticated: false }),
    }),
    {
      name: "tradeassistant-auth",
    }
  )
);
