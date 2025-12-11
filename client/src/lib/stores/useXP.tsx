import { create } from "zustand";
import { usePlayer } from "./usePlayer";
import { useGame } from "./useGame";

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  icon: string;
  apply: () => void;
}

interface XPState {
  xp: number;
  level: number;
  xpToNextLevel: number;
  showLevelUpScreen: boolean;
  availableUpgrades: Upgrade[];

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

const generateRandomUpgrades = (): Upgrade[] => {
  const allUpgrades: Upgrade[] = [
    {
      id: "health",
      name: "Max Health +1",
      description: "Increase your maximum health by 1 heart. Current health is also restored.",
      icon: "❤️",
      apply: () => {
        const player = usePlayer.getState();
        usePlayer.setState({
          maxHearts: player.maxHearts + 1,
          hearts: player.hearts + 1,
        });
      },
    },
    {
      id: "speed",
      name: "Movement Speed",
      description: "Increase your movement speed by 15%. Move faster to dodge enemy attacks.",
      icon: "⚡",
      apply: () => {
        const player = usePlayer.getState();
        usePlayer.setState({ speed: player.speed * 1.15 });
      },
    },
    {
      id: "damage",
      name: "Damage Boost",
      description: "Increase all weapon damage by 20%. Deal more damage to enemies.",
      icon: "💥",
      apply: () => {
        const player = usePlayer.getState();
        usePlayer.setState({ baseDamage: player.baseDamage * 1.2 });
      },
    },
    {
      id: "firerate",
      name: "Fire Rate",
      description: "Decrease time between shots by 15%. Fire your weapon faster.",
      icon: "🔥",
      apply: () => {
        const player = usePlayer.getState();
        usePlayer.setState({ firerate: player.firerate * 0.85 });
      },
    },
    {
      id: "reload",
      name: "Fast Reload",
      description: "Reduce reload time by 20%. Get back into the fight faster.",
      icon: "🔄",
      apply: () => {
        const player = usePlayer.getState();
        usePlayer.setState({ reloadTime: player.reloadTime * 0.8 });
      },
    },
    {
      id: "ammo",
      name: "Extended Magazine",
      description: "Increase maximum ammo capacity by 2 rounds.",
      icon: "🎯",
      apply: () => {
        const player = usePlayer.getState();
        usePlayer.setState({
          maxAmmo: player.maxAmmo + 2,
          ammo: player.ammo + 2,
        });
      },
    },
    {
      id: "projectile_speed",
      name: "Projectile Speed",
      description: "Increase projectile speed by 25%. Your bullets travel faster.",
      icon: "🚀",
      apply: () => {
        const player = usePlayer.getState();
        usePlayer.setState({ baseProjectileSpeed: player.baseProjectileSpeed * 1.25 });
      },
    },
    {
      id: "range",
      name: "Extended Range",
      description: "Increase projectile range by 30%. Hit enemies from further away.",
      icon: "🎪",
      apply: () => {
        const player = usePlayer.getState();
        usePlayer.setState({ baseProjectileRange: player.baseProjectileRange * 1.3 });
      },
    },
    {
      id: "piercing",
      name: "Piercing Shots",
      description: "Your bullets can pierce through one additional enemy.",
      icon: "🗡️",
      apply: () => {
        const player = usePlayer.getState();
        usePlayer.setState({ piercing: player.piercing + 1 });
      },
    },
    {
      id: "homing",
      name: "Homing Projectiles",
      description: "Your projectiles seek out enemies automatically.",
      icon: "🎯",
      apply: () => {
        const player = usePlayer.getState();
        usePlayer.setState({ homing: true });
      },
    },
    {
      id: "bouncing",
      name: "Bouncing Shots",
      description: "Your bullets bounce off walls.",
      icon: "⚡",
      apply: () => {
        const player = usePlayer.getState();
        usePlayer.setState({ bouncing: Math.max(player.bouncing + 1, 2) });
      },
    },
    {
      id: "triple_shot",
      name: "Triple Shot",
      description: "Fire 3 projectiles at once.",
      icon: "🔱",
      apply: () => {
        const player = usePlayer.getState();
        usePlayer.setState({ projectileCount: 3 });
      },
    },
    {
      id: "explosive",
      name: "Explosive Rounds",
      description: "Your projectiles explode on impact, dealing damage to nearby enemies.",
      icon: "💣",
      apply: () => {
        usePlayer.setState({ explosive: { radius: 4, damage: 15 } });
      },
    },
    {
      id: "chain_lightning",
      name: "Chain Lightning",
      description: "Your projectiles chain to nearby enemies.",
      icon: "⚡",
      apply: () => {
        usePlayer.setState({ chainLightning: { chains: 3, range: 5 } });
      },
    },
    {
      id: "accuracy",
      name: "Improved Accuracy",
      description: "Reduce bullet spread by 20%. Hit your targets more consistently.",
      icon: "🎯",
      apply: () => {
        const player = usePlayer.getState();
        usePlayer.setState({ accuracy: Math.min(player.accuracy * 1.2, 1.0) });
      },
    },
  ];

  const shuffled = [...allUpgrades].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
};

export const useXP = create<XPState>((set, get) => ({
  xp: 0,
  level: 1,
  xpToNextLevel: calculateXPForLevel(1),
  showLevelUpScreen: false,
  availableUpgrades: [],

  addXP: (amount) => {
    const state = get();
    const newXP = state.xp + amount;

    if (newXP >= state.xpToNextLevel) {
      // Level up!
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
      availableUpgrades: generateRandomUpgrades(),
    });

    // Pause the game
    useGame.getState().pause();
  },

  selectUpgrade: (upgrade) => {
    upgrade.apply();
    set({
      showLevelUpScreen: false,
      availableUpgrades: [],
    });

    // Resume the game
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
    }),
}));