// client/src/lib/stores/usePlayer.tsx - WITH INTEGRATED XP SYSTEM
import { create } from "zustand";
import * as THREE from "three";
import { useSummons } from "./useSummons";
import { useGame } from "./useGame";

// ============================================================================
// UPGRADE TYPES
// ============================================================================

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  icon: string | SpriteIcon;
  category: string;
  tier: number;
  requires?: string[];
  apply: () => void;
}

export interface SpriteIcon {
  normal: string;
  selected: string;
}

// ============================================================================
// PLAYER STATE INTERFACE
// ============================================================================

interface PlayerState {
  // Position & Movement
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  speed: number;
  isMoving: boolean;
  lastMovementTime: number;

  // Health
  hearts: number;
  maxHearts: number;
  invincibilityTimer: number;
  invincibilityDuration: number;
  defense: number;

  // Combat Stats
  firerate: number;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  reloadTime: number;
  reloadProgress: number;
  isFiring: boolean;

  baseDamage: number;
  baseProjectileSpeed: number;
  baseProjectileRange: number;
  projectileSize: number;
  projectileCount: number;
  life: number,
  homing: boolean;
  piercing: number;
  bouncing: number;
  accuracy: number;
  trailLength: number;
  explosive?: { radius: number; damage: number };
  chainLightning?: { chains: number; range: number };
  

  // Special Upgrades
  knockbackMultiplier: number;
  instantKillThreshold: number;
  splinterBullets: boolean;
  pierceKilledEnemies: boolean;
  siegeMode: boolean;
  fanFire: boolean;
  splitFire: boolean;
  freshClip: boolean;
  freshClipActive: boolean;
  freshClipTimer: number;
  killClip: boolean;
  killClipStacks: number;

  muzzleFlashTimer: number;
  fanFireActive: boolean;
  fanFireIndex: number;
  fanFireTimer: number;

  // XP & LEVELING
  xp: number;
  level: number;
  xpToNextLevel: number;
  showLevelUpScreen: boolean;
  availableUpgrades: Upgrade[];
  takenUpgrades: Set<string>;

  // Actions - Movement & Combat
  move: (delta: THREE.Vector3) => void;
  loseHeart: () => void;
  updateInvincibility: (delta: number) => void;
  setFiring: (val: boolean) => void;
  setMoving: (val: boolean) => void;
  fireShot: () => boolean;
  startReload: () => void;
  updateReload: (delta: number) => void;
  addKillClipStack: () => void;
  updateFreshClip: (delta: number) => void;
  getProjectileStats: () => {
    damage: number;
    speed: number;
    range: number;
    life: number;
    projectileSize: number;
    projectileCount: number;
    homing: boolean;
    piercing: number;
    bouncing: number;
    accuracy: number;
    trailLength: number;
    explosive?: { radius: number; damage: number };
    chainLightning?: { chains: number; range: number };
  };

  // Actions - Fan Fire
  startFanFire: () => void;
  updateFanFire: (delta: number, fireCallback: () => void) => void;
  fireMuzzleFlash: () => void;
  updateMuzzleFlash: (delta: number) => void;

  // Actions - XP & Leveling
  addXP: (amount: number) => void;
  levelUp: () => void;
  selectUpgrade: (upgrade: Upgrade) => void;
  setShowLevelUpScreen: (show: boolean) => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// XP CALCULATION
// ============================================================================

const calculateXPForLevel = (level: number): number => {
  return Math.floor(10 + level * 15 + Math.pow(level, 1.5) * 5);
};

const ALL_UPGRADES: Record<string, Upgrade> = {
  // FAST BULLETS TREE
  take_aim: {
    id: "take_aim",
    name: "Take Aim",
    description: "Bullet Speed +30%, Spread -15%",
    icon: {
      normal: "/sprites/upgrades/speed/take_aim.png",
      selected: "/sprites/upgrades/speed/take_aim_selected.png",
    },
    category: "speed",
    tier: 1,
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        baseProjectileSpeed: player.baseProjectileSpeed * 1.3,
        accuracy: Math.min(1.0, player.accuracy * 1.15),
      });
    },
  },

  penetration: {
    id: "penetration",
    name: "Penetration",
    description: "Bullet Speed +15%, Piercing +1",
    icon: "➡️",
    category: "speed",
    tier: 2,
    requires: ["take_aim"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        baseProjectileSpeed: player.baseProjectileSpeed * 1.15,
        piercing: player.piercing + 1,
      });
    },
  },

  sniper: {
    id: "sniper",
    name: "Sniper",
    description: "Bullet Speed +25%, Bullet Damage +15%",
    icon: "🎯",
    category: "speed",
    tier: 2,
    requires: ["take_aim"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        baseProjectileSpeed: player.baseProjectileSpeed * 1.25,
        baseDamage: player.baseDamage * 1.15,
      });
    },
  },

  assassin: {
    id: "assassin",
    name: "Assassin",
    description: "Instant-kill enemies below 20% HP",
    icon: "💀",
    category: "speed",
    tier: 3,
    requires: ["sniper", "penetration"],
    apply: () => {
      usePlayer.setState({ instantKillThreshold: 0.2 });
    },
  },

  // BULLET DAMAGE TREE
  power_shot: {
    id: "power_shot",
    name: "Power Shot",
    description: "Bullet Damage +40%, Knockback +20%",
    icon: {
      normal: "/sprites/upgrades/damage/power_shot.png",
      selected: "/sprites/upgrades/damage/power_shot_selected.png",
    },
    category: "damage",
    tier: 1,
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        baseDamage: player.baseDamage * 1.4,
        knockbackMultiplier: (player.knockbackMultiplier || 1) * 1.2,
      });
    },
  },

  big_shot: {
    id: "big_shot",
    name: "Big Shot",
    description: "Bullet Damage +45%, Bullet Size +40%",
    icon: "🔵",
    category: "damage",
    tier: 2,
    requires: ["power_shot"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        baseDamage: player.baseDamage * 1.45,
        projectileSize: (player.projectileSize || 1) * 1.4,
      });
    },
  },

  splinter: {
    id: "splinter",
    name: "Splinter",
    description: "Killed enemies explode into 3 bullets dealing 10% damage",
    icon: "💢",
    category: "damage",
    tier: 2,
    requires: ["power_shot"],
    apply: () => {
      usePlayer.setState({ splinterBullets: true });
    },
  },

  reaper_rounds: {
    id: "reaper_rounds",
    name: "Reaper Rounds",
    description: "Damage +20%, Piercing +1, bullets pierce killed enemies",
    icon: "☠️",
    category: "damage",
    tier: 3,
    requires: ["splinter", "big_shot"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        baseDamage: player.baseDamage * 1.2,
        piercing: player.piercing + 1,
        pierceKilledEnemies: true,
      });
    },
  },

  // FIRE RATE TREE
  rapid_fire: {
    id: "rapid_fire",
    name: "Rapid Fire",
    description: "Fire Rate +25%",
    icon: {
      normal: "/sprites/upgrades/firerate/rapid_fire.png",
      selected: "/sprites/upgrades/firerate/rapid_fire_selected.png",
    },
    category: "firerate",
    tier: 1,
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({ firerate: player.firerate * 0.75 });
    },
  },

  light_bullets: {
    id: "light_bullets",
    name: "Light Bullets",
    description: "Fire Rate +15%, Max Ammo +1, Bullet Speed +15%",
    icon: "⚡",
    category: "firerate",
    tier: 2,
    requires: ["rapid_fire"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        firerate: player.firerate * 0.85,
        maxAmmo: player.maxAmmo + 1,
        ammo: player.ammo + 1,
        baseProjectileSpeed: player.baseProjectileSpeed * 1.15,
      });
    },
  },

  rubber_bullets: {
    id: "rubber_bullets",
    name: "Rubber Bullets",
    description: "Bullet Bounce +1, Fire Rate +10%",
    icon: "🏀",
    category: "firerate",
    tier: 2,
    requires: ["rapid_fire"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        bouncing: player.bouncing + 1,
        firerate: player.firerate * 0.9,
      });
    },
  },

  siege: {
    id: "siege",
    name: "Siege",
    description: "While standing still: 40% chance to not consume ammo",
    icon: "🛡️",
    category: "firerate",
    tier: 3,
    requires: ["light_bullets", "rubber_bullets"],
    apply: () => {
      usePlayer.setState({ siegeMode: true });
    },
  },

  // MULTI SHOTS TREE
  double_shot: {
    id: "double_shot",
    name: "Double Shot",
    description: "Projectiles +1, Spread +10%, Bullet Damage -10%",
    icon: "🔱",
    category: "multishot",
    tier: 1,
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        projectileCount: player.projectileCount + 1,
        accuracy: player.accuracy * 0.9,
        baseDamage: player.baseDamage * 0.9,
      });
    },
  },

  fan_fire: {
    id: "fan_fire",
    name: "Fan Fire",
    description: "On last ammo: shoot 10 bullets in a circle at 15% damage",
    icon: "🌟",
    category: "multishot",
    tier: 2,
    requires: ["double_shot"],
    apply: () => {
      usePlayer.setState({ fanFire: true });
    },
  },

  split_fire: {
    id: "split_fire",
    name: "Split Fire",
    description: "Shoots an additional bullet behind you",
    icon: "↔️",
    category: "multishot",
    tier: 2,
    requires: ["double_shot"],
    apply: () => {
      usePlayer.setState({ splitFire: true });
    },
  },

  fusillade: {
    id: "fusillade",
    name: "Fusillade",
    description: "Projectiles +1, Spread +15%, Damage -25%, doubles base projectiles",
    icon: "💫",
    category: "multishot",
    tier: 3,
    requires: ["fan_fire", "split_fire"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        projectileCount: (player.projectileCount + 1) * 2,
        accuracy: player.accuracy * 0.85,
        baseDamage: player.baseDamage * 0.75,
      });
    },
  },

  // RELOAD TREE
  quick_hands: {
    id: "quick_hands",
    name: "Quick Hands",
    description: "Reload Rate +20%, Fire Rate +5%",
    icon: "🔄",
    category: "reload",
    tier: 1,
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        reloadTime: player.reloadTime * 0.8,
        firerate: player.firerate * 0.95,
      });
    },
  },

  armed_ready: {
    id: "armed_ready",
    name: "Armed & Ready",
    description: "Reload Rate +10%, Max Ammo +2",
    icon: "📦",
    category: "reload",
    tier: 2,
    requires: ["quick_hands"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        reloadTime: player.reloadTime * 0.9,
        maxAmmo: player.maxAmmo + 2,
      });
    },
  },

  fresh_clip: {
    id: "fresh_clip",
    name: "Fresh Clip",
    description: "Reload Rate +5%; after reload, Damage +50% for 1s",
    icon: "✨",
    category: "reload",
    tier: 2,
    requires: ["quick_hands"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        reloadTime: player.reloadTime * 0.95,
        freshClip: true,
      });
    },
  },

  kill_clip: {
    id: "kill_clip",
    name: "Kill Clip",
    description: "Reload Rate increases with kills (resets on reload)",
    icon: "💀",
    category: "reload",
    tier: 3,
    requires: ["armed_ready", "fresh_clip"],
    apply: () => {
      usePlayer.setState({ killClip: true });
    },
  },

  // SUMMON TREES
  ghost_friend: {
    id: "ghost_friend",
    name: "Ghost Friend",
    description: "Summon a Ghost Friend that fires piercing projectiles for 8 damage",
    icon: "👻",
    category: "summon",
    tier: 1,
    apply: () => {
      const { addSummon } = useSummons.getState();
      addSummon("ghost");
    },
  },

  best_friends: {
    id: "best_friends",
    name: "Best Friends",
    description: "Fire Rate +10%. Ghost attacks 50% faster",
    icon: "💕",
    category: "summon",
    tier: 2,
    requires: ["ghost_friend"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({ firerate: player.firerate * 0.9 });
      useSummons.setState({ ghostFireRate: 0.5 * 0.5 });
    },
  },

  ghost_wizard: {
    id: "ghost_wizard",
    name: "Ghost Wizard",
    description: "Ghost projectiles inflict Burn for 6 damage/s",
    icon: "🔮",
    category: "summon",
    tier: 3,
    requires: ["best_friends"],
    apply: () => {
      useSummons.setState({ ghostBurn: true });
    },
  },

  vengeful_ghost: {
    id: "vengeful_ghost",
    name: "Vengeful Ghost",
    description: "Ghost shoots 2 additional projectiles (total 3)",
    icon: "😈",
    category: "summon",
    tier: 4,
    requires: ["ghost_wizard"],
    apply: () => {
      useSummons.setState({ ghostProjectiles: 3 });
    },
  },

  magic_scythe: {
    id: "magic_scythe",
    name: "Magic Scythe",
    description: "Summon a Magic Scythe that orbits and deals 40 damage on contact",
    icon: "🗡️",
    category: "summon",
    tier: 1,
    apply: () => {
      const { addSummon } = useSummons.getState();
      addSummon("scythe");
    },
  },

  shadowblade: {
    id: "shadowblade",
    name: "Shadowblade",
    description: "Scythe inflicts Curse: 200% bullet damage after 1s. Curse +15%",
    icon: "⚫",
    category: "summon",
    tier: 2,
    requires: ["magic_scythe"],
    apply: () => {
      useSummons.setState({
        scytheCurse: true,
        curseDamageBonus: 0.15,
      });
    },
  },

  windcutter: {
    id: "windcutter",
    name: "Windcutter",
    description: "Move Speed +10%. Scythe damage scales with Move Speed",
    icon: "💨",
    category: "summon",
    tier: 3,
    requires: ["shadowblade"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({ speed: player.speed * 1.1 });
      useSummons.setState({ scytheSpeedBonus: true });
    },
  },

  scythe_mastery: {
    id: "scythe_mastery",
    name: "Scythe Mastery",
    description: "Bullet Damage +10%. Scythe damage scales with Bullet Damage",
    icon: "⚔️",
    category: "summon",
    tier: 4,
    requires: ["windcutter"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({ baseDamage: player.baseDamage * 1.1 });
      useSummons.setState({ scytheDamageBonus: true });
    },
  },

  magic_spear: {
    id: "magic_spear",
    name: "Magic Spear",
    description: "Summon 2 Magic Spears that orbit and deal 20 damage",
    icon: "🔱",
    category: "summon",
    tier: 1,
    apply: () => {
      const { addSummon } = useSummons.getState();
      addSummon("spear");
    },
  },

  holy_spear: {
    id: "holy_spear",
    name: "Holy Spear",
    description: "Spear deals +10 damage for every Max HP you have",
    icon: "✨",
    category: "summon",
    tier: 2,
    requires: ["magic_spear"],
    apply: () => {
      useSummons.setState({ spearHolyBonus: true });
    },
  },

  soul_drain: {
    id: "soul_drain",
    name: "Soul Drain",
    description: "Every 500th enemy killed by a summon drops a Heart",
    icon: "💜",
    category: "summon",
    tier: 3,
    requires: ["holy_spear"],
    apply: () => {
      useSummons.setState({ soulDrain: true });
    },
  },

  soul_knight: {
    id: "soul_knight",
    name: "Soul Knight",
    description: "Spear gains +15 damage for every Soul Heart",
    icon: "🛡️",
    category: "summon",
    tier: 4,
    requires: ["soul_drain"],
    apply: () => {
      useSummons.setState({ soulKnight: true });
    },
  },

  electro_bug: {
    id: "electro_bug",
    name: "Electro Bug",
    description: "Summon an Electro Bug that strikes 2 nearby enemies with Lightning",
    icon: "🐛",
    category: "summon",
    tier: 1,
    apply: () => {
      const { addSummon } = useSummons.getState();
      addSummon("electrobug");
    },
  },

  energized: {
    id: "energized",
    name: "Energized",
    description: "Lightning strikes have 20% chance to refill 3 ammo",
    icon: "⚡",
    category: "summon",
    tier: 2,
    requires: ["electro_bug"],
    apply: () => {
      useSummons.setState({ energized: true });
    },
  },

  electro_mastery: {
    id: "electro_mastery",
    name: "Electro Mastery",
    description: "All Lightning damage +12",
    icon: "🌩️",
    category: "summon",
    tier: 3,
    requires: ["energized"],
    apply: () => {
      useSummons.setState({ electroMastery: true });
    },
  },
};

// ============================================================================
// UPGRADE GENERATION
// ============================================================================

const generateRandomUpgrades = (takenUpgrades: Set<string>): Upgrade[] => {
  const available = Object.values(ALL_UPGRADES).filter(upgrade => {
    if (takenUpgrades.has(upgrade.id)) return false;
    if (upgrade.requires && upgrade.requires.length > 0) {
      const hasRequirement = upgrade.requires.some(req => takenUpgrades.has(req));
      if (!hasRequirement) return false;
    }
    return true;
  });

  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 9);
};

// ============================================================================
// PLAYER STORE
// ============================================================================

export const usePlayer = create<PlayerState>((set, get) => ({
  // Position & Movement
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  speed: 10,
  isMoving: false,
  lastMovementTime: 0,

  // Health
  hearts: 5,
  maxHearts: 5,
  invincibilityTimer: 0,
  invincibilityDuration: 3,
  defense: 0,

  // Combat
  firerate: 0.5,
  ammo: 6,
  maxAmmo: 6,
  reloadTime: 1,
  isReloading: false,
  reloadProgress: 0,
  isFiring: false,
  
  baseDamage: 13,
  baseProjectileSpeed: 60,
  baseProjectileRange: 50,
  projectileCount: 1,
  life: 3.0,
  projectileSize: 96.0,
  homing: false,
  piercing: 0,
  bouncing: 0,
  accuracy: 1.0,
  trailLength: 80,
  explosive: undefined,
  chainLightning: undefined,
  
  

  // Special Upgrades
  knockbackMultiplier: 1.0,
  instantKillThreshold: 0,
  splinterBullets: false,
  pierceKilledEnemies: false,
  siegeMode: false,
  fanFire: false,
  splitFire: false,
  freshClip: false,
  freshClipActive: false,
  freshClipTimer: 0,
  killClip: false,
  killClipStacks: 0,

  muzzleFlashTimer: 0,
  fanFireActive: false,
  fanFireIndex: 0,
  fanFireTimer: 0,

  // XP & Leveling
  xp: 20,
  level: 1,
  xpToNextLevel: calculateXPForLevel(1),
  showLevelUpScreen: false,
  availableUpgrades: [],
  takenUpgrades: new Set<string>(),

  // === XP ACTIONS ===

  addXP: (amount) => {
    const state = get();
    const newXP = state.xp + amount;

    if (newXP >= state.xpToNextLevel) {
      get().levelUp();
    } else {
      set({ xp: newXP });
    }
  },

  levelUp: () => {
    const state = get();
    const newLevel = state.level + 1;
    const newXPRequired = calculateXPForLevel(newLevel);

    set({
      level: newLevel,
      xp: 0,
      xpToNextLevel: newXPRequired,
      showLevelUpScreen: true,
      availableUpgrades: generateRandomUpgrades(state.takenUpgrades),
    });

    useGame.getState().pause();
  },

  selectUpgrade: (upgrade) => {
    upgrade.apply();

    const newTaken = new Set(get().takenUpgrades);
    newTaken.add(upgrade.id);

    set({
      showLevelUpScreen: false,
      availableUpgrades: [],
      takenUpgrades: newTaken,
    });

    useGame.getState().resume();
  },

  setShowLevelUpScreen: (show) => set({ showLevelUpScreen: show }),

  // === COMBAT ACTIONS ===

  startFanFire: () => set({
    fanFireActive: true,
    fanFireIndex: 0,
    fanFireTimer: 0,
  }),

  updateFanFire: (delta, fireCallback) => set((state) => {
    if (!state.fanFireActive) return {};

    const newTimer = state.fanFireTimer + delta;
    const intervalTime = state.reloadTime / 10;

    if (newTimer >= intervalTime && state.fanFireIndex < 10) {
      fireCallback();
      return {
        fanFireTimer: 0,
        fanFireIndex: state.fanFireIndex + 1,
      };
    }

    if (state.fanFireIndex >= 10) {
      return {
        fanFireActive: false,
        fanFireIndex: 0,
        fanFireTimer: 0,
      };
    }

    return { fanFireTimer: newTimer };
  }),

  fireMuzzleFlash: () => set({ muzzleFlashTimer: 0.02 }),

  updateMuzzleFlash: (delta) => set((state) => {
    if (state.muzzleFlashTimer <= 0) return {};
    return { muzzleFlashTimer: Math.max(state.muzzleFlashTimer - delta, 0) };
  }),

  setFiring: (val) => set({ isFiring: val }),

  setMoving: (val) => {
    const state = get();
    if (val && !state.isMoving) {
      set({ isMoving: true, lastMovementTime: Date.now() });
    } else if (!val) {
      set({ isMoving: false });
    }
  },

  fireShot: () => {
    const state = get();
    if (state.ammo > 0 && !state.isReloading) {
      const isStandingStill = Date.now() - state.lastMovementTime > 500;
      if (state.siegeMode && isStandingStill && Math.random() < 0.4) {
        return true;
      }
      set({ ammo: state.ammo - 1 });
      return true;
    }
    return false;
  },

  getProjectileStats: () => {
    const state = get();
    let damageMultiplier = 1.0;
    if (state.freshClipActive) {
      damageMultiplier = 1.5;
    }

    return {
      damage: state.baseDamage * damageMultiplier,
      speed: state.baseProjectileSpeed,
      range: state.baseProjectileRange,
      life: state.life,
      projectileCount: state.projectileCount,
      homing: state.homing,
      piercing: state.piercing,
      bouncing: state.bouncing,
      explosive: state.explosive,
      chainLightning: state.chainLightning,
      accuracy: state.accuracy,
      knockbackMultiplier: state.knockbackMultiplier,
      projectileSize: state.projectileSize,
      trailLength: state.trailLength,
    };
  },

  startReload: () => {
    const state = get();
    let reloadTime = state.reloadTime;
    if (state.killClip && state.killClipStacks > 0) {
      const speedBonus = Math.min(state.killClipStacks * 0.05, 0.5);
      reloadTime = reloadTime * (1 - speedBonus);
    }

    set({
      isReloading: true,
      reloadProgress: 0,
      killClipStacks: 0,
    });
  },

  updateReload: (delta) => {
    const state = get();
    if (!state.isReloading) return;

    const newProgress = state.reloadProgress + delta;

    if (newProgress >= state.reloadTime) {
      const updates: any = {
        isReloading: false,
        reloadProgress: 0,
        ammo: state.maxAmmo,
      };

      if (state.freshClip) {
        updates.freshClipActive = true;
        updates.freshClipTimer = 1.0;
      }

      set(updates);
    } else {
      set({ reloadProgress: newProgress });
    }
  },

  updateFreshClip: (delta) => {
    const state = get();
    if (!state.freshClipActive) return;

    const newTimer = state.freshClipTimer - delta;
    if (newTimer <= 0) {
      set({ freshClipActive: false, freshClipTimer: 0 });
    } else {
      set({ freshClipTimer: newTimer });
    }
  },

  addKillClipStack: () => {
    const state = get();
    if (state.killClip) {
      set({ killClipStacks: state.killClipStacks + 1 });
    }
  },

  move: (delta) => set((state) => ({
    position: state.position.clone().add(delta)
  })),

  loseHeart: () => set((state) => ({
    hearts: Math.max(state.hearts - 1, 0),
    invincibilityTimer: state.invincibilityDuration
  })),

  updateInvincibility: (delta) => set((state) => {
    if (state.invincibilityTimer <= 0) return {};
    return { invincibilityTimer: Math.max(state.invincibilityTimer - delta, 0) };
  }),

  reset: () => set({
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    hearts: 5,
    maxHearts: 5,
    invincibilityTimer: 0,
    invincibilityDuration: 3,
    firerate: 0.5,
    ammo: 6,
    maxAmmo: 6,
    isReloading: false,
    reloadTime: 1.1,
    reloadProgress: 0,
    isFiring: false,
    isMoving: false,
    baseDamage: 13,
    baseProjectileSpeed: 60,
    baseProjectileRange: 50,
    projectileCount: 2,
    homing: false,
    piercing: 0,
    bouncing: 0,
    explosive: undefined,
    chainLightning: undefined,
    accuracy: 0.99,
    knockbackMultiplier: 1.0,
    projectileSize: 32.0,
    instantKillThreshold: 0,
    splinterBullets: false,
    pierceKilledEnemies: false,
    siegeMode: false,
    fanFire: false,
    splitFire: false,
    freshClip: false,
    freshClipActive: false,
    freshClipTimer: 0,
    killClip: false,
    killClipStacks: 0,
    lastMovementTime: 0,
    muzzleFlashTimer: 0,
    fanFireActive: false,
    fanFireIndex: 0,
    fanFireTimer: 0,
    xp: 0,
    level: 1,
    xpToNextLevel: calculateXPForLevel(1),
    showLevelUpScreen: false,
    availableUpgrades: [],
    takenUpgrades: new Set<string>(),
  })
}));