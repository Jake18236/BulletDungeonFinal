import { create } from "zustand";
import * as THREE from "three";

export interface Enemy {
  id: string;
  position: THREE.Vector3;
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  speed: number;
  detectionRange: number;
  attackRange: number;
  canAttack: boolean;
  attackCooldown: number;
  maxAttackCooldown: number;
  state: "patrolling" | "chasing" | "attacking";
  patrolTarget?: THREE.Vector3;
  // New: support different enemy types and patrol waypoints
  type?: string;
  patrolPoints?: THREE.Vector3[];
  currentPatrolIndex?: number;
  velocity: THREE.Vector3;
}

interface EnemiesState {
  enemies: Enemy[];

  addEnemy: (enemy: Partial<Enemy>) => void;
  removeEnemy: (id: string) => void;
  updateEnemies: (enemies: Enemy[]) => void;
  generateRoomEnemies: () => void;
  reset: () => void;
}

export const useEnemies = create<EnemiesState>((set, get) => ({
  enemies: [],

  addEnemy: (enemyData) => {
    // Choose a type and base stats (allow overrides via enemyData)
    const chosenType = (enemyData.type as string) || (Math.random() < 0.6 ? "grunt" : Math.random() < 0.8 ? "patroller" : "sentry");

    const baseStats: Partial<Enemy> = (() => {
      switch (chosenType) {
        case "patroller":
          return {
            health: 60,
            maxHealth: 60,
            attack: 1,
            defense: 3,
            speed: 1,
            detectionRange: 1000,
            attackRange: 1.6,
            maxAttackCooldown: 1.2,
          } as Partial<Enemy>;
        case "sentry":
          return {
            health: 80,
            maxHealth: 80,
            attack: 1,
            defense: 4,
            speed: 0,
            detectionRange: 12,
            attackRange: 1.8,
            maxAttackCooldown: 1.5,
          } as Partial<Enemy>;
        case "grunt":
        default:
          return {
            health: 45,
            maxHealth: 45,
            attack: 1,
            defense: 1,
            speed: 3.5,
            detectionRange: 7,
            attackRange: 1.4,
            maxAttackCooldown: 1.0,
          } as Partial<Enemy>;
      }
    })();

    const defaultPosition = new THREE.Vector3(0, 0, 0);

    const enemy: Enemy = {
      id: Math.random().toString(36),
      position: enemyData.position ?? defaultPosition,
      health: (enemyData.health as number) ?? (baseStats.health as number) ?? 50,
      maxHealth: (enemyData.maxHealth as number) ?? (baseStats.maxHealth as number) ?? 50,
      attack: (enemyData.attack as number) ?? (baseStats.attack as number) ?? 10,
      defense: (enemyData.defense as number) ?? (baseStats.defense as number) ?? 1,
      speed: (enemyData.speed as number) ?? (baseStats.speed as number) ?? 3,
      detectionRange: (enemyData.detectionRange as number) ?? (baseStats.detectionRange as number) ?? 8,
      attackRange: (enemyData.attackRange as number) ?? (baseStats.attackRange as number) ?? 1.5,
      canAttack: true,
      attackCooldown: 1.0,
      maxAttackCooldown: (enemyData.maxAttackCooldown as number) ?? (baseStats.maxAttackCooldown as number) ?? 1.0,
      state: "patrolling",
      type: chosenType,
      velocity: new THREE.Vector3(0, 0, 0),
      currentPatrolIndex: 0,
      ...enemyData,
    };

    // If this is a patroller, give it two patrol points near its spawn position
    if (enemy.type === "patroller" && !enemy.patrolPoints) {
      const p1 = enemy.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
      const p2 = enemy.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
      enemy.patrolPoints = [p1, p2];
      enemy.currentPatrolIndex = 0;
    }

    // If not a patroller and no explicit patrolTarget provided, generate a wander target
    if (enemy.type !== "patroller" && !enemy.patrolTarget && !enemy.patrolPoints) {
      enemy.patrolTarget = new THREE.Vector3(
        enemy.position.x + (Math.random() - 0.5) * 10,
        0,
        enemy.position.z + (Math.random() - 0.5) * 10
      );
    }

    set((state) => ({ enemies: [...state.enemies, enemy] }));
  },

  removeEnemy: (id) =>
    set((state) => ({ enemies: state.enemies.filter((e) => e.id !== id) })),

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
      // Randomly choose a type per enemy
      const roll = Math.random();
      const type = roll < 0.6 ? "grunt" : roll < 0.85 ? "patroller" : "sentry";
      addEnemy({
        position: pos,
        type,
      });
      addEnemy({
        position: pos,
        type,
      });
      addEnemy({
        position: pos,
        type,
      });
    }
  },

  reset: () => set({ enemies: [] }),
}));