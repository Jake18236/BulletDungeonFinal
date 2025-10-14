import { useEffect, useRef } from "react";
import { usePlayer } from "../lib/stores/usePlayer";
import { useEnemies } from "../lib/stores/useEnemies";
import { useDungeon } from "../lib/stores/useDungeon";
import { useGame } from "../lib/stores/useGame";
import { useAudio } from "../lib/stores/useAudio";
import { useInventory } from "../lib/stores/useInventory";
import { processCombat } from "../lib/combat";

const TILE_SIZE = 32;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const ROOM_SIZE = 20;

export default function CanvasGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const keysPressed = useRef<Set<string>>(new Set());
  const lastTimeRef = useRef<number>(0);

  const { phase, end } = useGame();
  const {
    player,
    move: movePlayer,
    attack: playerAttack,
    takeDamage: playerTakeDamage,
    gainXP,
  } = usePlayer();

  const {
    enemies,
    updateEnemies,
    removeEnemy,
  } = useEnemies();

  const { currentRoom, changeRoom } = useDungeon();
  const { playHit, playSuccess } = useAudio();
  const { items, addItem } = useInventory();

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.code);
      console.log("Key pressed:", e.code, "Active keys:", Array.from(keysPressed.current));
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
  }, []);

  // Main game loop
  useEffect(() => {
    if (phase !== "playing" || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gameLoop = (currentTime: number) => {
      const delta = lastTimeRef.current ? (currentTime - lastTimeRef.current) / 1000 : 0;
      lastTimeRef.current = currentTime;

      if (delta > 0.1) {
        animationFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // Clear canvas
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw dungeon
      if (currentRoom) {
        drawDungeon(ctx);
      }

      // Handle player movement
      let moveX = 0;
      let moveZ = 0;

      if (keysPressed.current.has("KeyW") || keysPressed.current.has("ArrowUp")) moveZ -= 1;
      if (keysPressed.current.has("KeyS") || keysPressed.current.has("ArrowDown")) moveZ += 1;
      if (keysPressed.current.has("KeyA") || keysPressed.current.has("ArrowLeft")) moveX -= 1;
      if (keysPressed.current.has("KeyD") || keysPressed.current.has("ArrowRight")) moveX += 1;

      if (moveX !== 0 || moveZ !== 0) {
        const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
        moveX = (moveX / length) * player.speed * delta;
        moveZ = (moveZ / length) * player.speed * delta;

        const newX = player.position.x + moveX;
        const newZ = player.position.z + moveZ;

        // Check room boundaries
        if (Math.abs(newX) < ROOM_SIZE && Math.abs(newZ) < ROOM_SIZE) {
          movePlayer({ x: moveX, y: 0, z: moveZ });
        }
      }

      // Handle player attack
      if (keysPressed.current.has("Space") && player.canAttack) {
        playerAttack();
        keysPressed.current.delete("Space");

        // Check if attack hits any enemies
        enemies.forEach((enemy) => {
          const dx = player.position.x - enemy.position.x;
          const dz = player.position.z - enemy.position.z;
          const distance = Math.sqrt(dx * dx + dz * dz);

          if (distance <= player.attackRange) {
            const damage = processCombat(player, enemy);
            if (damage > 0) {
              playHit();
              if (enemy.health <= 0) {
                gainXP(enemy.xpValue);
                playSuccess();
                removeEnemy(enemy.id);

                // Random item drop
                if (Math.random() < 0.3) {
                  addItem({
                    name: "Health Potion",
                    icon: "🧪",
                    type: "consumable",
                    quantity: 1,
                    effect: { health: 30 },
                  });
                }
              }
            }
          }
        });
      }

      // Update and draw enemies
      const updatedEnemies = enemies.map((enemy) => {
        const dx = player.position.x - enemy.position.x;
        const dz = player.position.z - enemy.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // AI behavior
        if (distance <= enemy.detectionRange) {
          // Chase player
          const dirX = dx / distance;
          const dirZ = dz / distance;

          enemy.position.x += dirX * enemy.speed * delta;
          enemy.position.z += dirZ * enemy.speed * delta;
          enemy.state = "chasing";

          // Attack player if close enough
          if (distance <= enemy.attackRange && enemy.canAttack) {
            const damage = processCombat(enemy, player);
            if (damage > 0) {
              playerTakeDamage(damage);
              playHit();
            }
            enemy.canAttack = false;
            enemy.attackCooldown = enemy.maxAttackCooldown;
          }
        } else if (enemy.state !== "patrolling") {
          enemy.state = "patrolling";
        }

        // Update attack cooldown
        if (enemy.attackCooldown > 0) {
          enemy.attackCooldown -= delta;
          if (enemy.attackCooldown <= 0) {
            enemy.canAttack = true;
          }
        }

        return enemy;
      });

      updateEnemies(updatedEnemies);

      // Draw enemies
      updatedEnemies.forEach((enemy) => {
        drawEnemy(ctx, enemy);
      });

      // Draw player
      drawPlayer(ctx);

      // Check game over
      if (player.health <= 0) {
        end();
      }

      // Check room transition
      const roomBoundary = 18;
      if (
        Math.abs(player.position.x) > roomBoundary ||
        Math.abs(player.position.z) > roomBoundary
      ) {
        let direction = "north";
        if (player.position.x > roomBoundary) direction = "east";
        else if (player.position.x < -roomBoundary) direction = "west";
        else if (player.position.z > roomBoundary) direction = "south";

        changeRoom(direction);

        // Reset player position
        const resetX =
          direction === "east"
            ? -roomBoundary + 2
            : direction === "west"
            ? roomBoundary - 2
            : player.position.x;
        const resetZ =
          direction === "north"
            ? -roomBoundary + 2
            : direction === "south"
            ? roomBoundary - 2
            : player.position.z;

        movePlayer({
          x: resetX - player.position.x,
          y: 0,
          z: resetZ - player.position.z,
        });
      }

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [phase, player, enemies, currentRoom]);

  const drawDungeon = (ctx: CanvasRenderingContext2D) => {
    if (!currentRoom) return;

    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    // Draw floor
    ctx.fillStyle = "#2a2a2a";
    const floorSize = ROOM_SIZE * TILE_SIZE;
    ctx.fillRect(
      centerX - floorSize / 2,
      centerY - floorSize / 2,
      floorSize,
      floorSize
    );

    // Draw grid lines for pixel art effect
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1;
    for (let i = -ROOM_SIZE; i <= ROOM_SIZE; i += 2) {
      const x = centerX + i * TILE_SIZE / 2;
      const y = centerY + i * TILE_SIZE / 2;
      
      ctx.beginPath();
      ctx.moveTo(x, centerY - floorSize / 2);
      ctx.lineTo(x, centerY + floorSize / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(centerX - floorSize / 2, y);
      ctx.lineTo(centerX + floorSize / 2, y);
      ctx.stroke();
    }

    // Draw walls
    ctx.fillStyle = "#555555";
    const wallThickness = 20;

    // North wall
    if (!currentRoom.exits.includes("north")) {
      ctx.fillRect(
        centerX - floorSize / 2,
        centerY - floorSize / 2 - wallThickness,
        floorSize,
        wallThickness
      );
    }

    // South wall
    if (!currentRoom.exits.includes("south")) {
      ctx.fillRect(
        centerX - floorSize / 2,
        centerY + floorSize / 2,
        floorSize,
        wallThickness
      );
    }

    // East wall
    if (!currentRoom.exits.includes("east")) {
      ctx.fillRect(
        centerX + floorSize / 2,
        centerY - floorSize / 2,
        wallThickness,
        floorSize
      );
    }

    // West wall
    if (!currentRoom.exits.includes("west")) {
      ctx.fillRect(
        centerX - floorSize / 2 - wallThickness,
        centerY - floorSize / 2,
        wallThickness,
        floorSize
      );
    }

    // Draw exit indicators
    ctx.fillStyle = "#00ff00";
    currentRoom.exits.forEach((exit) => {
      const exitSize = 60;
      switch (exit) {
        case "north":
          ctx.fillRect(centerX - exitSize / 2, centerY - floorSize / 2 - 10, exitSize, 10);
          break;
        case "south":
          ctx.fillRect(centerX - exitSize / 2, centerY + floorSize / 2, exitSize, 10);
          break;
        case "east":
          ctx.fillRect(centerX + floorSize / 2, centerY - exitSize / 2, 10, exitSize);
          break;
        case "west":
          ctx.fillRect(centerX - floorSize / 2 - 10, centerY - exitSize / 2, 10, exitSize);
          break;
      }
    });
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    const screenX = centerX + player.position.x * TILE_SIZE / 2;
    const screenY = centerY + player.position.z * TILE_SIZE / 2;

    // Draw player shadow (for semi-3D effect)
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 18, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw player body
    ctx.fillStyle = "#4a9eff";
    ctx.fillRect(screenX - 12, screenY - 12, 24, 24);

    // Draw pixel art details
    ctx.fillStyle = "#2a5eff";
    ctx.fillRect(screenX - 8, screenY - 8, 8, 8);
    ctx.fillRect(screenX + 2, screenY + 2, 8, 8);

    // Draw health bar
    const healthBarWidth = 30;
    const healthBarHeight = 4;
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(screenX - healthBarWidth / 2, screenY - 22, healthBarWidth, healthBarHeight);
    ctx.fillStyle = "#00ff00";
    const healthWidth = (player.health / player.maxHealth) * healthBarWidth;
    ctx.fillRect(screenX - healthBarWidth / 2, screenY - 22, healthWidth, healthBarHeight);
  };

  const drawEnemy = (
    ctx: CanvasRenderingContext2D,
    enemy: any
  ) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    const screenX = centerX + enemy.position.x * TILE_SIZE / 2;
    const screenY = centerY + enemy.position.z * TILE_SIZE / 2;

    // Draw enemy shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 18, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw enemy body
    ctx.fillStyle = "#ff4444";
    ctx.fillRect(screenX - 12, screenY - 12, 24, 24);

    // Draw pixel art details
    ctx.fillStyle = "#aa2222";
    ctx.fillRect(screenX - 8, screenY - 8, 8, 8);
    ctx.fillRect(screenX + 2, screenY + 2, 8, 8);

    // Draw health bar
    const healthBarWidth = 30;
    const healthBarHeight = 4;
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(screenX - healthBarWidth / 2, screenY - 22, healthBarWidth, healthBarHeight);
    ctx.fillStyle = "#00ff00";
    const healthWidth = (enemy.health / enemy.maxHealth) * healthBarWidth;
    ctx.fillRect(screenX - healthBarWidth / 2, screenY - 22, healthWidth, healthBarHeight);
  };

  if (phase !== "playing") return null;

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="border-2 border-gray-700"
      style={{
        imageRendering: "pixelated",
        imageRendering: "crisp-edges" as any,
      }}
    />
  );
}
