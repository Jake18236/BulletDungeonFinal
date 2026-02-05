// client/src/lib/stores/useSummons.tsx - COMPLETE REPLACEMENT
import { create } from "zustand";
import * as THREE from "three";
import { usePlayer } from "./usePlayer";
import { useHit } from "./useHit";

const CANVAS_WIDTH = 1490;
const CANVAS_HEIGHT = 750;
const TILE_SIZE = 50;

export interface Summon {
  id: string;
  type: "ghost" | "scythe" | "spear" | "dagger" | "electrobug";
  position: THREE.Vector3;
  rotation: number;

  // Ghost-specific
  driftOffset?: THREE.Vector3;
  fireTimer?: number;
  shootAnimTimer?: number;

  // Orbit-specific (scythe, spear, electrobug)
  orbitAngle?: number;
  orbitRadius?: number;
  orbitSpeed?: number;

  // Electro bug specific
  strikeTimer?: number;

  // Dagger-specific
  targetId?: string;
  hitCooldown?: number;
  velocity?: THREE.Vector3;
  lastTargetTime?: number;
  recentTargets?: string[];
  trail?: THREE.Vector3[];
  enemiesInside?: Set<string>;
  
  // Scythe-specific - damage cooldown per enemy
  lastDamageTime?: number;
  damagedEnemies?: Record<string, number>;
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
  ghostFireRate: 2,
  ghostProjectiles: 1,
  ghostBurn: false,
  ghostTriggerOnHit: false,

  scytheDamage: 10,
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

  daggerDamage: 12,
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
        shootAnimTimer: 0,
      };

      set(state => ({ summons: [...state.summons, summon] }));
    }
    else if (type === "scythe") {
      const summon: Summon = {
        id: `scythe_${Date.now()}`,
        type: "scythe",
        position: playerPos.clone().add(new THREE.Vector3(50, 0, 0)),
        rotation: 0,
        orbitAngle: 0,
        orbitRadius: 5,
        orbitSpeed: 2,
        lastDamageTime: 0,
        damagedEnemies: {},
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
    const { applyHit } = useHit.getState();
    const updatedSummons = state.summons.map(summon => {
      const updated = { ...summon };

      // ========================================================================
      // GHOST FRIEND - Stays close, drifts gently, fires at closest enemy
      // ========================================================================
        if (summon.type === "ghost") {

            const orbitScreenRadius = 50;
            const orbitRadius = orbitScreenRadius / (TILE_SIZE / 2); // pixels from player
            const orbitSpeed = 2;   // radians per second

            // Initialize orbit angle if undefined
            if (summon.orbitAngle === undefined) summon.orbitAngle = Math.random() * Math.PI * 2;


            // Advance orbit angle
            summon.orbitAngle += orbitSpeed * delta;
            if (summon.orbitAngle > Math.PI * 2) summon.orbitAngle -= Math.PI * 2;

            // Update ghost position around player
            updated.position.x = playerPos.x + Math.cos(summon.orbitAngle) * orbitRadius;
            updated.position.z = playerPos.z + Math.sin(summon.orbitAngle) * orbitRadius;


            // Optional: gentle rotation for visual effect
            updated.rotation += delta * 2;
            if (updated.fireTimer === undefined) updated.fireTimer = state.ghostFireRate;
            if (updated.shootAnimTimer === undefined) updated.shootAnimTimer = 0;

            // Fire continuously at closest enemy
            updated.fireTimer! -= delta;
            if (updated.fireTimer! <= 1 && updated.shootAnimTimer <= 0) {
                updated.shootAnimTimer = 4;
            }

            if (updated.shootAnimTimer > 0) {
                updated.shootAnimTimer = Math.max(0, updated.shootAnimTimer - delta);
            }

            if (updated.fireTimer! <= 0 && enemies.length > 0) {
                updated.fireTimer = state.ghostFireRate;

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
                            size: 20,
                            direction: dir,
                            slotId: 0,
                            damage: state.ghostDamage * state.summonDamageMultiplier,
                            speed: 60,
                            range: 100,
                            trailLength: 10,
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
      // SCYTHE - Orbits player, damages on contact
      // ========================================================================
        else if (summon.type === "scythe") {
          const playerPos = usePlayer.getState().position;

          updated.orbitAngle += updated.orbitSpeed * delta;

          updated.position.set(
            playerPos.x + Math.cos(updated.orbitAngle) * updated.orbitRadius,
            0,
            playerPos.z + Math.sin(updated.orbitAngle) * updated.orbitRadius
          );

          updated.rotation = updated.orbitAngle + Math.PI / 2;

          if (!updated.damagedEnemies) updated.damagedEnemies = {};
          const now = Date.now();

          enemies.forEach(enemy => {
            const dist = updated.position.distanceTo(enemy.position);
            const HIT_RADIUS = 2.2; 

            const lastHit = updated.damagedEnemies![enemy.id] ?? 0;
            
            if (dist < HIT_RADIUS && now - lastHit > 950) {
              let damage =
                state.scytheDamage * state.summonDamageMultiplier;
              
              // Speed-based scaling
              if (state.scytheSpeedBonus) {
                const ps = usePlayer.getState();
                damage *= 1 + Math.max(0, ps.speed - 10) * 0.05;
              }
              
              applyHit({
                enemy,
                damage,
                sourcePos: updated.position,
                color: "#ff4444",
                knockbackStrength: 6,
                curse: state.scytheCurse,
                isSummonDamage: true,
              });
              updated.damagedEnemies![enemy.id] = now;
              let hitEnemy = true;
              playHit();
            }
          });

          // Cleanup
          for (const id in updated.damagedEnemies) {
            if (now - updated.damagedEnemies[id] > 1000) {
              delete updated.damagedEnemies[id];
            }
          }
        }
      // ========================================================================
      // MAGIC SPEAR 
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
          if (!updated.recentTargets) updated.recentTargets = [];
          if (!updated.enemiesInside) {
            updated.enemiesInside = new Set<string>();
          }
          if (!updated.trail) updated.trail = [];
          updated.trail.unshift(updated.position.clone());

          if (updated.trail.length > 20) {
            updated.trail.pop();
          }


          if (!updated.velocity) {
            updated.velocity = new THREE.Vector3();
          }

          if (!updated.hitCooldown) {
            updated.hitCooldown = 0;
          }

          updated.hitCooldown -= delta;

          const ps = usePlayer.getState();

          // ---------- TARGET SELECTION ----------
          let targetEnemy = enemies.find(e => e.id === updated.targetId);

          const MAX_LEASH_DIST = 100;
          const ACQUIRE_RADIUS = 100;

          const distFromPlayer = updated.position.distanceTo(playerPos);

          const needsNewTarget =
            !targetEnemy ||
            targetEnemy.health <= 0 ||
            updated.hitCooldown > 0 ||
            distFromPlayer > MAX_LEASH_DIST;

          if (needsNewTarget) {
            let best: Enemy | null = null;
            let bestScore = Infinity;

            for (const enemy of enemies) {
              if (enemy.health <= 0) continue;
              if (updated.recentTargets?.includes(enemy.id)) continue;


              const dPlayer = enemy.position.distanceTo(playerPos);
              if (dPlayer > ACQUIRE_RADIUS) continue;

              const dDagger = enemy.position.distanceTo(updated.position);
              const score = (dDagger * 2.7 + dPlayer * 10.3) / Math.random();

              if (score < bestScore) {
                bestScore = score;
                best = enemy;
              }
            }

            updated.targetId = best?.id;
            targetEnemy = best || null;
          }

          // ---------- MOVEMENT ----------
          let desiredDir: THREE.Vector3;

          if (targetEnemy) {
            desiredDir = targetEnemy.position.clone().sub(updated.position);
          } else {
            // Drift back toward player if idle
            desiredDir = playerPos.clone().sub(updated.position);
          }
          const MAX_SPEED = 40;
          const dist = desiredDir.length();

          if (dist > 1) {
            desiredDir.normalize();

            const ACCEL = 20;
            const desiredVelocity = desiredDir.multiplyScalar(ACCEL);

            // Steering = "where I want to go" − "where I am going"
            const steering = desiredVelocity.sub(updated.velocity);

            // Clamp steering force
            const MAX_STEER = 100 * delta;
            if (steering.length() > MAX_STEER) {
              steering.setLength(MAX_STEER);
            }

            updated.velocity.add(steering);

          }
        
          if (updated.velocity.length() > MAX_SPEED) {
            updated.velocity.setLength(MAX_SPEED);
          }

          // Damping
          

          updated.position.add(updated.velocity.clone().multiplyScalar(delta));
          updated.rotation += delta * 8;
          const DAGGER_HIT_RADIUS = 1.5;

          // ---------- HIT LOGIC ----------
          for (const enemy of enemies) {
            if (enemy.health <= 0) continue;

            // Must still be within player radius
            if (enemy.position.distanceTo(playerPos) > ACQUIRE_RADIUS) continue;

            const dist = enemy.position.distanceTo(updated.position);
            const isInside = dist <= DAGGER_HIT_RADIUS;
            const wasInside = updated.enemiesInside.has(enemy.id);

            // ENTER hit radius → deal damage once
            if (isInside && !wasInside) {
              let damage = state.daggerDamage * state.summonDamageMultiplier;

              applyHit({
                enemy,
                damage,
                impactPos: updated.position,
                color: "#ff4444",
                knockbackStrength: 10,
                curse: state.scytheCurse,
                isSummonDamage: true,
              });
              updated.recentTargets.push(enemy.id);
              if (updated.recentTargets.length > 2) {
                updated.recentTargets.shift();
              }

              updated.targetId = undefined;
              updated.enemiesInside.add(enemy.id);
            }

            // EXIT hit radius → allow future hits
            if (!isInside && wasInside) {
              updated.enemiesInside.delete(enemy.id);
            }
          }
          for (const id of updated.enemiesInside) {
            const e = enemies.find(en => en.id === id);
            if (!e || e.health <= 0) {
              updated.enemiesInside.delete(id);
            }
          }

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