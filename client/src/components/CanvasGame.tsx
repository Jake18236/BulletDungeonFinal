
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import Matter from "matter-js";
import { usePlayer } from "../lib/stores/usePlayer";
import { useEnemies } from "../lib/stores/useEnemies";
import { useDungeon } from "../lib/stores/useDungeon";
import { bounceAgainstBounds } from "../lib/collision";
import { useGame } from "../lib/stores/useGame";
import { useAudio } from "../lib/stores/useAudio";
import { useInventory } from "../lib/stores/useInventory";

import { useProjectiles } from "../lib/stores/useProjectiles";
import { useHit } from "../lib/stores/useHit";
import { useSummons } from "../lib/stores/useSummons";
import { useVisualEffects } from "../lib/stores/useVisualEffects";
import swordSrc from "/images/sword.png";
import GameUI from "./GameUI"  
import { any } from "zod";
import { LevelUpScreen } from "./GameUI";
import Darkness from "./Darkness";
import {
  enemySprite,
  WeaponSprites,
  CursorSprite,
  SummonSprites,
  xpSprite,
  getProjectileImage,
  enemyFlashSprite,
  VisualSprites,
  
} from "./SpriteProps";

VisualSprites.circle.src = "/sprites/impact_circle.png";
VisualSprites.cshape.src = "/sprites/impact_cShape.png";

const TILE_SIZE = 50;
export const CANVAS_WIDTH = 1490;
export const CANVAS_HEIGHT = 750;
const ROOM_SIZE = 200;

interface Position {
  x: number;
  y: number;
  z: number;
}

interface TerrainObstacle {
  x: number;
  z: number;
  width: number;
  height: number;
  type: "rock" | "pillar" | "wall";
}

const { addSummon } = useSummons.getState();
addSummon("dagger");

function generateRoomTerrain(roomX: number, roomY: number): TerrainObstacle[] {
  const obstacles: TerrainObstacle[] = [];
  const seed = roomX * 1000 + roomY;

  const seededRandom = (n: number) => {
    const x = Math.sin(seed + n) * 1000;
    return x - Math.floor(x);
  };

  const numOutcrops = 4;
  for (let i = 0; i < numOutcrops; i++) {
    const side = Math.floor(seededRandom(i * 20) * 4);
    const position = seededRandom(i * 10 - 10) * 70 - 35;
    const depth = seededRandom(i * 10 + 7) * 10 + 2;
    const width = seededRandom(i * 10 + 9) * 8 + 3;

    switch (side) {
      case 0:
        obstacles.push({
          x: position,
          z: -ROOM_SIZE + depth / 2,
          width: width,
          height: depth,
          type: "rock",
        });
        break;
      case 1:
        obstacles.push({
          x: position,
          z: ROOM_SIZE - depth / 2,
          width: width,
          height: depth,
          type: "rock",
        });
        break;
      case 2:
        obstacles.push({
          x: ROOM_SIZE - depth / 2,
          z: position,
          width: depth,
          height: width,
          type: "rock",
        });
        break;
      case 3:
        obstacles.push({
          x: -ROOM_SIZE + depth / 2,
          z: position,
          width: depth,
          height: width,
          type: "rock",
        });
        break;
    }
  }

  const numPillars = Math.floor(seededRandom(100) * 2) + 1;
  for (let i = 0; i < numPillars; i++) {
    const x = (seededRandom(i * 20 + 100) - 0.5) * 25;
    const z = (seededRandom(i * 20 + 105) - 0.5) * 25;
    const size = seededRandom(i * 20 + 110) * 2 + 1.5;

    if (Math.hypot(x, z) > 5) {
      obstacles.push({
        x: x,
        z: z,
        width: size,
        height: size,
        type: "pillar",
      });
    }
  }

  return obstacles;
}

function checkTerrainCollision(
  pos: THREE.Vector3,
  obstacles: TerrainObstacle[],
  radius: number,
): { collision: boolean; normal?: THREE.Vector2 } {
  for (const obs of obstacles) {
    const closestX = Math.max(
      obs.x - obs.width / 2,
      Math.min(pos.x, obs.x + obs.width / 2),
    );
    const closestZ = Math.max(
      obs.z - obs.height / 2,
      Math.min(pos.z, obs.z + obs.height / 2),
    );

    const distX = pos.x - closestX;
    const distZ = pos.z - closestZ;
    const distSq = distX * distX + distZ * distZ;

    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      const normal = new THREE.Vector2(distX / dist, distZ / dist);
      return { collision: true, normal };
    }
  }

  return { collision: false };
}

export default function CanvasGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const keysPressed = useRef<Set<string>>(new Set());
  const lastTimeRef = useRef<number>(0);
  const damagedThisFrameRef = useRef<boolean>(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const { applyHit, applyPlayerDamage } = useHit();
  const terrainRef = useRef<TerrainObstacle[]>([]);
  const { particles, damageNumbers, impactEffects, addImpact, addExplosion, addDamageNumber, updateEffects } = useVisualEffects();
  const { phase, end } = useGame();
  const {
    position,
    xp,
    xpToNextLevel,
    level,
    availableUpgrades,
    takenUpgrades,
    hearts,
    maxHearts,
    maxAmmo,
    invincibilityTimer,
    speed,
    firerate,
    reloadTime,
    ammo,
    isReloading,
    reloadProgress, 
    isFiring,
    setFiring,
    fireShot,
    startReload,
    updateReload,
    loseHeart,
    updateInvincibility,
    muzzleFlashTimer,
    updateMuzzleFlash,
      updateFanFire,
      startFanFire,
      fireMuzzleFlash,
  } = usePlayer();
  
  const { projectiles, addProjectile, updateProjectiles } = useProjectiles();

  
  
  const { xpOrbs, addXPOrb, updateXPOrbs } = useEnemies();
  const movePlayer = usePlayer((s) => s.move);
  const player = usePlayer.getState();
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const { enemies, updateEnemies, removeEnemy } = useEnemies();
  const { currentRoom, changeRoom } = useDungeon();
  const { playHit, playSuccess } = useAudio();
  const { items, addItem } = useInventory();
  const { summons, updateSummons, updateStatusEffects, electroMage, electroShotCounter, handleEnemyKilledBySummon } = useSummons();
  const fireTimer = useRef(0);
  const canFire = useRef(true);
  const isMouseDown = useRef(false);
  const canInteract = phase === "playing";
  const canvasRectRef = useRef<DOMRect | null>(null);
  
  useEffect(() => {
    if (canvasRef.current) {
      canvasRectRef.current = canvasRef.current.getBoundingClientRect();
    }
  }, []);

  
  useEffect(() => {
    if (currentRoom) {
      terrainRef.current = generateRoomTerrain(currentRoom.x, currentRoom.y);
    }
  }, [currentRoom]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.code);
      if (!canInteract) return;

      if (e.code === "KeyR" && !isReloading && ammo < 6) {
        startReload();
      }
    
    if (e.code === "KeyB") {
      const spawnPos = position.clone().add(new THREE.Vector3(20, 0, 0));
      useEnemies.getState().spawnDeerBoss(spawnPos);
    }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [canInteract, isReloading, ammo, startReload]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!canInteract || e.button !== 0) return;
      isMouseDown.current = true;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isMouseDown.current = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      
      // Store raw mouse position for UI components
      const rawX = e.clientX;
      const rawY = e.clientY;
      
      setMousePos({ x: rawX, y: rawY });

      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;

      mouseRef.current = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        rawX,
        rawY
      };
    };

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [canInteract]);

  useEffect(() => {
    const gameLoop = (currentTime: number) => {
      const delta = lastTimeRef.current
        ? (currentTime - lastTimeRef.current) / 1000
        : 0;

      lastTimeRef.current = currentTime;
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      

      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (currentRoom) drawDungeon(ctx);

      if (phase === "playing") {
        
        const ps = usePlayer.getState();
        updateReload(delta);
        updateInvincibility(delta);
        updateMuzzleFlash(delta);
        updateSummons(delta, position, enemies, addProjectile, playHit);
        updateFanFire(delta, () => {
          const fanIndex = usePlayer.getState().fanFireIndex;
          const angle = (fanIndex / 10) * Math.PI * 2;
          const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

          
          const stats = usePlayer.getState().getProjectileStats();

          addProjectile({
            position: ps.position.clone(),
            direction,
            size: stats.projectileSize,
            damage: stats.damage * 0.15,
            life: stats.life,
            speed: stats.speed,
            range: stats.range,
            trailLength: stats.trailLength,
            homing: false,
            piercing: stats.piercing,
            bouncing: stats.bouncing,
          });

          playHit();
        });
        
        updateStatusEffects(delta, enemies, (enemyId, damage) => {
          const enemy = enemies.find(e => e.id === enemyId);
          if (enemy) {
            enemy.health -= damage;
            if (enemy.health <= 0) {
              handleEnemyKilledBySummon();

              // SPLINTER BULLETS HERE
              const ps = usePlayer.getState();
              if (ps.splinterBullets) {
                const stats = ps.getProjectileStats();
                const addProjectile = useProjectiles.getState().addProjectile;

                for (let i = 0; i < 3; i++) {
                  const angle = (i / 3) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
                  const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

                  addProjectile({
                    position: enemy.position.clone(),
                    direction,
                    size: 1,
                    damage: stats.damage * 0.1,
                    speed: stats.speed * 1.5,
                    life: stats.life,
                    range: stats.range * 0.5,
                    trailLength: 10,
                    piercing: 2,
                    bouncing: 0,
                    homing: false,
                  });
                }
              }
            }
          }
        });


        updateEffects(delta);
        
        damagedThisFrameRef.current = false;

        if (ammo === 0 && !isReloading) {
          startReload();
        }

        if (fireTimer.current > 0) {
          fireTimer.current -= delta;
          if (fireTimer.current <= 0) {
            fireTimer.current = 0;
            canFire.current = true;
          }
        }

        setFiring(isMouseDown.current && !isReloading && ammo > 0);

        if (isMouseDown.current && !isReloading && ammo > 0 && canFire.current) {
            if (fireShot()) {
              const centerX = CANVAS_WIDTH / 2;
              const centerY = CANVAS_HEIGHT / 2;

              const stats = usePlayer.getState().getProjectileStats();
              const baseAngle = Math.atan2(
                mouseRef.current.y - centerY,
                mouseRef.current.x - centerX
              );

              // Helper function to fire a projectile in a direction
           const fireProjectileInDirection = (angle: number, damageMultiplier: number = 1) => {
                const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
                const handOffset = 8;
                const barrelLength = 28;
                const totalOffsetPixels = handOffset + barrelLength;
                const totalOffset = totalOffsetPixels / (TILE_SIZE / 2);
                
                const barrelPosition = ps.position.clone().add(
                  new THREE.Vector3(
                    Math.cos(angle) * totalOffset,
                    0,
                    Math.sin(angle) * totalOffset
                  )
                );

                addProjectile({
                  position: barrelPosition,
                  direction,
                  damage: stats.damage * damageMultiplier,
                  speed: stats.speed,
                  life: stats.life,
                  size: stats.projectileSize,
                  range: stats.range,
                  homing: stats.homing,
                  piercing: stats.piercing,
                  bouncing: stats.bouncing,
                  explosive: stats.explosive,
                  chainLightning: stats.chainLightning,
                  trailLength: stats.trailLength, // Add a default trail length
                  source: { type: "player", playerEffects: { splinterBullets: ps.splinterBullets } },
                });
              };

              // Normal projectiles
              const spreadAngle = stats.projectileCount > 1 ? 0.15 : 0;
              for (let i = 0; i < stats.projectileCount; i++) {
                let angle = baseAngle;
                if (stats.projectileCount > 1) {
                  const offset = (i - (stats.projectileCount - 1) / 2) * spreadAngle;
                  angle += offset;
                }

                const inaccuracy = (1 - stats.accuracy);
                angle += ((Math.random() / 4) - 0.125) * inaccuracy;

                fireProjectileInDirection(angle);
              }

              // Split Fire: fire behind
              if (ps.splitFire) {
                fireProjectileInDirection(baseAngle + Math.PI);
              }

              // Fan Fire: on last ammo, fire 10 bullets in a circle
              if (ps.fanFire && ammo === 1) {
                ps.startFanFire();
              }
              ps.fireMuzzleFlash();

              playHit();

              const summonState = useSummons.getState();
                if (summonState.electroMage) {
                  const newCounter = summonState.electroShotCounter + 1;
                  useSummons.setState({ electroShotCounter: newCounter });

                  if (newCounter >= 2) {
                    useSummons.setState({ electroShotCounter: 0 });

                    // Strike nearest enemy with lightning
                    if (enemies.length > 0) {
                      const nearest = enemies.reduce((acc, e) => {
                        const d = position.distanceTo(e.position);
                        return d < acc.dist ? { enemy: e, dist: d } : acc;
                      }, { enemy: null as any, dist: Infinity });

                      if (nearest.enemy && nearest.dist < 150) {
                        let damage = 22;
                        if (summonState.electroMastery) {
                          damage += 12;
                        }
                        nearest.enemy.health -= damage;

                        // Energized: 20% chance to refill 3 ammo
                        if (summonState.energized && Math.random() < 0.2) {
                          usePlayer.setState({ ammo: Math.min(ammo + 3, maxAmmo) });
                        }
                      }
                    }
                  }
                }

                
              fireTimer.current = firerate;
              canFire.current = false;
            }
          
        }


        let moveX = 0;
        let moveZ = 0;

        if (keysPressed.current.has("KeyW") || keysPressed.current.has("ArrowUp")) moveZ -= 1;
        if (keysPressed.current.has("KeyS") || keysPressed.current.has("ArrowDown")) moveZ += 1;
        if (keysPressed.current.has("KeyA") || keysPressed.current.has("ArrowLeft")) moveX -= 1;
        if (keysPressed.current.has("KeyD") || keysPressed.current.has("ArrowRight")) moveX += 1;

          if (moveX !== 0 || moveZ !== 0) { 
            usePlayer.getState().setMoving(true);
          const len = Math.sqrt(moveX ** 2 + moveZ ** 2);
          const speedModifier = isFiring && !isReloading ? 0.4 : 1;

          let dx = (moveX / len) * speed * delta * speedModifier;
          let dz = (moveZ / len) * speed * delta * speedModifier;

          let currentPos = usePlayer.getState().position.clone();
          let newPos = currentPos.clone().add(new THREE.Vector3(dx, 0, dz));

          const terrainCheck = checkTerrainCollision(newPos, terrainRef.current, 0.8);
          if (terrainCheck.collision && terrainCheck.normal) {
            dx = dx - terrainCheck.normal.x * (dx * terrainCheck.normal.x + dz * terrainCheck.normal.y);
            dz = dz - terrainCheck.normal.y * (dx * terrainCheck.normal.x + dz * terrainCheck.normal.y);
            newPos = currentPos.clone().add(new THREE.Vector3(dx, 0, dz));
            if (checkTerrainCollision(newPos, terrainRef.current, 0.8).collision) {
              newPos = currentPos;
            }
          }

          const bounced = bounceAgainstBounds(newPos, new THREE.Vector3(0,0,0), ROOM_SIZE, 1);
          usePlayer.setState({ position: bounced.position });
        } else {
          usePlayer.getState().setMoving(false);
        }

        updateProjectiles(
          delta,
          enemies,
          position,
          ROOM_SIZE,
          (enemyId, damage, knockback, projectileData) => {
            const enemy = enemies.find((e) => e.id === enemyId);
            if (enemy) {
              applyHit({
                enemy,
                damage,
                sourcePos: position,
                color: projectileData?.color || "#ffffff",
                knockbackStrength: knockback.length(),
                explosive: projectileData?.explosive,
                chainLightning: projectileData?.chainLightning,
                burn: projectileData?.burn,
                isPlayerDamage: true,
              }, enemies);

              if (enemy.health <= 0) {
                playSuccess();
                const { addExplosion } = useVisualEffects.getState();
                addExplosion(enemy.position.clone(), 25);
                removeEnemy(enemyId);

                // Splinter bullets (stays here due to addProjectile access)
                const ps = usePlayer.getState();
                if (ps.splinterBullets) {
                  for (let i = 0; i < 3; i++) {
                    const angle = (i / 3) * Math.PI * 2 + Math.random() * 0.3;
                    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
                    const stats = ps.getProjectileStats();
                    addProjectile({
                      position: enemy.position.clone(),
                      direction,
                      size: 1,
                      damage: stats.damage * 0.1,
                      speed: stats.speed * 0.8,
                      range: stats.range * 0.5,
                      trailLength: stats.trailLength,
                      homing: false,
                      piercing: 2,
                      bouncing: 0,
                    });
                  }
                }
              }
            }
          }
        );

      const updatedEnemies = enemies.map((enemy) => {
      // BOSS LOGIC
        enemy.hitFlash = Math.max(enemy.hitFlash - delta, 0);


        // #########################################################################
        if (enemy.isBoss && enemy.bossType === "deer") {
          const updated = { ...enemy };

          // Phase 2 at 50% HP
          if (!updated.isEnraged && updated.health < updated.maxHealth * 0.5) {
            updated.isEnraged = true;
            updated.maxDashCooldown = 2.0;
            updated.speed *= 1.3;
            updated.maxWindUpTime = 0.5;
          }
          const dirToPlayer = new THREE.Vector3()
            .subVectors(position, updated.position)
            .normalize();
          const distanceToPlayer = updated.position.distanceTo(position);

          
          updated.rotationY = Math.atan2(dirToPlayer.x, dirToPlayer.z);
          if (updated.attackState === "chasing") {
            
            const moveAmount = updated.speed * delta;
            updated.position.add(dirToPlayer.clone().multiplyScalar(moveAmount));

            // dash trigger
            updated.dashCooldown! -= delta;
            if (updated.dashCooldown! <= 0 && distanceToPlayer < 30 && distanceToPlayer > 8) {
              updated.attackState = "winding_up";
              updated.windUpTimer = 0;
              updated.clawWindUp = 0;
              updated.dashDirection = dirToPlayer.clone();
            }

            // Projectile attack cooldown
            updated.projectileCooldown! -= delta;
            if (updated.projectileCooldown! <= 0 && distanceToPlayer > 15) {
              updated.attackState = "projectile_attack";
              updated.projectileCooldown = updated.maxProjectileCooldown!;
            }
          }

          else if (updated.attackState === "winding_up") {
            updated.windUpTimer! += delta;
            updated.clawWindUp = Math.min(updated.windUpTimer! / updated.maxWindUpTime!, 1);
            updated.clawGlowIntensity = updated.clawWindUp;
            updated.position.add(dirToPlayer.clone().multiplyScalar(-2 * delta));

            if (updated.windUpTimer! >= updated.maxWindUpTime!) {
              updated.attackState = "dashing";
              updated.isDashing = true;
              updated.velocity = updated.dashDirection!.clone().multiplyScalar(180);
              playHit();
            }
          }

          else if (updated.attackState === "dashing") {
            const dashMove = updated.velocity.clone().multiplyScalar(delta);
            updated.position.add(dashMove);
            updated.velocity.multiplyScalar(0.52);

            if (updated.velocity.length() < 10) {
              updated.attackState = "recovering";
              updated.isDashing = false;
            }
          }

          else if (updated.attackState === "recovering") {
            updated.clawGlowIntensity = Math.max(updated.clawGlowIntensity! - delta * 3, 0);
            updated.clawWindUp = Math.max(updated.clawWindUp! - delta * 3, 0);
            updated.windUpTimer! -= delta * 2;

            if (updated.windUpTimer! <= 0) {
              updated.attackState = "chasing";
              updated.dashCooldown = updated.maxDashCooldown;
              updated.velocity.set(0, 0, 0);
            }
          }

          else if (updated.attackState === "projectile_attack") {
            const projectileCount = updated.isEnraged ? 16 : 12;

            for (let i = 0; i < projectileCount; i++) {
              const angle = (i / projectileCount) * Math.PI * 2;
              const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

              addProjectile({
                position: updated.position.clone().add(direction.clone().multiplyScalar(2)),
                direction,
                size: 4,
                damage: 1,
                speed: 40,
                range: 80,
                trailLength: 15,
                homing: false,
                piercing: 0,
                bouncing: 0,
              });
            }

            playHit();
            updated.attackState = "recovering";
            updated.windUpTimer = 0.3;
          }

          return updated;
        }
        const dx = position.x - enemy.position.x;
        const dz = position.z - enemy.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance <= enemy.detectionRange) {
          const dirX = dx / distance;
          const dirZ = dz / distance;

          const moveAmount = enemy.speed * delta;
          const newEnemyPos = new THREE.Vector3(
            enemy.position.x + dirX * moveAmount,
            0,
            enemy.position.z + dirZ * moveAmount,
          );

          const enemyTerrainCheck = checkTerrainCollision(
            newEnemyPos,
            terrainRef.current,
            0.7,
          );

          if (!enemyTerrainCheck.collision) {
            enemy.position.x = newEnemyPos.x;
            enemy.position.z = newEnemyPos.z;
          }
        } 

        if (!enemy.velocity) enemy.velocity = new THREE.Vector3(0, 0, 0);

        const velNewPos = new THREE.Vector3(
          enemy.position.x + enemy.velocity.x * delta,
          0,
          enemy.position.z + enemy.velocity.z * delta,
        );

        const velTerrainCheck = checkTerrainCollision(
          velNewPos,
          terrainRef.current,
          0.7,
        );

        if (!velTerrainCheck.collision) {
          enemy.position.x = velNewPos.x;
          enemy.position.z = velNewPos.z;
        } else {
          enemy.velocity.multiplyScalar(-0.5);
        }

        enemy.velocity.multiplyScalar(Math.max(0, 1 - 6 * delta));

        const bouncedEnemy = bounceAgainstBounds(
          enemy.position,
          enemy.velocity,
          ROOM_SIZE,
          0.6,
        );
        enemy.position.copy(bouncedEnemy.position);
        enemy.velocity.copy(bouncedEnemy.velocity);

        return enemy;
      });
          

        for (let i = 0; i < updatedEnemies.length; i++) {
          for (let j = i + 1; j < updatedEnemies.length; j++) {
            const e1 = updatedEnemies[i];
            const e2 = updatedEnemies[j];
            const dx = e1.position.x - e2.position.x;
            const dz = e1.position.z - e2.position.z;
            const dist = Math.hypot(dx, dz);
            const minDist = 2;
            e1.position.x += Math.sin(Math.random() * 10) * 0.002;

            if (dist > 0 && dist < minDist) {
              const push = (minDist - dist) / 2;
              const nx = dx / dist;
              const nz = dz / dist;
              e1.position.x += nx * push;
              e1.position.z += nz * push;
              e2.position.x -= nx * push;
              e2.position.z -= nz * push;
            }
          }
        }

        const PLAYER_RADIUS = 0.8;
        const ENEMY_RADIUS = 0.7;
        const DAMPING = 1.5;

        const aliveEnemies: typeof updatedEnemies = [];

        for (const enemy of updatedEnemies) {
          const dx = enemy.position.x - position.x;
          const dz = enemy.position.z - position.z;
          const dist = Math.hypot(dx, dz);

          if (dist > 0 && dist < PLAYER_RADIUS + ENEMY_RADIUS) {
            if (enemy.canAttack && invincibilityTimer <= 0 && !damagedThisFrameRef.current) {
              applyPlayerDamage(1, enemy.position);
              enemy.attackCooldown = enemy.maxAttackCooldown;
              damagedThisFrameRef.current = true;
            }
          }

          if (!enemy.velocity) enemy.velocity = new THREE.Vector3(0, 0, 0);
          enemy.velocity.multiplyScalar(Math.max(0, 1 - DAMPING * delta));

          const bounced = bounceAgainstBounds(
            enemy.position,
            enemy.velocity,
            ROOM_SIZE,
            0.6,
          );
          enemy.position.copy(bounced.position);
          enemy.velocity.copy(bounced.velocity);

          if (enemy.health <= 0) {
            handleEnemyDeath(enemy);
            continue;
          }

          aliveEnemies.push(enemy);
        }

        updateXPOrbs(delta, position);
        updateEnemies(aliveEnemies);
        
        

        useEnemies.getState().updateAutoSpawn(delta, player.position);

        if (hearts <= 0) end();
      }

      enemies.forEach(enemy => drawEnemy(ctx, enemy));
      drawPlayer(ctx);
      drawSummons(ctx);
      drawStatusEffects(ctx);
      drawImpactEffects(ctx); // ADD - behind projectiles
      drawProjectilesAndTrails(ctx, phase !== "playing", position); 
      drawParticles(ctx); 
      drawDamageNumbers(ctx); 
      drawXPOrbs(ctx);
      drawReloadIndicator(ctx);
      drawWeapon(ctx, "revolver", phase !== "playing");
      
      
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    position,
    speed,
    enemies,
    updateEnemies,
    phase,
  ]);

  function handleEnemyDeath(enemy: Enemy) {
    const ps = usePlayer.getState();

    addXPOrb(enemy.position.clone(), 25);
    addExplosion(enemy.position.clone(), 25);
    removeEnemy(enemy.id);
    
    if (ps.splinterBullets) {
      const stats = ps.getProjectileStats();
      const addProjectile = useProjectiles.getState().addProjectile;

      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

        addProjectile({
          position: enemy.position.clone(),
          size: 1.5,
          direction,
          damage: stats.damage * 0.1,
          speed: stats.speed * 1.5,
          life: 0.2,
          range: stats.range * 0.01,
          trailLength: 0.5,
          piercing: 0,
          bouncing: 0,
          homing: false,
        });
      }
    }
  }



  const drawDungeon = (ctx: CanvasRenderingContext2D) => {
    if (!currentRoom) return;

    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    const floorSize = ROOM_SIZE * TILE_SIZE;

    const offsetX = (-position.x * TILE_SIZE) / 2;
    const offsetZ = (-position.z * TILE_SIZE) / 2;

    // ============================================
    // DARK STONE FLOOR (20MTD Style - OPTIMIZED)
    // ============================================

    // Base dark floor color
    ctx.fillStyle = "#1a1a1c";
    ctx.fillRect(
      centerX - floorSize / 2 + offsetX,
      centerY - floorSize / 2 + offsetZ,
      floorSize,
      floorSize,
    );

    // Seeded random for consistent pattern
    const seed = currentRoom.x * 1000 + currentRoom.y;
    const seededRandom = (n: number) => {
      const x = Math.sin(seed + n) * 1000;
      return x - Math.floor(x);
    };

    // Draw subtle stone pattern (MUCH fewer tiles)
    const stoneSize = 80; // Larger tiles = less drawing
    const rows = Math.ceil(floorSize / stoneSize) + 1;
    const cols = Math.ceil(floorSize / stoneSize) + 1;

    ctx.strokeStyle = "#0f0f10";
    ctx.lineWidth = 1;

    // Draw stone tile lines
    for (let row = 0; row <= rows; row++) {
      const y = centerY - floorSize / 2 + offsetZ + row * stoneSize;
      ctx.beginPath();
      ctx.moveTo(centerX - floorSize / 2 + offsetX, y);
      ctx.lineTo(centerX + floorSize / 2 + offsetX, y);
      ctx.stroke();
    }

    for (let col = 0; col <= cols; col++) {
      const x = centerX - floorSize / 2 + offsetX + col * stoneSize;
      ctx.beginPath();
      ctx.moveTo(x, centerY - floorSize / 2 + offsetZ);
      ctx.lineTo(x, centerY + floorSize / 2 + offsetZ);
      ctx.stroke();
    }

    // Add occasional dark spots (very few)
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    for (let i = 0; i < 20; i++) {
      if (seededRandom(i * 123) > 0.7) {
        const x = centerX - floorSize / 2 + offsetX + seededRandom(i * 234) * floorSize;
        const y = centerY - floorSize / 2 + offsetZ + seededRandom(i * 345) * floorSize;
        ctx.beginPath();
        ctx.arc(x, y, 2 + seededRandom(i) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Add subtle vignette (simple gradient)
    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      floorSize * 0.3,
      centerX,
      centerY,
      floorSize * 0.7
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.4)");

    ctx.fillStyle = gradient;
    ctx.fillRect(
      centerX - floorSize / 2 + offsetX,
      centerY - floorSize / 2 + offsetZ,
      floorSize,
      floorSize,
    );

    // ============================================
    // TERRAIN OBSTACLES
    // ============================================

    terrainRef.current.forEach((obstacle) => {
      const screenX = centerX + ((obstacle.x - position.x) * TILE_SIZE) / 2;
      const screenY = centerY + ((obstacle.z - position.z) * TILE_SIZE) / 2;
      const w = (obstacle.width * TILE_SIZE) / 2;
      const h = (obstacle.height * TILE_SIZE) / 2;

      if (obstacle.type === "rock") {
        // Dark rock
        ctx.fillStyle = "#2a2a2c";
        ctx.fillRect(screenX - w / 2, screenY - h / 2, w, h);

        // Simple texture
        ctx.fillStyle = "#1f1f21";
        ctx.fillRect(screenX - w / 2 + 2, screenY - h / 2 + 2, w / 3, h / 3);

        // Outline
        ctx.strokeStyle = "#0f0f10";
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX - w / 2, screenY - h / 2, w, h);
      } else if (obstacle.type === "pillar") {
        // Dark pillar
        ctx.fillStyle = "#3a3a3c";
        ctx.beginPath();
        ctx.arc(screenX, screenY, w / 2, 0, Math.PI * 2);
        ctx.fill();

        // Shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.beginPath();
        ctx.ellipse(screenX + 2, screenY + 2, w / 2 - 1, w / 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // ============================================
    // WALLS
    // ============================================

    ctx.fillStyle = "#2a2a2c";
    const wallThickness = 20;

    if (!currentRoom.exits.includes("north")) {
      ctx.fillRect(
        centerX - floorSize / 2 + offsetX,
        centerY - floorSize / 2 - wallThickness + offsetZ,
        floorSize,
        wallThickness,
      );
    }
    if (!currentRoom.exits.includes("south")) {
      ctx.fillRect(
        centerX - floorSize / 2 + offsetX,
        centerY + floorSize / 2 + offsetZ,
        floorSize,
        wallThickness,
      );
    }
    if (!currentRoom.exits.includes("east")) {
      ctx.fillRect(
        centerX + floorSize / 2 + offsetX,
        centerY - floorSize / 2 + offsetZ,
        wallThickness,
        floorSize,
      );
    }
    if (!currentRoom.exits.includes("west")) {
      ctx.fillRect(
        centerX - floorSize / 2 - wallThickness + offsetX,
        centerY - floorSize / 2 + offsetZ,
        wallThickness,
        floorSize,
      );
    }
  };

  const drawXPOrbs = (ctx: CanvasRenderingContext2D) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    xpOrbs.forEach((orb) => {
      const screenX = centerX + ((orb.position.x - position.x) * TILE_SIZE) / 2;
      const screenY = centerY + ((orb.position.z - position.z) * TILE_SIZE) / 2;

      const sprite = xpSprite; // assume you imported or loaded xp.png as xpImage

      if (sprite.complete) {
        const scale = 3; // adjust size as needed
        const w = sprite.width * scale;
        const h = sprite.height * scale;

        ctx.save();
        ctx.imageSmoothingEnabled = false; // pixelated
        ctx.translate(screenX, screenY);
        ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
        ctx.restore();
      }
    });
  };

  const drawReloadIndicator = (ctx: CanvasRenderingContext2D) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    if (isReloading) {
      const radius = 40;
      const barHeight = 8;
      const barY = centerY - 60;

      // Background bar
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(centerX - radius, barY, radius * 2, barHeight);

      // Progress bar with color gradient
      const progress = reloadProgress / reloadTime;
      const barWidth = radius * 2 * progress;

      const gradient = ctx.createLinearGradient(
        centerX - radius, barY,
        centerX + radius, barY
      );
      gradient.addColorStop(0, "#ff8800");
      gradient.addColorStop(0.5, "#ffaa00");
      gradient.addColorStop(1, "#ffcc00");

      ctx.fillStyle = gradient;
      ctx.fillRect(centerX - radius, barY, barWidth, barHeight);

      // Border with glow
      ctx.strokeStyle = "#ffaa00";
      ctx.lineWidth = 2;
      ctx.strokeRect(centerX - radius, barY, radius * 2, barHeight);

      // Outer glow
      ctx.strokeStyle = "rgba(255, 170, 0, 0.3)";
      ctx.lineWidth = 4;
      ctx.strokeRect(centerX - radius - 1, barY - 1, radius * 2 + 2, barHeight + 2);

      // Text with animation
      const textScale = 1 + Math.sin(progress * Math.PI * 4) * 0.1;
      ctx.save();
      ctx.translate(centerX, barY - 12);
      ctx.scale(textScale, textScale);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText("RELOADING", 0, 0);

      ctx.restore();

      // Spinning chamber indicator
      const spinAngle = progress * Math.PI * 4;
      ctx.save();
      ctx.translate(centerX, barY + barHeight + 15);
      ctx.rotate(spinAngle);

      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const x = Math.cos(angle) * 8;
        const y = Math.sin(angle) * 8;

        ctx.fillStyle = i < Math.floor(progress * 6) ? "#00ff00" : "#333333";
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  };

  const drawWeapon = (
    ctx: CanvasRenderingContext2D,
    type: string,
    isPaused: boolean
  ) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    const dx = mouseRef.current.x - centerX;
    const dy = mouseRef.current.y - centerY;
    const mouseAngle = Math.atan2(dy, dx);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(centerX, centerY);

    if (type === "revolver") {
      
      const scale = 2;
      let gunRotation = mouseAngle;
      
      

      // Reload spin (spin around its own axis)
      if (isReloading) {
        const p = reloadProgress / reloadTime;
        const spins = 2;
        gunRotation += spins * 2 * Math.PI * p;
      }

      const flipGun = Math.abs(mouseAngle) > Math.PI / 2;

      
      
      ctx.rotate(gunRotation);
      ctx.translate(-10, 0);

      ctx.scale(-scale, scale);
      
      if (flipGun) ctx.scale(1, -1);
      // ===========================
      // REVOLVER SPRITE
      // ===========================
      const sprite = WeaponSprites.revolver;
      if (sprite.complete) {
        ctx.save();
        const w = sprite.width;
        const h = sprite.height;

        // Grip anchor: left-middle of sprite
        ctx.drawImage(sprite, -w, -h / 2, w, h);

        ctx.restore();
      }
      // ===========================
      // MUZZLE FLASH
      // ===========================
      if (muzzleFlashTimer > 0) {
        ctx.scale(scale, scale)
        const flashAlpha = muzzleFlashTimer / 0.1;
        const flashSize = 5 + (1 - flashAlpha) * 2.5;

        ctx.save();
        ctx.globalAlpha = flashAlpha * 0.8;

        
        const flashX = 15; // scale adjustment
        const flashY = 0;

        const gradient = ctx.createRadialGradient(-flashX, -flashY, 0, -flashX, -flashY, flashSize);
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(0.4, "#ffff88");
        gradient.addColorStop(0.7, "#ff8800");
        gradient.addColorStop(1, "rgba(255,136,0,0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(-flashX, -flashY, flashSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }


    ctx.restore();
  };

  const drawProjectilesAndTrails = (
    ctx: CanvasRenderingContext2D,
    isPaused: boolean,
    playerPos: THREE.Vector3
  ) => {
    const { projectiles } = useProjectiles.getState();
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    
    const worldToScreen = (pos: THREE.Vector3) => ({
      x: centerX + ((pos.x - playerPos.x) * TILE_SIZE) / 2,
      y: centerY + ((pos.z - playerPos.z) * TILE_SIZE) / 2,
    });

    ctx.save();
    const img = getProjectileImage();

    projectiles.forEach((proj) => {
      const trail = proj.trailHistory;

      // --- SPRITE TRAIL ---
      for (let i = 0; i < trail.length; i++) {
        const t = i / trail.length; // 0 = head, 1 = tail
        const alpha = 1;
        const scale = 1 - t * 0.9;

        const p = worldToScreen(trail[i]);
        const size = proj.size * 60 * scale;

        ctx.globalAlpha = alpha;
        ctx.drawImage(
          img,
          p.x - size / 2,
          p.y - size / 2,
          size,
          size
        );
      }

      // --- MAIN BULLET (brightest, full size) ---
      const screen = worldToScreen(proj.position);
      const mainSize = proj.size * 60;
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
      ctx.drawImage(
        img,
        screen.x - mainSize / 2,
        screen.y - mainSize / 2,
        mainSize,
        mainSize
      );
    });

    ctx.globalAlpha = 1;

    ctx.restore();
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    ctx.save();

    particles.forEach(particle => {
      const screenX = centerX + ((particle.position.x - position.x) * TILE_SIZE) / 2;
      const screenY = centerY + ((particle.position.z - position.z) * TILE_SIZE) / 2;

      ctx.globalAlpha = particle.alpha;

      if (particle.type === "spark") {
        // Bright yellow/white sparks
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(screenX, screenY, particle.size, 0, Math.PI * 2);
        ctx.fill();

        // Glow
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.alpha * 0.3;
        ctx.beginPath();
        ctx.arc(screenX, screenY, particle.size * 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Impact and explosion particles
        const gradient = ctx.createRadialGradient(
          screenX, screenY, 0,
          screenX, screenY, particle.size
        );
        gradient.addColorStop(0, particle.color);
        gradient.addColorStop(0.7, particle.color + "aa");
        gradient.addColorStop(1, particle.color + "00");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.restore();
  };

  const drawImpactEffects = (ctx: CanvasRenderingContext2D) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    
    ctx.save();

    impactEffects.forEach(impact => {
      // Compute screen position
      const screenX = centerX + ((impact.x - position.x) * TILE_SIZE) / 2;
      const screenY = centerY + ((impact.y - position.z) * TILE_SIZE) / 2;

      // Compute fade alpha (optional)
      const alpha = impact.alpha ?? 1;

      // Compute size (optional scaling over lifetime)
      const lifePercent = impact.life / impact.frameDuration; // percent through current frame
      const size = impact.size * (1 + lifePercent * 0.2); // subtle growth effect

      // Get current frame sprite
      const frame = impact.frames[impact.currentFrame];

      if (frame.complete) {
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = alpha;
        if(frame.complete) {
        ctx.drawImage(frame, -size / 2, -size / 2, size, size);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    });

    ctx.restore();
  };


  const drawDamageNumbers = (ctx: CanvasRenderingContext2D) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    damageNumbers.forEach(dmg => {
      const screenX = centerX + ((dmg.x - position.x) * TILE_SIZE) / 2;
      const screenY = centerY + ((dmg.y - position.z) * TILE_SIZE) / 2;

      const lifePercent = dmg.life / dmg.maxLife;
      const alpha = lifePercent < 0.7 ? 1 : (1 - (lifePercent - 0.7) / 0.3);

      ctx.globalAlpha = alpha;

      // Scale and positioning
      const scale = dmg.scale;
      const fontSize = 15 * scale;

      ctx.font = `bold ${fontSize}px Press Start monospace`;

      // Outline
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 4;
      ctx.strokeText(dmg.damage.toString(), screenX, screenY);

      // White text
      ctx.fillStyle = "#ffffff";
      ctx.fillText(dmg.damage.toString(), screenX, screenY);
    });

    ctx.restore();
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    ctx.save();
    ctx.translate(centerX, centerY);

    // Flashing effect during invincibility
    if (invincibilityTimer > 0) {
      const flashFrequency = 0.15; // Flash every 150ms
      const flash = Math.sin((invincibilityTimer / flashFrequency) * Math.PI * 4) > 0;
      if (!flash) {
        ctx.restore();
        return; // Skip drawing to create flash effect
      }
    }

    ctx.fillStyle = "#4a9eff";
    ctx.beginPath();
    
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();

    const { items, equippedWeaponId } = useInventory.getState();
    const weapon = items.find((i) => i.id === equippedWeaponId);
    if (weapon) drawWeapon(ctx, weapon.name.toLowerCase());

    ctx.restore();
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, enemy: any) => {
    if (!enemy || !enemy.position) return;
    if (enemy.position.x == null || enemy.position.z == null) return;

    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    const screenX =
      centerX + ((enemy.position.x - position.x) * TILE_SIZE) / 2;
    const screenY =
      centerY + ((enemy.position.z - position.z) * TILE_SIZE) / 2;

    const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    // Animation inputs
    const wind = easeOut(
      typeof enemy.clawWindUp === "number"
        ? clamp(enemy.clawWindUp)
        : enemy.attackState === "winding_up"
        ? 1
        : 0
    );

    const dash = easeOut(
      typeof enemy.dashProgress === "number"
        ? clamp(enemy.dashProgress)
        : enemy.isDashing
        ? 1
        : 0
    );

    // ================================================================
    // SKELETON BOSS
    // ================================================================
    if (enemy.isBoss && enemy.bossType === "deer") {
      const baseRadius = 24;
      const radius = enemy.isEnraged ? baseRadius * 1.15 : baseRadius;
      const bob = Math.sin(Date.now() / 120) * 1.2;

      const smearStrength = Math.max(wind, dash);
      const smearLen = 52 * smearStrength;

      ctx.save();
      ctx.translate(screenX, screenY + bob);
      ctx.rotate(enemy.rotationY ?? 0);

      // ---------------- Shadow ----------------

      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.ellipse(0, 7, radius * 1.15, radius * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      // ---------------- Smear (charge motion) ----------------
      if (smearLen > 1) {
        for (let i = 4; i >= 1; i--) {
          const t = i / 4;
          ctx.globalAlpha = 0.2 * (1 - t);
          ctx.beginPath();
          ctx.ellipse(
            -smearLen * t,
            0,
            radius + smearLen * 0.15 * t,
            radius * (0.85 - 0.1 * t),
            0,
            0,
            Math.PI * 2
          );
          ctx.fillStyle = "#d6d6d6";
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // ---------------- Skull ----------------
      ctx.fillStyle = enemy.isEnraged ? "#e6e6e6" : "#f2f2f2";
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 3;
      ctx.strokeStyle = "#444";
      ctx.stroke();

      // ---------------- Cracks ----------------
      ctx.strokeStyle = "#666";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(-12, -12);
      ctx.moveTo(4, -10);
      ctx.lineTo(8, -18);
      ctx.stroke();

      // ---------------- Eye sockets ----------------
      ctx.fillStyle = enemy.isEnraged ? "#ff2a2a" : "#000";
      ctx.beginPath();
      ctx.arc(-7, -4, 4, 0, Math.PI * 2);
      ctx.arc(7, -4, 4, 0, Math.PI * 2);
      ctx.fill();

      // ---------------- Nasal cavity ----------------
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(-2, 4);
      ctx.lineTo(2, 4);
      ctx.closePath();
      ctx.fill();

      // ---------------- Jaw notch ----------------
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, 10);
      ctx.lineTo(8, 10);
      ctx.stroke();

      ctx.restore();

      // ---------------- Impact flash ----------------
      if (dash > 0.6) {
        const t = clamp((dash - 0.6) / 0.4);
        ctx.save();
        ctx.globalAlpha = Math.sin(t * Math.PI) * 0.8;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(
          screenX + Math.cos(enemy.rotationY ?? 0) * radius * 1.4,
          screenY + Math.sin(enemy.rotationY ?? 0) * radius * 1.4,
          18 * t,
          12 * t,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
      }

      // ---------------- Health Bar ----------------
      const barW = 80;
      const barH = 8;
      const barY = screenY - radius - 30;
      const hpPct = Math.max(0, enemy.health / enemy.maxHealth);

      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(screenX - barW / 2 - 2, barY - 2, barW + 4, barH + 4);

      ctx.fillStyle = "#ff0000";
      ctx.fillRect(screenX - barW / 2, barY, barW, barH);

      ctx.fillStyle =
        hpPct > 0.5 ? "#00ff00" : hpPct > 0.25 ? "#ffaa00" : "#ff4444";
      ctx.fillRect(screenX - barW / 2, barY, barW * hpPct, barH);

      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(screenX - barW / 2, barY, barW, barH);

      ctx.font = "bold 14px monospace";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText("SKELETON COLOSSUS", screenX, barY - 10);

      return;
    }

    // ================================================================
    // NORMAL SKELETON ENEMY
    // ================================================================
    const size = enemySprite.size * enemySprite.scale;
    const facingRight = enemy.position.x >= position.x;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.imageSmoothingEnabled = false;

    if (!facingRight) ctx.scale(-1, 1);

    // Base sprite
    

    // Hit flash (white overlay)
    if (enemy.hitFlash > 0) {
      ctx.drawImage(enemyFlashSprite.img, -size/2, -size/2, size, size);
    } else {ctx.drawImage(enemySprite.img, -size / 2, -size / 2, size, size);}
    
    ctx.restore();
  };

  const drawSummons = (ctx: CanvasRenderingContext2D) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    
    summons.forEach(summon => {
      const screenX = centerX + ((summon.position.x - position.x) * TILE_SIZE) / 2;
      const screenY = centerY + ((summon.position.z - position.z) * TILE_SIZE) / 2;


      if (summon.type === "ghost") {
        // Semi-transparent ghostly body
        ctx.globalAlpha = 0.7;

        // Main body
        ctx.fillStyle = "#88ccff";
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();

        // Glow
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#88ccff";
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(-4, -2, 2, 0, Math.PI * 2);
        ctx.arc(4, -2, 2, 0, Math.PI * 2);
        ctx.fill();

        // Wavy tail
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#88ccff";
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(0, 12 + i * 4, 10 - i * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      else if (summon.type === "scythe") {
          const sprite = SummonSprites.scythe;
          if (!sprite.complete) return;
          
          const scale = 4;
          const w = sprite.width * scale;
          const h = sprite.height * scale;
    
          ctx.save();
          ctx.imageSmoothingEnabled = false;

          // Rotate so the blade leads the orbit
          
          ctx.rotate(0);
          ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
          ctx.restore();
        }
      else if (summon.type === "spear") {
        // Sharp spear
        ctx.fillStyle = "#ffaa00";
        ctx.strokeStyle = "#cc8800";
        ctx.lineWidth = 2;

        // Spearhead
        ctx.beginPath();
        ctx.moveTo(0, -25);
        ctx.lineTo(5, -15);
        ctx.lineTo(2, -12);
        ctx.lineTo(0, -18);
        ctx.lineTo(-2, -12);
        ctx.lineTo(-5, -15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Shaft
        ctx.fillStyle = "#8b4513";
        ctx.fillRect(-2, -12, 4, 30);

        // Glow
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = "#ffaa00";
        ctx.beginPath();
        ctx.arc(0, -15, 10, 0, Math.PI * 2);
        ctx.fill();
      }
      
          else if (summon.type === "dagger") {
            const sprite = SummonSprites.dagger;
            const img = getProjectileImage();

            const canDrawDagger =
              sprite.complete && sprite.naturalWidth > 0;

            const canDrawTrail =
              img.complete && img.naturalWidth > 0;

            // --- TRAIL ---
            if (summon.trail && canDrawTrail) {
              for (let i = summon.trail.length - 1; i >= 0; i--) {
                const p = summon.trail[i];

                const x = centerX + ((p.x - position.x) * TILE_SIZE) / 2;
                const y = centerY + ((p.z - position.z) * TILE_SIZE) / 2;

                const t = i / summon.trail.length;
                const size = 120 * (1 - t * 0.9);

                ctx.save();
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
                ctx.restore();
              }
            }

            // --- MAIN DAGGER ---
            if (!canDrawDagger) return; // ← safe here ONLY if this is inside a dagger block

            const screenX =
              centerX + ((summon.position.x - position.x) * TILE_SIZE) / 2;
            const screenY =
              centerY + ((summon.position.z - position.z) * TILE_SIZE) / 2;

            const scale = 2;
            const w = sprite.naturalWidth * scale;
            const h = sprite.naturalHeight * scale;

            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(summon.rotation);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
            ctx.restore();
          }

                               
      else if (summon.type === "electrobug") {
        // Small electric bug
        ctx.fillStyle = "#00ffff";

        // Body
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wings
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = "#00ffff";
        ctx.beginPath();
        ctx.ellipse(-6, -2, 5, 3, -0.3, 0, Math.PI * 2);
        ctx.ellipse(6, -2, 5, 3, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Electric glow
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#00ffff";
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();

        // Antennae
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-3, -6);
        ctx.lineTo(-5, -10);
        ctx.moveTo(3, -6);
        ctx.lineTo(5, -10);
        ctx.stroke();
      }

      ctx.restore();
    });
  };
  

  const drawStatusEffects = (ctx: CanvasRenderingContext2D) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    const { statusEffects } = useSummons.getState();

    statusEffects.forEach(effect => {
      const enemy = enemies.find(e => e.id === effect.enemyId);
      if (!enemy) return;

      const screenX = centerX + ((enemy.position.x - position.x) * TILE_SIZE) / 2;
      const screenY = centerY + ((enemy.position.z - position.z) * TILE_SIZE) / 2;

      if (effect.type === "burn") {
        // Flame particles
        ctx.fillStyle = "#ff6600";
        ctx.globalAlpha = 0.8;
        for (let i = 0; i < 3; i++) {
          const angle = (Date.now() / 200 + i) % (Math.PI * 2);
          const x = screenX + Math.cos(angle) * 15;
          const y = screenY + Math.sin(angle) * 15 - 10;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (effect.type === "curse") {
        // Dark aura
        ctx.strokeStyle = "#9900ff";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 20 + Math.sin(Date.now() / 200) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    ctx.globalAlpha = 1;
  };


  return (
    <>
      <div
        className=""
        style={{ cursor: phase === "playing" ? "none" : "default" }}
      >
      <Darkness />
      <LevelUpScreen />
      <GameUI />
      
      
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-gray-700"
        
      />
        
      <CursorSprite
        x={mousePos.x}
        y={mousePos.y}
      />
      </div>
    </>
  );

}