// client/src/lib/stores/useSummons.tsx
import { create } from "zustand";
import * as THREE from "three";
import { usePlayer } from "./usePlayer";
import { useEnemies } from "./useEnemies";
import { useProjectiles } from "./useProjectiles";
import { useGame } from "./useGame"
const CANVAS_WIDTH = 1490;
const CANVAS_HEIGHT = 750;
const TILE_SIZE = 50;

export interface Summon {
  id: string;
  type: "ghost" | "scythe" | "spear" | "dagger" | "electrobug";
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: number;
  target?: THREE.Vector3;

  // Combat stats
  damage: number;
  attackSpeed: number;
  attackCooldown: number;

  // Visual
  color: string;
  size: number;

  // Behavior
  orbitRadius?: number;
  orbitSpeed?: number;
  orbitAngle?: number;
  homingStrength?: number;

  // Special effects
  piercing?: boolean;
  burn?: boolean;
  curse?: boolean;
  projectileCount?: number;
  triggerOnHit?: boolean;
}

export interface StatusEffect {
  id: string;
  enemyId: string;
  type: "burn" | "curse";
  damage: number;
  duration: number;
  elapsed: number;
  tickRate: number;
  lastTick: number;
}

interface SummonState {
  summons: Summon[];
  statusEffects: StatusEffect[];

  // Upgrade tracking
  hasSummons: {
    ghost: boolean;
    scythe: boolean;
    spear: boolean;
    dagger: boolean;
    electroBug: boolean;
  };

  // Upgrade bonuses
  summonDamageMultiplier: number;
  ghostFireRateBonus: number;
  ghostProjectiles: number;
  ghostBurn: boolean;
  ghostTriggerOnHit: boolean;

  scytheCurse: boolean;
  curseDamageBonus: number;
  scytheSpeedBonus: boolean;
  scytheDamageBonus: boolean;

  spearCount: number;
  spearHolyBonus: boolean;
  soulDrain: boolean;
  soulKnight: boolean;
  soulHearts: number;

  pulsingSummons: boolean;
  pulseTimer: number;
  feedTheBeasts: boolean;
  beastKills: number;
  bloodsuckers: boolean;

  daggerCount: number;
  daggerBurn: boolean;

  electroMage: boolean;
  electroShotCounter: number;
  energized: boolean;
  electroMastery: boolean;

  // Actions
  addSummon: (type: Summon["type"]) => void;
  updateSummons: (delta: number, playerPos: THREE.Vector3, enemies: any[]) => void;
  updateStatusEffects: (delta: number, enemies: any[], onDamage: (enemyId: string, damage: number) => void) => void;
  applyStatusEffect: (enemyId: string, type: "burn" | "curse", damage: number, duration: number) => void;
  removeSummon: (id: string) => void;
  handleEnemyKilledBySummon: () => void;
  reset: () => void;
}

export const useSummons = create<SummonState>((set, get) => ({
  summons: [],
  statusEffects: [],

  hasSummons: {
    ghost: false,
    scythe: false,
    spear: false,
    dagger: false,
    electroBug: false,
  },

  summonDamageMultiplier: 1.0,
  ghostFireRateBonus: 0,
  ghostProjectiles: 1,
  ghostBurn: false,
  ghostTriggerOnHit: false,

  scytheCurse: false,
  curseDamageBonus: 0,
  scytheSpeedBonus: false,
  scytheDamageBonus: false,

  spearCount: 2,
  spearHolyBonus: false,
  soulDrain: false,
  soulKnight: false,
  soulHearts: 0,

  pulsingSummons: false,
  pulseTimer: 0,
  feedTheBeasts: false,
  beastKills: 0,
  bloodsuckers: false,

  daggerCount: 1,
  daggerBurn: false,

  electroMage: false,
  electroShotCounter: 0,
  energized: false,
  electroMastery: false,

  addSummon: (type) => {
    const state = get();
    const playerPos = usePlayer.getState().position;

    const configs: Record<Summon["type"], Partial<Summon>> = {
      ghost: {
        damage: 8,
        attackSpeed: 0.5,
        attackCooldown: 0,
        color: "#88ccff",
        size: 12,
        orbitRadius: 50,
        orbitSpeed: 2,
        orbitAngle: Math.random() * Math.PI * 2,
        piercing: true,
        projectileCount: state.ghostProjectiles,
        burn: state.ghostBurn,
        triggerOnHit: state.ghostTriggerOnHit,
      },
      scythe: {
        damage: 40,
        attackSpeed: 1.0,
        attackCooldown: 0,
        color: "#ff4444",
        size: 20,
        orbitRadius: 10,
        orbitSpeed: 0.1,
        orbitAngle: Math.random() * Math.PI * 2,
        curse: state.scytheCurse,
      },
      spear: {
        damage: 20,
        attackSpeed: 1.5,
        attackCooldown: 0,
        color: "#ffaa00",
        size: 25,
        orbitRadius: 35,
        orbitSpeed: 4,
        orbitAngle: Math.random() * Math.PI * 2,
      },
      dagger: {
        damage: 10,
        attackSpeed: 1,
        attackCooldown: 2,
        color: "#ff00ff",
        size: 45,
        homingStrength: 8,
        burn: state.daggerBurn,
      },
      electrobug: {
        damage: 22,
        attackSpeed: 2.0,
        attackCooldown: 0,
        color: "#00ffff",
        size: 10,
        orbitRadius: 60,
        orbitSpeed: 1.5,
        orbitAngle: Math.random() * Math.PI * 2,
      },
    };

    const config = configs[type];
    const count = type === "spear" ? state.spearCount : type === "dagger" ? state.daggerCount : 1;

    const newSummons: Summon[] = [];
    for (let i = 0; i < count; i++) {
      newSummons.push({
        id: `${type}_${Date.now()}_${i}`,
        type,
        position: playerPos.clone().add(new THREE.Vector3(
          Math.cos(i * (Math.PI * 2 / count)) * 30,
          0,
          Math.sin(i * (Math.PI * 2 / count)) * 30
        )),
        velocity: new THREE.Vector3(),
        rotation: 0,
        ...config,
      });
    }

    set(state => ({
      summons: [...state.summons, ...newSummons],
      hasSummons: { ...state.hasSummons, [type]: true },
    }));
  },


  updateSummons: (delta, playerPos, enemies) => {
    const state = get();
    const { addProjectile } = useProjectiles.getState();

    // Update pulse timer
    let newPulseTimer = state.pulseTimer;
    if (state.pulsingSummons) {
      newPulseTimer -= delta;
      if (newPulseTimer <= 0) {
        newPulseTimer = 2.0;

        // Pulse damage to nearby enemies
        const pulseDamage = 50 * state.summonDamageMultiplier;
        const pulseRadius = 80;

        state.summons.forEach(summon => {
          enemies.forEach(enemy => {
            const dist = summon.position.distanceTo(enemy.position);
            if (dist < pulseRadius) {
              enemy.health -= pulseDamage;
              // Visual effect could be added here
            }
          });
        });
      }
    }

    const updatedSummons = state.summons.map(summon => {
      const updated = { ...summon };

      // GHOST FRIEND: Orbit with physics
      if (summon.type === "ghost") {
        const targetDist = summon.orbitRadius!;
        const currentDist = summon.position.distanceTo(playerPos);

        // Orbit angle
        updated.orbitAngle = (summon.orbitAngle! + summon.orbitSpeed! * delta) % (Math.PI * 2);

        // Target position on orbit
        const targetX = playerPos.x + Math.cos(updated.orbitAngle) * targetDist;
        const targetZ = playerPos.z + Math.sin(updated.orbitAngle) * targetDist;
        const targetPos = new THREE.Vector3(targetX, 0, targetZ);

        // Apply physics to move toward target
        const direction = targetPos.clone().sub(summon.position);
        const forceMag = Math.min(direction.length() * 5, 20);
        const force = direction.normalize().multiplyScalar(forceMag);

        updated.velocity.add(force.multiplyScalar(delta));
        updated.velocity.multiplyScalar(0.9); // Drag

        updated.position.add(updated.velocity.clone().multiplyScalar(delta));
        updated.rotation += delta * 3;

        // Attack
        updated.attackCooldown -= delta;
        if (updated.attackCooldown <= 0 && enemies.length > 0) {
          const ps = usePlayer.getState();
          const fireRateBonus = 1 + state.ghostFireRateBonus;
          updated.attackCooldown = summon.attackSpeed / fireRateBonus;

          // Find nearest enemy
          const nearest = enemies.reduce((acc, e) => {
            const d = summon.position.distanceTo(e.position);
            return d < acc.dist ? { enemy: e, dist: d } : acc;
          }, { enemy: null as any, dist: Infinity });

          if (nearest.enemy) {
            for (let i = 0; i < state.ghostProjectiles; i++) {
              const spreadAngle = state.ghostProjectiles > 1 ? 0.3 : 0;
              const baseAngle = Math.atan2(
                nearest.enemy.position.z - summon.position.z,
                nearest.enemy.position.x - summon.position.x
              );
              const angle = baseAngle + (i - (state.ghostProjectiles - 1) / 2) * spreadAngle;

              const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

              addProjectile({
                position: summon.position.clone(),
                direction: dir,
                slotId: 0,
                damage: summon.damage * state.summonDamageMultiplier,
                speed: 60,
                range: 100,
                trailLength: 50,
                homing: false,
                piercing: summon.piercing ? 999 : 0,
                bouncing: 0,
                isSummonProjectile: true,
                burn: summon.burn ? { damage: 6, duration: 1 } : undefined,
                triggerOnHit: summon.triggerOnHit,
              });
            }
          }
        }
      }

      // MAGIC SCYTHE: Orbit and damage on contact
      if (summon.type === "scythe") {
        updated.orbitAngle = (summon.orbitAngle! + summon.orbitSpeed! * delta) % (Math.PI * 2);

        const targetX = playerPos.x + Math.cos(updated.orbitAngle) * summon.orbitRadius!;
        const targetZ = playerPos.z + Math.sin(updated.orbitAngle) * summon.orbitRadius!;

        updated.position.x = targetX;
        updated.position.z = targetZ;
        updated.rotation += delta * 10;

        // Check collision with enemies
        enemies.forEach(enemy => {
          const dist = updated.position.distanceTo(enemy.position);
          if (dist < 15) {
            const ps = usePlayer.getState();
            let damage = summon.damage * state.summonDamageMultiplier;

            // Windcutter: bonus from move speed
            if (state.scytheSpeedBonus) {
              const speedBonus = (ps.speed - 10) / 10; // Base speed is 10
              damage *= (1 + speedBonus);
            }

            // Scythe Mastery: bonus from bullet damage
            if (state.scytheDamageBonus) {
              const damageBonus = (ps.baseDamage - 100) / 100; // Base damage is 100
              damage *= (1 + damageBonus * 0.1);
            }

            enemy.health -= damage;

            // Curse effect
            if (summon.curse) {
              const curseDamage = ps.baseDamage * 2 * (1 + state.curseDamageBonus);
              get().applyStatusEffect(enemy.id, "curse", curseDamage, 1);
            }
          }
        });
      }

      // MAGIC SPEAR: Orbit
      if (summon.type === "spear") {
        updated.orbitAngle = (summon.orbitAngle! + summon.orbitSpeed! * delta) % (Math.PI * 2);

        const targetX = playerPos.x + Math.cos(updated.orbitAngle) * summon.orbitRadius!;
        const targetZ = playerPos.z + Math.sin(updated.orbitAngle) * summon.orbitRadius!;

        updated.position.x = targetX;
        updated.position.z = targetZ;
        updated.rotation = updated.orbitAngle;

        // Check collision
        enemies.forEach(enemy => {
          const dist = updated.position.distanceTo(enemy.position);
          if (dist < 12) {
            const ps = usePlayer.getState();
            let damage = summon.damage * state.summonDamageMultiplier;

            // Holy Spear: +10 per max HP
            if (state.spearHolyBonus) {
              damage += ps.maxHearts * 10;
            }

            // Soul Knight: +15 per soul heart
            if (state.soulKnight) {
              damage += state.soulHearts * 15;
            }

            enemy.health -= damage;
          }
        });
      }
                if (summon.type === "dagger") {
                  const playerPos = usePlayer.getState().position;
                  const MAX_SPEED = 20;       // constant dagger speed
                  const TURN_RATE = 5;       // how fast dagger steers
                  const TARGET_RADIUS = 700;  // max distance from player to select enemy
                  const HIT_COOLDOWN = 1000;  // ms an enemy cannot be retargeted

                  const now = Date.now();

                  // Track recently hit enemies
                  if (!updated.hitCooldowns) updated.hitCooldowns = new Map<string, number>();

                  // Filter valid targets: within 200 units of player & not on cooldown
                  const validTargets = enemies.filter(e => 
                    e.health > 0 &&
                    e.position.distanceTo(playerPos) <= TARGET_RADIUS &&
                    (!updated.hitCooldowns.has(e.id) || now - updated.hitCooldowns.get(e.id)! > HIT_COOLDOWN)
                  );

                  // Select target if none or previous target is gone
                  if (!updated.target || !validTargets.includes(enemies.find(e => e.id === updated.targetId)!)) {
                    if (validTargets.length > 0) {
                      // Pick the target minimizing travel time (distance / speed)
                      let best = validTargets[0];
                      let bestTime = updated.position.distanceTo(best.position) / MAX_SPEED;
                      validTargets.forEach(e => {
                        const t = updated.position.distanceTo(e.position) / MAX_SPEED;
                        if (t < bestTime) {
                          bestTime = t;
                          best = e;
                        }
                      });
                      updated.target = best.position.clone();
                      updated.targetId = best.id;
                    } else {
                      // No valid target: hover near player
                      updated.target = playerPos.clone().add(new THREE.Vector3(Math.random() * 20 - 10, 0, Math.random() * 20 - 10));
                      updated.targetId = undefined;
                    }
                  }

                  // Steering
                  if (updated.target) {
                    const desiredDir = updated.target.clone().sub(updated.position).normalize().multiplyScalar(MAX_SPEED);
                    updated.velocity.lerp(desiredDir, delta * TURN_RATE);
                  }

                  // Apply velocity
                  updated.position.add(updated.velocity.clone().multiplyScalar(delta));

                  // Rotation for visuals
                  updated.rotation = Math.atan2(updated.velocity.z, updated.velocity.x);

                  // Check hits
                  enemies.forEach(enemy => {
                    if (updated.position.distanceTo(enemy.position) < 1) {
                      // Damage enemy
                      enemy.health -= summon.damage * state.summonDamageMultiplier;

                      // Burn effect
                      if (summon.burn) {
                        get().applyStatusEffect(enemy.id, "burn", 12, 4);
                      }

                      // Mark enemy as recently hit
                      updated.hitCooldowns.set(enemy.id, now);

                      // Immediately retarget next frame
                      updated.target = undefined;
                      updated.targetId = undefined;
                    }
                  });
                }

      // ELECTRO BUG: Orbit and shoot lightning
      else if (summon.type === "electrobug") {
        updated.orbitAngle = (summon.orbitAngle! + summon.orbitSpeed! * delta) % (Math.PI * 2);

        const targetX = playerPos.x + Math.cos(updated.orbitAngle) * summon.orbitRadius!;
        const targetZ = playerPos.z + Math.sin(updated.orbitAngle) * summon.orbitRadius!;

        updated.position.x = targetX;
        updated.position.z = targetZ;
        updated.rotation += delta * 5;

        // Attack
        updated.attackCooldown -= delta;
        if (updated.attackCooldown <= 0 && enemies.length > 0) {
          updated.attackCooldown = summon.attackSpeed;

          // Strike 2 nearest enemies
          const sorted = enemies
            .map(e => ({ enemy: e, dist: summon.position.distanceTo(e.position) }))
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 2);

          sorted.forEach(({ enemy }) => {
            let damage = summon.damage * state.summonDamageMultiplier;
            if (state.electroMastery) {
              damage += 12;
            }
            enemy.health -= damage;

            // Visual lightning effect would go here

            // Energized: 20% chance to refill 3 ammo
            if (state.energized && Math.random() < 0.2) {
              const ps = usePlayer.getState();
              usePlayer.setState({ ammo: Math.min(ps.ammo + 3, ps.maxAmmo) });
            }
          });
        }
      }

      return updated;
    });

    set({ summons: updatedSummons, pulseTimer: newPulseTimer });
  },

  updateStatusEffects: (delta, enemies, onDamage) => {
    const state = get();
    const updated: StatusEffect[] = [];

    state.statusEffects.forEach(effect => {
      const enemy = enemies.find(e => e.id === effect.enemyId);
      if (!enemy) return; // Enemy dead

      effect.elapsed += delta;
      effect.lastTick += delta;

      // Tick damage
      if (effect.lastTick >= effect.tickRate) {
        effect.lastTick = 0;

        if (effect.type === "burn") {
          onDamage(effect.enemyId, effect.damage);
        } else if (effect.type === "curse") {
          // Curse applies full damage after duration
          if (effect.elapsed >= effect.duration) {
            onDamage(effect.enemyId, effect.damage);
          }
        }
      }

      // Keep if not expired
      if (effect.elapsed < effect.duration) {
        updated.push(effect);
      }
    });

    set({ statusEffects: updated });
  },

  applyStatusEffect: (enemyId, type, damage, duration) => {
    const effect: StatusEffect = {
      id: `${type}_${enemyId}_${Date.now()}`,
      enemyId,
      type,
      damage,
      duration,
      elapsed: 0,
      tickRate: type === "burn" ? 0.25 : 999, // Burn ticks, curse doesn't
      lastTick: 0,
    };

    set(state => ({
      statusEffects: [...state.statusEffects, effect],
    }));
  },

  removeSummon: (id) => set(state => ({
    summons: state.summons.filter(s => s.id !== id),
  })),

  handleEnemyKilledBySummon: () => {
    const state = get();
    const totalKills = (state.beastKills || 0) + 1;

    const updates: any = { beastKills: totalKills };

    // Soul Drain: every 500th kill drops heart
    if (state.soulDrain && totalKills % 500 === 0) {
      const ps = usePlayer.getState();
      usePlayer.setState({ hearts: Math.min(ps.hearts + 1, ps.maxHearts) });
      updates.soulHearts = state.soulHearts + 1;
    }

    // Bloodsuckers: every 500th kill heals
    if (state.bloodsuckers && totalKills % 500 === 0) {
      const ps = usePlayer.getState();
      usePlayer.setState({ hearts: Math.min(ps.hearts + 1, ps.maxHearts) });
    }

    set(updates);
  },

  reset: () => set({
    summons: [],
    statusEffects: [],
    hasSummons: { ghost: false, scythe: false, spear: false, dagger: false, electroBug: false },
    summonDamageMultiplier: 1.0,
    ghostFireRateBonus: 0,
    ghostProjectiles: 1,
    ghostBurn: false,
    ghostTriggerOnHit: false,
    scytheCurse: false,
    curseDamageBonus: 0,
    scytheSpeedBonus: false,
    scytheDamageBonus: false,
    spearCount: 2,
    spearHolyBonus: false,
    soulDrain: false,
    soulKnight: false,
    soulHearts: 0,
    pulsingSummons: false,
    pulseTimer: 0,
    feedTheBeasts: false,
    beastKills: 0,
    bloodsuckers: false,
    daggerCount: 1,
    daggerBurn: false,
    electroMage: false,
    electroShotCounter: 0,
    energized: false,
    electroMastery: false,
  }),
}));