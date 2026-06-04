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
  addImpactBatch: (impacts: Array<{ x: number; y: number; z: number; size: number }>) => void;
  addExplosion: (position: THREE.Vector3, radius: number, count?: number) => void;
  addDamageNumber: (x: number, y: number, damage: number) => void;
  addDamageNumberBatch: (numbers: Array<{ x: number; y: number; damage: number }>) => void
  addLightning: (x: number, y: number, angle: number) => void;
  updateEffects: (delta: number) => void;
  reset: () => void;
}
let _nextImpactId = 0;
let _nextDmgId = 0;
let _nextExplosionId = 0;
let _nextLightningId = 0;

export const useVisualEffects = create<VisualEffectsState>((set, get) => ({
  particles: [],
  damageNumbers: [],
  impactEffects: [],
  explosionEffects: [],
  lightningEffects: [],

  // ---------------- Impact Effects ----------------
  addImpact: (position: THREE.Vector3, size: number) => {
    const MAX_IMPACT_EFFECTS = 30;
    set(state => {
      const effects = state.impactEffects;
      if (effects.length >= MAX_IMPACT_EFFECTS) {
        // Overwrite oldest instead of shift() which is O(n)
        effects[0] = {
          id: `impact_${_nextImpactId++}`,
          x: position.x,
          y: position.z,
          life: 0,
          maxLife: 0.20,
          size,
          frameIndex: 0,
          totalFrames: 2,
        };
      } else {
        effects.push({
          id: `impact_${_nextImpactId++}`,
          x: position.x,
          y: position.z,
          life: 0,
          maxLife: 0.20,
          size,
          frameIndex: 0,
          totalFrames: 2,
        });
      }
      return { impactEffects: effects };
    });
  },

  // ---------------- Impact Batch ----------------
  addImpactBatch: (impacts: Array<{ x: number; y: number; z: number; size: number }>) => {
    const MAX_IMPACT_EFFECTS = 30;
    set(state => {
      const effects = state.impactEffects;
      for (const imp of impacts) {
        if (effects.length >= MAX_IMPACT_EFFECTS) {
          effects[0] = {
            id: `impact_${_nextImpactId++}`,
            x: imp.x,
            y: imp.z,
            life: 0,
            maxLife: 0.20,
            size: imp.size,
            frameIndex: 0,
            totalFrames: 2,
          };
        } else {
          effects.push({
            id: `impact_${_nextImpactId++}`,
            x: imp.x,
            y: imp.z,
            life: 0,
            maxLife: 0.20,
            size: imp.size,
            frameIndex: 0,
            totalFrames: 2,
          });
        }
      }
      return { impactEffects: effects };
    });
  },

  // ---------------- Explosion ----------------
  addExplosion: (position, radius, count) => {
    set(state => {
      state.explosionEffects.push({
        id: `big_explosion_${_nextExplosionId++}`,
        x: position.x,
        y: position.z,
        life: 0,
        maxLife: 0.5,
        size: radius * 25,
        radius,
        frameIndex: 0,
        totalFrames: 6,
      });
      return { explosionEffects: state.explosionEffects };
    });
  },

  // ---------------- Damage Numbers ----------------
  addDamageNumber: (x, y, damage) => {
    const MAX_DAMAGE_NUMBERS = 50;
    set(state => {
      const numbers = state.damageNumbers;
      if (numbers.length >= MAX_DAMAGE_NUMBERS) {
        // Overwrite instead of shift()
        numbers[0] = {
          id: `dmg_${_nextDmgId++}`,
          x,
          y,
          damage: Math.round(damage),
          life: 0,
          maxLife: 0.8,
          velocity: { x: 0, y: 0 },
          scale: 0,
        };
      } else {
        numbers.push({
          id: `dmg_${_nextDmgId++}`,
          x,
          y,
          damage: Math.round(damage),
          life: 0,
          maxLife: 0.8,
          velocity: { x: 0, y: 0 },
          scale: 0,
        });
      }
      return { damageNumbers: numbers };
    });
  },

  // ---------------- Damage Number Batch ----------------
  addDamageNumberBatch: (numbers: Array<{ x: number; y: number; damage: number }>) => {
    const MAX_DAMAGE_NUMBERS = 50;
    set(state => {
      const arr = state.damageNumbers;
      for (const n of numbers) {
        if (arr.length >= MAX_DAMAGE_NUMBERS) {
          arr[0] = {
            id: `dmg_${_nextDmgId++}`,
            x: n.x,
            y: n.y,
            damage: Math.round(n.damage),
            life: 0,
            maxLife: 0.8,
            velocity: { x: 0, y: 0 },
            scale: 0,
          };
        } else {
          arr.push({
            id: `dmg_${_nextDmgId++}`,
            x: n.x,
            y: n.y,
            damage: Math.round(n.damage),
            life: 0,
            maxLife: 0.8,
            velocity: { x: 0, y: 0 },
            scale: 0,
          });
        }
      }
      return { damageNumbers: arr };
    });
  },

  // ---------------- Lightning ----------------
  addLightning: (x, y, angle) => {
    set(state => {
      state.lightningEffects.push({
        id: `lightning_${_nextLightningId++}`,
        x, y, angle, life: 0, maxLife: 0.5, frameIndex: 0, totalFrames: 6,
      });
      return { lightningEffects: state.lightningEffects };
    });
  },

  // ---------------- Update Effects ----------------
  // Replaces map()+filter() with in-place write-index compaction — zero allocations
  updateEffects: (delta) => {
    const state = get();

    // Particles
    let w = 0;
    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      p.life += delta;
      if (p.life >= p.maxLife) continue;
      p.position.x += p.velocity.x * delta;
      p.position.z += p.velocity.z * delta;
      p.velocity.multiplyScalar(0.92);
      p.alpha = 1 - (p.life / p.maxLife);
      if (w !== i) state.particles[w] = p;
      w++;
    }
    state.particles.length = w;

    // Damage numbers
    w = 0;
    for (let i = 0; i < state.damageNumbers.length; i++) {
      const d = state.damageNumbers[i];
      d.life += delta;
      if (d.life >= d.maxLife) continue;
      const lifePercent = d.life / d.maxLife;
      d.scale = lifePercent < 0.15 ? lifePercent / 0.15 : 1;
      if (w !== i) state.damageNumbers[w] = d;
      w++;
    }
    state.damageNumbers.length = w;

    // Impact effects
    w = 0;
    for (let i = 0; i < state.impactEffects.length; i++) {
      const imp = state.impactEffects[i];
      imp.life += delta;
      if (imp.life >= imp.maxLife) continue;
      imp.frameIndex = (imp.life / imp.maxLife) < 0.5 ? 0 : 1;
      if (w !== i) state.impactEffects[w] = imp;
      w++;
    }
    state.impactEffects.length = w;

    // Explosion effects
    w = 0;
    for (let i = 0; i < state.explosionEffects.length; i++) {
      const e = state.explosionEffects[i];
      e.life += delta;
      if (e.life >= e.maxLife) continue;
      const lifePercent = Math.min(1, e.life / e.maxLife);
      e.frameIndex = Math.min(e.totalFrames - 1, Math.floor(lifePercent * e.totalFrames));
      if (w !== i) state.explosionEffects[w] = e;
      w++;
    }
    state.explosionEffects.length = w;

    // Lightning effects
    w = 0;
    for (let i = 0; i < state.lightningEffects.length; i++) {
      const l = state.lightningEffects[i];
      l.life += delta;
      if (l.life >= l.maxLife) continue;
      const lifePercent = Math.min(1, l.life / l.maxLife);
      l.frameIndex = Math.min(l.totalFrames - 1, Math.floor(lifePercent * l.totalFrames));
      if (w !== i) state.lightningEffects[w] = l;
      w++;
    }
    state.lightningEffects.length = w;

    // Single set() for all five arrays, same references so no GC
    set({
      particles: state.particles,
      damageNumbers: state.damageNumbers,
      impactEffects: state.impactEffects,
      explosionEffects: state.explosionEffects,
      lightningEffects: state.lightningEffects,
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