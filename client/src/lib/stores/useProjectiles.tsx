import { create } from "zustand";
import { CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE } from "../components/CanvasGame"
import { usePlayer } from "./usePlayer";
import * as THREE from "three";
import { Enemy } from "./useEnemies";
import { useSummons } from "./useSummons";
import { useVisualEffects } from "./useVisualEffects";

export type projectileType = "basic" | "heavy";

export interface Projectile {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  speed: number;
  maxRange: number;
  distanceTraveled: number;
  rotationY: number;
  

  currentLength: number; 
  jitterOffset: THREE.Vector3;

  // Visual
  type: projectileType;
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

  // Slot reference
  

  // ADD THESE NEW FIELDS:
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
    projectileType?: projectileType;
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
    onHit: (enemyId: string, damage: number, knockback: THREE.Vector3) => void,
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
    projectileType?: projectileType;
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
      maxRange: config.range,
      distanceTraveled: 0,
      rotationY: Math.atan2(config.direction.x, config.direction.z),
      currentLength: 0,
      jitterOffset: new THREE.Vector3(),
      color: getProjectileColor(config),
      size: config.size,
      trailColor: getTrailColor(config),
      trailLength: config.trailLength * config.speed,
      trailHistory: [],
      type: config.projectileType || "basic",

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
    };

    set((state) => ({
      projectiles: [...state.projectiles, projectile],
    }));
  },

  updateProjectiles: (delta, enemies, playerPos, roomBounds, onHit) => {
    const updated: Projectile[] = [];
    const { trailGhosts } = get();
    const CURVE_RATE = 0.2;
    for (const proj of get().projectiles) {
      // --- Move projectile ---
      // --- Apply curve to velocity (slight rotation) ---
      const speed = proj.velocity.length();
      const angle = Math.atan2(proj.velocity.z, proj.velocity.x); // note: z first for world
      const newAngle = Math.random() / 1000 + angle + CURVE_RATE * delta;
      proj.velocity.x = Math.cos(newAngle) * speed;
      proj.velocity.z = Math.sin(newAngle) * speed;

      // --- Move projectile ---
      const move = proj.velocity.clone().multiplyScalar(delta);
      proj.position.add(move);
      proj.distanceTraveled += move.length();


      // --- Update trail history ---
      if (!proj.trailHistory) proj.trailHistory = [];

      const lastPos = proj.trailHistory[0] ?? proj.position.clone();
      const dist = proj.position.distanceTo(lastPos);
      if (dist > 0.05) {
        const steps = Math.ceil(dist / 0.05);
        for (let s = 1; s <= steps; s++) {
          const interpolated = lastPos.clone().lerp(proj.position, s / steps);
          proj.trailHistory.unshift(interpolated);
        }
      } else {
        proj.trailHistory.unshift(proj.position.clone());
      }

      if (proj.trailHistory.length > proj.trailLength) {
        proj.trailHistory = proj.trailHistory.slice(0, proj.trailLength);
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
      if (proj.distanceTraveled > proj.maxRange) {
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

      for (const enemy of enemies) {
        // Skip if already pierced this enemy
        if (proj.piercedEnemies.has(enemy.id)) continue;

        if (proj.position.distanceTo(enemy.position) < 1.3) {
          hitEnemy = true;

          // Deal damage
          onHit(
            enemy.id,
            proj.damage,
            proj.velocity.clone().normalize().multiplyScalar(8)
          );

          // Add impact effect
          if (get().addImpactEffect) {
            get().addImpactEffect(enemy.position.clone(), 'hit', proj.color, 1.5);
          }

          // ========================================
          // BOUNCE LOGIC (if has bounces left)
          // ========================================
          if (proj.bouncesLeft > 0) {
            // Calculate bounce direction (reflect off enemy)
            const hitDirection = proj.position.clone().sub(enemy.position).normalize();

            // Reflect velocity around the hit normal
            const dot = proj.velocity.dot(hitDirection);
            proj.velocity.x = proj.velocity.x - 2 * dot * hitDirection.x;
            proj.velocity.z = proj.velocity.z - 2 * dot * hitDirection.z;

            // Normalize and maintain speed
            proj.velocity.normalize().multiplyScalar(proj.speed);
            proj.rotationY = Math.atan2(proj.velocity.x, proj.velocity.z);

            // Decrement bounces
            proj.bouncesLeft--;

            // Mark this enemy as hit (so we don't bounce off them again immediately)
            proj.piercedEnemies.add(enemy.id);

            // Move projectile slightly away from enemy to prevent getting stuck
            proj.position.add(hitDirection.multiplyScalar(1.2));

            // Continue to next enemy (we bounced, don't check pierce count)
            continue;
          }

          // ========================================
          // PIERCE LOGIC (if no bounces left)
          // ========================================
          else {
            // Mark as pierced
            proj.piercedEnemies.add(enemy.id);

            // Explosive effect
            if (proj.explosive) {
              if (get().addImpactEffect) {
                get().addImpactEffect(
                  proj.position.clone(),
                  'explosion',
                  '#ff6600',
                  proj.explosive.radius
                );
              }

              for (const e of enemies) {
                if (e.position.distanceTo(proj.position) < proj.explosive.radius) {
                  onHit(
                    e.id,
                    proj.explosive.damage,
                    e.position.clone().sub(proj.position).normalize().multiplyScalar(12)
                  );
                }
              }
            }

            // Chain lightning
            if (
              proj.chainLightning &&
              proj.chainLightning.chainedEnemies.size < proj.chainLightning.chains
            ) {
              proj.chainLightning.chainedEnemies.add(enemy.id);
              const targets = enemies.filter(
                (e) =>
                  e.id !== enemy.id &&
                  !proj.chainLightning!.chainedEnemies.has(e.id) &&
                  e.position.distanceTo(enemy.position) < proj.chainLightning!.range
              );
              if (targets.length > 0) {
                const t = targets[0];
                onHit(t.id, proj.damage * 0.7, new THREE.Vector3());
                proj.chainLightning.chainedEnemies.add(t.id);
              }
            }

            // Check if piercing is exhausted
            if (proj.piercedEnemies.size > proj.piercing) {
              break; // Stop checking more enemies
            }
          }
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
