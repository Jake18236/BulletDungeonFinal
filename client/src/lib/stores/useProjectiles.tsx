import { create } from "zustand";
import * as THREE from "three";
import { ENEMY_TYPE_CONFIG, SHOGGOTH_CONFIG } from "./useEnemies";
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
  

  currentLength: number; 
  jitterOffset: THREE.Vector3;

  // Visual
  color: string;
  size: number;
  trailColor: string;
  trailColorSecondary: string;
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


interface ProjectileEnemy {
  id: string;
  position: THREE.Vector3;
  health: number;
  velocity?: THREE.Vector3;
  type?: "basic" | "tank" | "eyeball" | "tree" | "boss";
}

const PROJECTILE_ENEMY_CELL_SIZE = 16;
const PROJECTILE_ENEMY_NEIGHBOR_OFFSETS = [-1, 0, 1] as const;

function getProjectileEnemyCellKey(x: number, z: number) {
  return `${Math.floor(x / PROJECTILE_ENEMY_CELL_SIZE)},${Math.floor(z / PROJECTILE_ENEMY_CELL_SIZE)}`;
}

function buildEnemyBuckets(enemies: ProjectileEnemy[]) {
  const buckets = new Map<string, ProjectileEnemy[]>();

  for (const enemy of enemies) {
    const key = getProjectileEnemyCellKey(enemy.position.x, enemy.position.z);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(enemy);
    } else {
      buckets.set(key, [enemy]);
    }
  }

  return buckets;
}

function getNearbyEnemies(
  buckets: Map<string, ProjectileEnemy[]>,
  position: THREE.Vector3,
) {
  const cellX = Math.floor(position.x / PROJECTILE_ENEMY_CELL_SIZE);
  const cellZ = Math.floor(position.z / PROJECTILE_ENEMY_CELL_SIZE);
  const nearby: ProjectileEnemy[] = [];

  for (const offsetX of PROJECTILE_ENEMY_NEIGHBOR_OFFSETS) {
    for (const offsetZ of PROJECTILE_ENEMY_NEIGHBOR_OFFSETS) {
      const bucket = buckets.get(`${cellX + offsetX},${cellZ + offsetZ}`);
      if (bucket) nearby.push(...bucket);
    }
  }

  return nearby;
}

interface ProjectilesState {
  projectiles: Projectile[];


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
    enemies: ProjectileEnemy[],
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
        impactPos: THREE.Vector3;
      }
    ) => void,
    isPaused: boolean,
  ) => void;

  removeProjectile: (id: string) => void;
  reset: () => void;
}

export const useProjectiles = create<ProjectilesState>((set, get) => ({
  projectiles: [],


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
      trailColorSecondary: getTrailColor(config),
      trailLength: config.trailLength,
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
    };

    set((state) => ({
      projectiles: [...state.projectiles, projectile],
    }));
  },

  updateProjectiles: (delta, enemies, playerPos, roomBounds, onHit, isPaused) => {
    if (isPaused) {
      return;
    }

    const updated: Projectile[] = [];
    const enemyBuckets = buildEnemyBuckets(enemies);

    for (const proj of get().projectiles) {
      // --- Move projectile ---

      
      
      const drag = proj.drag;
      proj.velocity.multiplyScalar(Math.pow(drag, delta * 60));
      // --- Move projectile ---
      const moveX = proj.velocity.x * delta;
      const moveZ = proj.velocity.z * delta;
      proj.position.x += moveX;
      proj.position.z += moveZ;
      proj.distanceTraveled += Math.hypot(moveX, moveZ);

      const velocityFactor = 50 / proj.speed;
      const effectiveTrailLength = Math.max(
        2,
        Math.floor(proj.trailLength * velocityFactor)
      );

      // --- Update trail history ---
      if (!proj.trailHistory) proj.trailHistory = [];

      const lastPos = proj.trailHistory[0] ?? proj.position;
      const trailDx = proj.position.x - lastPos.x;
      const trailDz = proj.position.z - lastPos.z;
      const dist = Math.ceil(Math.hypot(trailDx, trailDz));
      if (dist > 0.20) {
        const steps = Math.ceil(dist / 0.20);
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          proj.trailHistory.unshift(new THREE.Vector3(
            lastPos.x + trailDx * t,
            0,
            lastPos.z + trailDz * t,
          ));
        }
      } else {
        proj.trailHistory.unshift(proj.position.clone());
      }
        
      if (proj.trailHistory.length > effectiveTrailLength) {
        proj.trailHistory.length = effectiveTrailLength;
      }

      // --- Homing ---
      if (proj.homing && enemies.length > 0) {
        let nearestEnemy: ProjectileEnemy | null = null;
        let nearestDistSq = Infinity;
        for (const enemy of getNearbyEnemies(enemyBuckets, proj.position)) {
          if (proj.piercedEnemies.has(enemy.id)) continue;
          const dx = enemy.position.x - proj.position.x;
          const dz = enemy.position.z - proj.position.z;
          const distSq = dx * dx + dz * dz;
          if (distSq < nearestDistSq) {
            nearestEnemy = enemy;
            nearestDistSq = distSq;
          }
        }
        if (nearestEnemy && nearestDistSq < 15 * 15) {
          const dir = nearestEnemy.position.clone().sub(proj.position).normalize();
          proj.velocity.lerp(dir.multiplyScalar(proj.speed), 5 * delta);
          proj.velocity.normalize().multiplyScalar(proj.speed);
          proj.rotationY = Math.atan2(proj.velocity.x, proj.velocity.z);
        }
      }

      // --- Check range ---
      proj.life -= delta;

      if (proj.life <= 0) {
        if (proj.trailHistory.length > 1) {
        }
        continue;
      }

      // ========================================
      // WALL BOUNCING FIRST
      // ========================================
      const hitWallX = Math.abs(proj.position.x) > roomBounds;
      const hitWallZ = Math.abs(proj.position.z) > roomBounds;

      if (hitWallX || hitWallZ) {
        if (proj.bouncesLeft <= 0) {
          continue;
        }

        if (hitWallX) {
          proj.position.x = Math.sign(proj.position.x) * roomBounds;
          proj.velocity.x = -proj.velocity.x;
        }
        if (hitWallZ) {
          proj.position.z = Math.sign(proj.position.z) * roomBounds;
          proj.velocity.z = -proj.velocity.z;
        }

        const retainedSpeed = Math.max(proj.speed * 0.65, proj.velocity.length() * 0.95);
        proj.velocity.normalize().multiplyScalar(retainedSpeed);
        proj.rotationY = Math.atan2(proj.velocity.x, proj.velocity.z);
        proj.bouncesLeft--;

        useVisualEffects.getState().addImpact(
          new THREE.Vector3(proj.position.x, 0, proj.position.z),
          Math.max(20, proj.size * 0.3),
        );
      }

      
      let hitEnemy = false;

      // Loop over nearby enemies
      for (const enemy of getNearbyEnemies(enemyBuckets, proj.position)) {
        // Skip enemies we've already pierced
        if (proj.piercedEnemies.has(enemy.id)) continue;

        const toEnemyX = enemy.position.x - proj.position.x;
        const toEnemyZ = enemy.position.z - proj.position.z;

        const enemyRadius = enemy.type === "boss"
          ? SHOGGOTH_CONFIG.bodyHitRadius
          : ENEMY_TYPE_CONFIG[enemy.type === "tank" || enemy.type === "eyeball" ? enemy.type : "basic"].bodyHitRadius;
        const distanceSq = toEnemyX * toEnemyX + toEnemyZ * toEnemyZ;

        
        if (distanceSq <= enemyRadius * enemyRadius) {
          const distance = Math.max(Math.sqrt(distanceSq), 0.0001);
          hitEnemy = true;

          // Compute exact impact point on enemy surface
          const impactPos = new THREE.Vector3(
            proj.position.x + (toEnemyX / distance) * (distance - enemyRadius),
            0,
            proj.position.z + (toEnemyZ / distance) * (distance - enemyRadius),
          );

          // Deal damage & trigger effects
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

          // ===================== BOUNCE LOGIC =====================

if (proj.bouncesLeft > 0) {
      
  const outward = new THREE.Vector3(
    proj.position.x - enemy.position.x,
    0,
    proj.position.z - enemy.position.z,
  ).normalize();
  proj.velocity.copy(outward.multiplyScalar(proj.speed));


  proj.rotationY = Math.atan2(proj.velocity.x, proj.velocity.z);

  proj.bouncesLeft--;

  // Important: do NOT mark as pierced during bounce phase
  // or piercing logic will get corrupted

  continue;
}

          // ===================== PIERCE LOGIC =====================
          proj.piercedEnemies.add(enemy.id);

          // Stop checking more enemies if piercing limit exceeded
          if (proj.piercedEnemies.size > proj.piercing) {
            break;
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

    set({
      projectiles: updated,
    });
  },
  
  removeProjectile: (id) =>
    set((s) => ({
      projectiles: s.projectiles.filter((p) => p.id !== id),
    })),

  reset: () => set({ projectiles: []}),
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
