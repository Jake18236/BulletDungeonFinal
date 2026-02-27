import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { useDungeon } from "../lib/stores/useDungeon";
import * as THREE from "three";

export default function Dungeon() {
  const { currentRoom } = useDungeon();
  const grassTexture = useTexture("/textures/grass.png");
  const asphaltTexture = useTexture("/textures/asphalt.png");
  
  
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
    
   
    elements.push(
      <mesh key="floor" position={[0, -0.5, 0]} receiveShadow>
        <boxGeometry args={[roomSize * 2, 1, roomSize * 2]} />
        <meshLambertMaterial map={grassTexture} />
      </mesh>
    );
    
 
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
    

    return elements;
  }, [currentRoom, grassTexture, asphaltTexture]);

  return <group>{roomElements}</group>;
}
