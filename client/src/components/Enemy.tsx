import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { bounceAgainstBounds, ROOM_LIMIT } from "../lib/collision";

interface EnemyProps {
  enemy: {
    id: string;
    position: THREE.Vector3;
    health: number;
    maxHealth: number;
    state: string;
    speed: number;
    patrolTarget?: THREE.Vector3;
    patrolPoints?: THREE.Vector3[];
    currentPatrolIndex?: number;
    type?: string;
    velocity: THREE.Vector3;
  };
}

export default function Enemy({ enemy }: EnemyProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const woodTexture = useTexture("/textures/wood.jpg");

  woodTexture.magFilter = THREE.NearestFilter;
  woodTexture.minFilter = THREE.NearestFilter;

  const patrolTarget = useMemo(() => {
    // If this enemy has explicit patrol points, use the current index
    if (enemy.patrolPoints && enemy.patrolPoints.length > 0) {
      const idx = enemy.currentPatrolIndex ?? 0;
      return enemy.patrolPoints[idx % enemy.patrolPoints.length];
    }

    return enemy.patrolTarget || new THREE.Vector3(
      (Math.random() - 0.5) * 10,
      0,
      (Math.random() - 0.5) * 10
    );
  }, [enemy.id]);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;

    // Apply velocity
    enemy.position.add(enemy.velocity.clone().multiplyScalar(delta));
    enemy.velocity.multiplyScalar(0.8); // friction

    // Patrol behavior
    if (enemy.state === "patrolling") {
      if (enemy.type === "sentry") {
        // Sentry: stay in place (maybe rotate/look) - no position change
      } else if (enemy.type === "patroller" && enemy.patrolPoints && enemy.patrolPoints.length > 0) {
        // Move towards current patrol point
        const target = enemy.patrolPoints[enemy.currentPatrolIndex ?? 0];
        const dir = target.clone().sub(enemy.position);
        const dist = dir.length();
        if (dist > 0.2) {
          dir.normalize().multiplyScalar(enemy.speed * 0.5 * delta);
          enemy.position.add(dir);
        } else {
          // advance patrol index
          enemy.currentPatrolIndex = ((enemy.currentPatrolIndex ?? 0) + 1) % enemy.patrolPoints.length;
        }
      } else {
        // Default small wander
        const direction = patrolTarget.clone().sub(enemy.position)
          .normalize()
          .multiplyScalar(enemy.speed * 0.5 * delta);

        enemy.position.add(direction);

        if (enemy.position.distanceTo(patrolTarget) < 1) {
          patrolTarget.set(
            (Math.random() - 0.5) * 10,
            0,
            (Math.random() - 0.5) * 10
          );
        }
      }
    }

    // After movement, bounce off room bounds
    const bounced = bounceAgainstBounds(enemy.position, enemy.velocity, ROOM_LIMIT, 0.6);
    enemy.position.copy(bounced.position);
    enemy.velocity.copy(bounced.velocity);

    // Update mesh position
    meshRef.current.position.copy(enemy.position).add(new THREE.Vector3(0, 0.5, 0));
  });

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <boxGeometry args={[0.8, 1, 0.8]} />
      <meshLambertMaterial map={woodTexture} color="#ff4444" />

      {/* Health bar */}
      <mesh position={[0, 1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 0.1]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>
      <mesh
        position={[0, 1.21, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[enemy.health / enemy.maxHealth, 1, 1]}
      >
        <planeGeometry args={[1, 0.1]} />
        <meshBasicMaterial color="#00ff00" />
      </mesh>
    </mesh>
  );
}
