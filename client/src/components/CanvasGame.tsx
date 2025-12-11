
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
import { useSpellSlots } from "../lib/stores/useSpellSlots";
import { useProjectiles } from "../lib/stores/useProjectiles";
import { useXP } from "../lib/stores/useXP";


import swordSrc from "/images/sword.png";
import GameUI from "./GameUI"  
import { any } from "zod";
import { LevelUpScreen } from "./GameUI";
import Darkness from "./Darkness";

const TILE_SIZE = 50;
const CANVAS_WIDTH = 1490;
const CANVAS_HEIGHT = 750;
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

// Generate cave-like terrain for a room
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
  const terrainRef = useRef<TerrainObstacle[]>([]);

  const { phase, end } = useGame();
  const {
    position,
    hearts,
    maxHearts,
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
  } = usePlayer();
  const { slots, activeSlotId, getSlotStats, startCooldown, updateCooldowns } = useSpellSlots();
  const { projectiles, addProjectile, updateProjectiles } = useProjectiles();

  const [showCardManager, setShowCardManager] = useState(false);
  const { xp, level, xpToNextLevel } = useXP();
  const { xpOrbs, addXPOrb, updateXPOrbs } = useEnemies();
  const movePlayer = usePlayer((s) => s.move);
  const player = usePlayer.getState();
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const { enemies, updateEnemies, removeEnemy } = useEnemies();
  const { currentRoom, changeRoom } = useDungeon();
  const { playHit, playSuccess } = useAudio();
  const { items, addItem } = useInventory();

  const fireTimer = useRef(0);
  const canFire = useRef(true);
  const isMouseDown = useRef(false);
  const canInteract = phase === "playing" || showCardManager;

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

      if (e.code === "KeyC") {
        setShowCardManager((prev) => !prev);
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
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      mouseRef.current = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
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

      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (currentRoom) drawDungeon(ctx);

      if (phase === "playing") {
        updateReload(delta);
        updateInvincibility(delta);
        updateFreshClip(delta);
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
          const activeSlot = slots.find(s => s.id === activeSlotId);
          if (activeSlot && !activeSlot.isOnCooldown) {
            if (fireShot()) {
              const centerX = CANVAS_WIDTH / 2;
              const centerY = CANVAS_HEIGHT / 2;

              // Get combined stats
              const slotStats = getSlotStats(activeSlotId);
              const playerStats = usePlayer.getState().getProjectileStats();

              const stats = {
                damage: slotStats.damage + playerStats.damage - 100,
                speed: slotStats.speed * (playerStats.speed / 80),
                range: slotStats.range * (playerStats.range / 50),
                projectileCount: Math.max(slotStats.projectileCount, playerStats.projectileCount),
                homing: slotStats.homing || playerStats.homing,
                piercing: Math.max(slotStats.piercing, playerStats.piercing),
                bouncing: Math.max(slotStats.bouncing, playerStats.bouncing),
                explosive: slotStats.explosive || playerStats.explosive,
                chainLightning: slotStats.chainLightning || playerStats.chainLightning,
                accuracy: Math.min(slotStats.accuracy, playerStats.accuracy),
                trailLength: slotStats.trailLength,
              };

              const ps = usePlayer.getState();
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
                  slotId: activeSlotId,
                  damage: stats.damage * damageMultiplier,
                  speed: stats.speed,
                  range: stats.range,
                  trailLength: stats.trailLength,
                  homing: stats.homing,
                  piercing: stats.piercing,
                  bouncing: stats.bouncing,
                  explosive: stats.explosive,
                  chainLightning: stats.chainLightning,
                });
              };

              // Normal projectiles
              const spreadAngle = stats.projectileCount > 1 ? 0.2 : 0;
              for (let i = 0; i < stats.projectileCount; i++) {
                let angle = baseAngle;
                if (stats.projectileCount > 1) {
                  const offset = (i - (stats.projectileCount - 1) / 2) * spreadAngle;
                  angle += offset;
                }

                const inaccuracy = (1 - stats.accuracy);
                angle += (Math.random() - 0.5) * inaccuracy;

                fireProjectileInDirection(angle);
              }

              // Split Fire: fire behind
              if (ps.splitFire) {
                fireProjectileInDirection(baseAngle + Math.PI);
              }

              // Fan Fire: on last ammo, fire 10 bullets in a circle
              if (ps.fanFire && ammo === 1) {
                for (let i = 0; i < 10; i++) {
                  const fanAngle = (i / 10) * Math.PI * 2;
                  fireProjectileInDirection(fanAngle, 0.15);
                }
              }

              playHit();
              fireTimer.current = firerate;
              canFire.current = false;
            }
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
          (enemyId, damage, knockback) => {
            const enemy = enemies.find((e) => e.id === enemyId);
            if (enemy) {
              enemy.health -= damage;
              if (!enemy.velocity) enemy.velocity = new THREE.Vector3(0, 0, 0);
              enemy.velocity.add(knockback);
              playHit();
              if (enemy.health <= 0) {
                playSuccess();
                addXPOrb(enemy.position.clone(), 25);

                // ADD THESE SPECIAL EFFECTS:
                const ps = usePlayer.getState();

                // Kill Clip: add stack
                ps.addKillClipStack();

                // Splinter Bullets: explode into 3 bullets
                if (ps.splinterBullets) {
                  for (let i = 0; i < 3; i++) {
                    const angle = (i / 3) * Math.PI * 2;
                    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

                    addProjectile({
                      position: enemy.position.clone(),
                      direction,
                      slotId: activeSlotId,
                      damage: ps.baseDamage * 0.1,
                      speed: ps.baseProjectileSpeed * 0.8,
                      range: ps.baseProjectileRange * 0.5,
                      trailLength: 50,
                      homing: false,
                      piercing: 0,
                      bouncing: 0,
                    });
                  }
                }

                removeEnemy(enemyId);
              }
            }
          },
        );

        const updatedEnemies = enemies.map((enemy) => {
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

          if (enemy.attackCooldown > 0) {
            enemy.attackCooldown -= delta;
            if (enemy.attackCooldown <= 0) enemy.canAttack = true;
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
            const minDist = 1.5;
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

        const PLAYER_RADIUS = 1.1;
        const ENEMY_RADIUS = 0.7;
        const DAMPING = 1.5;

        const aliveEnemies: typeof updatedEnemies = [];

        for (const enemy of updatedEnemies) {
          const dx = enemy.position.x - position.x;
          const dz = enemy.position.z - position.z;
          const dist = Math.hypot(dx, dz);

          if (dist > 0 && dist < PLAYER_RADIUS + ENEMY_RADIUS) {
            if (enemy.canAttack && invincibilityTimer <= 0 && !damagedThisFrameRef.current) {
              loseHeart();
              playHit();
              enemy.canAttack = false;
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
            playSuccess();
            addXPOrb(enemy.position.clone(), 25);
            removeEnemy(enemy.id);
            continue;
          }

          aliveEnemies.push(enemy);
        }

        updateXPOrbs(delta, position);
        updateEnemies(aliveEnemies);
        updateCooldowns(delta);
        

        useEnemies.getState().updateAutoSpawn(delta, player.position);

        if (hearts <= 0) end();
      }

      enemies.forEach(enemy => drawEnemy(ctx, enemy));
      drawPlayer(ctx);
      drawProjectilesAndTrails(ctx, phase !== "playing", position);
      drawXPOrbs(ctx);
      drawXPBar(ctx);
      drawReloadIndicator(ctx);
      drawCustomCursor(ctx);
      drawWeapon(ctx, "revolver")

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

  const drawCustomCursor = (ctx: CanvasRenderingContext2D) => {
    const x = mouseRef.current.x;
    const y = mouseRef.current.y;

    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${ammo}/6`, x + 20, y);
  };

  const drawDungeon = (ctx: CanvasRenderingContext2D) => {
    if (!currentRoom) return;

    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    const floorSize = ROOM_SIZE * TILE_SIZE;
    const offsetX = (-position.x * TILE_SIZE) / 2;
    const offsetZ = (-position.z * TILE_SIZE) / 2;

    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(
      centerX - floorSize / 2 + offsetX,
      centerY - floorSize / 2 + offsetZ,
      floorSize,
      floorSize,
    );

    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1;
    for (let i = -ROOM_SIZE; i <= ROOM_SIZE; i += 2) {
      const x = centerX + (i * TILE_SIZE) / 2 + offsetX;
      const y = centerY + (i * TILE_SIZE) / 2 + offsetZ;

      ctx.beginPath();
      ctx.moveTo(x, centerY - floorSize / 2 + offsetZ);
      ctx.lineTo(x, centerY + floorSize / 2 + offsetZ);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(centerX - floorSize / 2 + offsetX, y);
      ctx.lineTo(centerX + floorSize / 2 + offsetX, y);
      ctx.stroke();
    }

    terrainRef.current.forEach((obstacle) => {
      const screenX = centerX + ((obstacle.x - position.x) * TILE_SIZE) / 2;
      const screenY = centerY + ((obstacle.z - position.z) * TILE_SIZE) / 2;
      const w = (obstacle.width * TILE_SIZE) / 2;
      const h = (obstacle.height * TILE_SIZE) / 2;

      if (obstacle.type === "rock") {
        ctx.fillStyle = "#505050ff";
        ctx.fillRect(screenX - w / 2, screenY - h / 2, w, h);
        ctx.fillStyle = "#484542ff";
        ctx.fillRect(screenX - w / 2 + 2, screenY - h / 2 + 2, w / 3, h / 3);
        ctx.fillRect(screenX + w / 6, screenY + h / 6, w / 4, h / 4);
      } else if (obstacle.type === "pillar") {
        ctx.fillStyle = "#5a5a5a";
        ctx.beginPath();
        ctx.arc(screenX, screenY, w / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(0, 0, 0, 0.52)";
        ctx.beginPath();
        ctx.ellipse(screenX + 2, screenY + 2, w / 2 - 1, w / 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2;
      ctx.strokeRect(screenX - w / 2, screenY - h / 2, w, h);
    });

    ctx.fillStyle = "#555555";
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

    ctx.fillStyle = "#00ff00";
    const exitSize = 60;
    currentRoom.exits.forEach((exit) => {
      switch (exit) {
        case "north":
          ctx.fillRect(
            centerX - exitSize / 2 + offsetX,
            centerY - floorSize / 2 - 10 + offsetZ,
            exitSize,
            10,
          );
          break;
        case "south":
          ctx.fillRect(
            centerX - exitSize / 2 + offsetX,
            centerY + floorSize / 2 + offsetZ,
            exitSize,
            10,
          );
          break;
        case "east":
          ctx.fillRect(
            centerX + floorSize / 2 + offsetX,
            centerY - exitSize / 2 + offsetZ,
            10,
            exitSize,
          );
          break;
        case "west":
          ctx.fillRect(
            centerX - floorSize / 2 - 10 + offsetX,
            centerY - exitSize / 2 + offsetZ,
            10,
            exitSize,
          );
          break;
      }
    });
  };

  const drawXPOrbs = (ctx: CanvasRenderingContext2D) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    xpOrbs.forEach((orb) => {
      const screenX = centerX + ((orb.position.x - position.x) * TILE_SIZE) / 2;
      const screenY = centerY + ((orb.position.z - position.z) * TILE_SIZE) / 2;

      const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 12);
      gradient.addColorStop(0, "rgba(18, 150, 97, 0.8)");
      gradient.addColorStop(0.5, "rgba(28, 186, 123, 0.4)");
      gradient.addColorStop(1, "rgba(43, 207, 142, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#033822";
      ctx.beginPath();
      ctx.arc(screenX, screenY, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.beginPath();
      ctx.arc(screenX - 2, screenY - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  };


  // Add this function to draw XP bar at top of screen:
  const drawXPBar = (ctx: CanvasRenderingContext2D) => {
    const barWidth = 400;
    const barHeight = 20;
    const barX = (CANVAS_WIDTH - barWidth) / 2;
    const barY = 20;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(barX - 5, barY - 5, barWidth + 10, barHeight + 10);

    // XP Bar background
    ctx.fillStyle = "#333333";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // XP Bar fill
    const progress = xp / xpToNextLevel;
    ctx.fillStyle = "#64c8ff";
    ctx.fillRect(barX, barY, barWidth * progress, barHeight);

    // Border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("blue XP", barX + barWidth / 2, barY + barHeight + 20);
  };

  const drawReloadIndicator = (ctx: CanvasRenderingContext2D) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    if (isReloading) {
      const radius = 30;
      const barHeight = 6;
      const barY = centerY - 50;

      // Background bar
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(centerX - radius, barY, radius * 2, barHeight);

      // Progress bar
      const progress = reloadProgress / 2.0; // 2 second reload time
      ctx.fillStyle = "#ffaa00";
      ctx.fillRect(centerX - radius, barY, radius * 2 * progress, barHeight);

      // Border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(centerX - radius, barY, radius * 2, barHeight);

      // Text
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px monospace";
      ctx.textAlign = "center";
      ctx.fillText("RELOADING...", centerX, barY - 8);
    }
  };

  const swordImg = new Image();
  swordImg.src = swordSrc;
  
  const revolverImg = new Image();
  revolverImg.src = "/images/revolver.png";

  const SWING_SPEED = 0.1;
  const SWING_ARC = Math.PI;

  const swingRef = useRef({
    progress: 0,
    swinging: false,
    direction: 1,
  });

  useEffect(() => {
    const animateSwing = () => {
      if (swingRef.current.swinging) {
        swingRef.current.progress += SWING_SPEED * swingRef.current.direction;
        if (swingRef.current.progress >= 1) swingRef.current.direction = -2;
        if (swingRef.current.progress <= 0) {
          swingRef.current.progress = 0;
          swingRef.current.swinging = false;
          swingRef.current.direction = 1;
        }
      }
      requestAnimationFrame(animateSwing);
    };
    animateSwing();
  }, []);

  const drawWeapon = (ctx: CanvasRenderingContext2D, type: string) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    const dx = mouseRef.current.x - centerX;
    const dy = mouseRef.current.y - centerY;
    const mouseAngle = Math.atan2(dy, dx);

    ctx.save();
    

    if (type === "revolver") {
      ctx.rotate(mouseAngle);

      // Offset to position gun in hand (8 pixels from player center)
      const handOffset = 8;
      ctx.translate(handOffset, 0);

      // Determine if gun should flip (when pointing left)
      const flipGun = Math.abs(mouseAngle) > Math.PI / 2;

      if (flipGun) {
        ctx.scale(1, -1); // Flip vertically when pointing left
      }

      // Barrel (long rectangle)
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(0, -3, 28, 6);

      // Barrel top highlight
      ctx.fillStyle = "#404040";
      ctx.fillRect(0, -3, 28, 2);

      // Cylinder (revolver chamber)
      ctx.fillStyle = "#3a3a3a";
      ctx.beginPath();
      ctx.arc(8, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      // Cylinder detail (chamber divisions)
      ctx.strokeStyle = "#2a2a2a";
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(8 + Math.cos(angle) * 5, Math.sin(angle) * 5);
        ctx.stroke();
      }

      // Frame (connects barrel to grip)
      ctx.fillStyle = "#333333";
      ctx.fillRect(6, -4, 8, 8);

      // Grip (angled down and back)
      ctx.fillStyle = "#4a3020";
      ctx.beginPath();
      ctx.moveTo(6, 1);
      ctx.lineTo(6, 6);
      ctx.lineTo(-2, 12);
      ctx.lineTo(-4, 12);
      ctx.lineTo(-4, 4);
      ctx.lineTo(4, 1);
      ctx.closePath();
      ctx.fill();

      // Grip texture (wood grain lines)
      ctx.strokeStyle = "#3a2010";
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(2 - i * 1.5, 3 + i * 2);
        ctx.lineTo(-2 - i * 0.5, 8 + i * 1.5);
        ctx.stroke();
      }

      // Trigger guard
      ctx.strokeStyle = "#2a2a2a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(8, 4, 4, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();

      // Trigger
      ctx.fillStyle = "#333333";
      ctx.beginPath();
      ctx.arc(8, 5, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Hammer (at back of gun)
      ctx.fillStyle = "#2a2a2a";
      ctx.beginPath();
      ctx.moveTo(2, -4);
      ctx.lineTo(4, -6);
      ctx.lineTo(6, -6);
      ctx.lineTo(6, -4);
      ctx.closePath();
      ctx.fill();

      // Muzzle (front of barrel)
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.arc(28, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      // Muzzle opening
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(28, 0, 2, 0, Math.PI * 2);
      ctx.fill();

      // Front sight
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(26, -5, 2, 3);
      ctx.translate(centerX, centerY);
    } else if (type === "sword") {
      ctx.rotate(mouseAngle);

      // Blade
      ctx.fillStyle = "#cccccc";
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.lineTo(40, 0);
      ctx.lineTo(0, 3);
      ctx.closePath();
      ctx.fill();

      // Blade edge highlight
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(40, 0);
      ctx.stroke();

      // Hilt/handle
      ctx.fillStyle = "#8b4513";
      ctx.fillRect(-8, -4, 8, 8);

      // Handle detail
      ctx.fillStyle = "#a0522d";
      ctx.fillRect(-7, -3, 1, 6);
      ctx.fillRect(-5, -3, 1, 6);
      ctx.fillRect(-3, -3, 1, 6);
    }

    ctx.restore();
  };

  const drawProjectilesAndTrails = (
    ctx: CanvasRenderingContext2D,
    isPaused: boolean,
    playerPos: THREE.Vector3
  ) => {
    const { projectiles, trailGhosts } = useProjectiles.getState();
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    const MIN_TAIL_LEN = 5;
    const MAX_TAIL_LEN = 120;
    const SEGMENT_DIST = 0.02; // minimal distance to add a new trail segment
    const SPEED_TO_LENGTH = 2;
    const JITTER_AMPLITUDE = 1;
    const HEAD_SCALE = 1;

    const worldToScreen = (pos: THREE.Vector3) => ({
      x: centerX + (pos.x - playerPos.x) * TILE_SIZE / 2,
      y: centerY + (pos.z - playerPos.z) * TILE_SIZE / 2,
    });

    const seedFromId = (id: string) => {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < id.length; i++) {
        h ^= id.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return h / 0xffffffff;
    };

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const now = performance.now() / 1000;

    const updateTrail = (p: Projectile) => {
      if (!p.trailHistory) p.trailHistory = [];

      const last = p.trailHistory[0] ?? p.position.clone();
      const dist = last.distanceTo(p.position);

      if (dist >= SEGMENT_DIST) {
        const steps = Math.floor(dist / SEGMENT_DIST);
        for (let i = 1; i <= steps; i++) {
          const interp = last.clone().lerp(p.position, i / steps);
          p.trailHistory.unshift(interp);
        }
      }

      if (p.trailHistory.length > p.trailLength) {
        p.trailHistory.length = p.trailLength;
      }
    };

    const drawTrail = (trail: THREE.Vector3[], size: number, color: string) => {
      if (trail.length < 2) return;

      const headScreen = worldToScreen(trail[0]);
      const tailScreen = worldToScreen(trail[trail.length - 1]);
      const dx = headScreen.x - tailScreen.x;
      const dy = headScreen.y - tailScreen.y;
      const dist = Math.hypot(dx, dy);
      const targetLen = Math.min(MAX_TAIL_LEN, Math.max(MIN_TAIL_LEN, dist));

      const angle = Math.atan2(dy, dx);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const jitterX = Math.sin(now * 2.0) * JITTER_AMPLITUDE * 0.6;
      const jitterY = Math.cos(now * 2.0) * JITTER_AMPLITUDE * 0.6;

      const headRadius = Math.max(1, (size * HEAD_SCALE) / 2);
      const tailWidth = 0.6;

      const leftTail = { x: 0, y: -tailWidth * 0.5 };
      const rightTail = { x: 0, y: tailWidth * 0.5 };
      const leftHead = { x: targetLen, y: -headRadius * 2 };
      const rightHead = { x: targetLen, y: headRadius };

      const wobble = (xLocal: number) => Math.sin(xLocal / targetLen * Math.PI * 2 + now * 40) * (JITTER_AMPLITUDE * 0.25);

      const localToScreen = (lx: number, ly: number) => ({
        x: tailScreen.x + (lx * cosA - ly * sinA) + jitterX + wobble(lx),
        y: tailScreen.y + (lx * sinA + ly * cosA) + jitterY + wobble(lx),
      });

      const pA = localToScreen(leftTail.x, leftTail.y);
      const pB = localToScreen(leftHead.x, leftHead.y);
      const pC = localToScreen(rightHead.x, rightHead.y);
      const pD = localToScreen(rightTail.x, rightTail.y);

      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.quadraticCurveTo(pB.x, pB.y, (pB.x + pC.x) / 2, (pB.y + pC.y) / 2);
      ctx.lineTo(pC.x, pC.y);
      ctx.quadraticCurveTo(pD.x, pD.y, pA.x, pA.y);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(headScreen.x, headScreen.y, headRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = color;
      ctx.stroke();
    };

    // --- Update and draw all projectiles ---
    projectiles.forEach((p) => {
      if (!(p as any)._seed) (p as any)._seed = seedFromId(p.id || Math.random().toString());

      if (!isPaused) updateTrail(p);
      drawTrail(p.trailHistory, p.size, p.color);
    });

    // --- Draw ghost trails ---
    trailGhosts.forEach((g) => drawTrail(g.trail, g.size, g.color));

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
    // --- SAFETY CHECKS (fixes your crash) ---
    if (!enemy || !enemy.position) return;
    if (enemy.position.x == null || enemy.position.z == null) return;

    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    const screenX = centerX + ((enemy.position.x - position.x) * TILE_SIZE) / 2;
    const screenY = centerY + ((enemy.position.z - position.z) * TILE_SIZE) / 2;

    // Body shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 18, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = "#ff4444";
    ctx.fillRect(screenX - 12, screenY - 12, 36, 36);

    // Eyes
    ctx.fillStyle = "#aa2222";
    ctx.fillRect(screenX - 8, screenY - 8, 12, 12);
    ctx.fillRect(screenX + 2, screenY + 2, 12, 12);

    // Healthbar
    const healthBarWidth = 50;
    const healthBarHeight = 6;

    ctx.fillStyle = "#ff0000";
    ctx.fillRect(
      screenX - healthBarWidth / 2,
      screenY - 22,
      healthBarWidth,
      healthBarHeight
    );

    ctx.fillStyle = "#00ff00";
    const pct = Math.max(0, enemy.health / enemy.maxHealth); // another safety guard
    ctx.fillRect(
      screenX - healthBarWidth / 2,
      screenY - 22,
      pct * healthBarWidth,
      healthBarHeight
    );
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-gray-700"
        
      />
      <Darkness />
      
      <LevelUpScreen />
    </>
  );

}