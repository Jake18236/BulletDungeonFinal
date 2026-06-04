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
  icon: number;
  category: string;
  requires?: string[];
  apply: () => void;
}


// ============================================================================
// PLAYER STATE INTERFACE
// ============================================================================

interface PlayerState {

  position: THREE.Vector3;
  velocity: THREE.Vector3;
  speed: number;
  isMoving: boolean;
  lastMovementTime: number;

  hearts: number;
  maxHearts: number;
  invincibilityTimer: number;
  invincibilityDuration: number;
  defense: number;

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
  life: number;
  homing: boolean;
  incendiary: boolean;
  piercing: number;
  bouncing: number;
  accuracy: number;
  trailLength: number;
  explosive?: { radius: number; damage: number };
  chainLightning?: { chains: number; range: number };
  lastAmmoExplosive: boolean;
  magnetRange: number;
  speedWhenFiring: number;
  healPerLevelUp: number;

  knockbackMultiplier: number;
  instantKillThreshold: number;
  splinterBullets: boolean;
  pierceKilledEnemies: boolean;
  railgun: boolean;
  handCannon: boolean;
  siegeMode: boolean;
  fanFire: boolean;
  splitFire: boolean;
  freshClip: boolean;
  freshClipActive: boolean;
  freshClipTimer: number;
  killClip: boolean;
  killClipStacks: number;
  speedFiringBonus: number;

  regeneration: boolean;
  regenerationInterval: number;
  regenerationTimer: number;

  burnDurationMultiplier: number;

  muzzleFlashTimer: number;
  muzzleFlashPosition: THREE.Vector3 | null;
  fanFireActive: boolean;
  fanFireIndex: number;
  fanFireTimer: number;

  visionRange: number;
  cameraZoom: number;

  damageFlashTimer: number;
  damageFlashPosition: THREE.Vector3 | null;
  lastDamageKnockback: THREE.Vector3 | null;

  xp: number;
  level: number;
  xpToNextLevel: number;
  showLevelUpScreen: boolean;
  availableUpgrades: Upgrade[];
  takenUpgrades: Set<string>;

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

  startFanFire: () => void;
  updateFanFire: (delta: number, fireCallback: () => void) => void;
  fireMuzzleFlash: (position: THREE.Vector3) => void;
  updateMuzzleFlash: () => void;

  addXP: (amount: number) => void;
  levelUp: () => void;
  selectUpgrade: (upgrade: Upgrade) => void;
  setShowLevelUpScreen: (show: boolean) => void;

  triggerDamageFlash: (
    position: THREE.Vector3,
    knockback: THREE.Vector3,
  ) => void;
  updateDamageFlash: (delta: number) => void;

  updateRegeneration: (delta: number) => void;

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
    icon: 59,
    category: "speed",

    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        baseProjectileSpeed: player.baseProjectileSpeed * 1.3,
        accuracy: Math.min(1.0, player.accuracy * 1.15),
      });
    },
  }, //

  penetration: {
    id: "penetration",
    name: "Penetration",
    description: "Bullet Speed +15%, Piercing +1",
    icon: 61,
    category: "speed",
 
    requires: ["take_aim"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        baseProjectileSpeed: player.baseProjectileSpeed * 1.15,
        piercing: player.piercing + 1,
      });
    },
  },

  regeneration: {
    id: "regeneration",
    name: "Regeneration",
    description: "Heal 1 HP every 50 seconds",
    icon: 28,
    category: "buff",
    
    requires: ["fleet_footed"],
    apply: () => {
      usePlayer.setState({
        regeneration: true,
        regenerationInterval: 50,
      });
    },
  },

  wildfire: {
    id: "wildfire",
    name: "Wildfire",
    description: "Summons inflict Burn. Burn duration +100%",
    icon: 42,
    category: "summon",
    
    requires: ["ghost_wizard", "electro_mastery"],
    apply: () => {
      usePlayer.setState({
        burnDurationMultiplier: 2,
      });

      useSummons.setState({
        summonBurn: true, // Enable burn effect on summons
      });
    },
  },

  master_summoner: {
    id: "master_summoner",
    name: "Master Summoner",
    description: "Summon Attack Speed +50%, Bullet Damage -25%",
    icon: 4,
    category: "summon",
    
    requires: ["wildfire", "blade_dance"],
    apply: () => {
      const player = usePlayer.getState();

      usePlayer.setState({
        baseDamage: player.baseDamage * 0.75,
      });

      useSummons.setState({
        summonAttackSpeedMultiplier:
          (useSummons.getState().summonAttackSpeedMultiplier || 1) * 1.5,
      });
    },
  },

  sharpened_edge: {
    id: "sharpened_edge",
    name: "Sharpen",
    description: "All Summon Damage +40%",
    icon: 53,
    category: "summon",
    
    requires: ["magic_dagger"],
    apply: () => {
      useSummons.setState({
        summonDamageMultiplier:
          (useSummons.getState().summonDamageMultiplier || 1) * 1.4,
      });
    },
  },

  blade_dance: {
    id: "blade_dance",
    name: "Blade Dance",
    description: "Summon 2 additional Daggers",
    icon: 54,
    category: "summon",
    
    requires: ["sharpened_edge"],
    apply: () => {
      const { addSummon } = useSummons.getState();

      addSummon("dagger");
      addSummon("dagger");
    },
  },

  stormcaller: {
    id: "stormcaller",
    name: "Stormcaller",
    description:
      "Every 15 seconds, all enemies in range are struck by lightning",
    icon: 34,
    category: "summon",
    
    requires: ["energized"],
    apply: () => {
      useSummons.setState({
        stormcaller: true,
        stormcallerCooldown: 15,
      });
    },
  },

  minigun: {
    id: "minigun",
    name: "Bullet Spray",
    description:
      "Max Ammo x3, Spread +50%, Knockback -90%, Fire Rate +50%, Bullet Damage -50%",
    icon: 23,
    category: "reload",
    
    requires: ["armed_ready", "fresh_clip"],
    apply: () => {
      const player = usePlayer.getState();

      const newAmmo = player.maxAmmo * 3;

      usePlayer.setState({
        maxAmmo: newAmmo,
        ammo: player.ammo + (newAmmo - player.maxAmmo),
        accuracy: player.accuracy * (1 / 1.5),
        knockbackMultiplier: (player.knockbackMultiplier || 1) * 0.1,
        firerate: player.firerate * (1 / 1.5),
        baseDamage: player.baseDamage * 0.5,
      });
    },
  },

  sniper: {
    id: "sniper",
    name: "Sniper",
    description: "Bullet Speed +25%, Bullet Damage +15%",
    icon: 60,
    category: "speed",
    
    requires: ["take_aim"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        baseProjectileSpeed: player.baseProjectileSpeed * 1.25,
        baseDamage: player.baseDamage * 1.15,
      });
    },
  },

  hyper_rounds: {
    id: "hyper_rounds",
    name: "Hyper Rounds",
    description:
      "Bullet Size -50%, Fire Rate -25%, Bullet Speed +25%, Bullet Damage +50%, Piercing +2",
    icon: 61,
    category: "speed",
    
    requires: ["penetration"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        projectileSize: player.projectileSize * 0.5,
        firerate: player.firerate * 1.25,
        baseProjectileSpeed: player.baseProjectileSpeed * 1.25,
        baseDamage: player.baseDamage * 1.5,
        piercing: player.piercing + 1,
      });
    },
  },

  assassin: {
    id: "assassin",
    name: "Assassin",
    description: "Instant-kill enemies below 20% HP",
    icon: 62,
    category: "speed",
    
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
    icon: 16,
    category: "damage",
    
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
    icon: 17,
    category: "damage",
    
    requires: ["power_shot"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        baseDamage: player.baseDamage * 1.45,
        projectileSize: (player.projectileSize || 1) * 1.4,
      });
    },
  },

  hand_cannon: {
    id: "hand_cannon",
    name: "Hand Cannon",
    description:
      "Max Ammo -75%, Bullet Damage +250%, Bullet Size +50%, Piercing +1",
    icon: 12,
    category: "reload",
    
    requires: ["big_shot"],
    apply: () => {
      const player = usePlayer.getState();
      const newMaxAmmo = Math.max(1, Math.floor(player.maxAmmo * 0.25));
      usePlayer.setState({
        maxAmmo: newMaxAmmo,
        ammo: Math.min(player.ammo, newMaxAmmo),
        baseDamage: player.baseDamage * 3.5,
        projectileSize: player.projectileSize * 1.5,
        piercing: player.piercing + 1,
        handCannon: true,
      });
    },
  },

  splinter: {
    id: "splinter",
    name: "Splinter",
    description: "Killed enemies explode into 3 bullets dealing 10% damage",
    icon: 18,
    category: "damage",
    
    requires: ["power_shot"],
    apply: () => {
      usePlayer.setState({ splinterBullets: true });
    },
  },

  railgun: {
    id: "railgun",
    name: "Railgun",
    description:
      "-80% Spread, Bullets pierce killed enemies (-20% damage per death pierce)",
    icon: 22,
    category: "damage",
    
    requires: ["splinter", "big shot"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        railgun: true,
        accuracy: player.accuracy * 5,
      });
    },
  },

  // BULLET ENHANCEMENTS
  homing_rounds: {
    id: "homing_rounds",
    name: "Homing Rounds",
    description: "Projectiles home in on enemies",
    icon: 27,
    category: "damage",
    
    requires: ["power_shot"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({ homing: true,
                         life: player.life/2,
                         });
    },
  },

  inciendiary_rounds: {
    id: "incendiary_rounds",
    name: "Incendiary Rounds",
    description: "Projectiles inflict Burn: 4 damage/s for 3s",
    icon: 37,
    category: "damage",
    
    requires: ["power_shot"],
    apply: () => {
      usePlayer.setState({ incendiary: true });
    },
  },

  // FIRE RATE TREE
  rapid_fire: {
    id: "rapid_fire",
    name: "Rapid Fire",
    description: "Fire Rate +25%",
    icon: 20,
    category: "firerate",
    
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({ firerate: player.firerate * 0.75 });
    },
  },

  light_bullets: {
    id: "light_bullets",
    name: "Light Bullets",
    description: "Fire Rate +15%, Max Ammo +1, Bullet Speed +15%",
    icon: 13,
    category: "firerate",
    
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
    icon: 21,
    category: "firerate",
    
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
    description:
      "Bullet Damage increases when standing still. Damage bonus resets when you move.",
    icon: 31,
    category: "firerate",
    
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
    icon: 43,
    category: "multishot",
    
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
    icon: 44,
    category: "multishot",
    
    requires: ["double_shot"],
    apply: () => {
      usePlayer.setState({ fanFire: true });
    },
  },

  split_fire: {
    id: "split_fire",
    name: "Split Fire",
    description: "Shoots an additional bullet behind you",
    icon: 45,
    category: "multishot",
    
    requires: ["double_shot"],
    apply: () => {
      usePlayer.setState({ splitFire: true });
    },
  },

  fusillade: {
    id: "fusillade",
    name: "Fusillade",
    description:
      "Projectiles +1, Spread +15%, Fire Rate -50%, doubles base projectiles",
    icon: 46,
    category: "multishot",
    
    requires: ["fan_fire", "split_fire"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        projectileCount: (player.projectileCount + 1) * 2,
        accuracy: player.accuracy * 0.85,
        firerate: player.firerate * 2,
      });
    },
  },

  shotgun: {
    id: "shotgun",
    name: "Shotgun",
    description: "Bullet Damage +100%, Bullet Lifetime -90%",
    icon: 71,
    category: "multishot",
    
    requires: ["fan_fire", "split_fire"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        baseDamage: player.baseDamage * 2.0,
        life: player.life * 0.1,
      });
    },
  },

  // RELOAD TREE
  quick_hands: {
    id: "quick_hands",
    name: "Quick Hands",
    description: "Reload Rate +20%, Fire Rate +5%",
    icon: 47,
    category: "reload",
    
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
    icon: 49,
    category: "reload",
    
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
    icon: 48,
    category: "reload",
    
    requires: ["quick_hands"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        reloadTime: player.reloadTime * 0.95,
        freshClip: true,
      });
    },
  },

  explosive_last_round: {
    id: "explosive_last_round",
    name: "Last Round Blast",
    description: "Last bullet explodes on impact",
    icon: 77,
    category: "reload",
    
    requires: ["incendiary", "splinter"],
    apply: () => {
      usePlayer.setState({ lastAmmoExplosive: true });
    },
  },

  kill_clip: {
    id: "kill_clip",
    name: "Kill Clip",
    description: "Reload Rate increases with kills (resets on reload)",
    icon: 65,
    category: "reload",
    
    requires: ["armed_ready", "fresh_clip"],
    apply: () => {
      usePlayer.setState({ killClip: true });
    },
  },

  // BUFF TREE
  fleet_footed: {
    id: "fleet_footed",
    name: "Fleet Footed",
    description: "Movement Speed +20%",
    icon: 38,
    category: "buff",
    
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({ speed: player.speed * 1.2 });
    },
  },

  hawk_eye: {
    id: "hawk_eye",
    name: "Hawk Eye",
    description: "Vision Range +40%",
    icon: 67,
    category: "buff",
    
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({
        visionRange: player.visionRange * 1.1,
        cameraZoom: (player.cameraZoom || 1) / 1.1,
      });
    },
  },

  rapid_stride: {
    id: "rapid_stride",
    name: "Rapid Stride",
    description: "Movement Speed +100% while firing",
    icon: 39,
    category: "buff",
    
    requires: ["hawk_eye, magnetic_field"],
    apply: () => {
      usePlayer.setState({ speedWhenFiring: 0.3 });
    },
  },

  magnetic_field: {
    id: "magnetic_field",
    name: "Magnetic Field",
    description: "Magnet Range +50%",
    icon: 55,
    category: "buff",
    
    requires: ["fleet_footed"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({ magnetRange: player.magnetRange * 1.5 });
    },
  },

  // SUMMON TREES
  ghost_friend: {
    id: "ghost_friend",
    name: "Ghost Friend",
    description:
      "Summon a Ghost Friend that fires piercing projectiles for 8 damage",
    icon: 24,
    category: "summon",
    
    apply: () => {
      const { addSummon } = useSummons.getState();
      addSummon("ghost");
    },
  },

  best_friends: {
    id: "best_friends",
    name: "Best Friends",
    description: "Fire Rate +10%. Ghost attacks 50% faster",
    icon: 26,
    category: "summon",
    
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
    icon: 15,
    category: "summon",
    
    requires: ["best_friends"],
    apply: () => {
      useSummons.setState({ ghostBurn: true });
    },
  },

  triple_shot_ghost: {
    id: "triple_shot_ghost",
    name: "Triple Shot Ghost",
    description: "Ghost shoots 2 additional projectiles",
    icon: 25,
    category: "summon",
    
    requires: ["ghost_wizard"],
    apply: () => {
      useSummons.setState({ ghostProjectiles: 3 });
    },
  },

  magic_scythe: {
    id: "magic_scythe",
    name: "Magic Scythe",
    description:
      "Summon a Magic Scythe that orbits and deals 20 damage on contact",
    icon: 52,
    category: "summon",
    
    apply: () => {
      const { addSummon } = useSummons.getState();
      addSummon("scythe");
    },
  },

  dagger: {
    id: "magic_dagger",
    name: "Magic Dagger",
    description: "Summon a Dagger",
    icon: 51,
    category: "summon",
    
    apply: () => {
      const { addSummon } = useSummons.getState();
      addSummon("dagger");
    },
  },

  dual_wield: {
    id: "duel_wield",
    name: "Duel Wield",
    description: "Summon another Magic Scythe, +10% Player Speed",
    icon: 3,
    category: "summon",
    
    requires: ["magic_scythe"],
    apply: () => {
      const { addSummon } = useSummons.getState();
      addSummon("scythe");
      const player = usePlayer.getState();
      usePlayer.setState({ speed: player.speed * 1.1 });
    },
  },

  windcutter: {
    id: "windcutter",
    name: "Windcutter",
    description: "Move Speed +10%. Scythe speed scales with Move Speed",
    icon: 1,
    category: "summon",
    
    requires: ["magic_scythe"],
    apply: () => {
      const player = usePlayer.getState();
      usePlayer.setState({ speed: player.speed * 1.1 });
      useSummons.setState({ scytheSpeedBonus: true });
    },
  },

  stormblade: {
    id: "stormblade",
    name: "Stormblade",
    description: "Scythe's deal more damage based on lightning damage",
    icon: 2,
    category: "summon",
    
    requires: ["magic_scythe"],
    apply: () => {
      useSummons.setState({
        scytheDamage: useSummons.getState().scytheDamage * 1.3,
      });
    },
  },

  lightning: {
    id: "lightning",
    name: "Lightning",
    description: "Summon lightning that strikes 1 enemy every 2s",
    icon: 32,
    category: "summon",
    
    apply: () => {
      const { addSummon } = useSummons.getState();
      addSummon("lightning");
    },
  },

  energized: {
    id: "energized",
    name: "Energized",
    description: "Lightning strikes have 20% chance to refill 3 ammo",
    icon: 33,
    category: "summon",
    
    requires: ["lightning"],
    apply: () => {
      useSummons.setState({ energized: true });
    },
  },

  electro_mastery: {
    id: "electro_mastery",
    name: "Electro Mastery",
    description: "All Lightning damage +12",
    icon: 30,
    category: "summon",
    
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
  const available = Object.values(ALL_UPGRADES).filter((upgrade) => {
    if (takenUpgrades.has(upgrade.id)) return false;
    if (upgrade.requires && upgrade.requires.length > 0) {
      const hasRequirement = upgrade.requires.some((req) =>
        takenUpgrades.has(req),
      );
      if (!hasRequirement) return false;
    }
    return true;
  });

  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5);
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
  firerate: 0.4,
  ammo: 6,
  maxAmmo: 6,
  reloadTime: 1,
  isReloading: false,
  reloadProgress: 0,
  isFiring: false,

  baseDamage: 13,
  baseProjectileSpeed: 50,
  baseProjectileRange: 50,
  projectileCount: 1,
  life: 2.5,
  projectileSize: 12.0,
  homing: false,
  incendiary: false,
  piercing: 0,
  bouncing: 0,
  accuracy: 0.75,
  trailLength: 5,
  explosive: undefined,
  chainLightning: undefined,
  magnetRange: 1,
  speedWhenFiring: 0,
  healPerLevelUp: 0,

  // Special Upgrades
  knockbackMultiplier: 2.0,
  instantKillThreshold: 0,
  splinterBullets: false,
  pierceKilledEnemies: false,
  railgun: false,
  handCannon: false,
  siegeMode: false,
  fanFire: false,
  splitFire: false,
  freshClip: false,
  freshClipActive: false,
  freshClipTimer: 0,
  lastAmmoExplosive: false,
  killClip: false,
  killClipStacks: 0,
  speedFiringBonus: 0,

  // Regeneration
  regeneration: false,
  regenerationInterval: 50,
  regenerationTimer: 0,

  // Burn effects
  burnDurationMultiplier: 1,

  muzzleFlashTimer: 0,
  muzzleFlashPosition: null,
  fanFireActive: false,
  fanFireIndex: 0,
  fanFireTimer: 0,

  // Special mechanics
  visionRange: 1,
  cameraZoom: 1,
  damageFlashTimer: 0,
  damageFlashPosition: null,
  lastDamageKnockback: null,

  // XP & Leveling
  xp: 20,
  level: 0,
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

    // Apply healing from lifesteal upgrades
    if (state.healPerLevelUp > 0) {
      const newHearts = Math.min(
        state.hearts + state.healPerLevelUp,
        state.maxHearts,
      );
      set({
        level: newLevel,
        xp: 0,
        xpToNextLevel: newXPRequired,
        showLevelUpScreen: true,
        availableUpgrades: generateRandomUpgrades(state.takenUpgrades),
        hearts: newHearts,
      });
    } else {
      set({
        level: newLevel,
        xp: 0,
        xpToNextLevel: newXPRequired,
        showLevelUpScreen: true,
        availableUpgrades: generateRandomUpgrades(state.takenUpgrades),
      });
    }

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

  

  // === DAMAGE FEEDBACK ACTIONS ===

  triggerDamageFlash: (position, knockback) =>
    set({
      damageFlashTimer: 0.3,
      damageFlashPosition: position.clone(),
      lastDamageKnockback: knockback.clone(),
    }),

  updateDamageFlash: (delta) =>
    set((state) => {
      if (state.damageFlashTimer <= 0) return {};

      const newTimer = Math.max(0, state.damageFlashTimer - delta);
      if (newTimer > 0 && state.lastDamageKnockback) {
        const knockbackSpeed = 8;
        const knockbackMove = state.lastDamageKnockback
          .clone()
          .multiplyScalar(knockbackSpeed * delta);
        return {
          damageFlashTimer: newTimer,
          position: state.position.clone().add(knockbackMove),
        };
      }

      return {
        damageFlashTimer: 0,
        damageFlashPosition: null,
        lastDamageKnockback: null,
      };
    }),

  // === COMBAT ACTIONS ===

  startFanFire: () =>
    set({
      fanFireActive: true,
      fanFireIndex: 0,
      fanFireTimer: 0,
    }),

  updateFanFire: (delta, fireCallback) =>
    set((state) => {
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

  fireMuzzleFlash: (position) =>
    set({
      muzzleFlashTimer: 6,
      muzzleFlashPosition: position.clone(),
    }),

  updateMuzzleFlash: () =>
    set((state) => {
      if (state.muzzleFlashTimer <= 0) return {};
      const nextTimer = Math.max(state.muzzleFlashTimer - 1, 0);
      return {
        muzzleFlashTimer: nextTimer,
        muzzleFlashPosition: nextTimer > 0 ? state.muzzleFlashPosition : null,
      };
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
      if (state.siegeMode && isStandingStill) {
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

  move: (delta) =>
    set((state) => ({
      position: state.position.clone().add(delta),
    })),

  loseHeart: () =>
    set((state) => ({
      hearts: Math.max(state.hearts - 1, 0),
      invincibilityTimer: state.invincibilityDuration,
    })),

  updateInvincibility: (delta) =>
    set((state) => {
      if (state.invincibilityTimer <= 0) return {};
      return {
        invincibilityTimer: Math.max(state.invincibilityTimer - delta, 0),
      };
    }),

  updateRegeneration: (delta) =>
    set((state) => {
      if (!state.regeneration) return {};

      const newTimer = state.regenerationTimer + delta;
      if (newTimer >= state.regenerationInterval) {
        const healed = Math.min(state.hearts + 1, state.maxHearts);
        return {
          regenerationTimer: 0,
          hearts: healed,
        };
      }
      return { regenerationTimer: newTimer };
    }),

  reset: () =>
    set({
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      speed: 10,
      hearts: 5,
      maxHearts: 5,
      invincibilityTimer: 0,
      invincibilityDuration: 3,
      firerate: 0.4,
      ammo: 6,
      maxAmmo: 6,
      isReloading: false,
      reloadTime: 1,
      reloadProgress: 0,
      isFiring: false,
      isMoving: false,
      baseDamage: 13,
      baseProjectileSpeed: 50,
      baseProjectileRange: 50,
      projectileCount: 1,
      life: 2.5,
      homing: false,
      incendiary: false,
      piercing: 0,
      bouncing: 0,
      trailLength: 1,
      explosive: undefined,
      chainLightning: undefined,
      accuracy: 0.75,
      knockbackMultiplier: 2.0,
      projectileSize: 12.0,
      instantKillThreshold: 0,
      splinterBullets: false,
      pierceKilledEnemies: false,
      railgun: false,
      handCannon: false,
      siegeMode: false,
      fanFire: false,
      splitFire: false,
      freshClip: false,
      freshClipActive: false,
      freshClipTimer: 0,
      lastAmmoExplosive: false,
      killClip: false,
      killClipStacks: 0,
      regeneration: false,
      regenerationInterval: 50,
      regenerationTimer: 0,
      burnDurationMultiplier: 1,
      lastMovementTime: 0,
      muzzleFlashTimer: 0,
      muzzleFlashPosition: null,
      fanFireActive: false,
      fanFireIndex: 0,
      fanFireTimer: 0,
      visionRange: 1,
      cameraZoom: 1,
      damageFlashTimer: 0,
      damageFlashPosition: null,
      lastDamageKnockback: null,
      xp: 0,
      level: 1,
      xpToNextLevel: calculateXPForLevel(1),
      showLevelUpScreen: false,
      availableUpgrades: [],
      takenUpgrades: new Set<string>(),
    }),
}));
