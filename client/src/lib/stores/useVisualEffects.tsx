// client/src/lib/stores/useVisualEffects.tsx
import { create } from "zustand";
import * as THREE from "three";
import { VisualSprites } from "../../components/SpriteProps";
import { useProjectiles } from "./useProjectiles"
// ---------------- Types ----------------
export interface Particle {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  gravity?: boolean;
  type: "impact" | "explosion" | "spark";
}

export interface DamageNumber {
  id: string;
  x: number;
  y: number;
  damage: number;
  life: number;
  maxLife: number;
  velocity: { x: number; y: number };
  scale: number;
}

export interface ImpactEffect {
  id: string;
  x: number;
  y: number;
  life: number;        // how long this frame has been alive
  maxLife: number;     // duration per frame
  size: number;
  frameIndex: number;  // current frame
  totalFrames: number; // total frames in spritesheet
}

export interface ExplosionEffect {
  id: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  size: number;
  radius: number;
  frameIndex: number;
  totalFrames: number;
}
export interface LightningEffect {
  id: string;
  x: number;
  y: number;
  angle: number;
  life: number;
  maxLife: number;
  frameIndex: number;
  totalFrames: number;
}


// ---------------- Store ----------------
interface VisualEffectsState {
  particles: Particle[];
  damageNumbers: DamageNumber[];
  impactEffects: ImpactEffect[];
  explosionEffects: ExplosionEffect[];
  lightningEffects: LightningEffect[];

  addImpact: (position: THREE.Vector3, size: number) => void;
  addExplosion: (position: THREE.Vector3, count?: number, radius?: number) => void;
  addDamageNumber: (x: number, y: number, damage: number) => void;
  addLightning: (x: number, y: number, angle: number) => void;
  updateEffects: (delta: number) => void;
  reset: () => void;
}

export const useVisualEffects = create<VisualEffectsState>((set, get) => ({
  particles: [],
  damageNumbers: [],
  impactEffects: [],
  explosionEffects: [],
  lightningEffects: [],

  // ---------------- Impact Effects ----------------
  addImpact: (position: THREE.Vector3, size: number) => {
    const MAX_IMPACT_EFFECTS = 50;

    set(state => {
      const effects = state.impactEffects;
      if (effects.length >= MAX_IMPACT_EFFECTS) {
        effects.shift();
      }

      const impactEffect: ImpactEffect = {
        id: `impact_${Date.now()}`,
        x: position.x,
        y: position.z,
        life: 0,
        maxLife: 0.15,
        size,
        frameIndex: 0,
        totalFrames: 2,
      };

      return {
        impactEffects: [...effects, impactEffect],
      };
    });
  },
  // ---------------- Explosion ----------------
  addExplosion: (position, count = 1, radius = 0) => {
    const particles: Particle[] = [];

    // Explosion particles
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 10;
      const colors = ["#ff4444", "#ff6666", "#ff8888", "#ffaa44"];
      const color = colors[Math.floor(Math.random() * colors.length)];
    }

    const pixelDiameter = radius > 0 ? Math.max(radius * 50, 64) : 110;
    const explosionEffect: ExplosionEffect = {
      id: `big_explosion_${Date.now()}`,
      x: position.x,
      y: position.z,
      life: 0,
      maxLife: 0.4,
      size: pixelDiameter,
      radius,
      frameIndex: 0,
      totalFrames: 6,
    };

    set(state => ({
      particles: [...state.particles, ...particles],
      explosionEffects: [...state.explosionEffects, explosionEffect],
    }));
  },

  // ---------------- Damage Numbers ----------------
  addDamageNumber: (x, y, damage) => {
    const MAX_DAMAGE_NUMBERS = 100;

    set(state => {
      const numbers = state.damageNumbers;
      if (numbers.length >= MAX_DAMAGE_NUMBERS) {
        numbers.shift();
      }

      const damageNumber: DamageNumber = {
        id: `dmg_${Date.now()}`,
        x,
        y,
        damage: Math.round(damage),
        life: 0,
        maxLife: 1,
        velocity: { x: 0, y: 0 },
        scale: 0,
      };

      return {
        damageNumbers: [...numbers, damageNumber],
      };
    });
  },
  addLightning: (x, y, angle) => {
    set(state => ({
      lightningEffects: [...state.lightningEffects, {
        id: `lightning_${Date.now()}_${Math.random()}`,
        x, y, angle, life: 0, maxLife: 0.5, frameIndex: 0, totalFrames: 6,
      }],
    }));
  },

  // ---------------- Update Effects ----------------
  updateEffects: (delta) => {
    const state = get();

    // Particles
    const updatedParticles = state.particles
      .map(p => {
        const updated = { ...p };
        updated.life += delta;
        updated.position.x += updated.velocity.x * delta;
        updated.position.z += updated.velocity.z * delta;
        updated.velocity.multiplyScalar(0.92);
        updated.alpha = 1 - (updated.life / updated.maxLife);
        return updated;
      })
      .filter(p => p.life < p.maxLife);

    // Damage numbers
    const updatedDamageNumbers = state.damageNumbers
      .map(d => {
        const updated = { ...d };
        updated.life += delta;
        const lifePercent = updated.life / updated.maxLife;
        updated.scale = lifePercent < 0.15 ? lifePercent / 0.15 : 1;
        return updated;
      })
      .filter(d => d.life < d.maxLife);

    const updatedImpacts = state.impactEffects
    .map(i => {
      const updated = { ...i };
      updated.life += delta;

      // 2-frame animation: first half = frame 0, second half = frame 1
      const lifePercent = updated.life / updated.maxLife;
      updated.frameIndex = lifePercent < 0.5 ? 0 : 1;

      return updated;
    })
    .filter(i => i.life < i.maxLife);

    const updatedExplosions = state.explosionEffects
    .map(e => {
      const updated = { ...e };
      updated.life += delta;
      const lifePercent = Math.min(1, updated.life / updated.maxLife);
      updated.frameIndex = Math.min(updated.totalFrames - 1, Math.floor(lifePercent * updated.totalFrames));
      return updated;
    })
    .filter(e => e.life < e.maxLife);
    const updatedLightning = state.lightningEffects
      .map(l => {
        const updated = { ...l };
        updated.life += delta;
        const lifePercent = Math.min(1, updated.life / updated.maxLife);
        updated.frameIndex = Math.min(updated.totalFrames - 1, Math.floor(lifePercent * updated.totalFrames));
        return updated;
      })
      .filter(l => l.life < l.maxLife);

    set({
      particles: updatedParticles,
      damageNumbers: updatedDamageNumbers,
      impactEffects: updatedImpacts,
      explosionEffects: updatedExplosions,
      lightningEffects: updatedLightning,
    });
  },

  // ---------------- Reset ----------------
  reset: () => set({
    particles: [],
    damageNumbers: [],
    impactEffects: [],
    explosionEffects: [],
    lightningEffects: [],
  }),
}));
