import { create } from "zustand";

interface Position {
  x: number;
  y: number;
  z: number;
}

interface PlayerState {
  position: Position;
  health: number;
  maxHealth: number;
  level: number;
  xp: number;
  xpToNext: number;
  attack: number;
  defense: number;
  speed: number;
  attackRange: number;
  canAttack: boolean;
  attackCooldown: number;
  maxAttackCooldown: number;
  
  // Actions
  move: (delta: Position) => void;
  attack: () => void;
  takeDamage: (damage: number) => void;
  gainXP: (amount: number) => void;
  levelUp: () => void;
  reset: () => void;
}

const initialState = {
  position: { x: 0, y: 0, z: 0 },
  health: 100,
  maxHealth: 100,
  level: 1,
  xp: 0,
  xpToNext: 100,
  attack: 20,
  defense: 5,
  speed: 8,
  attackRange: 2,
  canAttack: true,
  attackCooldown: 0,
  maxAttackCooldown: 0.5,
};

export const usePlayer = create<PlayerState>((set, get) => ({
  ...initialState,
  
  move: (delta) => set((state) => ({
    position: {
      x: state.position.x + delta.x,
      y: state.position.y + delta.y,
      z: state.position.z + delta.z
    }
  })),
  
  attack: () => {
    const state = get();
    if (state.canAttack) {
      set({
        canAttack: false,
        attackCooldown: state.maxAttackCooldown
      });
      
      // Reset attack cooldown
      setTimeout(() => {
        set({ canAttack: true, attackCooldown: 0 });
      }, state.maxAttackCooldown * 1000);
    }
  },
  
  takeDamage: (damage) => set((state) => {
    const actualDamage = Math.max(1, damage - state.defense);
    return {
      health: Math.max(0, state.health - actualDamage)
    };
  }),
  
  gainXP: (amount) => set((state) => {
    const newXP = state.xp + amount;
    if (newXP >= state.xpToNext) {
      // Level up
      const newLevel = state.level + 1;
      return {
        xp: newXP - state.xpToNext,
        level: newLevel,
        xpToNext: newLevel * 100,
        maxHealth: state.maxHealth + 10,
        health: Math.min(state.health + 10, state.maxHealth + 10),
        attack: state.attack + 2,
        defense: state.defense + 1
      };
    }
    return { xp: newXP };
  }),
  
  levelUp: () => set((state) => ({
    level: state.level + 1,
    maxHealth: state.maxHealth + 10,
    health: state.maxHealth + 10,
    attack: state.attack + 2,
    defense: state.defense + 1,
    xpToNext: (state.level + 1) * 100
  })),
  
  reset: () => set(() => ({
    ...initialState,
    position: { x: 0, y: 0, z: 0 }
  }))
}));
