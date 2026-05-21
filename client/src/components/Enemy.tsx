import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface EnemyProps {
  enemy: {
    id: string;
    position: THREE.Vector3;
    health: number;
    maxHealth: number;
    velocity: THREE.Vector3;
  };
}

export default function Enemy({ enemy }: EnemyProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    
    meshRef.current.position.copy(enemy.position).add(new THREE.Vector3(0, 0.5, 0));
  });
}
