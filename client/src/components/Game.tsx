import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import Player from "./Player";
import Dungeon from "./Dungeon";
import Enemy from "./Enemy";
import { usePlayer } from "../lib/stores/usePlayer";
import { useEnemies } from "../lib/stores/useEnemies";
import { useDungeon } from "../lib/stores/useDungeon";
import { useGame } from "../lib/stores/useGame";
import { useAudio } from "../lib/stores/useAudio";
import { checkCollision } from "../lib/collision";
import { processCombat } from "../lib/combat";
import * as THREE from "three";

export default function Game() {
  const [, get] = useKeyboardControls();
  const { phase, start, end } = useGame();
  const { 
    player, 
    move: movePlayer, 
    attack: playerAttack,
    takeDamage: playerTakeDamage,
    gainXP,
    reset: resetPlayer 
  } = usePlayer();
  
  const { 
    enemies, 
    updateEnemies, 
    removeEnemy,
    reset: resetEnemies 
  } = useEnemies();
  
  const { 
    currentRoom, 
    generateDungeon,
    changeRoom,
    reset: resetDungeon 
  } = useDungeon();
  
  const { playHit } = useAudio();

  // Initialize game
  useEffect(() => {
    if (phase === "ready") {
      resetPlayer();
      resetEnemies();
      resetDungeon();
      generateDungeon();
      start();
    }
  }, [phase]);

  // Game loop
  useFrame((state, delta) => {
    if (phase !== "playing") return;

    const controls = get();
    
    // Handle player movement
    const moveVector = new THREE.Vector3(0, 0, 0);
    if (controls.forward) moveVector.z -= 1;
    if (controls.backward) moveVector.z += 1;
    if (controls.leftward) moveVector.x -= 1;
    if (controls.rightward) moveVector.x += 1;
    
    if (moveVector.length() > 0) {
      moveVector.normalize();
      moveVector.multiplyScalar(player.speed * delta);
      
      // Check collision with walls before moving
      const newPosition = new THREE.Vector3()
        .copy(player.position)
        .add(moveVector);
      
      // Simple wall collision (dungeon boundaries)
      const roomSize = 20;
      if (Math.abs(newPosition.x) < roomSize && Math.abs(newPosition.z) < roomSize) {
        movePlayer(moveVector);
      }
    }

    // Handle player attack
    if (controls.attack && player.canAttack) {
      playerAttack();
      
      // Check if attack hits any enemies
      enemies.forEach(enemy => {
        const distance = player.position.distanceTo(enemy.position);
        if (distance <= player.attackRange) {
          const damage = processCombat(player, enemy);
          if (damage > 0) {
            playHit();
            if (enemy.health <= 0) {
              gainXP(enemy.xpValue);
              removeEnemy(enemy.id);
            }
          }
        }
      });
    }

    // Update enemies
    const updatedEnemies = enemies.map(enemy => {
      const playerDistance = enemy.position.distanceTo(player.position);
      
      // AI behavior
      if (playerDistance <= enemy.detectionRange) {
        // Chase player
        const direction = new THREE.Vector3()
          .subVectors(player.position, enemy.position)
          .normalize()
          .multiplyScalar(enemy.speed * delta);
        
        enemy.position.add(direction);
        enemy.state = "chasing";
        
        // Attack player if close enough
        if (playerDistance <= enemy.attackRange && enemy.canAttack) {
          const damage = processCombat(enemy, player);
          if (damage > 0) {
            playerTakeDamage(damage);
            playHit();
          }
          enemy.canAttack = false;
          enemy.attackCooldown = enemy.maxAttackCooldown;
        }
      } else if (enemy.state !== "patrolling") {
        // Return to patrol
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

    // Check game over condition
    if (player.health <= 0) {
      end();
    }

    // Check room transition
    const roomBoundary = 18;
    if (Math.abs(player.position.x) > roomBoundary || Math.abs(player.position.z) > roomBoundary) {
      // Determine direction and change room
      let direction = "north";
      if (player.position.x > roomBoundary) direction = "east";
      else if (player.position.x < -roomBoundary) direction = "west";
      else if (player.position.z > roomBoundary) direction = "south";
      
      changeRoom(direction);
      
      // Reset player position to opposite side of new room
      const newPos = new THREE.Vector3(0, 0, 0);
      if (direction === "north") newPos.z = roomBoundary - 2;
      else if (direction === "south") newPos.z = -roomBoundary + 2;
      else if (direction === "east") newPos.x = -roomBoundary + 2;
      else if (direction === "west") newPos.x = roomBoundary - 2;
      
      movePlayer(newPos.sub(player.position));
    }
  });

  if (phase !== "playing") return null;

  return (
    <group>
      <Dungeon />
      <Player />
      {enemies.map(enemy => (
        <Enemy key={enemy.id} enemy={enemy} />
      ))}
    </group>
  );
}
