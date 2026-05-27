import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useFireSystem } from "./fireStore";

interface EnemyProps {
  enemy: {
    id: string;
    position: THREE.Vector3;
    health: number;
    maxHealth: number;
  };
}

export default function Enemy({ enemy }: EnemyProps) {
  const fire = useFireSystem();

  useFrame(() => {
    const burning = enemy.health < enemy.maxHealth;

    if (burning && Math.random() < 0.2) {
      fire?.emit(enemy.position.x, enemy.position.y);
    }
  });

  return null;
}