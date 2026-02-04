import { create } from "zustand";
import { CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE } from "../components/CanvasGame"
import { usePlayer } from "./usePlayer";
import * as THREE from "three";
import { Enemy } from "./useEnemies";
import { useSummons } from "./useSummons";
import { useVisualEffects } from "./useVisualEffects";

export type DamageSource = {
  type: "player" | "summon" | "enemy";
  playerEffects?: {
    splinterBullets?: boolean;
    splitFire?: boolean;
    fanFire?: boolean;
  };
};

export interface Projectile {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  drag: number;
  damage: number;
  speed: number;
  life: number;
  maxLife: number;
  maxRange: number;
  distanceTraveled: number;
  rotationY: number;
  impactPos?: THREE.Vector3;

  currentLength: number; 
  jitterOffset: THREE.Vector3;

  // Visual
  color: string;
  size: number;
  trailColor: string;
  trailLength: number;
  trailHistory: THREE.Vector3[];

  // Special effects
  homing: boolean;
  piercing: number;
  piercedEnemies: Set<string>;
  bouncing: number;
  bouncesLeft: number;
  explosive?: { radius: number; damage: number };
  chainLightning?: { chains: number; range: number; chainedEnemies: Set<string> };
  
  isSummonProjectile?: boolean;
  burn?: { damage: number; duration: number };
  triggerOnHit?: boolean;
}

interface TrailGhost {
  id: string;
  trail: THREE.Vector3[];
  segments: { x: number; y: number; alpha: number; size: number }[];
  life: number; // 0.15 seconds fade
}

interface ProjectilesState {
  projectiles: Projectile[];
  trailGhosts: TrailGhost[];

  addProjectile: (config: {
    position: THREE.Vector3;
    direction: THREE.Vector3;
    life?: number;
    trailLength: number;
    damage: number;
    speed: number;
    range: number;
    size: number;
    homing: boolean;
    piercing: number;
    bouncing: number;

    explosive?: { radius: number; damage: number };
    chainLightning?: { chains: number; range: number };
  }) => void;

  updateProjectiles: (
    delta: number,
    enemies: Array<{
      id: string;
      position: THREE.Vector3;
      health: number;
      velocity?: THREE.Vector3;
    }>,
    playerPos: THREE.Vector3,
    roomBounds: number,
    onHit: (
      enemyId: string, 
      damage: number, 
      knockback: THREE.Vector3,
      projectileData: {
        color: string;
        explosive?: { radius: number; damage: number };
        chainLightning?: { chains: number; range: number; chainedEnemies: Set<string> };
        burn?: { damage: number; duration: number };
        impactPos?: THREE.Vector3;
      }
    ) => void,
    isPaused: boolean,
  ) => void;

  removeProjectile: (id: string) => void;
  reset: () => void;
}

export const useProjectiles = create<ProjectilesState>((set, get) => ({
  projectiles: [],
  trailGhosts: [],

  addProjectile: (config: {
    position: THREE.Vector3;
    direction: THREE.Vector3;
    life?: number;
    trailLength: number;
    damage: number;
    speed: number;
    range: number;
    size: number;
    homing: boolean;
    piercing: number;
    bouncing: number;

    explosive?: { radius: number; damage: number };
    chainLightning?: { chains: number; range: number };

    // ADD THESE:
    isSummonProjectile?: boolean;
    burn?: { damage: number; duration: number };
    triggerOnHit?: boolean;
  }) => {
    const projectile: Projectile = {
      id: Math.random().toString(36).substring(2, 11),
      position: config.position.clone(),
      velocity: config.direction.clone().normalize().multiplyScalar(config.speed),
      damage: config.damage,
      speed: config.speed,
      life: config.life ?? 3,        // default lifetime (seconds)
      maxLife: config.life ?? 3,
      drag: 0.985,

      maxRange: config.range,
      distanceTraveled: 0,
      rotationY: Math.atan2(config.direction.x, config.direction.z),
      currentLength: 0,
      jitterOffset: new THREE.Vector3(),
      color: getProjectileColor(config),
      size: config.size,
      trailColor: getTrailColor(config),
      trailLength: config.trailLength * 100,
      trailHistory: [],

      homing: config.homing,
      piercing: config.piercing,
      piercedEnemies: new Set(),
      bouncing: config.bouncing,
      bouncesLeft: config.bouncing,

      explosive: config.explosive,
      chainLightning: config.chainLightning
        ? {
            ...config.chainLightning,
            chainedEnemies: new Set(),
          }
        : undefined,

      

      // ADD THESE:
      isSummonProjectile: config.isSummonProjectile,
      burn: config.burn,
      triggerOnHit: config.triggerOnHit,
      impactPos: null,
    };

    set((state) => ({
      projectiles: [...state.projectiles, projectile],
    }));
  },

  updateProjectiles: (delta, enemies, playerPos, roomBounds, onHit) => {
    const updated: Projectile[] = [];
    const { trailGhosts } = get();
    for (const proj of get().projectiles) {
      // --- Move projectile ---

      
      
      const drag = proj.drag;
      proj.velocity.multiplyScalar(Math.pow(drag, delta * 60));

      // Subtle curvature (perpendicular force)
      const lateral = new THREE.Vector3(
        -proj.velocity.z,
        0,
        proj.velocity.x
      ).normalize();

      proj.velocity.add(lateral.multiplyScalar(0.15 * delta));
      // --- Move projectile ---
      const move = proj.velocity.clone().multiplyScalar(delta);
      proj.position.add(move);
      proj.distanceTraveled += move.length();

      const velocityFactor = proj.velocity.length() / proj.speed;
      const effectiveTrailLength = Math.max(
        2,
        Math.floor(proj.trailLength * velocityFactor)
      );

      // --- Update trail history ---
      if (!proj.trailHistory) proj.trailHistory = [];

      const lastPos = proj.trailHistory[0] ?? proj.position.clone();
      const dist = proj.position.distanceTo(lastPos);
      if (dist > 0.20) {
        const steps = Math.ceil(dist / 0.10);
        for (let s = 1; s <= steps; s++) {
          const interpolated = lastPos.clone().lerp(proj.position, s / steps);
          proj.trailHistory.unshift(interpolated);
        }
      } else {
        proj.trailHistory.unshift(proj.position.clone());
      }
        
      if (proj.trailHistory.length > effectiveTrailLength) {
        proj.trailHistory = proj.trailHistory.slice(0, effectiveTrailLength);
      }

      // --- Homing ---
      if (proj.homing && enemies.length > 0) {
        const nearest = enemies.reduce(
          (acc, e) => {
            if (proj.piercedEnemies.has(e.id)) return acc;
            const d = proj.position.distanceTo(e.position);
            return d < acc.dist ? { enemy: e, dist: d } : acc;
          },
          { enemy: null as any, dist: Infinity }
        );
        if (nearest.enemy && nearest.dist < 15) {
          const dir = nearest.enemy.position.clone().sub(proj.position).normalize();
          proj.velocity.lerp(dir.multiplyScalar(proj.speed), 5 * delta);
          proj.velocity.normalize().multiplyScalar(proj.speed);
          proj.rotationY = Math.atan2(proj.velocity.x, proj.velocity.z);
        }
      }

      // --- Check range ---
      proj.life -= delta;

      if (proj.life <= 0) {
        if (proj.trailHistory.length > 1) {
          trailGhosts.push({
            id: proj.id,
            life: 0.2,
            trail: [...proj.trailHistory],
            color: proj.color,
            size: proj.size,
          });
        }
        continue;
      }

      // ========================================
      // WALL BOUNCING FIRST
      // ========================================
      if (proj.bouncesLeft > 0) {
        let hitWall = false;
        let hitPosition = proj.position.clone();

        if (Math.abs(proj.position.x) > roomBounds) {
          proj.velocity.x *= -1;
          proj.bouncesLeft--;
          hitWall = true;
          hitPosition.x = Math.sign(proj.position.x) * roomBounds;
        }
        if (Math.abs(proj.position.z) > roomBounds) {
          proj.velocity.z *= -1;
          proj.bouncesLeft--;
          hitWall = true;
          hitPosition.z = Math.sign(proj.position.z) * roomBounds;
        }

        // Add terrain impact effect
        if (hitWall && get().addImpactEffect) {
          get().addImpactEffect(hitPosition, 'terrain', proj.color, 0.8);
        }
      } else if (
        // If no bounces left, check if out of bounds and remove
        Math.abs(proj.position.x) > roomBounds ||
        Math.abs(proj.position.z) > roomBounds
      ) {
        continue;
      }

      
      let hitEnemy = false;

      const enemyRadius = 0.8; // tune once, no magic numbers elsewhere

      for (const enemy of enemies) {
        if (proj.piercedEnemies.has(enemy.id)) continue;

        // Vector from enemy center → projectile
        const toProj = proj.position.clone().sub(enemy.position);
        toProj.y = 0;

        const dist = toProj.length();
        if (dist > enemyRadius) continue;

        // ================= HIT =================
        hitEnemy = true;

        // ✅ Impact point on enemy surface
        const impactPos = enemy.position.clone().add(
          toProj.normalize().multiplyScalar(enemyRadius)
        );

        onHit(
          enemy.id,
          proj.damage,
          proj.velocity.clone().normalize().multiplyScalar(8),
          {
            color: proj.color,
            explosive: proj.explosive,
            chainLightning: proj.chainLightning,
            burn: proj.burn,
            impactPos,
          }
        );

        // ================= BOUNCE =================
        if (proj.bouncesLeft > 0) {
          const normal = toProj.normalize();
          const dot = proj.velocity.dot(normal);

          proj.velocity.sub(normal.multiplyScalar(2 * dot));
          proj.velocity.multiplyScalar(0.85);
          proj.rotationY = Math.atan2(proj.velocity.x, proj.velocity.z);

          proj.bouncesLeft--;
          proj.piercedEnemies.add(enemy.id);

          // Push projectile out of enemy
          proj.position.copy(
            enemy.position.clone().add(normal.multiplyScalar(enemyRadius + 0.05))
          );

          continue;
        }

        // ================= PIERCE =================
        proj.piercedEnemies.add(enemy.id);
        if (proj.piercedEnemies.size > proj.piercing) {
          break;
        }
      }



      // Remove projectile if piercing is exhausted (and no bounces left)
      if (hitEnemy && proj.bouncesLeft === 0 && proj.piercedEnemies.size > proj.piercing) {
        continue;
      }

      updated.push(proj);
    }

    // --- Update ghost trails ---
    const newGhosts = trailGhosts
      .map((g) => ({ ...g, life: g.life - delta }))
      .filter((g) => g.life > 0);

    set({
      projectiles: updated,
      trailGhosts: newGhosts,
    });
  },
  
  removeProjectile: (id) =>
    set((s) => ({
      projectiles: s.projectiles.filter((p) => p.id !== id),
    })),

  reset: () => set({ projectiles: [], trailGhosts: [] }),
}));


//
// --------------------------- HELPERS ---------------------------------------
//

function getProjectileColor(config: any): string {
  if (config.explosive) return "#ff6600";
  if (config.chainLightning) return "#00ffff";
  if (config.homing) return "#ff00ff";
  if (config.piercing > 0) return "#ffff00";
  if (config.bouncing > 0) return "#00ff00";
  return "#ffffff";
}

function getTrailColor(config: any): string {
  if (config.explosive) return "rgba(255, 102, 0, 0.5)";
  if (config.chainLightning) return "rgba(0, 255, 255, 0.5)";
  if (config.homing) return "rgba(255, 0, 255, 0.5)";
  if (config.piercing > 0) return "rgba(255, 255, 0, 0.5)";
  if (config.bouncing > 0) return "rgba(0, 255, 0, 0.5)";
  return "rgba(255, 255, 255, 0.5)";
}
