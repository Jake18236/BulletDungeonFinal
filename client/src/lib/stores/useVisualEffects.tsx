// client/src/lib/stores/useVisualEffects.tsx
import { create } from "zustand";
import * as THREE from "three";

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
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface VisualEffectsState {
  particles: Particle[];
  damageNumbers: DamageNumber[];
  impactEffects: ImpactEffect[];

  addImpact: (position: THREE.Vector3, color?: string) => void;
  addExplosion: (position: THREE.Vector3, count?: number) => void;
  addDamageNumber: (x: number, y: number, damage: number) => void;
  updateEffects: (delta: number) => void;
  reset: () => void;
}

export const useVisualEffects = create<VisualEffectsState>((set, get) => ({
  particles: [],
  damageNumbers: [],
  impactEffects: [],

  addImpact: (position, color = "#ffffff") => {
    const particles: Particle[] = [];

    // Create 8-12 impact particles
    const count = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 15 + Math.random() * 10;

      particles.push({
        id: `impact_${Date.now()}_${i}`,
        position: position.clone(),
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          0,
          Math.sin(angle) * speed
        ),
        life: 0,
        maxLife: 0.3 + Math.random() * 0.2,
        size: 2 + Math.random() * 3,
        color,
        alpha: 1,
        type: "impact",
      });
    }

    // Add impact flash effect
    const impactEffect: ImpactEffect = {
      id: `flash_${Date.now()}`,
      x: position.x,
      y: position.z,
      life: 0,
      maxLife: 0.15,
      size: 20,
      color,
    };

    set(state => ({
      particles: [...state.particles, ...particles],
      impactEffects: [...state.impactEffects, impactEffect],
    }));
  },

  addExplosion: (position, count = 20) => {
    const particles: Particle[] = [];

    // Create explosion particles
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 30;

      // Red explosion particles
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
        maxLife: 0.5 + Math.random() * 0.3,
        size: 3 + Math.random() * 4,
        color,
        alpha: 1,
        gravity: true,
        type: "explosion",
      });
    }

    // Add some sparks
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

  addDamageNumber: (x, y, damage) => {
    const damageNumber: DamageNumber = {
      id: `dmg_${Date.now()}`,
      x,
      y,
      damage: Math.round(damage),
      life: 0,
      maxLife: 0.5,
      velocity: {
        x: (Math.random() - 0.5) * 10,
        y: -10 - Math.random() * 10,
      },
      scale: 0,
    };

    set(state => ({
      damageNumbers: [...state.damageNumbers, damageNumber],
    }));
  },

  updateEffects: (delta) => {
    const state = get();

    // Update particles
    const updatedParticles = state.particles
      .map(p => {
        const updated = { ...p };
        updated.life += delta;

        // Apply velocity
        updated.position.x += updated.velocity.x * delta;
        updated.position.z += updated.velocity.z * delta;

        // Apply friction
        updated.velocity.multiplyScalar(0.92);

        // Fade out
        const lifePercent = updated.life / updated.maxLife;
        updated.alpha = 1 - lifePercent;

        return updated;
      })
      .filter(p => p.life < p.maxLife);

    // Update damage numbers
    const updatedDamageNumbers = state.damageNumbers
      .map(d => {
        const updated = { ...d };
        updated.life += delta;

        // Move
        updated.x += updated.velocity.x * delta;
        updated.y += updated.velocity.y * delta;

        // Gravity
        updated.velocity.y += 40 * delta;

        // Scale animation (pop in then fade)
        const lifePercent = updated.life / updated.maxLife;
        if (lifePercent < 0.15) {
          // Pop in
          updated.scale = lifePercent / 0.15;
        } else {
          // Stay then fade
          updated.scale = 1;
        }

        return updated;
      })
      .filter(d => d.life < d.maxLife);

    // Update impact effects
    const updatedImpacts = state.impactEffects
      .map(i => {
        const updated = { ...i };
        updated.life += delta;
        return updated;
      })
      .filter(i => i.life < i.maxLife);

    set({
      particles: updatedParticles,
      damageNumbers: updatedDamageNumbers,
      impactEffects: updatedImpacts,
    });
  },

  reset: () => set({
    particles: [],
    damageNumbers: [],
    impactEffects: [],
  }),
}));