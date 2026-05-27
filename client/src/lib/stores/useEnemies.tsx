import { create } from "zustand";
import * as THREE from "three";
import { usePlayer } from "./usePlayer"
import { useVisualEffects } from "./useVisualEffects";


export interface EnemyTypeBehaviorConfig {
  bodyHitRadius: number;
  collisionRadius: number;
  engageDistancePx?: number;
  disengageDistancePx?: number;
  projectileSpeed?: number;
  projectileLife?: number;
  projectileSize?: number;
  projectileFireInterval?: number;
}

export const ENEMY_TYPE_CONFIG: Record<"basic" | "tank" | "eyeball", EnemyTypeBehaviorConfig> = {
  basic: {
    bodyHitRadius: 1.2,
    collisionRadius: 0.95,
  },
  tank: {
    bodyHitRadius: 1.2,
    collisionRadius: 1.8,
  },
  eyeball: {
    bodyHitRadius: 1.2,
    collisionRadius: 0.9,
    engageDistancePx: 500,
    disengageDistancePx: 550,
    projectileSpeed: 6,
    projectileLife: 8,
    projectileSize: 1,
    projectileFireInterval: 4.0,
  },
};

export const SHOGGOTH_CONFIG = {
  bodyHitRadius: 3.0,
  collisionRadius: 10,
  idealDistance: 12,
  minDistance: 4,
  maxDistance: 26,
  beamLengthScale: 10,
  beamHalfWidthWorld: 0.5,
  beamDamageInterval: 0.05,
  rotationSpeed: Math.PI * 0.03,
  fireDuration: 4,
  beamOriginOffsetPx: 80,
  beamAngles: [0, (Math.PI * 2) / 5, (Math.PI * 4) / 5, (Math.PI * 6) / 5, (Math.PI * 8) / 5] as const,
} as const;

export interface XPOrb {
  id: string;
  position: THREE.Vector3;
  value: number;
  velocity: THREE.Vector3;
}

export interface Enemy {
  id: string;
  position: THREE.Vector3;
  health: number;
  maxHealth: number;
  speed: number;
  type?: "basic" | "tank" | "eyeball" | "tree" | "boss";
  velocity: THREE.Vector3;
  hitFlash: number;
  
  // Knockback system
  knockbackAcceleration?: THREE.Vector3;
  knockbackDuration?: number;

  // BOSSS PROPERTIES:
  isBoss?: boolean;
  bossType?: "lazarus";
  dashCooldown?: number;
  maxDashCooldown?: number;
  windUpTimer?: number;
  maxWindUpTime?: number;
  attackState?: "chasing" | "laser_windup" | "laser_firing" | "recovering";
  dashDirection?: THREE.Vector3;
  isDashing?: boolean;
  clawWindUp?: number;
  clawGlowIntensity?: number;
  isEnraged?: boolean;
  projectileCooldown?: number;
  maxProjectileCooldown?: number;
  rotationY?: number;
  laserBaseRotation?: number;

  isRangedAttacking?: boolean;
  rangedShotCooldown?: number;
  spawnSessionId?: string;
}

export interface DamagePopup {
  id: string;
  x: number;
  y: number;
  value: number;
  life: number; 
}

type SpawnSessionEnemyType = "basic" | "tank" | "eyeball" | "lazarus";

interface SpawnSession {
  id: string;
  enemy: SpawnSessionEnemyType;
  start: number;
  end: number;
  hp: number;
  max: number;
  spawnCD: number;
  numPerSpawn: number;
}

interface EnemiesState {
  enemies: Enemy[];
  xpOrbs: XPOrb[];
  damagePopups: DamagePopup[];
  addXPOrb: (position: THREE.Vector3, value: number) => void;
  updateXPOrbs: (delta: number, playerPos: THREE.Vector3) => void;
  addEnemy: (enemy: Partial<Enemy>) => void;
  removeEnemy: (id: string) => void;
  updateEnemies: (enemies: Enemy[]) => void;
  registerHit: (id: string, dmg: number) => void;
  reset: () => void;
  elapsedTime: number;
  updateAutoSpawn: (delta: number, playerPos: THREE.Vector3) => void;
  updateDamagePopups: (delta: number) => void;
  spawnLazarusBoss: (position: THREE.Vector3) => void;
}

export const useEnemies = create<EnemiesState>((set, get) => {
  const toSeconds = (time: string) => {
    const [minutes, seconds] = time.split(":").map((part) => Number(part));
    return minutes * 60 + seconds;
  };

  const createSession = (
    id: string,
    enemy: SpawnSessionEnemyType,
    start: string,
    end: string,
    hp: number,
    max: number,
    numPerSpawn: number,
    spawnCD: number,
  ): SpawnSession => {
    const startSeconds = toSeconds(start);
    const rawEndSeconds = toSeconds(end);
    const normalizedEnd = rawEndSeconds <= startSeconds
      ? startSeconds + rawEndSeconds
      : rawEndSeconds;

    return {
      id,
      enemy,
      start: startSeconds,
      end: normalizedEnd,
      hp,
      max,
      numPerSpawn,
      spawnCD,
    };
  };

  const spawnSessions: SpawnSession[] = [
    createSession("basic_1", "basic", "0:00", "0:30", 24, 20, 4, 3),
    createSession("basic_2", "basic", "0:30", "1:00", 24, 50, 10, 4),
    createSession("basic_3", "basic", "1:00", "3:00", 30, 200, 7, 4),
    createSession("basic_4", "basic", "3:00", "30:00", 80, 400, 8, 1),
    //eyes
    createSession("eyeball_1", "eyeball", "0:30", "2:00", 30, 2, 2, 10),
    createSession("eyeball_2", "eyeball", "2:00", "3:00", 50, 20, 5, 2),
    createSession("eyeball_3", "eyeball", "3:01", "30:00", 80, 200, 1, 1),
    //tanks
    createSession("tank_1", "tank", "1:00", "2:00", 200, 4, 1, 5),
    createSession("tank_2", "tank", "2:00", "3:00", 200, 6, 2, 2),
    createSession("tank_3", "tank", "3:00", "30:00", 1000, 580, 5, 10),
    //boss
    createSession("lazarus_1", "lazarus", "1:00", "30:00", 2500, 1, 1, 10),
    
    
  ];

  let spawnSessionTimers = spawnSessions.reduce<Record<string, number>>((acc, session) => {
    acc[session.id] = 0;
    return acc;
  }, {});

  return {
    enemies: [],
    xpOrbs: [],
    damagePopups: [],
    elapsedTime: 0,

    registerHit: (id, dmg) => {
  const state = get();

  const enemy = state.enemies.find((e) => e.id === id);
  if (!enemy) return;

  enemy.hitFlash = 0.92;
  enemy.health -= dmg;

  const newPopup = {
    id: crypto.randomUUID(),
    x: enemy.position.x,
    y: enemy.position.z,
    value: dmg,
    life: 0,
  };

  // Batch update: modify in place instead of spreading
  state.damagePopups.push(newPopup);

  set({
    enemies: state.enemies,
    damagePopups: state.damagePopups,
  });
},

addXPOrb: (position, value) => {
  const MAX_XP_ORBS = 500;

  set(state => {
    const orbs = state.xpOrbs;
    if (orbs.length >= MAX_XP_ORBS) {
      orbs.shift();
    }

    orbs.push({
      id: Math.random().toString(36).substring(2, 11),
      position: position.clone(),
      value,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        0,
        (Math.random() - 0.5) * 4,
      ),
    });

    return { xpOrbs: orbs };
  });
},
    updateXPOrbs: (delta, playerPos) => {
      const baseRange = 5;
      const playerMagnetBonus = usePlayer.getState().magnetRange;
      const MAGNET_RANGE = baseRange * (1 + playerMagnetBonus);
      const COLLECT_RANGE = 1.5;
      const MAGNET_SPEED = 15;
      const MAGNET_RANGE_SQ = MAGNET_RANGE * MAGNET_RANGE;
      const COLLECT_RANGE_SQ = COLLECT_RANGE * COLLECT_RANGE;

      const addXP = usePlayer.getState().addXP;

      set((state) => {
        const orbs = state.xpOrbs;
        let writeIdx = 0;

        for (let i = 0; i < orbs.length; i++) {
          const orb = orbs[i];
          const dx = playerPos.x - orb.position.x;
          const dz = playerPos.z - orb.position.z;
          const distSq = dx * dx + dz * dz;

          if (distSq < COLLECT_RANGE_SQ) {
            addXP(orb.value);
            continue;
          }

          if (distSq < MAGNET_RANGE_SQ) {
            const mag = Math.sqrt(distSq);
            orb.velocity.x = (dx / mag) * MAGNET_SPEED;
            orb.velocity.z = (dz / mag) * MAGNET_SPEED;
          } else {
            // Simple velocity decay without creating new objects
            orb.velocity.x *= Math.max(0, 1 - 3 * delta);
            orb.velocity.z *= Math.max(0, 1 - 3 * delta);
          }

          orb.position.x += orb.velocity.x * delta;
          orb.position.z += orb.velocity.z * delta;

          if (writeIdx !== i) {
            orbs[writeIdx] = orb;
          }
          writeIdx++;
        }

        orbs.length = writeIdx;
        return { xpOrbs: orbs };
      });
    },

updateDamagePopups: (delta) => {
  const state = get();
  const popups = state.damagePopups;
  let writeIdx = 0;

  for (let i = 0; i < popups.length; i++) {
    const dp = popups[i];
    dp.life += delta * 0.5;
    dp.y += delta * 1.5;

    if (dp.life < 1) {
      if (writeIdx !== i) {
        popups[writeIdx] = dp;
      }
      writeIdx++;
    }
  }

  popups.length = writeIdx;
  set({ damagePopups: popups });
},

    addEnemy: (enemyData) => {
      const MAX_ENEMIES = 1000;

      set(state => {
        if (state.enemies.length >= MAX_ENEMIES) {
          return {};
        }

        const enemyTypePool: Array<"basic" | "tank" | "eyeball"> = ["basic", "tank", "eyeball"];
        const chosenType =
          (enemyData.type as "basic" | "tank" | "eyeball" | undefined) ||
          enemyTypePool[Math.floor(Math.random() * enemyTypePool.length)];

        const baseStatsByType: Record<"basic" | "tank" | "eyeball", Partial<Enemy>> = {
          basic: {
            health: 22,
            maxHealth: 22,
            speed: 3.0,
            hitFlash: 0,
          },
          tank: {
            health: 55,
            maxHealth: 55,
            speed: 2.2,
            hitFlash: 0,
          },
          eyeball: {
            health: 16,
            maxHealth: 16,
            speed: 2,
            hitFlash: 0,
          },
        };

        const baseStats = baseStatsByType[chosenType];

        const defaultPosition = new THREE.Vector3(0, 0, 0);

        const enemy: Enemy = {
          id: Math.random().toString(36),
          position: enemyData.position ?? defaultPosition,
          health: enemyData.health ?? baseStats.health!,
          maxHealth: enemyData.maxHealth ?? baseStats.maxHealth!,
          hitFlash: 0,
          speed: enemyData.speed ?? baseStats.speed!,
          type: chosenType,
          velocity: new THREE.Vector3(0, 0, 0),
          isRangedAttacking: false,
          rangedShotCooldown: 0,
          ...enemyData,
        };

        return { enemies: [...state.enemies, enemy] };
      });
    },

    removeEnemy: (id) =>
      set((state) => ({ enemies: state.enemies.filter((e) => e.id !== id) })),

    spawnLazarusBoss: (position) => {
      const boss: Enemy = {
        id: "boss_lazarus_" + Date.now(),
        position: position.clone(),
        health: 420,
        maxHealth: 420,
        speed: 6.5,

        type: "boss",
        velocity: new THREE.Vector3(),
        hitFlash: 0,

        isBoss: true,
        bossType: "lazarus",

        dashCooldown: 3.2,
        maxDashCooldown: 3.2,
        windUpTimer: 0,
        maxWindUpTime: 1.05,
        attackState: "chasing",
        dashDirection: new THREE.Vector3(),
        isDashing: false,
        clawWindUp: 0,
        clawGlowIntensity: 0,
        isEnraged: false,
        projectileCooldown: 0,
        maxProjectileCooldown: 2,
        rotationY: 0,
        laserBaseRotation: 0,
      };

      set((state) => ({ enemies: [...state.enemies, boss] }));
    },
    
    updateEnemies: (enemies) => set({ enemies }),

    updateAutoSpawn: (delta, playerPos) => {
      const elapsedTime = get().elapsedTime + delta;
      const currentEnemies = get().enemies;
      
      // Create a map for counting enemies per session (more efficient than filtering)
      const enemyCountBySession: Record<string, number> = {};
      for (const enemy of currentEnemies) {
        if (enemy.spawnSessionId) {
          enemyCountBySession[enemy.spawnSessionId] = (enemyCountBySession[enemy.spawnSessionId] || 0) + 1;
        }
      }

      for (const session of spawnSessions) {
        // Check if session is active
        if (elapsedTime < session.start || elapsedTime > session.end) {
          spawnSessionTimers[session.id] = 0;
          continue;
        }

        spawnSessionTimers[session.id] += delta;
        if (spawnSessionTimers[session.id] < session.spawnCD) continue;

        spawnSessionTimers[session.id] = 0;

        const aliveFromSession = enemyCountBySession[session.id] || 0;
        if (aliveFromSession >= session.max) continue;

        const availableSlots = session.max - aliveFromSession;
        const enemiesToSpawn = Math.min(session.numPerSpawn, availableSlots);

        for (let i = 0; i < enemiesToSpawn; i++) {
          const angle = Math.random() * Math.PI * 2;
          const distance = 50;
          const spawnPos = new THREE.Vector3(
            playerPos.x + Math.cos(angle) * distance,
            0,
            playerPos.z + Math.sin(angle) * distance,
          );

          if (session.enemy === "lazarus") {
            get().spawnLazarusBoss(spawnPos);
            const currentEnemies = get().enemies;
            const spawnedBoss = currentEnemies[currentEnemies.length - 1];
            if (!spawnedBoss) continue;

            spawnedBoss.health = session.hp;
            spawnedBoss.maxHealth = session.hp;
            spawnedBoss.spawnSessionId = session.id;
            
            set({ enemies: currentEnemies });
            continue;
          }

          get().addEnemy({
            position: spawnPos,
            type: session.enemy,
            health: session.hp,
            maxHealth: session.hp,
            spawnSessionId: session.id,
          });
        }
      }

      set({ elapsedTime });
    },

    reset: () => {
      spawnSessionTimers = spawnSessions.reduce<Record<string, number>>((acc, session) => {
        acc[session.id] = 0;
        return acc;
      }, {});
      set({ enemies: [], xpOrbs: [], damagePopups: [], elapsedTime: 0 });
    },
  };
});
