import { create } from "zustand";
import { CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE } from "../components/CanvasGame"
import * as THREE from "three";

export interface Projectile {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  speed: number;
  maxRange: number;
  distanceTraveled: number;
  rotationY: number;

  // Visual
  color: string;
  size: number;
  trailColor: string;
  trailLength: number;            // how many points to keep
  trailHistory: THREE.Vector3[];  // actual saved positions

  // Special effects
  homing: boolean;
  piercing: number;
  piercedEnemies: Set<string>;
  bouncing: number;
  bouncesLeft: number;
  explosive?: { radius: number; damage: number };
  chainLightning?: { chains: number; range: number; chainedEnemies: Set<string> };

  // Slot reference
  slotId: number;
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
    slotId: number;
    trailLength: number;
    damage: number;
    speed: number;
    range: number;

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
    onHit: (enemyId: string, damage: number, knockback: THREE.Vector3) => void
  ) => void;

  removeProjectile: (id: string) => void;
  reset: () => void;
}

export const useProjectiles = create<ProjectilesState>((set, get) => ({
  projectiles: [],
  trailGhosts: [],

  addProjectile: (config) => {
    const projectile: Projectile = {
      id: Math.random().toString(36).substring(2, 11),
      position: config.position.clone(),
      velocity: config.direction.clone().normalize().multiplyScalar(config.speed),
      damage: config.damage,
      speed: config.speed,
      maxRange: config.range,
      distanceTraveled: 0,
      rotationY: Math.atan2(config.direction.x, config.direction.z),

      color: getProjectileColor(config),
      size: 10,
      trailColor: getTrailColor(config),
      trailLength: 100,
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

      slotId: config.slotId,
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
      const move = proj.velocity.clone().multiplyScalar(delta);
      proj.position.add(move);
      proj.distanceTraveled += move.length();

      // --- Update trail history (world positions only) ---
      // inside updateProjectiles, after moving the projectile
      if (!proj.trailHistory) proj.trailHistory = [];

      // Interpolate points if distance is large (prevents gaps)
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

      // Limit trail length
      if (proj.trailHistory.length > proj.trailLength) proj.trailHistory = proj.trailHistory.slice(0, proj.trailLength);

      

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
          // Add to ghost trails
          trailGhosts.push({
            id: proj.id,
            life: 0.2, // lingering duration
            trail: [...proj.trailHistory],
            color: proj.color,
            size: proj.size,
          });
        }
        continue;
      }

      // --- Bouncing ---
      if (proj.bouncesLeft > 0) {
        if (Math.abs(proj.position.x) > roomBounds) {
          proj.velocity.x *= -1;
          proj.bouncesLeft--;
        }
        if (Math.abs(proj.position.z) > roomBounds) {
          proj.velocity.z *= -1;
          proj.bouncesLeft--;
        }
      } else if (
        Math.abs(proj.position.x) > roomBounds ||
        Math.abs(proj.position.z) > roomBounds
      ) {
        continue;
      }

      // --- Enemy hits ---
      let hit = false;
      for (const enemy of enemies) {
        if (proj.piercedEnemies.has(enemy.id)) continue;
        if (proj.position.distanceTo(enemy.position) < 1.0) {
          hit = true;

          onHit(
            enemy.id,
            proj.damage,
            proj.velocity.clone().normalize().multiplyScalar(8)
          );

          proj.piercedEnemies.add(enemy.id);

          // Explosive
          if (proj.explosive) {
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

          if (proj.piercedEnemies.size > proj.piercing) break;
        }
      }

      if (hit && proj.piercedEnemies.size > proj.piercing) continue;

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
