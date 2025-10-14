import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { usePlayer } from "../lib/stores/usePlayer";
import * as THREE from "three";

export default function Player() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { player } = usePlayer();
  const grassTexture = useTexture("/textures/grass.png");
  
  // Configure texture for pixel art
  grassTexture.magFilter = THREE.NearestFilter;
  grassTexture.minFilter = THREE.NearestFilter;

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(player.position);
    }
  });

  return (
    <mesh ref={meshRef} castShadow receiveShadow position={[0, 0.5, 0]}>
      <boxGeometry args={[0.8, 1, 0.8]} />
      <meshLambertMaterial map={grassTexture} color="#4a9eff" />
      
      {/* Health bar */}
      <mesh position={[0, 1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 0.1]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>
      <mesh position={[0, 1.21, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[player.health / player.maxHealth, 1, 1]}>
        <planeGeometry args={[1, 0.1]} />
        <meshBasicMaterial color="#00ff00" />
      </mesh>
    </mesh>
  );
}
