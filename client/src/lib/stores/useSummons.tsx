// client/src/lib/stores/useSummons.tsx - COMPLETE REPLACEMENT
import { create } from "zustand";
import * as THREE from "three";
import { usePlayer } from "./usePlayer";

const CANVAS_WIDTH = 1490;
const CANVAS_HEIGHT = 750;
const TILE_SIZE = 50;

export interface Summon {
  id: string;
  type: "ghost" | "scythe" | "spear" | "dagger" | "electrobug";
  position: THREE.Vector3;
  rotation: number;
  lastHitTime?: Record<string, number>;


  // Ghost-specific
  driftOffset?: THREE.Vector3;
  fireTimer?: number;

  // Orbit-specific (scythe, spear, electrobug)
  orbitAngle?: number;
  orbitRadius?: number;
  orbitSpeed?: number;

  // Electro bug specific
  strikeTimer?: number;

  // Dagger-specific
  velocity?: THREE.Vector3;
  target?: THREE.Vector3;
  targetId?: string;
  lastTargetTime?: number;
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

  // Upgrade bonuses
  summonDamageMultiplier: number;
  ghostDamage: number;
  ghostFireRate: number;
  ghostProjectiles: number;
  ghostBurn: boolean;
  ghostTriggerOnHit: boolean;

  scytheDamage: number;
  scytheCurse: boolean;
  curseDamageBonus: number;
  scytheSpeedBonus: boolean;
  scytheDamageBonus: boolean;

  spearDamage: number;
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

  daggerDamage: number;
  daggerCount: number;
  daggerBurn: boolean;

  electroBugDamage: number;
  electroMage: boolean;
  electroShotCounter: number;
  energized: boolean;
  electroMastery: boolean;

  // Actions
  addSummon: (type: Summon["type"]) => void;
  updateSummons: (
    delta: number, 
    playerPos: THREE.Vector3, 
    enemies: any[],
    addProjectile: (config: any) => void,
    playHit: () => void
  ) => void;
  updateStatusEffects: (delta: number, enemies: any[], onDamage: (enemyId: string, damage: number) => void) => void;
  applyStatusEffect: (enemyId: string, type: "burn" | "curse", damage: number, duration: number) => void;
  removeSummon: (id: string) => void;
  handleEnemyKilledBySummon: () => void;
  reset: () => void;
}

export const useSummons = create<SummonState>((set, get) => ({
  summons: [],
  statusEffects: [],

  summonDamageMultiplier: 1.0,
  
  ghostDamage: 20,
  ghostFireRate: 10,
  ghostProjectiles: 1,
  ghostBurn: false,
  ghostTriggerOnHit: false,

  scytheDamage: 40,
  scytheCurse: false,
  curseDamageBonus: 0,
  scytheSpeedBonus: false,
  scytheDamageBonus: false,

  spearDamage: 20,
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

  daggerDamage: 30,
  daggerCount: 1,
  daggerBurn: false,

  electroBugDamage: 22,
  electroMage: false,
  electroShotCounter: 0,
  energized: false,
  electroMastery: false,

  addSummon: (type) => {
    const playerPos = usePlayer.getState().position;

    if (type === "ghost") {
      const summon: Summon = {
        id: `ghost_${Date.now()}`,
        type: "ghost",
        position: playerPos.clone().add(new THREE.Vector3(50, 0, 0)),
        rotation: 0,
        
        fireTimer: 0,
      };

      set(state => ({ summons: [...state.summons, summon] }));
    }
    else if (type === "scythe") {
      const summon: Summon = {
        id: `scythe_${Date.now()}`,
        type: "scythe",
        position: playerPos.clone(),
        rotation: 0,
        orbitAngle: 0,
        orbitRadius: 40,
        orbitSpeed: 3,
      };

      set(state => ({ summons: [...state.summons, summon] }));
    }
    else if (type === "spear") {
      const state = get();
      for (let i = 0; i < state.spearCount; i++) {
        const summon: Summon = {
          id: `spear_${Date.now()}_${i}`,
          type: "spear",
          position: playerPos.clone(),
          rotation: 0,
          orbitAngle: (i / state.spearCount) * Math.PI * 2,
          orbitRadius: 35,
          orbitSpeed: 4,
        };

        set(state => ({ summons: [...state.summons, summon] }));
      }
    }
    else if (type === "dagger") {
      const state = get();
      for (let i = 0; i < state.daggerCount; i++) {
        const offset = (i - (state.daggerCount - 1) / 2) * 40;
        const summon: Summon = {
          id: `dagger_${Date.now()}_${i}`,
          type: "dagger",
          position: playerPos.clone().add(new THREE.Vector3(offset, 0, 30)),
          rotation: 0,
          velocity: new THREE.Vector3(),
        };

        set(state => ({ summons: [...state.summons, summon] }));
      }
    }
    else if (type === "electrobug") {
      const summon: Summon = {
        id: `electrobug_${Date.now()}`,
        type: "electrobug",
        position: playerPos.clone(),
        rotation: 0,
        orbitAngle: Math.random() * Math.PI * 2,
        orbitRadius: 60,
        orbitSpeed: 1.5,
        strikeTimer: 2.0,
      };

      set(state => ({ summons: [...state.summons, summon] }));
    }
  },

  updateSummons: (delta, playerPos, enemies, addProjectile, playHit) => {
    const state = get();

    // Update pulse timer
    
    
    const updatedSummons = state.summons.map(summon => {
      const updated = { ...summon };
      

      // ========================================================================
      // GHOST FRIEND - Stays close, drifts gently, fires at closest enemy
      // ========================================================================
        if (summon.type === "ghost") {
          
            const orbitScreenRadius = 50;
            const orbitRadius = orbitScreenRadius / (TILE_SIZE / 2); // pixels from player
            const orbitSpeed = 0.1;   // radians per second

            // Initialize orbit angle if undefined
            if (updated.orbitAngle === undefined) {
              updated.orbitAngle = Math.random() * Math.PI * 2;
            }

            updated.orbitAngle += orbitSpeed * delta;

            if (updated.orbitAngle > Math.PI * 2) updated.orbitAngle -= Math.PI * 2;

            // Update ghost position around player
            updated.position.x = playerPos.x + Math.cos(updated.orbitAngle) * orbitRadius;
            updated.position.z = playerPos.z + Math.sin(updated.orbitAngle) * orbitRadius;
            

            // Optional: gentle rotation for visual effect
            updated.rotation += delta * 2;
            updated.fireTimer ??= state.ghostFireRate;

            // Fire continuously at closest enemy
          // Fire continuously at closest enemy
          updated.fireTimer! -= delta;
          if (updated.fireTimer! <= 0 && enemies.length > 0) {
              updated.fireTimer = state.ghostFireRate; // <-- FIXED

              // Find closest enemy
              let closest = null;
              let closestDist = Infinity;
              for (const enemy of enemies) {
                  const dist = updated.position.distanceTo(enemy.position);
                  if (dist < closestDist) {
                      closestDist = dist;
                      closest = enemy;
                  }
              }

              if (closest && closestDist < 200) {
                  for (let i = 0; i < state.ghostProjectiles; i++) {
                      const spreadAngle = state.ghostProjectiles > 1 ? 0.3 : 0;
                      const baseAngle = Math.atan2(
                          closest.position.z - updated.position.z,
                          closest.position.x - updated.position.x
                      );
                      const angle = baseAngle + (i - (state.ghostProjectiles - 1) / 2) * spreadAngle;

                      const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

                      addProjectile({
                          position: updated.position.clone(),
                          size: 6,
                          direction: dir,
                          
                          damage: state.ghostDamage * state.summonDamageMultiplier,
                          speed: 20,
                          range: 100,
                          trailLength: 0,
                          homing: false,
                          piercing: 999,
                          bouncing: 0,
                          isSummonProjectile: true,
                          burn: state.ghostBurn ? { damage: 6, duration: 1 } : undefined,
                      });
                  }

                  playHit();
              }
          }
        }


      // ========================================================================
      // MAGIC SCYTHE - Orbits player, damages on contact
      // ========================================================================
      else if (summon.type === "scythe") {
        // Orbit around player
        updated.orbitAngle = (summon.orbitAngle! + summon.orbitSpeed! * delta) % (Math.PI * 2);

        const x = playerPos.x + Math.cos(updated.orbitAngle) * summon.orbitRadius!;
        const z = playerPos.z + Math.sin(updated.orbitAngle) * summon.orbitRadius!;

        updated.position = new THREE.Vector3(x, 0, z);
        updated.rotation += delta * 10;

        // Check collision with enemies
        enemies.forEach(enemy => {
          const dist = updated.position.distanceTo(enemy.position);
          const hitRadius = 18;

          if (dist < hitRadius) {
            const ps = usePlayer.getState();
            let damage = state.scytheDamage * state.summonDamageMultiplier;

            // Windcutter: bonus from move speed
            if (state.scytheSpeedBonus) {
              const speedBonus = (ps.speed - 10) / 10;
              damage *= (1 + speedBonus);
            }

            // Scythe Mastery: bonus from bullet damage
            if (state.scytheDamageBonus) {
              const damageBonus = (ps.baseDamage - 100) / 100;
              damage *= (1 + damageBonus * 0.1);
            }

            enemy.health -= damage;

            // Curse effect
            if (state.scytheCurse) {
              const curseDamage = ps.baseDamage * 2 * (1 + state.curseDamageBonus);
              get().applyStatusEffect(enemy.id, "curse", curseDamage, 1);
            }
          }
        });
      }

      // ========================================================================
      // MAGIC SPEAR - Orbits player
      // ========================================================================
      else if (summon.type === "spear") {
        updated.orbitAngle = (summon.orbitAngle! + summon.orbitSpeed! * delta) % (Math.PI * 2);

        const x = playerPos.x + Math.cos(updated.orbitAngle) * summon.orbitRadius!;
        const z = playerPos.z + Math.sin(updated.orbitAngle) * summon.orbitRadius!;

        updated.position = new THREE.Vector3(x, 0, z);
        updated.rotation = updated.orbitAngle;

        // Check collision
        enemies.forEach(enemy => {
          const dist = updated.position.distanceTo(enemy.position);
          if (dist < 15) {
            const ps = usePlayer.getState();
            let damage = state.spearDamage * state.summonDamageMultiplier;

            if (state.spearHolyBonus) {
              damage += ps.maxHearts * 10;
            }

            if (state.soulKnight) {
              damage += state.soulHearts * 15;
            }

            enemy.health -= damage;
          }
        });
      }

      // ========================================================================
      // MAGIC DAGGER - Homes in on enemies
      // ========================================================================
      else if (summon.type === "dagger") {
        // Initialize velocity
        if (!updated.velocity) {
          updated.velocity = new THREE.Vector3();
        }

        // Find on-screen enemies to target
        const CANVAS_WIDTH = 1490;
        const CANVAS_HEIGHT = 750;
        const TILE_SIZE = 50;

        const screenEnemies = enemies.filter(enemy => {
          const screenX = CANVAS_WIDTH / 2 + ((enemy.position.x - playerPos.x) * TILE_SIZE) / 2;
          const screenY = CANVAS_HEIGHT / 2 + ((enemy.position.z - playerPos.z) * TILE_SIZE) / 2;
          return screenX > -100 && screenX < CANVAS_WIDTH + 100 &&
                 screenY > -100 && screenY < CANVAS_HEIGHT + 100;
        });

        // Target selection
        const now = Date.now();
        if (screenEnemies.length > 0) {
          if (!updated.target || !updated.lastTargetTime || now - updated.lastTargetTime > 500) {
            let closest = null;
            let closestDist = Infinity;

            for (const enemy of screenEnemies) {
              if (updated.targetId === enemy.id && now - updated.lastTargetTime! < 2000) {
                continue;
              }
              const dist = summon.position.distanceTo(enemy.position);
              if (dist < closestDist) {
                closestDist = dist;
                closest = enemy;
              }
            }

            if (closest) {
              updated.target = closest.position.clone();
              updated.targetId = closest.id;
              updated.lastTargetTime = now;
            }
          }
        }

        // Move toward target or player
        const target = updated.target || playerPos;
        const dir = target.clone().sub(updated.position);
        const dist = dir.length();

        if (dist > 5) {
          const force = dir.normalize().multiplyScalar(8);
          updated.velocity.add(force.multiplyScalar(delta));
        }

        // Limit speed
        const speed = updated.velocity.length();
        if (speed > 50) {
          updated.velocity.normalize().multiplyScalar(50);
        }

        updated.velocity.multiplyScalar(0.98);
        updated.position.add(updated.velocity.clone().multiplyScalar(delta));
        updated.rotation += delta * 15;

        // Check collision
        enemies.forEach(enemy => {
          const dist = updated.position.distanceTo(enemy.position);
          if (dist < 10) {
            let damage = state.daggerDamage * state.summonDamageMultiplier;
            enemy.health -= damage;

            if (state.daggerBurn) {
              get().applyStatusEffect(enemy.id, "burn", 12, 4);
            }

            const bounceDir = updated.position.clone().sub(enemy.position).normalize();
            updated.velocity = bounceDir.multiplyScalar(30);
            updated.target = undefined;
          }
        });
      }

      // ========================================================================
      // ELECTRO BUG - Orbits and shoots lightning periodically
      // ========================================================================
      else if (summon.type === "electrobug") {
        // Orbit
        updated.orbitAngle = (summon.orbitAngle! + summon.orbitSpeed! * delta) % (Math.PI * 2);

        const x = playerPos.x + Math.cos(updated.orbitAngle) * summon.orbitRadius!;
        const z = playerPos.z + Math.sin(updated.orbitAngle) * summon.orbitRadius!;

        updated.position = new THREE.Vector3(x, 0, z);
        updated.rotation += delta * 5;

        // Lightning strikes at discrete intervals
        updated.strikeTimer! -= delta;
        if (updated.strikeTimer! <= 0 && enemies.length > 0) {
          updated.strikeTimer = 2.0;

          // Strike 2 nearest enemies
          const sorted = enemies
            .map(e => ({ enemy: e, dist: summon.position.distanceTo(e.position) }))
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 2);

          sorted.forEach(({ enemy }) => {
            let damage = state.electroBugDamage * state.summonDamageMultiplier;
            if (state.electroMastery) {
              damage += 12;
            }
            enemy.health -= damage;

            // Energized
            if (state.energized && Math.random() < 0.2) {
              const ps = usePlayer.getState();
              usePlayer.setState({ ammo: Math.min(ps.ammo + 3, ps.maxAmmo) });
            }
          });

          playHit();
        }
      }

      return updated;
    });

    set({ summons: updatedSummons });
  },

  updateStatusEffects: (delta, enemies, onDamage) => {
    const state = get();
    const updated: StatusEffect[] = [];

    state.statusEffects.forEach(effect => {
      const enemy = enemies.find(e => e.id === effect.enemyId);
      if (!enemy) return;

      effect.elapsed += delta;
      effect.lastTick += delta;

      if (effect.lastTick >= effect.tickRate) {
        effect.lastTick = 0;

        if (effect.type === "burn") {
          onDamage(effect.enemyId, effect.damage);
        } else if (effect.type === "curse") {
          if (effect.elapsed >= effect.duration) {
            onDamage(effect.enemyId, effect.damage);
          }
        }
      }

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
      tickRate: type === "burn" ? 0.25 : 999,
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

    if (state.soulDrain && totalKills % 500 === 0) {
      const ps = usePlayer.getState();
      usePlayer.setState({ hearts: Math.min(ps.hearts + 1, ps.maxHearts) });
      updates.soulHearts = state.soulHearts + 1;
    }

    if (state.bloodsuckers && totalKills % 500 === 0) {
      const ps = usePlayer.getState();
      usePlayer.setState({ hearts: Math.min(ps.hearts + 1, ps.maxHearts) });
    }

    set(updates);
  },

  reset: () => set({
    summons: [],
    statusEffects: [],
    summonDamageMultiplier: 1.0,
    ghostDamage: 8,
    ghostFireRate: 0.5,
    ghostProjectiles: 1,
    ghostBurn: false,
    ghostTriggerOnHit: false,
    scytheDamage: 40,
    scytheCurse: false,
    curseDamageBonus: 0,
    scytheSpeedBonus: false,
    scytheDamageBonus: false,
    spearDamage: 20,
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
    daggerDamage: 30,
    daggerCount: 1,
    daggerBurn: false,
    electroBugDamage: 22,
    electroMage: false,
    electroShotCounter: 0,
    energized: false,
    electroMastery: false,
  }),
}));