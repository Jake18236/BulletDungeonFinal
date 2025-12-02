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
import SpellSlotsHUD from "./SpellSlotsHUD";
import CardManager from "./CardManager";
import swordSrc from "/images/sword.png";

const TILE_SIZE = 22;
const CANVAS_WIDTH = 1100;
const CANVAS_HEIGHT = 700;
const ROOM_SIZE = 40;


const KNOCKBACK_FORCE = 20;

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

  // Seeded random function
  const seededRandom = (n: number) => {
    const x = Math.sin(seed + n) * 1000;
    return x - Math.floor(x);
  };

  // Add rocky outcroppings along walls (cave-like feel)
  const numOutcrops = 4;

  for (let i = 0; i < numOutcrops; i++) {
    const side = Math.floor(seededRandom(i * 20) * 4); // 0=north, 1=south, 2=east, 3=west
    const position = seededRandom(i * 10 - 10) * 70 - 35; // Position along the wall
    const depth = seededRandom(i * 10 + 7) * 10 + 2; // How far it juts out
    const width = seededRandom(i * 10 + 9) * 8 + 3; // Width of outcrop

    switch (side) {
      case 0: // North wall
        obstacles.push({
          x: position,
          z: -ROOM_SIZE + depth / 2,
          width: width,
          height: depth,
          type: "rock",
        });
        break;
      case 1: // South wall
        obstacles.push({
          x: position,
          z: ROOM_SIZE - depth / 2,
          width: width,
          height: depth,
          type: "rock",
        });
        break;
      case 2: // East wall
        obstacles.push({
          x: ROOM_SIZE - depth / 2,
          z: position,
          width: depth,
          height: width,
          type: "rock",
        });
        break;
      case 3: // West wall
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

  // Add some pillars/stalagmites in the room
  const numPillars = Math.floor(seededRandom(100) * 2) + 1;

  for (let i = 0; i < numPillars; i++) {
    const x = (seededRandom(i * 20 + 100) - 0.5) * 25;
    const z = (seededRandom(i * 20 + 105) - 0.5) * 25;
    const size = seededRandom(i * 20 + 110) * 2 + 1.5;

    // Don't place pillars too close to center (spawn point)
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

// Check collision with terrain
function checkTerrainCollision(
  pos: THREE.Vector3,
  obstacles: TerrainObstacle[],
  radius: number,
): { collision: boolean; normal?: THREE.Vector2 } {
  for (const obs of obstacles) {
    // AABB collision detection
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
      // Calculate normal for collision response
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

  const terrainRef = useRef<TerrainObstacle[]>([]);
  <canvas
    ref={canvasRef}
    width={CANVAS_WIDTH}
    height={CANVAS_HEIGHT}
    className="border-2 border-gray-700"
    style={{
      imageRendering: "pixelated" as any,
      cursor: "none", // Hide default cursor
    }}
  />;
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
  const { slots, activeSlotId, getSlotStats, startCooldown, updateCooldowns } =
    useSpellSlots();

  const { projectiles, addProjectile, updateProjectiles } = useProjectiles();

  const [showCardManager, setShowCardManager] = useState(false);

  const movePlayer = usePlayer((s) => s.move);
  const player = usePlayer.getState();
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const { enemies, updateEnemies, removeEnemy } = useEnemies();
  const { currentRoom, changeRoom } = useDungeon();
  const { playHit, playSuccess } = useAudio();
  const { items, addItem } = useInventory();
  const fireQueue = useRef(0); // pending shots
  const fireTimer = useRef(0); // cooldown timer
  const firstShotAfterReload = useRef(false);


  // Generate terrain when room changes
  useEffect(() => {
    if (currentRoom) {
      terrainRef.current = generateRoomTerrain(currentRoom.x, currentRoom.y);
    }
  }, [currentRoom]);

  // --- Keyboard handlers ---
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isMouseDown.current = true;
      fireQueue.current++; // immediate shot
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isMouseDown.current = false;
    };

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysPressed.current.add(e.code);
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.code);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [position]);
  
  const isMouseDown = useRef(false);


  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // --- Weapon attack handler ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyR" && !isReloading && ammo < 6) {
        startReload();
      }
    };
  
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isReloading, ammo, startReload]);
  
  useEffect(() => {
    if (!isReloading) {
      firstShotAfterReload.current = true;
    }
  }, [isReloading]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyC") {
        setShowCardManager((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- Main game loop ---
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

      updateReload(delta);
      updateInvincibility(delta);

      if (ammo === 0 && !isReloading) {
        startReload();
      }

      // Update firing state
      setFiring(isMouseDown.current && !isReloading && ammo > 0);

      // firing logic
        if (isMouseDown.current && !isReloading && ammo > 0) {
          fireTimer.current += delta;

          // Check if we can fire either because it's first shot or cooldown passed
          while (
            (firstShotAfterReload.current || fireTimer.current >= firerate) &&
            ammo > 0
          ) {
            if (!firstShotAfterReload.current) {
              fireTimer.current -= firerate;
            }

            firstShotAfterReload.current = false; // reset after first shot
            if (fireQueue.current > 0) fireQueue.current--;

            // Fire projectile logic here...
            const activeSlot = slots.find((s) => s.id === activeSlotId);
            if (activeSlot) {
              const stats = getSlotStats(activeSlotId);
              const ps = usePlayer.getState();
              const centerX = CANVAS_WIDTH / 2;
              const centerY = CANVAS_HEIGHT / 2;
              const baseAngle = Math.atan2(
                mouseRef.current.y - centerY,
                mouseRef.current.x - centerX
              );
              const spreadAngle = stats.projectileCount > 1 ? 0.2 : 0;
              for (let i = 0; i < stats.projectileCount; i++) {
                let angle = baseAngle;
                if (stats.projectileCount > 1) {
                  const offset = (i - (stats.projectileCount - 1) / 2) * spreadAngle;
                  angle += offset;
                }

                const inaccuracy = (1 - stats.accuracy);
                angle += (Math.random() - 0.5) * inaccuracy;

                const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

                addProjectile({
                  position: ps.position.clone(),
                  direction,
                  
                  slotId: activeSlotId,
                  damage: stats.damage,
                  speed: stats.speed,
                  range: stats.range,
                  trailLength: stats.trailLength,
                  homing: stats.homing,
                  piercing: stats.piercing,
                  bouncing: stats.bouncing,
                  explosive: stats.explosive,
                  chainLightning: stats.chainLightning,
                });
              }

              fireShot();
              playHit();
            }
          }


        }
      
      // --- Player movement with terrain collision ---
      // --- Player movement in game loop ---
      let moveX = 0;
      let moveZ = 0;

      if (keysPressed.current.has("KeyW") || keysPressed.current.has("ArrowUp")) moveZ -= 1;
      if (keysPressed.current.has("KeyS") || keysPressed.current.has("ArrowDown")) moveZ += 1;
      if (keysPressed.current.has("KeyA") || keysPressed.current.has("ArrowLeft")) moveX -= 1;
      if (keysPressed.current.has("KeyD") || keysPressed.current.has("ArrowRight")) moveX += 1;

      if (moveX !== 0 || moveZ !== 0) {
        const len = Math.sqrt(moveX ** 2 + moveZ ** 2);
        const speedModifier = isFiring && !isReloading ? 0.4 : 1;

        let dx = (moveX / len) * speed * delta * speedModifier;
        let dz = (moveZ / len) * speed * delta * speedModifier;

        let currentPos = usePlayer.getState().position.clone();
        let newPos = currentPos.clone().add(new THREE.Vector3(dx, 0, dz));

        // Terrain collision
        const terrainCheck = checkTerrainCollision(newPos, terrainRef.current, 0.8);
        if (terrainCheck.collision && terrainCheck.normal) {
          dx = dx - terrainCheck.normal.x * (dx * terrainCheck.normal.x + dz * terrainCheck.normal.y);
          dz = dz - terrainCheck.normal.y * (dx * terrainCheck.normal.x + dz * terrainCheck.normal.y);
          newPos = currentPos.clone().add(new THREE.Vector3(dx, 0, dz));
          if (checkTerrainCollision(newPos, terrainRef.current, 0.8).collision) {
            newPos = currentPos; // stuck, can't move
          }
        }

        // Room bounds
        const bounced = bounceAgainstBounds(newPos, new THREE.Vector3(0,0,0), ROOM_SIZE, 1);

        // Apply movement
        usePlayer.setState({ position: bounced.position });
      }




      updateProjectiles(
        delta,
        enemies,
        position,
        ROOM_SIZE,
        (enemyId, damage, knockback) => {
          // Handle enemy hit
          const enemy = enemies.find((e) => e.id === enemyId);
          if (enemy) {
            enemy.health -= damage;
            if (!enemy.velocity) enemy.velocity = new THREE.Vector3(0, 0, 0);
            enemy.velocity.add(knockback);
            playHit();
            if (enemy.health <= 0) {
              playSuccess();
              removeEnemy(enemyId);
            }
          }
        },
      );

      // --- Enemies movement with terrain collision ---
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

          // Check terrain collision for enemy
          const enemyTerrainCheck = checkTerrainCollision(
            newEnemyPos,
            terrainRef.current,
            0.7,
          );

          if (!enemyTerrainCheck.collision) {
            enemy.position.x = newEnemyPos.x;
            enemy.position.z = newEnemyPos.z;
          }

          enemy.state = "chasing";
        } else if (enemy.state !== "patrolling") {
          enemy.state = "patrolling";
        }

        if (enemy.attackCooldown > 0) {
          enemy.attackCooldown -= delta;
          if (enemy.attackCooldown <= 0) enemy.canAttack = true;
        }

        if (!enemy.velocity) enemy.velocity = new THREE.Vector3(0, 0, 0);

        // Apply velocity with terrain collision
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
          // Bounce off terrain
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

        drawEnemy(ctx, enemy);
        return enemy;
      });

      // Enemy-Enemy separation
      for (let i = 0; i < updatedEnemies.length; i++) {
        for (let j = i + 1; j < updatedEnemies.length; j++) {
          const e1 = updatedEnemies[i];
          const e2 = updatedEnemies[j];
          const dx = e1.position.x - e2.position.x;
          const dz = e1.position.z - e2.position.z;
          const dist = Math.hypot(dx, dz);
          const minDist = 1;
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
          const overlap = PLAYER_RADIUS + ENEMY_RADIUS - dist;
          const nx = dx / dist;
          const nz = dz / dist;

          enemy.position.x += nx * overlap * 0.6;
          enemy.position.z += nz * overlap * 0.6;

          usePlayer.setState((s) => {
            const v = s.velocity
              ? s.velocity.clone()
              : new THREE.Vector3(0, 0, 0);
            v.add(
              new THREE.Vector3(
                -nx * overlap * KNOCKBACK_FORCE * 10,
                100000,
                -nz * overlap * KNOCKBACK_FORCE * 10,
              ),
            );
            return { velocity: v };
          });

          if (!enemy.velocity) enemy.velocity = new THREE.Vector3(0, 0, 0);
          enemy.velocity.add(
            new THREE.Vector3(nx * KNOCKBACK_FORCE, 0, nz * KNOCKBACK_FORCE),
          );

          if (enemy.canAttack && invincibilityTimer <= 0) {
            loseHeart();
            playHit();
            enemy.canAttack = false;
            enemy.attackCooldown = enemy.attackCooldown;
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
          removeEnemy(enemy.id);
          playSuccess();
          continue;
        }

        aliveEnemies.push(enemy);
      }

      updateEnemies(aliveEnemies);
      updateCooldowns(delta);
      drawPlayer(ctx);
      drawProjectilesAndTrails(ctx);
      drawReloadIndicator(ctx);
      drawCustomCursor(ctx);
      if (hearts <= 0) end();

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
  ]);

  const drawCustomCursor = (ctx: CanvasRenderingContext2D) => {
    const x = mouseRef.current.x;
    const y = mouseRef.current.y;

    // Target crosshair
    ctx.strokeStyle = isReloading ? "#ff0000" : "#00ff00";
    ctx.lineWidth = 2;

    // Outer circle
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshair lines
    ctx.beginPath();
    ctx.moveTo(x - 25, y);
    ctx.lineTo(x - 15, y);
    ctx.moveTo(x + 15, y);
    ctx.lineTo(x + 25, y);
    ctx.moveTo(x, y - 25);
    ctx.lineTo(x, y - 15);
    ctx.moveTo(x, y + 15);
    ctx.lineTo(x, y + 25);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = isReloading ? "#ff0000" : "#00ff00";
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();

    // Ammo counter
    ctx.fillStyle = ammo === 0 ? "#ff0000" : "#ffffff";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${ammo}/${6}`, x, y + 40);

    // Ammo indicators (revolver chambers)
    const chamberRadius = 30;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const cx = x + Math.cos(angle) * chamberRadius;
      const cy = y + Math.sin(angle) * chamberRadius;

      ctx.fillStyle = i < ammo ? "#ffaa00" : "#333333";
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#666666";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
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

    // Draw terrain obstacles
    terrainRef.current.forEach((obstacle) => {
      const screenX = centerX + ((obstacle.x - position.x) * TILE_SIZE) / 2;
      const screenY = centerY + ((obstacle.z - position.z) * TILE_SIZE) / 2;
      const w = (obstacle.width * TILE_SIZE) / 2;
      const h = (obstacle.height * TILE_SIZE) / 2;

      if (obstacle.type === "rock") {
        // Rocky outcrop - darker brown
        ctx.fillStyle = "#505050ff";
        ctx.fillRect(screenX - w / 2, screenY - h / 2, w, h);

        // Add texture
        ctx.fillStyle = "#484542ff";
        ctx.fillRect(screenX - w / 2 + 2, screenY - h / 2 + 2, w / 3, h / 3);
        ctx.fillRect(screenX + w / 6, screenY + h / 6, w / 4, h / 4);
      } else if (obstacle.type === "pillar") {
        // Pillar/stalagmite
        ctx.fillStyle = "#5a5a5a";
        ctx.beginPath();
        ctx.arc(screenX, screenY, w / 2, 0, Math.PI * 2);
        ctx.fill();

        // Shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.52)";
        ctx.beginPath();
        ctx.ellipse(
          screenX + 2,
          screenY + 2,
          w / 2 - 1,
          w / 3,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      // Outline
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
      const progress = reloadProgress / reloadTime; // 2 second reload time
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

    let img: HTMLImageElement;
    let scale: number;

    if (type === "sword") {
      img = swordImg;
      scale = 0.2;
    } else if (type === "revolver") {
      img = revolverImg;
      scale = 0.45;
    } else return;

    if (!img.complete) return;

    const w = img.width * scale;
    const h = img.height * scale;

    ctx.save();

    if (type === "sword" && swingRef.current.swinging) {
      const swingOffset =
        SWING_ARC * 2 + (swingRef.current.progress * SWING_ARC) / 1.5;
      ctx.rotate(mouseAngle + swingOffset);
      ctx.drawImage(img, -w / 2 + 12, -h / 2 - 30, w, h);
    } else if (type === "sword" && !swingRef.current.swinging) {
      ctx.rotate(mouseAngle);
      ctx.drawImage(img, -w / 2 + 12, -h / 2 - 30, w, h);
    }
    if (type === "revolver") {
      ctx.rotate(mouseAngle);
      ctx.drawImage(img, -w / 2 + 16, -h / 2, w, h);
    }

    ctx.restore();
  };

  

  

  const drawProjectilesAndTrails = (ctx: CanvasRenderingContext2D) => {
    const { projectiles, trailGhosts } = useProjectiles.getState();
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const worldToScreen = (pos: THREE.Vector3) => ({
      x: centerX + (pos.x - position.x) * TILE_SIZE / 2,
      y: centerY + (pos.z - position.z) * TILE_SIZE / 2,
    });

    const drawCometTrail = (trail: THREE.Vector3[], color: string, size: number, fade: number) => {
      if (trail.length < 2) return;

      // Draw trail as quadratic curves
      ctx.beginPath();
      for (let i = 0; i < trail.length - 1; i++) {
        const t = i / trail.length;
        const alpha = fade * 40 * (1 - t);
        const width = size * 50 * (1 - t);

        const p0 = worldToScreen(trail[i]);
        const p1 = worldToScreen(trail[i + 1]);

        ctx.lineWidth = width;
        ctx.strokeStyle = hexToRgba(color, alpha);
        ctx.shadowBlur = width * 1.5;
        ctx.shadowColor = color;

        if (i === 0) ctx.moveTo(p0.x, p0.y);

        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
      }
      ctx.stroke();

      // Draw rotated oval tip at the end
      const lastIndex = trail.length - 1;
      const secondLastIndex = trail.length - 2;
      const pEndScreen = worldToScreen(trail[lastIndex]);
      const pPrevScreen = worldToScreen(trail[secondLastIndex]);

      const dx = pEndScreen.x - pPrevScreen.x;
      const dy = pEndScreen.y - pPrevScreen.y;
      const angle = Math.atan2(dy, dx);

      const tailWidth = size * 100 * (1 - (lastIndex / trail.length));
      const tailHeight = tailWidth / 2;
      const tailAlpha = fade * 20;

      ctx.save();
      ctx.translate(pEndScreen.x, pEndScreen.y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, tailWidth, tailHeight, 0, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(color, tailAlpha);
      ctx.shadowBlur = tailWidth * 2;
      ctx.shadowColor = color;
      ctx.fill();
      ctx.restore();
    };

    // --- Draw live projectile trails ---
    projectiles.forEach((proj) => {
      drawCometTrail(proj.trailHistory, proj.color, proj.size, 1);

      // Draw projectile head
      const last = worldToScreen(proj.trailHistory[0]);
      const angle = Math.atan2(proj.velocity.z, proj.velocity.x);
      ctx.save();
      ctx.translate(last.x, last.y);
      ctx.rotate(angle);

      ctx.fillStyle = proj.color;
      ctx.fillRect(0, -proj.size / 2, proj.size * 0.8, proj.size);

      ctx.beginPath();
      ctx.arc(proj.size * 0.8, 0, proj.size / 2, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(proj.color, 0.8);
      ctx.fill();
      ctx.restore();
    });

    // --- Draw ghost trails ---
    trailGhosts.forEach((ghost) => {
      const fade = ghost.life / 0.2;
      drawCometTrail(ghost.trail, ghost.color, ghost.size, fade);
    });

    ctx.restore();
  };
  
  function hexToRgba(hex: string, alpha: number) {
    const bigint = parseInt(hex.replace("#", ""), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }




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
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();

    const { items, equippedWeaponId } = useInventory.getState();
    const weapon = items.find((i) => i.id === equippedWeaponId);
    if (weapon) drawWeapon(ctx, weapon.name.toLowerCase());

    ctx.restore();
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, enemy: any) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    const screenX = centerX + ((enemy.position.x - position.x) * TILE_SIZE) / 2;
    const screenY = centerY + ((enemy.position.z - position.z) * TILE_SIZE) / 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 18, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ff4444";
    ctx.fillRect(screenX - 12, screenY - 12, 24, 24);

    ctx.fillStyle = "#aa2222";
    ctx.fillRect(screenX - 8, screenY - 8, 8, 8);
    ctx.fillRect(screenX + 2, screenY + 2, 8, 8);

    const healthBarWidth = 30;
    const healthBarHeight = 4;
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(
      screenX - healthBarWidth / 2,
      screenY - 22,
      healthBarWidth,
      healthBarHeight,
    );
    ctx.fillStyle = "#00ff00";
    const healthWidth = (enemy.health / enemy.maxHealth) * healthBarWidth;
    ctx.fillRect(
      screenX - healthBarWidth / 2,
      screenY - 22,
      healthWidth,
      healthBarHeight,
    );
  };

  if (phase !== "playing") return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-gray-700"
        style={{ imageRendering: "pixelated" as any }}
      />

      {/* Add spell system UI */}
      {phase === "playing" && (
        <>
          <SpellSlotsHUD />
          {showCardManager && <CardManager />}
        </>
      )}
    </>
  );
}
