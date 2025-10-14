import { create } from "zustand";

interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Enemy {
  id: string;
  position: Position;
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
  patrolTarget?: Position;
  xpValue: number;
}

interface EnemiesState {
  enemies: Enemy[];
  
  // Actions
  addEnemy: (enemy: Partial<Enemy>) => void;
  removeEnemy: (id: string) => void;
  updateEnemies: (enemies: Enemy[]) => void;
  generateRoomEnemies: () => void;
  reset: () => void;
}

export const useEnemies = create<EnemiesState>((set, get) => ({
  enemies: [],
  
  addEnemy: (enemyData) => {
    const enemy: Enemy = {
      id: Math.random().toString(36),
      position: { x: 0, y: 0, z: 0 },
      health: 50,
      maxHealth: 50,
      attack: 15,
      defense: 2,
      speed: 4,
      detectionRange: 8,
      attackRange: 1.5,
      canAttack: true,
      attackCooldown: 0,
      maxAttackCooldown: 1.0,
      state: "patrolling",
      xpValue: 25,
      ...enemyData
    };
    
    set((state) => ({
      enemies: [...state.enemies, enemy]
    }));
  },
  
  removeEnemy: (id) => set((state) => ({
    enemies: state.enemies.filter(enemy => enemy.id !== id)
  })),
  
  updateEnemies: (enemies) => set({ enemies }),
  
  generateRoomEnemies: () => {
    set({ enemies: [] });
    
    const numEnemies = Math.floor(Math.random() * 3) + 1;
    const { addEnemy } = get();
    
    for (let i = 0; i < numEnemies; i++) {
      addEnemy({
        position: {
          x: (Math.random() - 0.5) * 15,
          y: 0,
          z: (Math.random() - 0.5) * 15
        },
        patrolTarget: {
          x: (Math.random() - 0.5) * 10,
          y: 0,
          z: (Math.random() - 0.5) * 10
        }
      });
    }
  },
  
  reset: () => set({ enemies: [] })
}));
