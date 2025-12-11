// client/src/lib/stores/useXP.tsx
import { create } from "zustand";
import { usePlayer } from "./usePlayer";
import { useGame } from "./useGame";

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: number; // 1, 2, 3, or 4
  requires?: string[]; // IDs of upgrades that must be taken first
  apply: () => void;
}

interface XPState {
  xp: number;
  level: number;
  xpToNextLevel: number;
  showLevelUpScreen: boolean;
  availableUpgrades: Upgrade[];
  takenUpgrades: Set<string>;

  addXP: (amount: number) => void;
  levelUp: () => void;
  selectUpgrade: (upgrade: Upgrade) => void;
  setShowLevelUpScreen: (show: boolean) => void;
  reset: () => void;
}

// Calculate XP needed for next level (exponential curve)
const calculateXPForLevel = (level: number): number => {
  return Math.floor(10 + level * 15 + Math.pow(level, 1.5) * 5);
};

// All available upgrades organized by category and tier
const ALL_UPGRADES: Record<string, Upgrade> = {
  // ============================================================================
  // FAST BULLETS TREE
  // ============================================================================

  // Tier 1
  bullet_speed: {
    id: "bullet_speed",
    name: "Fast Bullets",
    description: "Projectile Speed +30%",
    icon: "🚀",
    category: "speed",
    tier: 1,
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({ baseProjectileSpeed: player.baseProjectileSpeed * 1.3 });
    },
  },

  // Tier 2
  take_aim: {
    id: "take_aim",
    name: "Take Aim",
    description: "Bullet Speed +30%, Spread -15%",
    icon: "🎯",
    category: "speed",
    tier: 2,
    requires: ["bullet_speed"],
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
    requires: ["bullet_speed"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        baseProjectileSpeed: player.baseProjectileSpeed * 1.15,
        piercing: player.piercing + 1,
      });
    },
  },

  // Tier 3
  sniper: {
    id: "sniper",
    name: "Sniper",
    description: "Bullet Speed +25%, Bullet Damage +15%",
    icon: "🎯",
    category: "speed",
    tier: 3,
    requires: ["take_aim", "penetration"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        baseProjectileSpeed: player.baseProjectileSpeed * 1.25,
        baseDamage: player.baseDamage * 1.15,
      });
    },
  },

  // Tier 4
  assassin: {
    id: "assassin",
    name: "Assassin",
    description: "Instant-kill enemies below 20% HP",
    icon: "💀",
    category: "speed",
    tier: 4,
    requires: ["sniper"],
    apply: () => {
      usePlayer.setState({ instantKillThreshold: 0.2 });
    },
  },

  // ============================================================================
  // BULLET DAMAGE TREE
  // ============================================================================

  // Tier 1
  increased_damage: {
    id: "increased_damage",
    name: "Bullet Damage",
    description: "Bullet Damage +20%",
    icon: "💥",
    category: "damage",
    tier: 1,
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({ baseDamage: player.baseDamage * 1.2 });
    },
  },

  // Tier 2
  power_shot: {
    id: "power_shot",
    name: "Power Shot",
    description: "Bullet Damage +40%, Knockback +20%",
    icon: "💪",
    category: "damage",
    tier: 2,
    requires: ["increased_damage"],
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
    requires: ["increased_damage"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        baseDamage: player.baseDamage * 1.45,
        projectileSize: (player.projectileSize || 1) * 1.4,
      });
    },
  },

  // Tier 3
  splinter: {
    id: "splinter",
    name: "Splinter",
    description: "Killed enemies explode into 3 bullets dealing 10% damage",
    icon: "💢",
    category: "damage",
    tier: 3,
    requires: ["power_shot", "big_shot"],
    apply: () => {
      usePlayer.setState({ splinterBullets: true });
    },
  },

  // Tier 4
  reaper_rounds: {
    id: "reaper_rounds",
    name: "Reaper Rounds",
    description: "Damage +20%, Piercing +1, bullets pierce killed enemies",
    icon: "☠️",
    category: "damage",
    tier: 4,
    requires: ["splinter"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        baseDamage: player.baseDamage * 1.2,
        piercing: player.piercing + 1,
        pierceKilledEnemies: true,
      });
    },
  },

  // ============================================================================
  // FIRE RATE TREE
  // ============================================================================

  // Tier 1
  rapid_fire: {
    id: "rapid_fire",
    name: "Rapid Fire",
    description: "Fire Rate +25%",
    icon: "🔥",
    category: "firerate",
    tier: 1,
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({ firerate: player.firerate * 0.75 }); // Lower = faster
    },
  },

  // Tier 2
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

  // Tier 3
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

  // ============================================================================
  // MULTI SHOTS TREE
  // ============================================================================

  // Tier 1
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

  // Tier 2
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

  // Tier 3
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

  // ============================================================================
  // RELOAD / AMMO EFFICIENCY TREE
  // ============================================================================

  // Tier 1
  fast_reload: {
    id: "fast_reload",
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

  // Tier 2
  armed_ready: {
    id: "armed_ready",
    name: "Armed & Ready",
    description: "Reload Rate +10%, Max Ammo +2",
    icon: "📦",
    category: "reload",
    tier: 2,
    requires: ["fast_reload"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        reloadTime: player.reloadTime * 0.9,
        maxAmmo: player.maxAmmo + 2,
        ammo: player.ammo + 2,
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
    requires: ["fast_reload"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        reloadTime: player.reloadTime * 0.95,
        freshClip: true,
      });
    },
  },

  // Tier 3
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

  // ============================================================================
  // BASIC UPGRADES (always available)
  // ============================================================================

  health: {
    id: "health",
    name: "Max Health +1",
    description: "Increase maximum health by 1 heart. Current health restored.",
    icon: "❤️",
    category: "basic",
    tier: 1,
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        maxHearts: player.maxHearts + 1,
        hearts: player.hearts + 1,
      });
    },
  },

  speed: {
    id: "speed",
    name: "Movement Speed",
    description: "Increase movement speed by 15%",
    icon: "⚡",
    category: "basic",
    tier: 1,
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({ speed: player.speed * 1.15 });
    },
  },

  ammo: {
    id: "ammo",
    name: "Extended Magazine",
    description: "Increase maximum ammo capacity by 2 rounds",
    icon: "🎯",
    category: "basic",
    tier: 1,
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        maxAmmo: player.maxAmmo + 2,
        ammo: player.ammo + 2,
      });
    },
  },
};

const generateRandomUpgrades = (takenUpgrades: Set<string>): Upgrade[] => {
  // Get available upgrades based on what's been taken
  const available = Object.values(ALL_UPGRADES).filter(upgrade => {
    // Skip if already taken
    if (takenUpgrades.has(upgrade.id)) return false;

    // Check requirements
    if (upgrade.requires && upgrade.requires.length > 0) {
      // For tier 2-3: need at least one requirement
      // For tier 4: need the specific tier 3 requirement
      const hasRequirement = upgrade.requires.some(req => takenUpgrades.has(req));
      if (!hasRequirement) return false;
    }

    return true;
  });

  // Shuffle and pick 3
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
};

export const useXP = create<XPState>((set, get) => ({
  xp: 0,
  level: 1,
  xpToNextLevel: calculateXPForLevel(1),
  showLevelUpScreen: false,
  availableUpgrades: [],
  takenUpgrades: new Set<string>(),

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

  reset: () =>
    set({
      xp: 0,
      level: 1,
      xpToNextLevel: calculateXPForLevel(1),
      showLevelUpScreen: false,
      availableUpgrades: [],
      takenUpgrades: new Set<string>(),
    }),
}));