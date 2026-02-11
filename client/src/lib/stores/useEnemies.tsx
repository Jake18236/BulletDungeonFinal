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
    bodyHitRadius: 0.7,
    collisionRadius: 0.95,
  },
  tank: {
    bodyHitRadius: 1.2,
    collisionRadius: 1.8,
  },
  eyeball: {
    bodyHitRadius: 0.65,
    collisionRadius: 0.9,
    engageDistancePx: 500,
    disengageDistancePx: 550,
    projectileSpeed: 4,
    projectileLife: 5,
    projectileSize: 1,
    projectileFireInterval: 4.0,
  },
};

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
  attack: number;
  speed: number;
  detectionRange: number;
  attackRange: number;
  canAttack: boolean;
  attackCooldown: number;
  maxAttackCooldown: number;
  type?: "basic" | "tank" | "eyeball" | "boss";
  velocity: THREE.Vector3;
  hitFlash: number;

  // BOSSS PROPERTIES:
  isBoss?: boolean;
  bossType?: "shoggoth";
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

  isRangedAttacking?: boolean;
  rangedShotCooldown?: number;
}

export interface DamagePopup {
  id: string;
  x: number;
  y: number;
  value: number;
  life: number; 
}

interface SpawnScheduleEntry {
  time: number;
  interval: number;
  count: number;
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
  generateRoomEnemies: () => void;
  registerHit: (id: string, dmg: number) => void;
  reset: () => void;
  elapsedTime: number;
  updateAutoSpawn: (delta: number, playerPos: THREE.Vector3) => void;
  updateDamagePopups: (delta: number) => void;
  spawnShoggothBoss: (position: THREE.Vector3) => void;
}

export const useEnemies = create<EnemiesState>((set, get) => {
  const spawnSchedule: SpawnScheduleEntry[] = [
    { time: 0, interval: 3, count: 20 },
    { time: 10, interval: 4, count: 2 },
    { time: 20, interval: 5, count: 3 },
    { time: 40, interval: 6, count: 20 },
    { time: 60, interval: 2, count: 30 },
  ];

  let spawnTimer = 0;

  return {
    enemies: [],
    xpOrbs: [],
    damagePopups: [],
    elapsedTime: 0,

    registerHit: (id, dmg) => {
      const { enemies, damagePopups } = get();
      const enemy = enemies.find((e) => e.id === id);
      if (!enemy) return;

      set({
        enemies: enemies.map((e) =>
          e.id === id ? { ...e, hitFlash: 0.92, health: e.health - dmg } : e
        ),
        damagePopups: [
          ...damagePopups,
          {
            id: crypto.randomUUID(),
            x: enemy.position.x,
            y: enemy.position.z,
            value: dmg,
            life: 0,
          },
        ],
      });
    },

    addXPOrb: (position, value) => {
      const orb: XPOrb = {
        id: Math.random().toString(36).substring(2, 11),
        position: position.clone(),
        value,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          0,
          (Math.random() - 0.5) * 2
        ),
      };
      set((state) => ({ xpOrbs: [...state.xpOrbs, orb] }));
    },

    updateXPOrbs: (delta, playerPos) => {
      const MAGNET_RANGE = 5;
      const COLLECT_RANGE = 1.5;
      const MAGNET_SPEED = 15;

      const addXP = usePlayer.getState().addXP;

      set((state) => {
        const remainingOrbs: XPOrb[] = [];

        for (const orb of state.xpOrbs) {
          const dx = playerPos.x - orb.position.x;
          const dz = playerPos.z - orb.position.z;
          const distance = Math.sqrt(dx * dx + dz * dz);

          if (distance < COLLECT_RANGE) {
            addXP(orb.value);

            // ADD VISUAL POP EFFECT
            // Create particles at collection point
            for (let i = 0; i < 8; i++) {
              const angle = (i / 8) * Math.PI * 2;
              const speed = 20 + Math.random() * 10;

              
              const { particles } = useVisualEffects.getState();
              useVisualEffects.setState({
                particles: [...particles, {
                  id: `xp_collect_${Date.now()}_${i}`,
                  position: orb.position.clone(),
                  velocity: new THREE.Vector3(
                    Math.cos(angle) * speed,
                    0,
                    Math.sin(angle) * speed
                  ),
                  life: 0,
                  maxLife: 0.4,
                  size: 3,
                  color: "#2bcf8e",
                  alpha: 1,
                  type: "spark" as const,
                }]
              });
            }

            continue;
          }

          if (distance < MAGNET_RANGE) {
            const dirX = dx / distance;
            const dirZ = dz / distance;
            orb.velocity.x = dirX * MAGNET_SPEED;
            orb.velocity.z = dirZ * MAGNET_SPEED;
          } else {
            orb.velocity.multiplyScalar(Math.max(0, 1 - 3 * delta));
          }

          orb.position.x += orb.velocity.x * delta;
          orb.position.z += orb.velocity.z * delta;

          remainingOrbs.push(orb);
        }

        return { xpOrbs: remainingOrbs };
      });
    },

    updateDamagePopups: (delta) => {
      set((state) => ({
        damagePopups: state.damagePopups
          .map((dp) => ({ ...dp, life: dp.life + delta * 0.5, y: dp.y + delta * 1.5 }))
          .filter((dp) => dp.life < 1),
      }));
    },

    addEnemy: (enemyData) => {
      const enemyTypePool: Array<"basic" | "tank" | "eyeball"> = ["basic", "tank", "eyeball"];
      const chosenType =
        (enemyData.type as "basic" | "tank" | "eyeball" | undefined) ||
        enemyTypePool[Math.floor(Math.random() * enemyTypePool.length)];

      const baseStatsByType: Record<"basic" | "tank" | "eyeball", Partial<Enemy>> = {
        basic: {
          health: 22,
          maxHealth: 22,
          attack: 1,
          speed: 3.8 + Math.random() * 0.7,
          detectionRange: 70000,
          attackRange: 1.4,
          maxAttackCooldown: 0.95,
        },
        tank: {
          health: 55,
          maxHealth: 55,
          attack: 2,
          speed: 2.2 + Math.random() * 0.4,
          detectionRange: 70000,
          attackRange: 1.55,
          maxAttackCooldown: 1.25,
        },
        eyeball: {
          health: 16,
          maxHealth: 16,
          attack: 2,
          speed: 4.6 + Math.random() * 0.8,
          detectionRange: 70000,
          attackRange: 1.25,
          maxAttackCooldown: 0.8,
        },
      };

      const baseStats = baseStatsByType[chosenType];

      const defaultPosition = new THREE.Vector3(0, 0, 0);

      const enemy: Enemy = {
        id: Math.random().toString(36),
        position: enemyData.position ?? defaultPosition,
        health: enemyData.health ?? baseStats.health!,
        maxHealth: enemyData.maxHealth ?? baseStats.maxHealth!,
        attack: enemyData.attack ?? baseStats.attack!,
        speed: enemyData.speed ?? baseStats.speed!,
        detectionRange: enemyData.detectionRange ?? baseStats.detectionRange!,
        attackRange: enemyData.attackRange ?? baseStats.attackRange!,
        canAttack: true,
        attackCooldown: 0,
        maxAttackCooldown: enemyData.maxAttackCooldown ?? baseStats.maxAttackCooldown!,
        type: chosenType,
        velocity: new THREE.Vector3(0, 0, 0),
        hitFlash: 0,
        isRangedAttacking: false,
        rangedShotCooldown: 0,
        ...enemyData,
      };

      set((state) => ({ enemies: [...state.enemies, enemy] }));
    },

    removeEnemy: (id) =>
      set((state) => ({ enemies: state.enemies.filter((e) => e.id !== id) })),

    spawnShoggothBoss: (position) => {
      const boss: Enemy = {
        id: "boss_shoggoth_" + Date.now(),
        position: position.clone(),
        health: 420,
        maxHealth: 420,
        attack: 1,
        speed: 3.5,
        detectionRange: 999999,
        attackRange: 2.9,
        canAttack: true,
        attackCooldown: 0,
        maxAttackCooldown: 0.5,
        type: "boss",
        velocity: new THREE.Vector3(),
        hitFlash: 0,

        isBoss: true,
        bossType: "shoggoth",

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
        projectileCooldown: 4.5,
        maxProjectileCooldown: 4.5,
        rotationY: 0,
      };

      set((state) => ({ enemies: [...state.enemies, boss] }));
    },
    
    updateEnemies: (enemies) => set({ enemies }),

    generateRoomEnemies: () => {
      set({ enemies: [] });
      const { addEnemy } = get();
      const numEnemies = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < numEnemies; i++) {
        const pos = new THREE.Vector3(
          (Math.random() - 0.5) * 15,
          0,
          (Math.random() - 0.5) * 15
        );
        addEnemy({ position: pos });
      }
    },

    updateAutoSpawn: (delta, playerPos) => {
      set((state) => {
        let elapsedTime = state.elapsedTime + delta;
        let currentConfig = spawnSchedule[0];

        for (let i = 0; i < spawnSchedule.length; i++) {
          if (elapsedTime >= spawnSchedule[i].time) currentConfig = spawnSchedule[i];
          else break;
        }

        spawnTimer += delta;

        if (spawnTimer >= currentConfig.interval) {
          spawnTimer = 0;
          for (let i = 0; i < currentConfig.count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 30 + Math.random() * 20;
            const spawnPos = new THREE.Vector3(
              playerPos.x + Math.cos(angle) * distance,
              0,
              playerPos.z + Math.sin(angle) * distance
            );

            get().addEnemy({ position: spawnPos });
          }
        }

        return { elapsedTime };
      });
    },

    reset: () => set({ enemies: [], xpOrbs: [], damagePopups: [], elapsedTime: 0 }),
  };
});
