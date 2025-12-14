// client/src/lib/stores/useCamera.tsx
import { create } from "zustand";
import * as THREE from "three";

interface CameraState {
  position: THREE.Vector3;
  targetPosition: THREE.Vector3;
  smoothing: number;
  maxMouseOffset: number;
  mouseInfluenceStrength: number;

  updateCamera: (
    delta: number,
    playerPos: THREE.Vector3,
    gunOffset: { x: number; y: number },
    mouseScreenPos: { x: number; y: number },
    canvasWidth: number,
    canvasHeight: number
  ) => void;

  worldToScreen: (
    worldPos: THREE.Vector3,
    canvasWidth: number,
    canvasHeight: number,
    tileSize: number
  ) => { x: number; y: number };

  reset: () => void;
}

export const useCamera = create<CameraState>((set, get) => ({
  position: new THREE.Vector3(),
  targetPosition: new THREE.Vector3(),
  smoothing: 1, // Higher = slower/smoother
  maxMouseOffset: 100, // Max pixels camera can shift from mouse
  mouseInfluenceStrength: 1.5, // Exponential curve strength

  updateCamera: (delta, playerPos, gunOffset, mouseScreenPos, canvasWidth, canvasHeight) => {
    const state = get();

    // Start with gun position as base
    const baseTarget = playerPos.clone();

    // Calculate mouse offset from center (normalized -1 to 1)
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    const mouseDeltaX = (mouseScreenPos.x - centerX) / (canvasWidth / 2);
    const mouseDeltaY = (mouseScreenPos.y - centerY) / (canvasHeight / 2);

    // Apply exponential curve for more natural feel
    const expX = Math.sign(mouseDeltaX) * Math.pow(Math.abs(mouseDeltaX), state.mouseInfluenceStrength);
    const expY = Math.sign(mouseDeltaY) * Math.pow(Math.abs(mouseDeltaY), state.mouseInfluenceStrength);

    // Convert screen-space mouse offset to world-space
    // Mouse offset influences camera in world coordinates
    const mouseOffsetWorld = new THREE.Vector3(
      expX * state.maxMouseOffset / 25, // Divide by tileSize/2 to convert to world units
      0,
      expY * state.maxMouseOffset / 25
    );

    // Target is player position + mouse influence
    const newTarget = baseTarget.add(mouseOffsetWorld);

    // Smooth camera movement
    const smoothed = state.position.clone().lerp(newTarget, delta * state.smoothing);

    set({
      targetPosition: newTarget,
      position: smoothed,
    });
  },

  worldToScreen: (worldPos, canvasWidth, canvasHeight, tileSize) => {
    const state = get();
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    return {
      x: centerX + ((worldPos.x - state.position.x) * tileSize) / 2,
      y: centerY + ((worldPos.z - state.position.z) * tileSize) / 2,
    };
  },

  reset: () => set({
    position: new THREE.Vector3(),
    targetPosition: new THREE.Vector3(),
  }),
}));

