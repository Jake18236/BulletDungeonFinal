// client/src/lib/stores/usePlayer.tsx - COMPLETE REPLACEMENT
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
  firerate: number;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  reloadTime: number;
  reloadProgress: number;
  isFiring: boolean;
  isMoving: boolean;

  baseDamage: number;
  baseProjectileSpeed: number;
  baseProjectileRange: number;
  projectileCount: number;
  homing: boolean;
  piercing: number;
  bouncing: number;
  explosive?: { radius: number; damage: number };
  chainLightning?: { chains: number; range: number };
  accuracy: number;

  // Special upgrade effects
  knockbackMultiplier: number;
  projectileSize: number;
  instantKillThreshold: number; // Assassin
  splinterBullets: boolean;
  pierceKilledEnemies: boolean;
  siegeMode: boolean;
  fanFire: boolean;
  splitFire: boolean;
  freshClip: boolean;
  freshClipActive: boolean;
  freshClipTimer: number;
  killClip: boolean;
  killClipStacks: number;
  lastMovementTime: number;

  muzzleFlashTimer: number;
  fanFireActive: boolean;
  fanFireIndex: number;
  fanFireTimer: number;


  startFanFire: () => void;
  updateFanFire: (delta: number, fireCallback: () => void) => void;
  fireMuzzleFlash: () => void;
  updateMuzzleFlash: (delta: number) => void;
  setFiring: (val: boolean) => void;
  setMoving: (val: boolean) => void;
  fireShot: () => boolean;
  startReload: () => void;
  updateReload: (delta: number) => void;
  addKillClipStack: () => void;
  updateFreshClip: (delta: number) => void;
  getProjectileStats: () => {
    damage: number;
    speed: number;
    range: number;
    projectileCount: number;
    homing: boolean;
    piercing: number;
    bouncing: number;
    explosive?: { radius: number; damage: number };
    chainLightning?: { chains: number; range: number };
    accuracy: number;
  };

  move: (delta: THREE.Vector3) => void;
  loseHeart: () => void;
  updateInvincibility: (delta: number) => void;
  reset: () => void;
}

export const usePlayer = create<PlayerState>((set, get) => ({
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  speed: 10,

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
  isMoving: false,

  baseDamage: 100,
  baseProjectileSpeed: 80,
  baseProjectileRange: 50,
  projectileCount: 1,
  homing: false,
  piercing: 0,
  bouncing: 0,
  explosive: undefined,
  chainLightning: undefined,
  accuracy: 1.0,

  knockbackMultiplier: 1.0,
  projectileSize: 1.0,
  instantKillThreshold: 0,
  splinterBullets: false,
  pierceKilledEnemies: false,
  siegeMode: false,
  fanFire: false,
  splitFire: false,
  freshClip: false,
  freshClipActive: false,
  freshClipTimer: 0,
  killClip: false,
  killClipStacks: 0,
  lastMovementTime: 0,

  muzzleFlashTimer: 0,
  fanFireActive: false,
  fanFireIndex: 0,
  fanFireTimer: 0,

  startFanFire: () => set({
    fanFireActive: true,
    fanFireIndex: 0,
    fanFireTimer: 0,
  }),
  updateFanFire: (delta, fireCallback) => set((state) => {
    if (!state.fanFireActive) return {};

    const newTimer = state.fanFireTimer + delta;
    const intervalTime = state.reloadTime / 10; // 10 shots spread across reload time

    if (newTimer >= intervalTime && state.fanFireIndex < 10) {
      // Fire one bullet
      fireCallback();

      return {
        fanFireTimer: 0,
        fanFireIndex: state.fanFireIndex + 1,
      };
    }

    if (state.fanFireIndex >= 10) {
      return {
        fanFireActive: false,
        fanFireIndex: 0,
        fanFireTimer: 0,
      };
    }

    return { fanFireTimer: newTimer };
  }),

  fireMuzzleFlash: () => set({ muzzleFlashTimer: 0.1 }),

  updateMuzzleFlash: (delta) => set((state) => {
    if (state.muzzleFlashTimer <= 0) return {};
    return { muzzleFlashTimer: Math.max(state.muzzleFlashTimer - delta, 0) };
  }),
  
  setFiring: (val) => set({ isFiring: val }),

  setMoving: (val) => {
    const state = get();
    if (val && !state.isMoving) {
      set({ isMoving: true, lastMovementTime: Date.now() });
    } else if (!val) {
      set({ isMoving: false });
    }
  },

  fireShot: () => {
    const state = get();
    if (state.ammo > 0 && !state.isReloading) {
      // Siege mode: 40% chance to not consume ammo when standing still
      const isStandingStill = Date.now() - state.lastMovementTime > 500; // Still for 0.5s
      if (state.siegeMode && isStandingStill && Math.random() < 0.4) {
        return true; // Don't consume ammo
      }

      set({ ammo: state.ammo - 1 });
      return true;
    }
    return false;
  },

  getProjectileStats: () => {
    const state = get();

    // Fresh Clip bonus
    let damageMultiplier = 1.0;
    if (state.freshClipActive) {
      damageMultiplier = 1.5;
    }

    return {
      damage: state.baseDamage * damageMultiplier,
      speed: state.baseProjectileSpeed,
      range: state.baseProjectileRange,
      projectileCount: state.projectileCount,
      homing: state.homing,
      piercing: state.piercing,
      bouncing: state.bouncing,
      explosive: state.explosive,
      chainLightning: state.chainLightning,
      accuracy: state.accuracy,
    };
  },

  startReload: () => {
    const state = get();

    // Calculate reload time with Kill Clip bonus
    let reloadTime = state.reloadTime;
    if (state.killClip && state.killClipStacks > 0) {
      const speedBonus = Math.min(state.killClipStacks * 0.05, 0.5); // Max 50% faster
      reloadTime = reloadTime * (1 - speedBonus);
    }

    set({
      isReloading: true,
      reloadProgress: 0,
      killClipStacks: 0, // Reset kill clip on reload
    });
  },

  updateReload: (delta) => {
    const state = get();
    if (!state.isReloading) return;

    const newProgress = state.reloadProgress + delta;

    if (newProgress >= state.reloadTime) {
      // Fresh Clip: activate bonus after reload
      const updates: any = {
        isReloading: false,
        reloadProgress: 0,
        ammo: state.maxAmmo,
      };

      if (state.freshClip) {
        updates.freshClipActive = true;
        updates.freshClipTimer = 1.0;
      }

      set(updates);
    } else {
      set({ reloadProgress: newProgress });
    }
  },

  updateFreshClip: (delta) => {
    const state = get();
    if (!state.freshClipActive) return;

    const newTimer = state.freshClipTimer - delta;
    if (newTimer <= 0) {
      set({ freshClipActive: false, freshClipTimer: 0 });
    } else {
      set({ freshClipTimer: newTimer });
    }
  },

  addKillClipStack: () => {
    const state = get();
    if (state.killClip) {
      set({ killClipStacks: state.killClipStacks + 1 });
    }
  },

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
    firerate: 0.5,
    ammo: 6,
    maxAmmo: 6,
    isReloading: false,
    reloadTime: 1.1,
    reloadProgress: 0,
    isFiring: false,
    isMoving: false,
    baseDamage: 13,
    baseProjectileSpeed: 80,
    baseProjectileRange: 50,
    projectileCount: 1,
    homing: false,
    piercing: 0,
    bouncing: 0,
    explosive: undefined,
    chainLightning: undefined,
    accuracy: 1.0,
    knockbackMultiplier: 1.0,
    projectileSize: 1.0,
    instantKillThreshold: 0,
    splinterBullets: false,
    pierceKilledEnemies: false,
    siegeMode: false,
    fanFire: false,
    splitFire: false,
    freshClip: false,
    freshClipActive: false,
    freshClipTimer: 0,
    killClip: false,
    killClipStacks: 0,
    lastMovementTime: 0,
    muzzleFlashTimer: 0,
    fanFireActive: false,
    fanFireIndex: 0,
    fanFireTimer: 0,
  })
}));