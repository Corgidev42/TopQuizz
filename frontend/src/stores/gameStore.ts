import { create } from "zustand";
import type { GameState, Preset } from "../types";

interface Notification {
  type: "success" | "error" | "info";
  message: string;
}

interface GameStore {
  connected: boolean;
  gameId: string | null;
  mySid: string | null;
  role: "player" | "host" | "tv" | null;
  myPlayer: { pseudo: string; color: string } | null;

  gameState: GameState | null;

  joinUrl: string | null;
  presets: Preset[];
  notification: Notification | null;
  lastErrorAt: number | null;

  setConnected: (c: boolean) => void;
  setGameId: (id: string | null) => void;
  setMySid: (sid: string | null) => void;
  setRole: (role: "player" | "host" | "tv" | null) => void;
  setMyPlayer: (p: { pseudo: string; color: string } | null) => void;
  setGameState: (s: GameState) => void;
  setJoinUrl: (url: string | null) => void;
  setPresets: (p: Preset[]) => void;
  setNotification: (n: Notification | null) => void;
  setLastErrorAt: (t: number | null) => void;
  reset: () => void;
}

const initial = {
  connected: false,
  gameId: null as string | null,
  mySid: null as string | null,
  role: null as "player" | "host" | "tv" | null,
  myPlayer: null as { pseudo: string; color: string } | null,
  gameState: null as GameState | null,
  joinUrl: null as string | null,
  presets: [] as Preset[],
  notification: null as Notification | null,
  lastErrorAt: null as number | null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initial,
  setConnected: (connected) => set({ connected }),
  setGameId: (gameId) => set({ gameId }),
  setMySid: (mySid) => set({ mySid }),
  setRole: (role) => set({ role }),
  setMyPlayer: (myPlayer) => set({ myPlayer }),
  setGameState: (gameState) => set({ gameState }),
  setJoinUrl: (joinUrl) => set({ joinUrl }),
  setPresets: (presets) => set({ presets }),
  setNotification: (notification) => set({ notification }),
  setLastErrorAt: (lastErrorAt) => set({ lastErrorAt }),
  reset: () => set(initial),
}));
