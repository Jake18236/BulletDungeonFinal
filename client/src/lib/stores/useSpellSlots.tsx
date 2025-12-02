import { create } from "zustand";

// Card types for buffs and debuffs
export type CardType = 
  // Buffs
  | "triple_shot" 
  | "homing" 
  | "piercing" 
  | "bouncing" 
  | "fast_reload"
  | "increased_damage"
  | "increased_speed"
  | "explosive"
  | "chain_lightning"
  // Debuffs
  | "reduced_range"
  | "reduced_damage"
  | "slow_reload"
  | "slower_projectile"
  | "inaccurate";

export interface Card {
  id: string;
  type: CardType;
  name: string;
  description: string;
  isBuff: boolean;
  icon: string;
  // Modifiers
  damageMultiplier?: number;
  speedMultiplier?: number;
  rangeMultiplier?: number;
  reloadMultiplier?: number;
  projectileCount?: number;
  // Special properties
  homing?: boolean;
  piercing?: number; // How many enemies it can pierce through
  bouncing?: number; // How many times it can bounce
  explosive?: { radius: number; damage: number };
  chainLightning?: { chains: number; range: number };
  accuracy?: number; // 1.0 = perfect, 0.5 = 50% spread
}

export interface SpellSlot {
  id: number;
  name: string;
  cards: Card[];
  cooldown: number;
  maxCooldown: number;
  isOnCooldown: boolean;
}

interface SpellSlotsState {
  slots: SpellSlot[];
  activeSlotId: number;
  availableCards: Card[];

  // Actions
  setActiveSlot: (slotId: number) => void;
  addCardToSlot: (slotId: number, card: Card) => void;
  removeCardFromSlot: (slotId: number, cardId: string) => void;
  startCooldown: (slotId: number) => void;
  updateCooldowns: (delta: number) => void;
  getSlotStats: (slotId: number) => {
    damage: number;
    speed: number;
    range: number;
    reload: number;
    projectileCount: number;
    homing: boolean;
    trailLength: number;
    piercing: number;
    bouncing: number;
    explosive?: { radius: number; damage: number };
    chainLightning?: { chains: number; range: number };
    accuracy: number;
  };
  reset: () => void;
}

// Base stats for projectiles
const BASE_DAMAGE = 1;
const BASE_SPEED = 80;
const BASE_RANGE = 50;
const BASE_RELOAD = 0.9; // seconds
const BASE_ACCURACY = 1.0;

// Card definitionsff
export const CARD_LIBRARY: Record<CardType, Omit<Card, "id">> = {
  // Buffs
  triple_shot: {
    type: "triple_shot",
    name: "Triple Shot",
    description: "Fire 3 projectiles at once",
    isBuff: true,
    icon: "🔱",
    projectileCount: 3,
  },
  homing: {
    type: "homing",
    name: "Homing",
    description: "Projectiles seek enemies",
    isBuff: true,
    icon: "🎯",
    homing: true,
    speedMultiplier: 0.8, // Slightly slower
  },
  piercing: {
    type: "piercing",
    name: "Piercing",
    description: "Pierce through 3 enemies",
    isBuff: true,
    icon: "➡️",
    piercing: 3,
    damageMultiplier: 0.9,
  },
  bouncing: {
    type: "bouncing",
    name: "Bouncing",
    description: "Bounces off walls 2 times",
    isBuff: true,
    icon: "⚡",
    bouncing: 2,
  },
  fast_reload: {
    type: "fast_reload",
    name: "Fast Reload",
    description: "50% faster reload",
    isBuff: true,
    icon: "⚡",
    reloadMultiplier: 0.5,
  },
  increased_damage: {
    type: "increased_damage",
    name: "Increased Damage",
    description: "+50% damage",
    isBuff: true,
    icon: "💥",
    damageMultiplier: 1.5,
  },
  increased_speed: {
    type: "increased_speed",
    name: "Increased Speed",
    description: "+50% projectile speed",
    isBuff: true,
    icon: "🚀",
    speedMultiplier: 1.5,
  },
  explosive: {
    type: "explosive",
    name: "Explosive",
    description: "Explodes on impact",
    isBuff: true,
    icon: "💣",
    explosive: { radius: 4, damage: 15 },
    speedMultiplier: 0.7,
  },
  chain_lightning: {
    type: "chain_lightning",
    name: "Chain Lightning",
    description: "Chains to 3 nearby enemies",
    isBuff: true,
    icon: "⚡",
    chainLightning: { chains: 3, range: 5 },
    damageMultiplier: 0.8,
  },

  // Debuffs
  reduced_range: {
    type: "reduced_range",
    name: "Reduced Range",
    description: "-40% range",
    isBuff: false,
    icon: "📉",
    rangeMultiplier: 0.6,
  },
  reduced_damage: {
    type: "reduced_damage",
    name: "Reduced Damage",
    description: "-30% damage",
    isBuff: false,
    icon: "🔻",
    damageMultiplier: 0.7,
  },
  slow_reload: {
    type: "slow_reload",
    name: "Slow Reload",
    description: "+50% reload time",
    isBuff: false,
    icon: "🐌",
    reloadMultiplier: 1.5,
  },
  slower_projectile: {
    type: "slower_projectile",
    name: "Slower Projectile",
    description: "-40% projectile speed",
    isBuff: false,
    icon: "🐢",
    speedMultiplier: 0.6,
  },
  inaccurate: {
    type: "inaccurate",
    name: "Inaccurate",
    description: "30% spread",
    isBuff: false,
    icon: "💫",
    accuracy: 0.7,
  },
};

export const useSpellSlots = create<SpellSlotsState>((set, get) => ({
  slots: [
    { id: 1, name: "Slot 1", cards: [], cooldown: 0, maxCooldown: BASE_RELOAD, isOnCooldown: false },
    { id: 2, name: "Slot 2", cards: [], cooldown: 0, maxCooldown: BASE_RELOAD, isOnCooldown: false },
    { id: 3, name: "Slot 3", cards: [], cooldown: 0, maxCooldown: BASE_RELOAD, isOnCooldown: false },
    { id: 4, name: "Slot 4", cards: [], cooldown: 0, maxCooldown: BASE_RELOAD, isOnCooldown: false },
    { id: 5, name: "Slot 5", cards: [], cooldown: 0, maxCooldown: BASE_RELOAD, isOnCooldown: false },
  ],
  activeSlotId: 1,
  availableCards: [
    // Start with some example cards
    { id: "card_1", ...CARD_LIBRARY.triple_shot },
    { id: "card_2", ...CARD_LIBRARY.homing },
    { id: "card_3", ...CARD_LIBRARY.increased_damage },
    { id: "card_4", ...CARD_LIBRARY.fast_reload },
    { id: "card_5", ...CARD_LIBRARY.reduced_range },
  ],

  setActiveSlot: (slotId) => set({ activeSlotId: slotId }),

  addCardToSlot: (slotId, card) => set((state) => ({
    slots: state.slots.map(slot => 
      slot.id === slotId 
        ? { ...slot, cards: [...slot.cards, card] }
        : slot
    )
  })),

  removeCardFromSlot: (slotId, cardId) => set((state) => ({
    slots: state.slots.map(slot =>
      slot.id === slotId
        ? { ...slot, cards: slot.cards.filter(c => c.id !== cardId) }
        : slot
    )
  })),

  startCooldown: (slotId) => {
    set(state => ({
      slots: state.slots.map(slot =>
        slot.id === slotId
          ? { ...slot, isOnCooldown: true, cooldown: slot.maxCooldown }
          : slot
      )
    }));
  },

  updateCooldowns: (delta) => {
    set(state => ({
      slots: state.slots.map(slot => {
        if (slot.isOnCooldown) {
          const newCooldown = slot.cooldown - delta;
          return {
            ...slot,
            cooldown: Math.max(0, newCooldown),
            isOnCooldown: newCooldown > 0
          };
        }
        return slot;
      })
    }));
  },

  getSlotStats: (slotId) => {
    const slot = get().slots.find(s => s.id === slotId);
    if (!slot) {
      return {
        damage: BASE_DAMAGE,
        speed: BASE_SPEED,
        range: BASE_RANGE,
        reload: 1.0,
        projectileCount: 1,
        
        homing: false,
        piercing: 0,
        bouncing: 0,
        accuracy: BASE_ACCURACY,
      };
    }

    // Calculate combined stats from all cards
    let damageMultiplier = 1.0;
    let speedMultiplier = 1.0;
    let rangeMultiplier = 1.0;
    let reloadMultiplier = 1.0;
    let projectileCount = 1;
    let homing = false;
    let piercing = 0;
    let bouncing = 0;
    let explosive: { radius: number; damage: number } | undefined;
    let chainLightning: { chains: number; range: number } | undefined;
    let accuracy = BASE_ACCURACY;

    slot.cards.forEach(card => {
      if (card.damageMultiplier) damageMultiplier *= card.damageMultiplier;
      if (card.speedMultiplier) speedMultiplier *= card.speedMultiplier;
      if (card.rangeMultiplier) rangeMultiplier *= card.rangeMultiplier;
      if (card.reloadMultiplier) reloadMultiplier *= card.reloadMultiplier;
      if (card.projectileCount) projectileCount = Math.max(projectileCount, card.projectileCount);
      if (card.homing) homing = true;
      if (card.piercing) piercing = Math.max(piercing, card.piercing);
      if (card.bouncing) bouncing = Math.max(bouncing, card.bouncing);
      if (card.explosive) explosive = card.explosive;
      if (card.chainLightning) chainLightning = card.chainLightning;
      if (card.accuracy) accuracy = Math.min(accuracy, card.accuracy);
    });

    return {
      damage: BASE_DAMAGE * damageMultiplier,
      speed: BASE_SPEED * speedMultiplier,
      range: BASE_RANGE * rangeMultiplier,
      reload: reloadMultiplier,
      projectileCount,
      homing,
      piercing,
      bouncing,
      explosive,
      chainLightning,
      accuracy,
      cooldown: slot.cooldown,
      maxCooldown: slot.maxCooldown,
    };
  },

  reset: () => set({
    slots: [
      { id: 1, name: "Slot 1", cards: [], cooldown: 0, maxCooldown: BASE_RELOAD, isOnCooldown: false },
      { id: 2, name: "Slot 2", cards: [], cooldown: 0, maxCooldown: BASE_RELOAD, isOnCooldown: false },
      { id: 3, name: "Slot 3", cards: [], cooldown: 0, maxCooldown: BASE_RELOAD, isOnCooldown: false },
      { id: 4, name: "Slot 4", cards: [], cooldown: 0, maxCooldown: BASE_RELOAD, isOnCooldown: false },
      { id: 5, name: "Slot 5", cards: [], cooldown: 0, maxCooldown: BASE_RELOAD, isOnCooldown: false },
    ],
    activeSlotId: 1,
  }),
}));