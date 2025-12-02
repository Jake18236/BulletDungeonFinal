import { create } from "zustand";
import * as THREE from "three";

interface PlayerState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  speed: number;
  
  
  hearts: number;
  maxHearts: number;
  invincibilityTimer: number;
  invincibilityDuration: number;
  defense: number;
  firerate: number,
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  reloadTime: number
  reloadProgress: number;
  isFiring: boolean;
  setFiring: (val: boolean) => void;
  fireShot: () => boolean;
  startReload: () => void;
  updateReload: (delta: number) => void;

  move: (delta: THREE.Vector3) => void;
  loseHeart: () => void;
  updateInvincibility: (delta: number) => void;
  reset: () => void;
}

export const usePlayer = create<PlayerState>((set) => ({
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  speed: 15,
  
  firerate: 0.5,
  
  hearts: 5,
  maxHearts: 5,
  invincibilityTimer: 0,
  invincibilityDuration: 3,
  defense: 0,
  ammo: 6,
  maxAmmo: 6,
  reloadTime: 1.5,
  isReloading: false,
  reloadProgress: 0,
  isFiring: false,

  setFiring: (val) => set({ isFiring: val }),

  fireShot: () => {
    const state = usePlayer.getState();
    if (state.ammo > 0 && !state.isReloading) {
      set({ ammo: state.ammo - 1 });
      return true;
    }
    return false;
  },

  startReload: () => set({
    isReloading: true,
    reloadProgress: 0
  }),

  updateReload: (delta) => set((state) => {
    if (!state.isReloading) return {};

    const newProgress = state.reloadProgress + delta;
    

    if (newProgress >= state.reloadTime) {
      return {
        isReloading: false,
        reloadProgress: 0,
        ammo: state.maxAmmo
      };
    }

    return { reloadProgress: newProgress };
  }),

  move: (delta) => set((state) => ({
    position: state.position.clone().add(delta)
  })),

  loseHeart: () => set((state) => ({
    hearts: Math.max(state.hearts - 1, 0),
    invincibilityTimer: state.invincibilityDuration
  })),

  updateInvincibility: (delta) => set((state) => {
    if (state.invincibilityTimer <= 0) return {};
    return { invincibilityTimer: Math.max(state.invincibilityTimer - delta, 0) };
  }),

  reset: () => set({
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    hearts: 5,
    maxHearts: 5,
    invincibilityTimer: 0,
    invincibilityDuration: 3,
    firerate: 0.2,
    ammo: 6,
    maxAmmo: 6,
    isReloading: false,
    reloadTime: 1.5,
    reloadProgress: 0,
    isFiring: false,
  })
}));
