import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface EnemyProps {
  enemy: {
    id: string;
    position: THREE.Vector3;
    health: number;
    maxHealth: number;
  };
}

export default function Enemy({ enemy }: EnemyProps) {

  return null;
}