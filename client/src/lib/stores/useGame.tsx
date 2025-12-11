import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type GamePhase = "ready" | "playing" | "paused" | "ended" | "resumed";

interface GameState {
  phase: GamePhase;
  setPhase: (phase: GamePhase) => void;
  start: () => void;
  restart: () => void;
  pause: () => void;
  resume: () => void;
  end: () => void;
}

export const useGame = create<GameState>()(
  subscribeWithSelector((set) => ({
    phase: "ready",

    setPhase: (phase) => set({ phase }),

    start: () => {
      set((state) => {
        if (state.phase === "ready") {
          return { phase: "playing" };
        }
        return {};
      });
    },

    pause: () => set({ phase: "paused" }),

    resume: () => set({ phase: "playing" }),

    restart: () => set({ phase: "ready" }),

    end: () => {
      set((state) => {
        if (state.phase === "playing") {
          return { phase: "ended" };
        }
        return {};
      });
    },
  }))
);