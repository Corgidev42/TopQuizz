import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface PlayerUser {
  id: string;
  email: string;
  display_name: string;
  avatar_emoji: string;
  games_played: number;
  total_score: number;
  wins: number;
  created_at: number;
}

interface PlayerAccountStore {
  token: string | null;
  user: PlayerUser | null;
  setAuth: (token: string, user: PlayerUser) => void;
  setUser: (user: PlayerUser) => void;
  logout: () => void;
}

export const usePlayerAccountStore = create<PlayerAccountStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: "topquizz-player-account",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ token: s.token, user: s.user }),
    },
  ),
);
