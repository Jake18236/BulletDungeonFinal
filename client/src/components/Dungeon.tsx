import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { useDungeon } from "../lib/stores/useDungeon";
import * as THREE from "three";

export default function Dungeon() {
  const { currentRoom } = useDungeon();
  const grassTexture = useTexture("/textures/grass.png");
  const asphaltTexture = useTexture("/textures/asphalt.png");
  
  // Configure textures for pixel art
  grassTexture.magFilter = THREE.NearestFilter;
  grassTexture.minFilter = THREE.NearestFilter;
  grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(10, 10);
  
  asphaltTexture.magFilter = THREE.NearestFilter;
  asphaltTexture.minFilter = THREE.NearestFilter;

  // Generate room layout
  const roomElements = useMemo(() => {
    if (!currentRoom) return [];
    
    const elements = [];
    const roomSize = 40;
    
    // Floor
    elements.push(
      <mesh key="floor" position={[0, -0.5, 0]} receiveShadow>
        <boxGeometry args={[roomSize * 2, 1, roomSize * 2]} />
        <meshLambertMaterial map={grassTexture} />
      </mesh>
    );
    
    // Walls
    const wallPositions: { pos: [number, number, number]; rot: [number, number, number]; args: [number, number, number]; }[] = [
      { pos: [0, 2, roomSize], rot: [0, 0, 0], args: [roomSize * 2, 4, 1] }, // North
      { pos: [0, 2, -roomSize], rot: [0, 0, 0], args: [roomSize * 2, 4, 1] }, // South  
      { pos: [roomSize, 2, 0], rot: [0, 0, 0], args: [1, 4, roomSize * 2] }, // East
      { pos: [-roomSize, 2, 0], rot: [0, 0, 0], args: [1, 4, roomSize * 2] }, // West
    ];
    
    wallPositions.forEach((wall, index) => {
      elements.push(
        <mesh key={`wall-${index}`} position={wall.pos} castShadow receiveShadow>
          <boxGeometry args={wall.args} />
          <meshLambertMaterial map={asphaltTexture} />
        </mesh>
      );
    });
    
    // Room exits (gaps in walls)
    currentRoom.exits.forEach((exit, index) => {
      const exitSize = 3;
      let position: [number, number, number] | undefined;
      let args: [number, number, number] | undefined;

      switch (exit) {
        case 'north':
          position = [0, 2, roomSize];
          args = [exitSize, 4, 1];
          break;
        case 'south':
          position = [0, 2, -roomSize];
          args = [exitSize, 4, 1];
          break;
        case 'east':
          position = [roomSize, 2, 0];
          args = [1, 4, exitSize];
          break;
        case 'west':
          position = [-roomSize, 2, 0];
          args = [1, 4, exitSize];
          break;
      }

      if (position && args) {
        elements.push(
          <mesh key={`exit-${index}`} position={position}>
            <boxGeometry args={args} />
            <meshBasicMaterial color="#111111" transparent opacity={0} />
          </mesh>
        );
      }
    });
    
    return elements;
  }, [currentRoom, grassTexture, asphaltTexture]);

  return <group>{roomElements}</group>;
}
