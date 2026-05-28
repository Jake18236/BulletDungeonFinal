import { create } from "zustand";

interface ParticlesState {
  fireParticleCount: number;
  trailParticleCount: number;
  setFireParticleCount: (count: number) => void;
  setTrailParticleCount: (count: number) => void;
}

export const useParticles = create<ParticlesState>((set) => ({
  fireParticleCount: 0,
  trailParticleCount: 0,
  setFireParticleCount: (count: number) => set({ fireParticleCount: count }),
  setTrailParticleCount: (count: number) => set({ trailParticleCount: count }),
}));
