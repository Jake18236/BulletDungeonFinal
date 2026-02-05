// client/src/lib/stores/useVisualEffects.tsx
import { create } from "zustand";
import * as THREE from "three";
import { VisualSprites } from "../../components/SpriteProps";
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



// ---------------- Store ----------------
interface VisualEffectsState {
  particles: Particle[];
  damageNumbers: DamageNumber[];
  impactEffects: ImpactEffect[];

  addImpact: (position: THREE.Vector3, size?: number) => void;
  addExplosion: (position: THREE.Vector3, count?: number) => void;
  addDamageNumber: (x: number, y: number, damage: number) => void;
  updateEffects: (delta: number) => void;
  reset: () => void;
}

export const useVisualEffects = create<VisualEffectsState>((set, get) => ({
  particles: [],
  damageNumbers: [],
  impactEffects: [],

  // ---------------- Impact Effects ----------------
  addImpact: (position: THREE.Vector3, size = 64) => {
    const impactEffect: ImpactEffect = {
      id: `impact_${Date.now()}`,
      x: position.x,
      y: position.z,
      life: 0,
      maxLife: 0.15,      // 0.15 sec per frame
      size,
      frameIndex: 0,
      totalFrames: 2,      // number of frames in spritesheet
    };

    set(state => ({
      impactEffects: [...state.impactEffects, impactEffect],
    }));
  },
  // ---------------- Explosion ----------------
  addExplosion: (position, count = 5) => {
    const particles: Particle[] = [];

    // Explosion particles
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 10;
      const colors = ["#ff4444", "#ff6666", "#ff8888", "#ffaa44"];
      const color = colors[Math.floor(Math.random() * colors.length)];

      particles.push({
        id: `explosion_${Date.now()}_${i}`,
        position: position.clone(),
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          0,
          Math.sin(angle) * speed
        ),
        life: 0,
        maxLife: 0.3 + Math.random() * 0.3,
        size: 6 + Math.random() * 8,
        color,
        alpha: 1,
        gravity: true,
        type: "explosion",
      });
    }

    // Sparks
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 20;

      particles.push({
        id: `spark_${Date.now()}_${i}`,
        position: position.clone(),
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          0,
          Math.sin(angle) * speed
        ),
        life: 0,
        maxLife: 0.2 + Math.random() * 0.2,
        size: 1 + Math.random() * 2,
        color: "#ffff88",
        alpha: 1,
        type: "spark",
      });
    }

    set(state => ({
      particles: [...state.particles, ...particles],
    }));
  },

  // ---------------- Damage Numbers ----------------
  addDamageNumber: (x, y, damage) => {
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

    set(state => ({
      damageNumbers: [...state.damageNumbers, damageNumber],
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

    set({
      particles: updatedParticles,
      damageNumbers: updatedDamageNumbers,
      impactEffects: updatedImpacts,
    });
  },

  // ---------------- Reset ----------------
  reset: () => set({
    particles: [],
    damageNumbers: [],
    impactEffects: [],
  }),
}));
