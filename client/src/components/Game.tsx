import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import * as THREE from "three";

import Player from "./Player";
import Dungeon from "./Dungeon";
import Enemy from "./Enemy";

import { usePlayer } from "../lib/stores/usePlayer";
import { useEnemies } from "../lib/stores/useEnemies";
import { useDungeon } from "../lib/stores/useDungeon";
import { useGame } from "../lib/stores/useGame";
import { useAudio } from "../lib/stores/useAudio";



export default function Game() {
  const { phase, end } = useGame();
  const { position, health } = usePlayer();
  const { enemies, updateEnemies } = useEnemies();
  const { changeRoom } = useDungeon();

  useFrame((state, delta) => {
    

    // Enemy AI and room transitions only
    const updatedEnemies = enemies.map(enemy => {
      if (!enemy.velocity) enemy.velocity = new THREE.Vector3();
      enemy.position.add(enemy.velocity.clone().multiplyScalar(delta));
      enemy.velocity.multiplyScalar(0.8);
      return enemy;
    });
    updateEnemies(updatedEnemies);

    const roomBoundary = 18;
    if (Math.abs(position.x) > roomBoundary || Math.abs(position.z) > roomBoundary) {
      let direction = "north";
      if (position.x > roomBoundary) direction = "east";
      else if (position.x < -roomBoundary) direction = "west";
      else if (position.z > roomBoundary) direction = "south";
      changeRoom(direction);
    }

    if (health <= 0) end();
  });

  

  return (
    <group>
      <Dungeon />
      <Player />
      {enemies.map(e => <Enemy key={e.id} enemy={e} />)}
    </group>
  );
}