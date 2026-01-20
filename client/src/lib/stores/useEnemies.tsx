import { create } from "zustand";
import * as THREE from "three";
import { useXP } from "./useXP";
import { useVisualEffects } from "./useVisualEffects";

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
  type?: string;
  velocity: THREE.Vector3;
  hitFlash: number;

  // BOSSS PROPERTIES:
  isBoss?: boolean;
  bossType?: "deer";
  dashCooldown?: number;
  maxDashCooldown?: number;
  windUpTimer?: number;
  maxWindUpTime?: number;
  attackState?: "chasing" | "winding_up" | "dashing" | "recovering" | "projectile_attack";
  dashDirection?: THREE.Vector3;
  isDashing?: boolean;
  clawWindUp?: number;
  clawGlowIntensity?: number;
  isEnraged?: boolean;
  projectileCooldown?: number;
  maxProjectileCooldown?: number;
  rotationY?: number;
}

export interface DamagePopup {
  id: string;
  x: number;
  y: number;
  value: number;
  life: number; // 0 → 1
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
  spawnDeerBoss: (position: THREE.Vector3) => void;
}

export const useEnemies = create<EnemiesState>((set, get) => {
  const spawnSchedule: SpawnScheduleEntry[] = [
    { time: 0, interval: 3, count: 1 },
    { time: 10, interval: 4, count: 2 },
    { time: 20, interval: 5, count: 3 },
    { time: 40, interval: 6, count: 20 },
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
          e.id === id ? { ...e, hitFlash: 0.12, health: e.health - dmg } : e
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

      const addXP = useXP.getState().addXP;

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
      const chosenType =
        enemyData.type || (Math.random() < 0.7 ? "grunt" : "sentry");

      const baseStats: Partial<Enemy> =
        chosenType === "sentry"
          ? { health: 25, maxHealth: 25, attack: 1, speed: 0, detectionRange: 12, attackRange: 1.8, maxAttackCooldown: 1.5 }
          : { health: 25, maxHealth: 25, attack: 1, speed: 3 + Math.random(), detectionRange: 70000, attackRange: 1.4, maxAttackCooldown: 1.0 };

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
        ...enemyData,
      };

      set((state) => ({ enemies: [...state.enemies, enemy] }));
    },

    removeEnemy: (id) =>
      set((state) => ({ enemies: state.enemies.filter((e) => e.id !== id) })),

    spawnDeerBoss: (position) => {
      const boss: Enemy = {
        id: "boss_deer_" + Date.now(),
        position: position.clone(),
        health: 500,
        maxHealth: 500,
        attack: 1,
        speed: 8,
        detectionRange: 999999,
        attackRange: 2.5,
        canAttack: true,
        attackCooldown: 0,
        maxAttackCooldown: 0.1,
        type: "boss",
        velocity: new THREE.Vector3(),
        hitFlash: 0,

        isBoss: true,
        bossType: "deer",

        dashCooldown: 3.0,
        maxDashCooldown: 3.0,
        windUpTimer: 0,
        maxWindUpTime: 0.65,
        attackState: "chasing",
        dashDirection: new THREE.Vector3(),
        isDashing: false,
        clawWindUp: 0,
        clawGlowIntensity: 0,
        isEnraged: false,
        projectileCooldown: 5.0,
        maxProjectileCooldown: 5.0,
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
        addEnemy({ position: pos, type: "grunt" });
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

            get().addEnemy({ position: spawnPos, type: "grunt" });
          }
        }

        return { elapsedTime };
      });
    },

    reset: () => set({ enemies: [], xpOrbs: [], damagePopups: [], elapsedTime: 0 }),
  };
});
