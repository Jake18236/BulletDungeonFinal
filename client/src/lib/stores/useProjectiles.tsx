import { create } from "zustand";
import * as THREE from "three";
import { ENEMY_TYPE_CONFIG, SHOGGOTH_CONFIG } from "./useEnemies";

export type TrailParticle = {
  x: number;
  y: number;
  size: number;
  life: number;
  maxLife: number;
  projectileId?: string;
};


interface SpriteSegment {
  x: number;
  z: number;
  angle: number;
  age: number;
}


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
  previousPosition: THREE.Vector3;
  velocity: THREE.Vector3;
  drag: number;
  damage: number;
  speed: number;
  life: number;
  maxLife: number;
  maxRange: number;
  distanceTraveled: number;
  rotationY: number;

  // Visual
  color: string;
  size: number;
  trailColor: string;
  trailColorSecondary: string;
  trailLength: number;


  // Special effects
  homing: boolean;
  piercing: number;
  piercedEnemies: Set<string>;
  bouncing: number;
  bouncesLeft: number;
  railgun: boolean;
  pierceKillCount: number;
  explosive?: { radius: number; damage: number };
  chainLightning?: { chains: number; range: number; chainedEnemies: Set<string> };

  isSummonProjectile?: boolean;
  burn?: { damage: number; duration: number };
  triggerOnHit?: boolean;
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
    burn?: { damage: number; duration: number };
    railgun?: boolean
  }) => void;

  trimTrailHistory: () => void;

  updateProjectiles: (
    delta: number,
    enemies: Array<{
      id: string;
      position: THREE.Vector3;
      health: number;
      velocity?: THREE.Vector3;
      type?: "basic" | "tank" | "eyeball" | "tree" | "boss" | "crow" | "mage";
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
        isSummonProjectile?: boolean;
        
        impactPos: THREE.Vector3;
      }
    ) => void,
    isPaused: boolean,
  ) => void;

  removeProjectile: (id: string) => void;
  reset: () => void;
}

let _nextProjectileStoreId = 0;

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
    railgun?: boolean;

    explosive?: { radius: number; damage: number };
    chainLightning?: { chains: number; range: number };

    isSummonProjectile?: boolean;
    burn?: { damage: number; duration: number };
    triggerOnHit?: boolean;
  }) => {
    const projectile: Projectile = {
      id: String(_nextProjectileStoreId++),
      position: config.position.clone(),
      previousPosition: config.position.clone(),
      velocity: config.direction.clone().normalize().multiplyScalar(config.speed),
      damage: config.damage,
      speed: config.speed,
      life: config.life ?? 3,
      maxLife: config.life ?? 3,
      drag: 0.985,

      maxRange: config.range,
      distanceTraveled: 0,
      rotationY: Math.atan2(config.direction.x, config.direction.z),
      color: getProjectileColor(config),
      size: config.size,
      trailColor: getTrailColor(config),
      trailColorSecondary: getTrailColor(config),
      trailLength: config.trailLength,
      homing: config.homing,
      piercing: config.piercing,
      piercedEnemies: new Set(),
      bouncing: config.bouncing,
      bouncesLeft: config.bouncing,
      railgun: config.railgun ?? false,
      pierceKillCount: 0,

      explosive: config.explosive,
      chainLightning: config.chainLightning
        ? {
            ...config.chainLightning,
            chainedEnemies: new Set(),
          }
        : undefined,

      isSummonProjectile: config.isSummonProjectile,
      burn: config.burn,
      triggerOnHit: config.triggerOnHit,
    };

    set((state) => ({
      projectiles: [...state.projectiles, projectile],
    }));
  },

  // Helper to trim old trail history to prevent unbounded growth
  trimTrailHistory: () => {
    
  },

  updateProjectiles: (delta, enemies, playerPos, roomBounds, onHit, isPaused) => {
    if (isPaused) {
      return;
    }

    const updated: Projectile[] = [];

    for (const proj of get().projectiles) {


      proj.previousPosition.copy(proj.position);

      if (Math.random() < 0.5) {
        const wobbleIntensity = 0.35;
        const wobbleX = (Math.random() - 0.5) * wobbleIntensity * proj.speed;
        const wobbleZ = (Math.random() - 0.5) * wobbleIntensity * proj.speed;
        proj.velocity.x += wobbleX * delta * 2;
        proj.velocity.z += wobbleZ * delta * 2;
      }

      const travelFactor = Math.min(1, proj.distanceTraveled / 20);
      const dragBase = 0.4;
      const dragFalloff = 0.01;
      const dragFactor = dragBase / (1 + dragFalloff * travelFactor);
      const speedDecay = Math.max(0, 1 - dragFactor * delta);
      proj.velocity.multiplyScalar(speedDecay);

      const move = proj.velocity.clone().multiplyScalar(delta);
      proj.position.add(move);
      proj.distanceTraveled += move.length();


      // --- Homing ---
      if (proj.homing && enemies.length > 0) {
        const nearest = enemies.reduce(
            (acc, e) => {
              if (proj.piercedEnemies.has(e.id)) return acc;

              const toEnemy = e.position
                .clone()
                .sub(proj.position);

              const dist = toEnemy.length();

              const projectileDir =
                proj.velocity.clone().normalize();

              const targetDir =
                toEnemy.normalize();

              const alignment =
                projectileDir.dot(targetDir);

              // Ignore enemies too far behind
              if (alignment < 0) return acc;

              return dist < acc.dist
                ? { enemy: e, dist }
                : acc;
            },
            { enemy: null as any, dist: Infinity }
          );
        if (nearest.enemy && nearest.dist < 20) {
          const toTarget = nearest.enemy.position.clone().sub(proj.position);
          const dir = toTarget.clone().normalize();
          const pullStrength = THREE.MathUtils.clamp(((20 - nearest.dist) / 20) * 8 , 0.8, 1);
          const desiredVelocity = dir.multiplyScalar(proj.speed);

          const steering = desiredVelocity.sub(proj.velocity);

          // stronger steering when close
          const steerStrength =
            THREE.MathUtils.clamp(((20 - nearest.dist) / 20) * 20, 6, 25);

          steering.multiplyScalar(steerStrength * delta);

          proj.velocity.add(steering);
          const maxSpeed = proj.speed * (1 + 0.35 * pullStrength);
          if (proj.velocity.length() > maxSpeed) {
            proj.velocity.normalize().multiplyScalar(maxSpeed);
          }
          proj.rotationY = Math.atan2(proj.velocity.x, proj.velocity.z);
        }
      }

      // --- Check range ---
      proj.life -= delta;
      
      if (proj.life <= 0) {
        continue;
      }
      

      
      let hitEnemy = false;

      for (const enemy of enemies) {
        //skip 
        if (proj.piercedEnemies.has(enemy.id)) continue;

        const enemyRadius = enemy.type === "boss"
          ? SHOGGOTH_CONFIG.bodyHitRadius
          : ENEMY_TYPE_CONFIG[enemy.type === "tank" || enemy.type === "eyeball" ? enemy.type : "basic"].bodyHitRadius;

        // Early distance check: quick AABB check before detailed collision
        const dx = proj.position.x - enemy.position.x;
        const dz = proj.position.z - enemy.position.z;
        const distSq = dx * dx + dz * dz;
        const maxDist = enemyRadius + 2; // Conservative bounds
        if (distSq > maxDist * maxDist) continue;

        const segmentStart = proj.previousPosition;
        const segmentEnd = proj.position;
        const enemyPos = enemy.position;

        const segment = segmentEnd.clone().sub(segmentStart);
        const segmentLengthSq = segment.x * segment.x + segment.z * segment.z;
        
        if (segmentLengthSq < 0.0001) {
          if (distSq <= enemyRadius * enemyRadius) {
          } else {
            continue;
          }
        } else {
          const toEnemy = enemyPos.clone().sub(segmentStart);
          const t = Math.max(0, Math.min(1, (toEnemy.x * segment.x + toEnemy.z * segment.z) / segmentLengthSq));
          const closestX = segmentStart.x + segment.x * t;
          const closestZ = segmentStart.z + segment.z * t;
          const distToClosestX = closestX - enemyPos.x;
          const distToClosestZ = closestZ - enemyPos.z;
          const distance = Math.sqrt(distToClosestX * distToClosestX + distToClosestZ * distToClosestZ);
          
          if (distance > enemyRadius) continue;
        }

        // Hit detected
        {
          hitEnemy = true;

          // Compute exact impact point on enemy surface
          const impactPos = proj.position.clone();

          // Calculate damage - apply railgun penalty if active
          let finalDamage = proj.damage;
          if (proj.railgun && proj.pierceKillCount > 0) {
            finalDamage = proj.damage * Math.pow(0.8, proj.pierceKillCount);
          }

          // Deal damage & trigger effects
          const knockbackBase = 1;
          const knockbackFromSpeed = proj.speed / 20;
          const knockbackMagnitude = knockbackBase + knockbackFromSpeed;

          onHit(
            enemy.id,
            finalDamage,
            proj.velocity.clone().normalize().multiplyScalar(knockbackMagnitude),
            {
              color: proj.color,
              explosive: proj.explosive,
              chainLightning: proj.chainLightning,
              burn: proj.burn,
              impactPos,
            }
          );

          // ===================== RAILGUN KILL CHECK =====================
          // Check if enemy was killed by this hit
          if (proj.railgun) {
            const enemyAfter = enemies.find(e => e.id === enemy.id);
            if (enemyAfter && enemyAfter.health <= 0) {
              proj.pierceKillCount++;
              // Continue piercing through killed enemy
              proj.piercedEnemies.add(enemy.id);
              continue;
            }
          }

          // ===================== BOUNCE LOGIC =====================
          if (proj.bouncesLeft > 0) {
            const normal = proj.position.clone().sub(enemy.position);
            normal.y = 0;
            const outward = normal.normalize();
            proj.velocity.copy(outward.multiplyScalar(proj.speed));
            proj.rotationY = Math.atan2(proj.velocity.x, proj.velocity.z);
            proj.bouncesLeft--;
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


      const effectivePierceCount = proj.piercedEnemies.size - proj.pierceKillCount;
      if (hitEnemy && proj.bouncesLeft === 0 && effectivePierceCount > proj.piercing) {
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
