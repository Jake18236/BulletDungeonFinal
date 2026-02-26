import { create } from "zustand";

interface CameraState {
  screenCenter: { x: number; y: number };
  setScreenCenter: (center: { x: number; y: number }) => void;
}

export const useCamera = create<CameraState>((set) => ({
  screenCenter: { x: 1490 / 2, y: 750 / 2 },
  setScreenCenter: (center) => set({ screenCenter: center }),
}));
