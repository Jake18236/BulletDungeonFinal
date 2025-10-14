import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface EnemyProps {
  enemy: {
    id: string;
    position: THREE.Vector3;
    health: number;
    maxHealth: number;
    state: string;
    speed: number;
    patrolTarget?: THREE.Vector3;
  };
}

export default function Enemy({ enemy }: EnemyProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const woodTexture = useTexture("/textures/wood.jpg");
  
  // Configure texture for pixel art
  woodTexture.magFilter = THREE.NearestFilter;
  woodTexture.minFilter = THREE.NearestFilter;

  // Pre-calculate patrol target
  const patrolTarget = useMemo(() => {
    if (!enemy.patrolTarget) {
      return new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        0,
        (Math.random() - 0.5) * 10
      );
    }
    return enemy.patrolTarget;
  }, [enemy.id]);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.position.copy(enemy.position);
      
      // Simple patrol behavior when not chasing
      if (enemy.state === "patrolling") {
        const direction = new THREE.Vector3()
          .subVectors(patrolTarget, enemy.position)
          .normalize()
          .multiplyScalar(enemy.speed * 0.5 * delta);
        
        enemy.position.add(direction);
        
        // Choose new patrol target if reached current one
        if (enemy.position.distanceTo(patrolTarget) < 1) {
          patrolTarget.set(
            (Math.random() - 0.5) * 10,
            0,
            (Math.random() - 0.5) * 10
          );
        }
      }
    }
  });

  return (
    <mesh ref={meshRef} castShadow receiveShadow position={[0, 0.5, 0]}>
      <boxGeometry args={[0.8, 1, 0.8]} />
      <meshLambertMaterial map={woodTexture} color="#ff4444" />
      
      {/* Health bar */}
      <mesh position={[0, 1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 0.1]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>
      <mesh position={[0, 1.21, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[enemy.health / enemy.maxHealth, 1, 1]}>
        <planeGeometry args={[1, 0.1]} />
        <meshBasicMaterial color="#00ff00" />
      </mesh>
    </mesh>
  );
}
