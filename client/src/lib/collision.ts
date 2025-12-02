import * as THREE from "three";

export interface Collidable {
  position: THREE.Vector3;
  size?: { x: number; y: number; z: number };
  radius?: number;
}

export function checkCollision(a: Collidable, b: Collidable): boolean {
  // Simple AABB collision detection
  if (a.size && b.size) {
    const aMin = new THREE.Vector3(
      a.position.x - a.size.x / 2,
      a.position.y - a.size.y / 2,
      a.position.z - a.size.z / 2
    );
    const aMax = new THREE.Vector3(
      a.position.x + a.size.x / 2,
      a.position.y + a.size.y / 2,
      a.position.z + a.size.z / 2
    );

    const bMin = new THREE.Vector3(
      b.position.x - b.size.x / 2,
      b.position.y - b.size.y / 2,
      b.position.z - b.size.z / 2
    );
    const bMax = new THREE.Vector3(
      b.position.x + b.size.x / 2,
      b.position.y + b.size.y / 2,
      b.position.z + b.size.z / 2
    );

    return (
      aMin.x <= bMax.x && aMax.x >= bMin.x &&
      aMin.y <= bMax.y && aMax.y >= bMin.y &&
      aMin.z <= bMax.z && aMax.z >= bMin.z
    );
  }

  // Circle collision detection (using radius)
  if (a.radius && b.radius) {
    const distance = a.position.distanceTo(b.position);
    return distance <= (a.radius + b.radius);
  }

  // Mixed collision (box vs circle)
  if (a.size && b.radius) {
    const closest = new THREE.Vector3(
      Math.max(a.position.x - a.size.x / 2, Math.min(b.position.x, a.position.x + a.size.x / 2)),
      Math.max(a.position.y - a.size.y / 2, Math.min(b.position.y, a.position.y + a.size.y / 2)),
      Math.max(a.position.z - a.size.z / 2, Math.min(b.position.z, a.position.z + a.size.z / 2))
    );

    const distance = closest.distanceTo(b.position);
    return distance <= b.radius;
  }

  if (b.size && a.radius) {
    return checkCollision(b, a);
  }

  return false;
}

export function resolveCollision(moving: Collidable, stationary: Collidable): THREE.Vector3 {
  const direction = new THREE.Vector3()
    .subVectors(moving.position, stationary.position)
    .normalize();

  let distance = 1;
  if (moving.radius && stationary.radius) {
    distance = moving.radius + stationary.radius;
  } else if (moving.size && stationary.size) {
    distance = Math.max(moving.size.x, moving.size.z) / 2 + Math.max(stationary.size.x, stationary.size.z) / 2;
  }

  return direction.multiplyScalar(distance).add(stationary.position);
}

export const ROOM_LIMIT = 20;

/**
 * Keep an object inside axis-aligned square bounds [-roomLimit, roomLimit] on x/z and
 * reflect its velocity component when it hits a wall (simple bounce).
 * Works with objects that have `x`/`z` on position and velocity (THREE.Vector3 or plain objects).
 */
export function bounceAgainstBounds(
  position: { x: number; z: number } | THREE.Vector3,
  velocity: { x: number; z: number } | THREE.Vector3,
  roomLimit: number = ROOM_LIMIT,
  bounce = 0.6
): { position: THREE.Vector3; velocity: THREE.Vector3 } {
  const pos = new THREE.Vector3(position.x, 0, position.z);
  const vel = new THREE.Vector3(velocity.x, 0, velocity.z);

  // Left/right
  if (pos.x < -roomLimit) {
    pos.x = -roomLimit;
    vel.x = -vel.x * bounce;
  }
  if (pos.x > roomLimit) {
    pos.x = roomLimit;
    vel.x = -vel.x * bounce;
  }

  // Top/bottom (z axis)
  if (pos.z < -roomLimit) {
    pos.z = -roomLimit;
    vel.z = -vel.z * bounce;
  }
  if (pos.z > roomLimit) {
    pos.z = roomLimit;
    vel.z = -vel.z * bounce;
  }

  return { position: pos, velocity: vel };
}