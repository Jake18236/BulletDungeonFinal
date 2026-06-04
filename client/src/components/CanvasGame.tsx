import { useEffect, useMemo, useRef, useState, memo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { usePlayer } from "../lib/stores/usePlayer";
import {
  ENEMY_TYPE_CONFIG,
  lazarusConfig,
  useEnemies,
  type Enemy,
} from "../lib/stores/useEnemies";
import { bounceAgainstBounds } from "../lib/collision";
import { useGame } from "../lib/stores/useGame";
import { useAudio } from "../lib/stores/useAudio";
import { FireParticleSystem } from "../lib/FireParticleSystem";
import { useProjectiles, TrailParticle } from "../lib/stores/useProjectiles";
import { useHit, flushHitEffects } from "../lib/stores/useHit";
import { useSummons } from "../lib/stores/useSummons";
import { useCamera } from "../lib/stores/useCamera";
import { useVisualEffects } from "../lib/stores/useVisualEffects";
import { useParticles } from "../lib/stores/useParticles";
import { GameCamera2D, getPixelPerfectScale } from "../lib/camera";
import fontJson from "./Lantern.json";
import { buildFont, drawBitmapText } from "../lib/font";
import GameUI from "./GameUI";
import { LevelUpScreen } from "./GameUI";
import Darkness from "./Darkness";
import {
  enemySpritesByType,
  enemyEyeSpritesByType,
  WeaponSprites,
  cursorSprite,
  SummonSprites,
  xpSprite,
  getProjectileImage,
  VisualSprites,
  EnemySpriteType,
  enemyEyeballProjectileSprite,
  enemyDeathSpritesheet,
  lazarusBossSpriteSheet,
  bossLaserSpriteSheet,
  bossLaserContinueSprite,
  bossLaserWindupSprite,
  reaperBossSpriteSheet,
  crowEnemySpriteSheet,
  crowDeathSpritesheet,
  mageEnemySpriteSheet,
  enemyLightningSpriteSheet,
} from "./SpriteProps";

import { DevTools } from "./DevTools";

const font = buildFont(fontJson);

const mageStaticParticleSheet = (() => {
  const img = new Image();
  img.src = "/sprites/mage-static-particles.png";
  return img;
})();

const mageLightningIndicator = (() => {
  const img = new Image();
  img.src = "/sprites/mage-lightning-indicator.png";
  return img;
})();

const fontWhiteImage = new Image();
fontWhiteImage.src = "/sprites/font-atlas-white.png";

const fontRedImage = new Image();
fontRedImage.src = "/sprites/font-atlas-red.png";

export const CANVAS_WIDTH = window.innerWidth;
export const CANVAS_HEIGHT = window.innerHeight;
const ROOM_SIZE = 2000;
const LAZARUS_BASE_BEAM_LENGTH_WORLD = (304 * 4) / 25;
const LAZARUS_BEAM_LENGTH_WORLD =
  LAZARUS_BASE_BEAM_LENGTH_WORLD * lazarusConfig.beamLengthScale;

const grassSprite = new Image();
grassSprite.src = "/textures/grass3.png";

const treeSprite = new Image();
treeSprite.src = "/sprites/enemy/tree-enemy.png";

const treeEnemyEyesSprite = new Image();
treeEnemyEyesSprite.src = "/sprites/enemy/tree-enemy-eyes.png";

const electricityLineSpriteSheet = new Image();
electricityLineSpriteSheet.src = "/sprites/electricity-line-spritesheet.png";

const playerSpriteSheet = new Image();
playerSpriteSheet.src = "/sprites/character4.png";

const PLAYER_SPRITE_FRAME_SIZE = 32;
const PLAYER_SPRITE_RENDER_SIZE = 64;
const PLAYER_SPRITE_ANIMATIONS = {
  idle: { row: 0, frames: 6, fps: 10 },
  running: { row: 1, frames: 4, fps: 12 },
  walking: { row: 2, frames: 8, fps: 12 },
} as const;

interface EnemyProjectile {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  life: number;
  maxLife: number;
  size: number;
  kind?: "orb" | "laser";
  frame?: number;
}

interface EnemyDeathAnimation {
  id: string;
  position: THREE.Vector3;
  startedAt: number;
  frameDurationMs: number;
}

interface FootstepMark {
  id: string;
  position: THREE.Vector3;
  life: number;
  maxLife: number;
  radius: number;
}

interface TerrainObstacle {
  id: number;
  x: number;
  z: number;
  radius: number;
  type: "tree";
  spriteFrame: 0 | 1 | 2;
  frameTimer: number;
  frameQueue: Array<0 | 1 | 2>;
  lockedByLightning: boolean;
  cooldownUntil: number;
}

interface TreeLightningAttack {
  source: TerrainObstacle;
  target: TerrainObstacle;
  startedAt: number;
  connectAt: number;
  dissipateAt: number;
  endsAt: number;
  frame: number;
  animTimer: number;
  damageTimer: number;
  releasedTrees: boolean;
}

interface MageLightningParticle {
  x: number; // world x
  z: number; // world z
  vy: number; // upward drift in screen px/s
  vx: number;
  age: number;
  maxAge: number;
  frame: number;
}

interface MageLightningAttack {
  targetX: number;
  targetZ: number;
  mageX: number;
  mageZ: number;
  warningTimer: number;
  fireTimer: number;
  fired: boolean;
  frame: number;
  animTimer: number;
  particles: MageLightningParticle[];
  particleSpawnTimer: number;
}

const { addSummon } = useSummons.getState();

// Reusable temp vector to avoid per-frame allocations
const _tmpVec = new THREE.Vector3();
// Lazarus boss update pools
const _laz1 = new THREE.Vector3(); // dirToPlayer
const _laz2 = new THREE.Vector3(); // safeDirection
const _laz3 = new THREE.Vector3(); // orbitDirection
const _laz4 = new THREE.Vector3(); // moveDirection / lockedDirection / scratch
const _laz5 = new THREE.Vector3(); // beamDirection
const _laz6 = new THREE.Vector3(); // beamOrigin / damage position
const _laz7 = new THREE.Vector3(); // toPlayer
// Reaper boss update pool
const _rep1 = new THREE.Vector3(); // targetDir
// Incrementing IDs for canvas-local effects (avoids crypto.randomUUID GC pressure)
let _nextImpactId = 0;
let _nextProjectileId = 0;
let _nextFootstepId = 0;

function generateRoomTerrain(): TerrainObstacle[] {
  const trees: TerrainObstacle[] = [];
  let obstacleId = 0;
  const seed = 1337;
  const random = (n: number) => {
    const value = Math.sin(seed * 0.13 + n * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  };

  const radialBands = [
    { radius: 30, count: 10 },
    { radius: 58, count: 30 },
    { radius: 88, count: 60 },
    { radius: 130, count: 100 },
  ];

  radialBands.forEach((band, bandIndex) => {
    const offset = random(30 + bandIndex) * Math.PI * 2;
    const jitter = (random(50 + bandIndex) - 0.5) * 2;

    for (let i = 0; i < band.count; i++) {
      const angle = offset + (i / band.count) * Math.PI * 2;
      const distance = band.radius + jitter * 2;
      trees.push({
        id: obstacleId++,
        x: Math.cos(angle) * distance,
        z: Math.sin(angle) * distance,
        radius: 1.7,
        type: "tree",
        spriteFrame: 0,
        frameTimer: 0,
        frameQueue: [],
        lockedByLightning: false,
        cooldownUntil: 0,
      });
    }
  });

  return trees;
}

function checkTerrainCollision(
  pos: THREE.Vector3,
  obstacles: TerrainObstacle[],
  radius: number,
): { collision: boolean; normal?: THREE.Vector2 } {
  for (const obs of obstacles) {
    const distX = pos.x - obs.x;
    const distZ = pos.z - obs.z;
    const distSq = distX * distX + distZ * distZ;
    const combinedRadius = radius + obs.radius;

    if (distSq < combinedRadius * combinedRadius) {
      const dist = Math.max(Math.sqrt(distSq), 0.0001);
      // Only create Vector2 if collision is detected (late allocation)
      const normal = new THREE.Vector2(distX / dist, distZ / dist);
      return { collision: true, normal };
    }
  }

  return { collision: false };
}

function resolveTerrainPenetration(
  pos: THREE.Vector3,
  obstacles: TerrainObstacle[],
  radius: number,
): THREE.Vector3 {
  const resolved = pos.clone();
  const combined = radius;

  for (let i = 0; i < 2; i++) {
    for (const obs of obstacles) {
      const dx = resolved.x - obs.x;
      const dz = resolved.z - obs.z;
      const distSq = dx * dx + dz * dz;
      const combinedRadius = combined + obs.radius;
      const threshold = combinedRadius * combinedRadius;

      if (distSq >= threshold) continue;

      const dist = Math.max(Math.sqrt(distSq), 0.0001);
      const pushOut = (combined + obs.radius - dist + 0.01) / dist;
      resolved.x += dx * pushOut;
      resolved.z += dz * pushOut;
    }
  }
  return resolved;
}

function moveWithTerrainSlide(
  currentPos: THREE.Vector3,
  move: THREE.Vector3,
  obstacles: TerrainObstacle[],
  radius: number,
): THREE.Vector3 {
  const targetX = currentPos.x + move.x;
  const targetZ = currentPos.z + move.z;

  let collision = false;
  const combinedRadius = radius;
  for (const obs of obstacles) {
    const dx = targetX - obs.x;
    const dz = targetZ - obs.z;
    const combined = combinedRadius + obs.radius;
    if (dx * dx + dz * dz < combined * combined) {
      collision = true;
      break;
    }
  }

  if (!collision) {
    const resolved = currentPos.clone().add(move);
    return resolveTerrainPenetration(resolved, obstacles, radius);
  }

  // Try slide options without creating intermediate vectors
  const moveLen = Math.sqrt(move.x * move.x + move.z * move.z);
  if (moveLen <= 0.00001) {
    return resolveTerrainPenetration(currentPos, obstacles, radius);
  }

  // Try horizontal, vertical, then diagonal slides
  const slides = [
    { x: move.x, z: 0 },
    { x: 0, z: move.z },
    { x: move.z * 0.7, z: -move.x * 0.7 },
    { x: -move.z * 0.7, z: move.x * 0.7 },
  ];

  for (const slide of slides) {
    const attemptX = currentPos.x + slide.x;
    const attemptZ = currentPos.z + slide.z;
    let slideCollision = false;

    for (const obs of obstacles) {
      const dx = attemptX - obs.x;
      const dz = attemptZ - obs.z;
      const combined = radius + obs.radius;
      if (dx * dx + dz * dz < combined * combined) {
        slideCollision = true;
        break;
      }
    }

    if (!slideCollision) {
      const result = currentPos.clone();
      result.x = attemptX;
      result.z = attemptZ;
      return resolveTerrainPenetration(result, obstacles, radius);
    }
  }

  return resolveTerrainPenetration(currentPos, obstacles, radius);
}

function getEnemyType(enemy: {
  type?: string;
}): "basic" | "tank" | "eyeball" | "tree" {
  if (
    enemy.type === "tank" ||
    enemy.type === "eyeball" ||
    enemy.type === "tree"
  )
    return enemy.type;
  return "basic";
}

function getEnemyBodyHitRadius(enemy: {
  type?: string;
  isBoss?: boolean;
  bossType?: string;
}) {
  if (enemy.isBoss && enemy.bossType === "lazarus")
    return lazarusConfig.bodyHitRadius;
  if (enemy.isBoss && enemy.bossType === "reaper") return 3.2;
  if (enemy.type === "crow") return 0.6;
  if (enemy.type === "mage") return 1.6;
  if (enemy.type === "tree") return ENEMY_TYPE_CONFIG.tree.bodyHitRadius;
  return ENEMY_TYPE_CONFIG[getEnemyType(enemy)].bodyHitRadius;
}

function getEnemyCollisionRadius(enemy: {
  type?: string;
  isBoss?: boolean;
  bossType?: string;
}) {
  if (enemy.isBoss && enemy.bossType === "reaper") return 3.5;
  if (enemy.type === "crow") return 0.5;
  if (enemy.type === "mage") return 0.9;
  if (enemy.type === "tree") return ENEMY_TYPE_CONFIG.tree.collisionRadius;
  return ENEMY_TYPE_CONFIG[getEnemyType(enemy)].collisionRadius;
}

function distancePointToSegment(
  point: THREE.Vector2,
  a: THREE.Vector2,
  b: THREE.Vector2,
) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abLenSq = abx * abx + aby * aby;

  if (abLenSq === 0) {
    const apx = point.x - a.x;
    const apy = point.y - a.y;
    return Math.sqrt(apx * apx + apy * apy);
  }

  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const t = THREE.MathUtils.clamp((apx * abx + apy * aby) / abLenSq, 0, 1);

  const closestX = a.x + abx * t;
  const closestY = a.y + aby * t;
  const dx = point.x - closestX;
  const dy = point.y - closestY;
  return Math.sqrt(dx * dx + dy * dy);
}

function pickTreeLightningAttack(
  nowMs: number,
  trees: TerrainObstacle[],
): TreeLightningAttack | null {
  if (trees.length < 2) return null;

  // Single pass to find eligible trees
  const eligibleTrees: TerrainObstacle[] = [];
  for (const tree of trees) {
    if (nowMs >= tree.cooldownUntil && !tree.lockedByLightning) {
      eligibleTrees.push(tree);
    }
  }

  if (eligibleTrees.length < 2) return null;

  const source =
    eligibleTrees[Math.floor(Math.random() * eligibleTrees.length)];

  // Single pass to find nearby trees with distance - avoid map/sort
  const nearbyTrees: { tree: TerrainObstacle; dist: number }[] = [];
  for (const tree of trees) {
    if (
      tree !== source &&
      nowMs >= tree.cooldownUntil &&
      !tree.lockedByLightning
    ) {
      const dx = tree.x - source.x;
      const dz = tree.z - source.z;
      const dist = dx * dx + dz * dz; // Use squared distance to avoid sqrt
      nearbyTrees.push({ tree, dist });

      // Keep only best 6 to avoid full sort
      if (nearbyTrees.length > 12) {
        let maxIdx = 0;
        for (let i = 1; i < nearbyTrees.length; i++) {
          if (nearbyTrees[i].dist > nearbyTrees[maxIdx].dist) maxIdx = i;
        }
        nearbyTrees.splice(maxIdx, 1);
      }
    }
  }

  if (nearbyTrees.length === 0) return null;

  // Quick sort of small array
  nearbyTrees.sort((a, b) => a.dist - b.dist);
  const target =
    nearbyTrees[Math.floor(Math.random() * Math.min(6, nearbyTrees.length))]
      .tree;

  return {
    source,
    target,
    startedAt: nowMs,
    connectAt: nowMs + 3000,
    dissipateAt: nowMs + 10000,
    endsAt: nowMs + 11000,
    frame: 0,
    animTimer: 0,
    damageTimer: 0,
    releasedTrees: false,
  };
}

function queueTreeFrames(tree: TerrainObstacle, frames: Array<0 | 1 | 2>) {
  tree.frameQueue.push(...frames);
}

function releaseLightningTree(tree: TerrainObstacle, nowMs: number) {
  tree.lockedByLightning = false;
  tree.cooldownUntil = nowMs + 10_000;
  queueTreeFrames(tree, [1, 0]);
}

const snapToGrid = (value: number) => Math.round(value / 1) * 1;

// =====================================================
// VIEWPORT CULLING HELPERS
// =====================================================
const isObjectInViewport = (
  objectX: number,
  objectZ: number,
  playerX: number,
  playerZ: number,
  cullRadius: number = 80,
): boolean => {
  const dx = objectX - playerX;
  const dz = objectZ - playerZ;
  const distSq = dx * dx + dz * dz;
  return distSq <= cullRadius * cullRadius;
};

export default memo(function CanvasGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eyeCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const animationDeltaRef = useRef<number>(0);
  const enemyProjectilesRef = useRef<EnemyProjectile[]>([]);
  const enemyDeathAnimationsRef = useRef<EnemyDeathAnimation[]>([]);
  const crowDeathAnimationsRef = useRef<EnemyDeathAnimation[]>([]);
  const keysPressed = useRef<Set<string>>(new Set());
  const lastTimeRef = useRef<number>(0);
  const pausedAnimationTimeRef = useRef<number>(0);
  const gameplayElapsedMsRef = useRef<number>(0);
  const damagedThisFrameRef = useRef<boolean>(false);
  const { applyHit, applyPlayerDamage } = useHit();
  const terrainRef = useRef<TerrainObstacle[]>([]);
  const treeLightningRef = useRef<TreeLightningAttack[]>([]);
  const gameStartTimeRef = useRef<number | null>(null);
  const treeLightningSpawnTimerRef = useRef<number>(0);
  const footstepMarksRef = useRef<FootstepMark[]>([]);
  const footstepSpawnTimerRef = useRef<number>(0);

  const footstepSideRef = useRef<1 | -1>(1);
  const playerFacingRef = useRef<1 | -1>(1);
  const fireSystem = useRef(new FireParticleSystem(3000));
  const fireSprite = useRef<HTMLImageElement>(new Image());
  const fireEmissionThrottleRef = useRef<Record<string, number>>({});
  const spriteReady = useRef(false);
  const mageLightningRef = useRef<MageLightningAttack[]>([]);
  const lightningSpriteSheet = useRef<HTMLImageElement>(new Image());
  const lightningReady = useRef(false);

  useEffect(() => {
    const img = new Image();

    img.onload = () => {
      fireSprite.current = img;
      spriteReady.current = true;
    };

    img.src = "/sprites/fire-effect.png";
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      lightningSpriteSheet.current = img;
      lightningReady.current = true;
    };
    img.src = "/sprites/lightning.png";
  }, []);

  const addImpact = useVisualEffects((state) => state.addImpact);
  const addExplosion = useVisualEffects((state) => state.addExplosion);
  const addDamageNumber = useVisualEffects((state) => state.addDamageNumber);
  const updateEffects = useVisualEffects((state) => state.updateEffects);

  const phase = useGame((state) => state.phase);
  const end = useGame((state) => state.end);

  const showLevelUpScreen = usePlayer((state) => state.showLevelUpScreen);
  const isMoving = usePlayer((state) => state.isMoving);

  const fireShot = usePlayer((state) => state.fireShot);
  const setFiring = usePlayer((state) => state.setFiring);
  const startReload = usePlayer((state) => state.startReload);
  const isReloading = usePlayer((state) => state.isReloading);
  const reloadProgress = usePlayer((state) => state.reloadProgress);
  const reloadTime = usePlayer((state) => state.reloadTime);
  const updateReload = usePlayer((state) => state.updateReload);
  const updateInvincibility = usePlayer((state) => state.updateInvincibility);
  const updateRegeneration = usePlayer((state) => state.updateRegeneration);
  const updateMuzzleFlash = usePlayer((state) => state.updateMuzzleFlash);
  const muzzleFlashTimer = usePlayer((state) => state.muzzleFlashTimer);
  const muzzleFlashPosition = usePlayer((state) => state.muzzleFlashPosition);
  const ammo = usePlayer((state) => state.ammo);
  const updateFanFire = usePlayer((state) => state.updateFanFire);
  const movePlayer = usePlayer((state) => state.move);

  const updateDamageFlash = usePlayer((state) => state.updateDamageFlash);
  const maxAmmo = usePlayer((state) => state.maxAmmo);
  const firerate = usePlayer((state) => state.firerate);
  const playerLevel = usePlayer((state) => state.level);
  const playerXP = usePlayer((state) => state.xp);
  const xpToNextLevel = usePlayer((state) => state.xpToNextLevel);

  const addProjectile = useProjectiles((state) => state.addProjectile);
  const updateProjectiles = useProjectiles((state) => state.updateProjectiles);

  const addXPOrb = useEnemies((state) => state.addXPOrb);
  const updateXPOrbs = useEnemies((state) => state.updateXPOrbs);
  const updateEnemies = useEnemies((state) => state.updateEnemies);
  const removeEnemy = useEnemies((state) => state.removeEnemy);
  const updateAutoSpawn = useEnemies((state) => state.updateAutoSpawn);

  const updateSummons = useSummons((state) => state.updateSummons);
  const updateStatusEffects = useSummons((state) => state.updateStatusEffects);
  const handleEnemyKilledBySummon = useSummons(
    (state) => state.handleEnemyKilledBySummon,
  );
  const playHit = useAudio((state) => state.playHit);
  const playSuccess = useAudio((state) => state.playSuccess);
  const screenCenter = useCamera((state) => state.screenCenter);

  const poolSize = 20000;

  const poolRef = useRef<TrailParticle[]>([]);
  const writeIndexRef = useRef(0);
  const activeCountRef = useRef(0);
  const highWaterRef = useRef(0);

  if (poolRef.current.length === 0) {
    for (let i = 0; i < poolSize; i++) {
      poolRef.current.push({
        x: 0,
        y: 0,
        size: 0,
        life: 0,
        maxLife: 0,
      });
    }
  }

  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const fireTimer = useRef(0);
  const canFire = useRef(true);
  const isMouseDown = useRef(false);
  const canInteract = phase === "playing";
  const canvasRectRef = useRef<DOMRect | null>(null);
  const cameraRef = useRef(new GameCamera2D());
  const weaponAngleRef = useRef(0);
  const playerPositionRef = useRef(new THREE.Vector3());
  const enemiesRef = useRef<Enemy[]>([]);
  const position = playerPositionRef.current;
  const enemies = enemiesRef.current;
  const [canvasDisplay, setCanvasDisplay] = useState({
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    offsetX: 0,
    offsetY: 0,
  });

  useEffect(() => {
    if (canvasRef.current) {
      canvasRectRef.current = canvasRef.current.getBoundingClientRect();
    }
  }, []);

  useEffect(() => {
    const updatePixelScale = () => {
      const scaled = getPixelPerfectScale(
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        window.innerWidth,
        window.innerHeight,
      );
      setCanvasDisplay({
        width: scaled.width,
        height: scaled.height,
        offsetX: scaled.offsetX,
        offsetY: scaled.offsetY,
      });
    };

    updatePixelScale();
    window.addEventListener("resize", updatePixelScale);
    return () => window.removeEventListener("resize", updatePixelScale);
  }, []);

  useEffect(() => {
    Object.values(VisualSprites).forEach((img) => {
      if (!img.complete) {
        img.onload = () => {};
      }
    });
  }, []);

  useEffect(() => {
    terrainRef.current = generateRoomTerrain();
    treeLightningRef.current = [];
    treeLightningSpawnTimerRef.current = 0;
    mageLightningRef.current = [];
    footstepMarksRef.current = [];
    footstepSpawnTimerRef.current = 0;
  }, []);

  useEffect(() => {
    if (phase === "playing" && gameStartTimeRef.current == null) {
      gameStartTimeRef.current = performance.now();
    }
    if (phase === "paused") {
      pausedAnimationTimeRef.current = performance.now();
    }
    if (phase === "ready" || phase === "ended") {
      gameStartTimeRef.current = null;
      gameplayElapsedMsRef.current = 0;
      pausedAnimationTimeRef.current = 0;
      treeLightningRef.current = [];
      treeLightningSpawnTimerRef.current = 0;
      footstepMarksRef.current = [];
      footstepSpawnTimerRef.current = 0;
      cameraRef.current.resetShake();
    }
  }, [phase]);

  useEffect(() => {
    if (showLevelUpScreen) {
      cameraRef.current.resetShake();
    }
  }, [showLevelUpScreen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.code);
      if (!canInteract) return;

      const playerState = usePlayer.getState();
      if (
        e.code === "KeyR" &&
        !playerState.isReloading &&
        playerState.ammo < maxAmmo
      ) {
        startReload();
      }

      if (e.code === "KeyB") {
        const spawnPos = position.clone().add(new THREE.Vector3(20, 0, 0));
        useEnemies.getState().spawnLazarusBoss(spawnPos);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [canInteract, startReload]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!canInteract) return;

      if (e.button === 0) {
        isMouseDown.current = true;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDown.current = false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();

      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;

      const offsetX = canvasDisplay.offsetX;
      const offsetY = canvasDisplay.offsetY;

      mouseRef.current = {
        x: (e.clientX - rect.left + offsetX) * scaleX,
        y: (e.clientY - rect.top + offsetY) * scaleY,
      };
    };

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [canInteract]);

  const spawnEyeballProjectile = (enemy: any) => {
    const direction = new THREE.Vector3(
      position.x - enemy.position.x,
      0,
      position.z - enemy.position.z,
    ).normalize();
    enemyProjectilesRef.current.push({
      id: String(_nextProjectileId++),
      position: enemy.position.clone(),
      velocity: direction.multiplyScalar(
        ENEMY_TYPE_CONFIG.eyeball.projectileSpeed ?? 9,
      ),
      damage: enemy.attack ?? 1,
      life: ENEMY_TYPE_CONFIG.eyeball.projectileLife ?? 2.8,
      maxLife: ENEMY_TYPE_CONFIG.eyeball.projectileLife ?? 2.8,
      size: ENEMY_TYPE_CONFIG.eyeball.projectileSize ?? 0.35,
    });
  };

  useEffect(() => {
    const gameLoop = (currentTime: number) => {
      const rawDelta = lastTimeRef.current
        ? (currentTime - lastTimeRef.current) / 1000
        : 0;
      const delta = phase === "playing" ? rawDelta : 0;
      animationDeltaRef.current = delta;

      lastTimeRef.current = currentTime;
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;

      const animationNowMs =
        phase === "playing" ? currentTime : pausedAnimationTimeRef.current;
      const playerState = usePlayer.getState();
      const position = playerState.position;
      playerPositionRef.current.copy(position);
      const ammo = playerState.ammo;
      const isReloading = playerState.isReloading;
      const isFiring = playerState.isFiring;
      const invincibilityTimer = playerState.invincibilityTimer;
      const hearts = playerState.hearts;
      const speed = playerState.speed;
      const enemies = useEnemies.getState().enemies;
      enemiesRef.current = enemies;

      cameraRef.current.update({
        deltaSeconds: delta,
        target: { x: position.x, y: position.z },
        mouse: mouseRef.current,
        viewportWidth: CANVAS_WIDTH,
        viewportHeight: CANVAS_HEIGHT,
      });
      useCamera
        .getState()
        .setScreenCenter(
          cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT),
        );

      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const cameraZoom = usePlayer.getState().cameraZoom || 1;
      ctx.save();
      ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.scale(cameraZoom, cameraZoom);
      ctx.translate(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2);

      drawDungeon(ctx, animationNowMs);

      if (phase === "playing") {
        const { x: centerX, y: centerY } =
          cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
        const ps = usePlayer.getState();
        updateReload(delta);
        updateInvincibility(delta);
        updateRegeneration(delta);

        updateDamageFlash(delta);
        updateMuzzleFlash();
        updateSummons(delta, position, enemies, addProjectile, playHit);
        updateFanFire(delta, () => {
          const fanIndex = usePlayer.getState().fanFireIndex;
          const angle = (fanIndex / 10) * Math.PI * 2;
          const direction = new THREE.Vector3(
            Math.cos(angle),
            0,
            Math.sin(angle),
          );
          const { x: centerX, y: centerY } =
            cameraRef.current.getPlayerScreenCenter(
              CANVAS_WIDTH,
              CANVAS_HEIGHT,
            );
          const aimAngle = Math.atan2(
            mouseRef.current.y - centerY,
            mouseRef.current.x - centerX,
          );
          const gunOffsetPixels = 3;
          const gunOffset = gunOffsetPixels / 25;
          const gunPosition = ps.position
            .clone()
            .add(
              new THREE.Vector3(
                Math.cos(aimAngle) * gunOffset,
                0,
                Math.sin(aimAngle) * gunOffset,
              ),
            );

          const stats = usePlayer.getState().getProjectileStats();

          useProjectiles.getState().addProjectile({
            position: gunPosition,
            direction,
            size: stats.projectileSize,
            damage: stats.damage * 0.15,
            life: stats.life,
            speed: stats.speed,
            range: stats.range,
            homing: false,
            piercing: stats.piercing,
            bouncing: stats.bouncing,
          });

          playHit();
        });
        fireSystem.current.update();

        updateStatusEffects(delta, enemies, (enemyId, damage) => {
          const enemy = enemies.find((e) => e.id === enemyId);
          if (enemy) {
            applyHit(
              {
                enemy,
                damage,
                impactPos: enemy.position.clone(),
                isSummonDamage: true,
              },
              enemies,
            );
          }
        });

        updateEffects(delta);

        damagedThisFrameRef.current = false;

        gameplayElapsedMsRef.current += delta * 1000;
        const nowMs = gameplayElapsedMsRef.current;
        if (gameStartTimeRef.current != null) {
          const elapsed = nowMs;

          if (elapsed >= 10) {
            treeLightningSpawnTimerRef.current += delta;
            while (treeLightningSpawnTimerRef.current >= 1.2) {
              treeLightningSpawnTimerRef.current -= 1.2;
              const newAttack = pickTreeLightningAttack(
                nowMs,
                terrainRef.current,
              );
              if (newAttack) {
                newAttack.source.lockedByLightning = true;
                newAttack.target.lockedByLightning = true;
                queueTreeFrames(newAttack.source, [1, 2]);
                queueTreeFrames(newAttack.target, [1, 2]);
                treeLightningRef.current.push(newAttack);
              }
            }
          }

          for (const attack of treeLightningRef.current) {
            if (nowMs >= attack.endsAt && !attack.releasedTrees) {
              releaseLightningTree(attack.source, nowMs);
              releaseLightningTree(attack.target, nowMs);
              attack.releasedTrees = true;
              continue;
            }

            if (nowMs < attack.connectAt) continue;

            attack.animTimer += delta;
            if (attack.animTimer >= 0.09) {
              attack.animTimer = 0;
              attack.frame = (attack.frame + 1) % 4;
            }

            const lineStart = new THREE.Vector2(
              attack.source.x,
              attack.source.z,
            );
            const lineEnd = new THREE.Vector2(attack.target.x, attack.target.z);
            const playerPoint = new THREE.Vector2(position.x, position.z);
            const lineHitRadius = 1.35;
            const playerRadius = 0.8;
            const distanceToBeam = distancePointToSegment(
              playerPoint,
              lineStart,
              lineEnd,
            );

            attack.damageTimer += delta;
            if (
              distanceToBeam <= lineHitRadius + playerRadius &&
              invincibilityTimer <= 0 &&
              !damagedThisFrameRef.current &&
              attack.damageTimer >= 0.2
            ) {
              applyPlayerDamage(new THREE.Vector3(position.x, 0, position.z));
              damagedThisFrameRef.current = true;
            }
          }

          treeLightningRef.current = treeLightningRef.current.filter(
            (attack) => nowMs < attack.endsAt,
          );
        }

        if (ammo === 0 && !isReloading) {
          startReload();
        }

        if (fireTimer.current > 0) {
          fireTimer.current -= delta;
          if (fireTimer.current <= 0) {
            fireTimer.current = 0;
            canFire.current = true;
          }
        }

        setFiring(isMouseDown.current && !isReloading && ammo > 0);

        if (
          isMouseDown.current &&
          !isReloading &&
          ammo > 0 &&
          canFire.current
        ) {
          if (fireShot()) {
            const { x: centerX, y: centerY } =
              cameraRef.current.getPlayerScreenCenter(
                CANVAS_WIDTH,
                CANVAS_HEIGHT,
              );

            const stats = usePlayer.getState().getProjectileStats();
            const baseAngle = Math.atan2(
              mouseRef.current.y - centerY,
              mouseRef.current.x - centerX,
            );
            const horizontalAim = Math.cos(baseAngle);
            if (horizontalAim < 0) {
              playerFacingRef.current = -1;
            } else if (horizontalAim > 0) {
              playerFacingRef.current = 1;
            }
            const handOffset = 0;
            const barrelLength = 5;
            const totalOffsetPixels = handOffset + barrelLength;
            const totalOffset = totalOffsetPixels / 25;
            const barrelFlashPosition = ps.position
              .clone()
              .add(
                new THREE.Vector3(
                  Math.cos(baseAngle) * totalOffset * 1.5,
                  0,
                  Math.sin(baseAngle) * totalOffset * 1.5,
                ),
              );

            // Helper function to fire a projectile in a direction
            const fireProjectileInDirection = (
              angle: number,
              damageMultiplier: number = 1,
            ) => {
              const direction = new THREE.Vector3(
                Math.cos(angle),
                0,
                Math.sin(angle),
              );
              const barrelPosition = ps.position
                .clone()
                .add(
                  new THREE.Vector3(
                    Math.cos(angle) * totalOffset * 5.5,
                    0,
                    Math.sin(angle) * totalOffset * 5.5,
                  ),
                );

              const projectileExplosive =
                ps.lastAmmoExplosive && ammo === 1
                  ? { radius: 192 / 25, damage: 50 }
                  : stats.explosive;

              const projectileBurn = ps.incendiary
                ? { damage: 4, duration: 3.1 }
                : undefined;

              addProjectile({
                position: barrelPosition,
                direction,
                damage: stats.damage * damageMultiplier,
                speed: stats.speed,
                life: stats.life,
                size: stats.projectileSize,
                range: stats.range,
                homing: stats.homing,
                piercing: stats.piercing,
                bouncing: stats.bouncing,
                railgun: ps.railgun,
                explosive: projectileExplosive,
                burn: projectileBurn,
              });
            };

            // Normal projectiles
            const spreadAngle = stats.projectileCount > 1 ? 0.15 : 0;
            for (let i = 0; i < stats.projectileCount; i++) {
              let angle = baseAngle;
              if (stats.projectileCount > 1) {
                const offset =
                  (i - (stats.projectileCount - 1) / 2) * spreadAngle;
                angle += offset;
              }

              const inaccuracy = 1 - stats.accuracy;
              angle += (Math.random() / 4 - 0.125) * inaccuracy;

              if (ps.railgun) {
                angle = baseAngle + Math.random();
              }

              fireProjectileInDirection(angle);
            }

            // Split Fire: fire behind
            if (ps.splitFire) {
              fireProjectileInDirection(baseAngle + Math.PI);
            }

            // Fan Fire: on last ammo, fire 10 bullets in a circle
            if (ps.fanFire && ammo === 1) {
              ps.startFanFire();
            }

            if (phase === "playing")
              cameraRef.current.shake({ strength: 35, durationMs: 60 });

            if (ps.handCannon)
              cameraRef.current.shake({ strength: 25, durationMs: 20 });

            ps.fireMuzzleFlash(barrelFlashPosition);

            playHit();

            fireTimer.current = firerate;
            canFire.current = false;
          }
        }

        let moveX = 0;
        let moveZ = 0;

        if (
          keysPressed.current.has("KeyW") ||
          keysPressed.current.has("ArrowUp")
        )
          moveZ -= 1;
        if (
          keysPressed.current.has("KeyS") ||
          keysPressed.current.has("ArrowDown")
        )
          moveZ += 1;
        if (
          keysPressed.current.has("KeyA") ||
          keysPressed.current.has("ArrowLeft")
        )
          moveX -= 1;
        if (
          keysPressed.current.has("KeyD") ||
          keysPressed.current.has("ArrowRight")
        )
          moveX += 1;

        if (moveX < 0 && !(isMouseDown.current && !isReloading && ammo > 0)) {
          playerFacingRef.current = -1;
        } else if (
          moveX > 0 &&
          !(isMouseDown.current && !isReloading && ammo > 0)
        ) {
          playerFacingRef.current = 1;
        }

        if (moveX !== 0 || moveZ !== 0) {
          usePlayer.getState().setMoving(true);
          const len = Math.sqrt(moveX ** 2 + moveZ ** 2);
          const playerState = usePlayer.getState();
          let speedModifier = isFiring && !isReloading ? 0.4 : 1;

          // Apply speed when firing bonus
          if (isFiring && !isReloading && playerState.speedWhenFiring > 0) {
            speedModifier += playerState.speedWhenFiring;
          }

          let dx = (moveX / len) * speed * delta * speedModifier;
          let dz = (moveZ / len) * speed * delta * speedModifier;

          const currentPos = usePlayer.getState().position.clone();
          const moveStep = new THREE.Vector3(dx, 0, dz);
          const movedPos = moveWithTerrainSlide(
            currentPos,
            moveStep,
            terrainRef.current,
            0.8,
          );

          const bounced = bounceAgainstBounds(
            movedPos,
            new THREE.Vector3(0, 0, 0),
            ROOM_SIZE,
            1,
          );
          usePlayer.setState({ position: bounced.position });

          footstepSpawnTimerRef.current += delta;
          if (footstepSpawnTimerRef.current >= 0.11) {
            footstepSpawnTimerRef.current = 0;
            const moveDir = new THREE.Vector3(dx, 0, dz).normalize();
            const down = new THREE.Vector3(0, 0, -5);
            const side = footstepSideRef.current;
            footstepSideRef.current = side === 1 ? -1 : 1;
            const lateral = new THREE.Vector3(
              -moveDir.z,
              0,
              moveDir.x,
            ).multiplyScalar(0.15 * side);
            footstepMarksRef.current.push({
              id: String(_nextFootstepId++),
              position: bounced.position
                .clone()
                .sub(moveDir.clone().multiplyScalar(0.35))
                .sub(down.clone().multiplyScalar(0.15))
                .add(lateral),
              life: 0,
              maxLife: 0.6,
              radius: 6,
            });
            if (footstepMarksRef.current.length > 40) {
              footstepMarksRef.current.shift();
            }
          }
        } else {
          usePlayer.getState().setMoving(false);
        }

        updateProjectiles(
          delta,
          enemies,
          position,
          (enemyId, damage, knockback, projectileData) => {
            const enemy = enemies.find((e) => e.id === enemyId);
            
              applyHit(
                {
                  enemy,
                  damage,
                  impactPos: projectileData?.impactPos,
                  knockbackStrength: knockback.length(),
                  explosive: projectileData?.explosive,
                  burn: projectileData?.burn,
                  isPlayerDamage: true,
                },
                enemies,
              );
            
          },
          phase !== "playing",
        );

        for (const enemy of enemies) {
          // BOSS LOGIC
          enemy.hitFlash = Math.max(enemy.hitFlash - delta, 0);

          // #########################################################################
          if (enemy.isBoss && enemy.bossType === "lazarus") {
            if (!enemy.isEnraged && enemy.health < enemy.maxHealth * 0.45) {
              enemy.isEnraged = true;
              enemy.maxProjectileCooldown = 1;
              enemy.maxWindUpTime = 0.8;
              enemy.speed *= 1.15;
            }

            _laz1.subVectors(position, enemy.position);
            const distanceToPlayer = _laz1.length();
            if (distanceToPlayer > 0.001) {
              _laz2.copy(_laz1).normalize();
            } else {
              _laz2.set(1, 0, 0);
            }
            _laz3.set(-_laz2.z, 0, _laz2.x);

            const canAdvance = distanceToPlayer > lazarusConfig.idealDistance;
            const canRetreat = distanceToPlayer < lazarusConfig.minDistance;

            if (enemy.attackState === "chasing") {
              _laz4.set(0, 0, 0);
              if (canAdvance) {
                _laz4.copy(_laz2);
              } else if (canRetreat) {
                _laz4.copy(_laz2).multiplyScalar(-0.65);
              }
              if (_laz4.lengthSq() > 0) {
                enemy.position.addScaledVector(
                  _laz4.normalize(),
                  enemy.speed * delta,
                );
              }
              enemy.rotationY = Math.atan2(_laz2.z, _laz2.x);
              enemy.projectileCooldown =
                (enemy.projectileCooldown ?? 0) - delta;
              if (
                enemy.projectileCooldown <= 0 &&
                distanceToPlayer <= lazarusConfig.maxDistance
              ) {
                enemy.attackState = "laser_windup";
                enemy.windUpTimer = 0;
                enemy.clawWindUp = 0;
                enemy.clawGlowIntensity = 0;
                if (!enemy.dashDirection)
                  enemy.dashDirection = new THREE.Vector3();
                enemy.dashDirection.copy(_laz2);
              }
            } else if (enemy.attackState === "laser_windup") {
              enemy.windUpTimer = (enemy.windUpTimer ?? 0) + delta;
              const windupProgress = Math.min(
                enemy.windUpTimer / (enemy.maxWindUpTime ?? 1),
                1,
              );
              const lockedDirection =
                enemy.dashDirection && enemy.dashDirection.lengthSq() > 0
                  ? _laz4.copy(enemy.dashDirection).normalize()
                  : _laz2;
              enemy.rotationY = Math.atan2(
                lockedDirection.z,
                lockedDirection.x,
              );
              enemy.clawWindUp = windupProgress;
              enemy.clawGlowIntensity = windupProgress;
              enemy.velocity.multiplyScalar(0.82);
              if (enemy.windUpTimer >= (enemy.maxWindUpTime ?? 1)) {
                enemy.attackState = "laser_firing";
                enemy.windUpTimer = 0;
                enemy.laserBaseRotation =
                  enemy.rotationY ??
                  Math.atan2(lockedDirection.z, lockedDirection.x);
                enemy.projectileCooldown = lazarusConfig.beamDamageInterval;
                playHit();
              }
            } else if (enemy.attackState === "laser_firing") {
              if (phase === "playing")
                cameraRef.current.shake({ strength: 5, durationMs: 1000 });
              enemy.windUpTimer = (enemy.windUpTimer ?? 0) + delta;
              const fireDuration = lazarusConfig.fireDuration;
              const spinAmount =
                (enemy.windUpTimer ?? 0) * lazarusConfig.rotationSpeed;
              const baseRotation =
                enemy.laserBaseRotation ?? enemy.rotationY ?? 0;
              const currentRotation = baseRotation + spinAmount;
              enemy.rotationY = currentRotation;
              enemy.position.addScaledVector(_laz3, enemy.speed * 0.42 * delta);
              enemy.projectileCooldown =
                (enemy.projectileCooldown ?? 0) - delta;
              if (enemy.projectileCooldown <= 0) {
                const beamOriginOffsetWorld =
                  lazarusConfig.beamOriginOffsetPx / 25;
                for (const beamOffset of lazarusConfig.beamAngles) {
                  const beamAngle = currentRotation + beamOffset;
                  _laz5.set(Math.cos(beamAngle), 0, Math.sin(beamAngle));
                  _laz6
                    .copy(enemy.position)
                    .addScaledVector(_laz5, beamOriginOffsetWorld);
                  _laz7.subVectors(position, _laz6);
                  const along = _laz7.dot(_laz5);
                  const latSq = _laz7.lengthSq() - along * along;
                  const lateral = latSq > 0 ? Math.sqrt(latSq) : 0;
                  if (
                    along >= 0.35 &&
                    along <= LAZARUS_BEAM_LENGTH_WORLD &&
                    lateral <= lazarusConfig.beamHalfWidthWorld &&
                    invincibilityTimer <= 0 &&
                    !damagedThisFrameRef.current
                  ) {
                    _laz6.addScaledVector(
                      _laz5,
                      Math.min(along, LAZARUS_BEAM_LENGTH_WORLD),
                    );
                    applyPlayerDamage(_laz6);
                    damagedThisFrameRef.current = true;
                  }
                }
                enemy.projectileCooldown = lazarusConfig.beamDamageInterval;
              }
              if (enemy.windUpTimer >= fireDuration) {
                enemy.attackState = "recovering";
                enemy.windUpTimer = enemy.isEnraged ? 0.35 : 0.5;
                enemy.projectileCooldown = enemy.maxProjectileCooldown ?? 3.8;
                enemy.laserBaseRotation = enemy.rotationY;
              }
            } else if (enemy.attackState === "recovering") {
              enemy.windUpTimer = (enemy.windUpTimer ?? 0) - delta;
              enemy.clawGlowIntensity = Math.max(
                (enemy.clawGlowIntensity ?? 0) - delta * 2.8,
                0,
              );
              enemy.clawWindUp = Math.max(
                (enemy.clawWindUp ?? 0) - delta * 2.8,
                0,
              );
              if (enemy.windUpTimer <= 0) {
                enemy.attackState = "chasing";
              }
            }

            continue;
          }

          // #########################################################################
          // REAPER BOSS LOGIC
          if (enemy.isBoss && enemy.bossType === "reaper") {
            const dx = position.x - enemy.position.x;
            const dz = position.z - enemy.position.z;
            const distToPlayerSq = dx * dx + dz * dz;
            const distToPlayer = Math.sqrt(distToPlayerSq);
            const safeDirX = distToPlayer > 0.001 ? dx / distToPlayer : 1;
            const safeDirZ = distToPlayer > 0.001 ? dz / distToPlayer : 0;

            // Teleport if too far away
            if (distToPlayer > 130) {
              const ang = Math.random() * Math.PI * 2;
              enemy.position.set(
                position.x + Math.cos(ang) * 15,
                0,
                position.z + Math.sin(ang) * 15,
              );
            }

            const rState = enemy.reaperState ?? "floating";
            const IDEAL_DIST = 10;

            if (rState === "floating") {
              const blend = Math.min(1, 2 * delta);
              if (distToPlayer > IDEAL_DIST + 1) {
                enemy.velocity.x +=
                  (safeDirX * enemy.speed - enemy.velocity.x) * blend;
                enemy.velocity.z +=
                  (safeDirZ * enemy.speed - enemy.velocity.z) * blend;
              } else if (distToPlayer < IDEAL_DIST - 2) {
                enemy.velocity.x +=
                  (-safeDirX * enemy.speed * 0.5 - enemy.velocity.x) * blend;
                enemy.velocity.z +=
                  (-safeDirZ * enemy.speed * 0.5 - enemy.velocity.z) * blend;
              } else {
                const perpX = -safeDirZ;
                const perpZ = safeDirX;
                enemy.velocity.x +=
                  (perpX * enemy.speed * 0.4 - enemy.velocity.x) * blend;
                enemy.velocity.z +=
                  (perpZ * enemy.speed * 0.4 - enemy.velocity.z) * blend;
              }
              enemy.position.x += enemy.velocity.x * delta;
              enemy.position.z += enemy.velocity.z * delta;
              enemy.rotationY = Math.atan2(safeDirZ, safeDirX);

              enemy.reaperMoveCooldown =
                (enemy.reaperMoveCooldown ?? 4) - delta;
              if ((enemy.reaperMoveCooldown ?? 0) <= 0) {
                enemy.reaperState = "charging";
                enemy.reaperChargeTimer = 1.0;
                if (!enemy.dashDirection)
                  enemy.dashDirection = new THREE.Vector3();
                enemy.dashDirection.set(safeDirX, 0, safeDirZ);
              }
            } else if (rState === "charging") {
              enemy.velocity.multiplyScalar(Math.max(0, 1 - 12 * delta));
              enemy.position.x += enemy.velocity.x * delta;
              enemy.position.z += enemy.velocity.z * delta;
              enemy.rotationY = Math.atan2(safeDirZ, safeDirX);
              if (!enemy.dashDirection)
                enemy.dashDirection = new THREE.Vector3();
              enemy.dashDirection.set(safeDirX, 0, safeDirZ);

              enemy.reaperChargeTimer = (enemy.reaperChargeTimer ?? 1) - delta;
              if ((enemy.reaperChargeTimer ?? 0) <= 0) {
                const dir = enemy.dashDirection!;
                enemy.velocity.set(dir.x * 10, 0, dir.z * 10);
                enemy.reaperState = "dashing";
                enemy.reaperDashTimer = 0;
              }
            } else if (rState === "dashing") {
              const ACCELERATION = 15;
              const TURN_RATE = 2.8;
              const DRAG = 0.002;
              const MAX_SPEED = 48;

              _rep1.set(safeDirX, 0, safeDirZ);
              if (!enemy.dashDirection)
                enemy.dashDirection = new THREE.Vector3().copy(_rep1);
              enemy.dashDirection.lerp(_rep1, TURN_RATE * delta).normalize();

              enemy.velocity.x += enemy.dashDirection.x * ACCELERATION * delta;
              enemy.velocity.z += enemy.dashDirection.z * ACCELERATION * delta;

              enemy.velocity.x *= Math.max(0, 1 - DRAG * delta);
              enemy.velocity.z *= Math.max(0, 1 - DRAG * delta);

              const speedSq =
                enemy.velocity.x * enemy.velocity.x +
                enemy.velocity.z * enemy.velocity.z;
              if (speedSq > MAX_SPEED * MAX_SPEED) {
                const scale = MAX_SPEED / Math.sqrt(speedSq);
                enemy.velocity.x *= scale;
                enemy.velocity.z *= scale;
              }

              enemy.position.x += enemy.velocity.x * delta;
              enemy.position.z += enemy.velocity.z * delta;
              enemy.rotationY = Math.atan2(enemy.velocity.z, enemy.velocity.x);
              enemy.reaperDashTimer = (enemy.reaperDashTimer ?? 0) + delta;

              enemy.reaperPassedPlayer ??= false;
              if (!enemy.reaperPassedPlayer && distToPlayer < 4) {
                enemy.reaperPassedPlayer = true;
              }
              if (
                (enemy.reaperDashTimer ?? 0) > 3.4 ||
                enemy.reaperPassedPlayer === true
              ) {
                enemy.reaperState = "summoning";
                enemy.reaperSummonTimer = 0;
                enemy.reaperSummonWave = 0;
              }
            } else if (rState === "summoning") {
              enemy.reaperSummonTimer = (enemy.reaperSummonTimer ?? 0) + delta;
              const t = enemy.reaperSummonTimer ?? 0;
              const DRAG = 0.01;
              enemy.velocity.x *= Math.max(0, 1 - DRAG * delta);
              enemy.velocity.z *= Math.max(0, 1 - DRAG * delta);
              enemy.position.x += enemy.velocity.x * delta;
              enemy.position.z += enemy.velocity.z * delta;

              if (
                enemy.velocity.x * enemy.velocity.x +
                  enemy.velocity.z * enemy.velocity.z >
                0.01
              ) {
                enemy.rotationY = Math.atan2(
                  enemy.velocity.z,
                  enemy.velocity.x,
                );
              }

              const sc = useEnemies.getState().spawnCrow;

              if ((enemy.reaperSummonWave ?? 0) === 0 && t >= 0.3) {
                enemy.reaperSummonWave = 1;
                for (let ci = 0; ci < 5; ci++) {
                  const ang = (ci / 3) * Math.PI * 2;
                  sc(
                    new THREE.Vector3(
                      enemy.position.x + Math.cos(ang) * 7,
                      0,
                      enemy.position.z + Math.sin(ang) * 4,
                    ),
                    new THREE.Vector3(Math.cos(ang) * 5, 0, Math.sin(ang) * 4),
                  );
                }
              }

              if ((enemy.reaperSummonWave ?? 0) === 1 && t >= 0.65) {
                enemy.reaperSummonWave = 2;
                for (let ci = 0; ci < 4; ci++) {
                  const ang = (ci / 3) * Math.PI * 2 + Math.PI / 3;
                  sc(
                    new THREE.Vector3(
                      enemy.position.x + Math.cos(ang) * 3,
                      0,
                      enemy.position.z + Math.sin(ang) * 4,
                    ),
                    new THREE.Vector3(Math.cos(ang) * 6, 0, Math.sin(ang) * 5),
                  );
                }
              }

              if (t >= 0.9) {
                enemy.reaperState = "floating";
                enemy.reaperMoveCooldown = 8 + Math.random() * 1.5;
              }
            } else if (rState === "gliding") {
              const DRAG = 0.01;
              enemy.velocity.x *= Math.max(0, 1 - DRAG * delta);
              enemy.velocity.z *= Math.max(0, 1 - DRAG * delta);
              enemy.position.x += enemy.velocity.x * delta;
              enemy.position.z += enemy.velocity.z * delta;
              const spdSq =
                enemy.velocity.x * enemy.velocity.x +
                enemy.velocity.z * enemy.velocity.z;
              if (spdSq < 0.25) {
                enemy.reaperState = "floating";
                enemy.reaperMoveCooldown = 8.0 + Math.random() * 2;
              }
            }

            continue;
          }

          if (enemy.type === "crow") {
            if (!enemy.velocity) enemy.velocity = new THREE.Vector3(0, 0, 0);

            // Decay spawn timer
            if ((enemy.spawnTimer ?? 0) > 0) {
              enemy.spawnTimer = Math.max(0, (enemy.spawnTimer ?? 0) - delta);
            }

            const dx = position.x - enemy.position.x;
            const dz = position.z - enemy.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist > 0.5) {
              enemy.rotationY = Math.atan2(dz, dx);
              const blend = Math.min(1, 14 * delta);
              const crowSeed = parseInt(enemy.id, 10) || 0;
              const t = gameplayElapsedMsRef.current * 0.001;
              const wobbleX = Math.sin(crowSeed * 2.618 + t * 8.3) * 0.5;
              const wobbleZ = Math.cos(crowSeed * 1.414 + t * 6.7) * 0.5;
              enemy.velocity.x +=
                ((dx / dist) * enemy.speed - enemy.velocity.x) * blend +
                wobbleX;
              enemy.velocity.z +=
                ((dz / dist) * enemy.speed - enemy.velocity.z) * blend +
                wobbleZ;
              const vsSq =
                enemy.velocity.x * enemy.velocity.x +
                enemy.velocity.z * enemy.velocity.z;
              if (vsSq > enemy.speed * enemy.speed) {
                const vs = Math.sqrt(vsSq);
                enemy.velocity.x = (enemy.velocity.x / vs) * enemy.speed;
                enemy.velocity.z = (enemy.velocity.z / vs) * enemy.speed;
              }
            } else {
              enemy.velocity.x *= Math.max(0, 1 - 8 * delta);
              enemy.velocity.z *= Math.max(0, 1 - 8 * delta);
            }

            if (
              enemy.knockbackAcceleration &&
              enemy.knockbackDuration &&
              enemy.knockbackDuration > 0
            ) {
              enemy.velocity.addScaledVector(
                enemy.knockbackAcceleration,
                delta,
              );
              enemy.knockbackDuration -= delta;
              if (enemy.knockbackDuration <= 0) {
                enemy.knockbackAcceleration = undefined;
                enemy.knockbackDuration = undefined;
              }
            }

            enemy.position.x += enemy.velocity.x * delta;
            enemy.position.z += enemy.velocity.z * delta;
            enemy.velocity.multiplyScalar(Math.pow(0.92, delta * 60));
            continue;
          }

          // MAGE ENEMY LOGIC
          if (enemy.type === "mage") {
            if (!enemy.velocity) enemy.velocity = new THREE.Vector3(0, 0, 0);
            const ENGAGE_DIST = 13;
            const dx = position.x - enemy.position.x;
            const dz = position.z - enemy.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            enemy.rotationY = Math.atan2(dz, dx);

            const mState = enemy.mageState ?? "moving";

            if (mState === "moving") {
              if (dist > ENGAGE_DIST) {
                const blend = Math.min(1, 12 * delta);
                enemy.velocity.x +=
                  ((dx / dist) * enemy.speed - enemy.velocity.x) * blend;
                enemy.velocity.z +=
                  ((dz / dist) * enemy.speed - enemy.velocity.z) * blend;
                const vs = Math.hypot(enemy.velocity.x, enemy.velocity.z);
                if (vs > enemy.speed) {
                  enemy.velocity.x = (enemy.velocity.x / vs) * enemy.speed;
                  enemy.velocity.z = (enemy.velocity.z / vs) * enemy.speed;
                }
              } else {
                // Decelerate and pick action via value system
                enemy.velocity.multiplyScalar(Math.max(0, 1 - 10 * delta));

                let lightningW = 0.6;
                let healW = 0.4;
                if (enemy.health < enemy.maxHealth * 0.6) healW += 0.35;
                let nearbyHurt = 0;
                for (const e of enemies) {
                  if (e.id === enemy.id || e.type === "crow") continue;
                  const ex = e.position.x - enemy.position.x;
                  const ez = e.position.z - enemy.position.z;
                  if (ex * ex + ez * ez < 100 && e.health < e.maxHealth * 0.7)
                    nearbyHurt++;
                }
                healW += nearbyHurt * 0.15;

                enemy.mageAction = healW > lightningW ? "heal" : "lightning";
                enemy.mageState = "casting";
                enemy.mageCastTimer = 0.9;

                if (enemy.mageAction === "lightning") {
                  mageLightningRef.current.push({
                    targetX: position.x + (Math.random() - 0.5) * 3,
                    targetZ: position.z + (Math.random() - 0.5) * 3,
                    mageX: enemy.position.x,
                    mageZ: enemy.position.z,
                    warningTimer: 0,
                    fireTimer: 0,
                    fired: false,
                    frame: 0,
                    animTimer: 0,
                    particles: [],
                    particleSpawnTimer: 0,
                  });
                }
              }
            } else if (mState === "casting") {
              enemy.velocity.multiplyScalar(Math.max(0, 1 - 8 * delta));
              enemy.mageCastTimer = (enemy.mageCastTimer ?? 0) - delta;
              if ((enemy.mageCastTimer ?? 0) <= 0) {
                if (enemy.mageAction === "heal") {
                  const healAmt = enemy.maxHealth * 0.2;
                  enemy.health = Math.min(
                    enemy.maxHealth,
                    enemy.health + healAmt,
                  );
                  for (const ally of enemies) {
                    if (ally.id === enemy.id) continue;
                    const ax = ally.position.x - enemy.position.x;
                    const az = ally.position.z - enemy.position.z;
                    if (ax * ax + az * az < 81) {
                      ally.health = Math.min(
                        ally.maxHealth,
                        ally.health + ally.maxHealth * 0.2,
                      );
                    }
                  }
                }
                enemy.mageState = "recovering";
                enemy.mageCastCooldown = 3.0;
              }
            } else if (mState === "recovering") {
              enemy.mageCastCooldown = (enemy.mageCastCooldown ?? 0) - delta;
              if ((enemy.mageCastCooldown ?? 0) <= 0) {
                enemy.mageState = "moving";
              }
            }

            // Apply knockback acceleration
            if (
              enemy.knockbackAcceleration &&
              enemy.knockbackDuration &&
              enemy.knockbackDuration > 0
            ) {
              enemy.velocity.addScaledVector(
                enemy.knockbackAcceleration,
                delta,
              );
              enemy.knockbackDuration -= delta;
              if (enemy.knockbackDuration <= 0) {
                enemy.knockbackAcceleration = undefined;
                enemy.knockbackDuration = undefined;
              }
            }

            // Apply velocity to position
            enemy.position.x += enemy.velocity.x * delta;
            enemy.position.z += enemy.velocity.z * delta;
            enemy.velocity.multiplyScalar(Math.pow(0.92, delta * 60));
            continue;
          }

          if (!enemy.velocity) enemy.velocity = new THREE.Vector3(0, 0, 0);

          const dx = position.x - enemy.position.x;
          const dz = position.z - enemy.position.z;
          const distance = Math.sqrt(dx * dx + dz * dz);
          const enemyCollisionRadius = getEnemyCollisionRadius(enemy);

          if (distance >= 1) {
            const dirX = dx / distance;
            const dirZ = dz / distance;
            const blend = Math.min(1, 12 * delta);

            const isEyeball = enemy.type === "eyeball";
            if (isEyeball) {
              enemy.rotationY = Math.atan2(dirZ, dirX);
              const isRangedAttacking =
                (enemy as any).isRangedAttacking ?? false;

              if (
                distance <=
                (ENEMY_TYPE_CONFIG.eyeball.engageDistancePx ?? 100) / 25
              ) {
                (enemy as any).isRangedAttacking = true;
              } else if (
                distance >
                (ENEMY_TYPE_CONFIG.eyeball.disengageDistancePx ?? 150) / 25
              ) {
                (enemy as any).isRangedAttacking = false;
              } else {
                (enemy as any).isRangedAttacking = isRangedAttacking;
              }

              if ((enemy as any).isRangedAttacking) {
                (enemy as any).rangedShotCooldown =
                  ((enemy as any).rangedShotCooldown ?? 0) - delta;
                if ((enemy as any).rangedShotCooldown <= 0) {
                  spawnEyeballProjectile(enemy);
                  (enemy as any).rangedShotCooldown =
                    ENEMY_TYPE_CONFIG.eyeball.projectileFireInterval ?? 1.1;
                }
                // Decelerate while attacking
                enemy.velocity.x *= Math.max(0, 1 - 10 * delta);
                enemy.velocity.z *= Math.max(0, 1 - 10 * delta);
              } else {
                enemy.velocity.x +=
                  (dirX * enemy.speed - enemy.velocity.x) * blend;
                enemy.velocity.z +=
                  (dirZ * enemy.speed - enemy.velocity.z) * blend;
              }
            } else {
              enemy.velocity.x +=
                (dirX * enemy.speed - enemy.velocity.x) * blend;
              enemy.velocity.z +=
                (dirZ * enemy.speed - enemy.velocity.z) * blend;
            }
          } else {
            enemy.velocity.x *= Math.max(0, 1 - 8 * delta);
            enemy.velocity.z *= Math.max(0, 1 - 8 * delta);
          }

          // Cap velocity at enemy speed (before knockback)
          const vspdSq =
            enemy.velocity.x * enemy.velocity.x +
            enemy.velocity.z * enemy.velocity.z;
          if (vspdSq > enemy.speed * enemy.speed) {
            const scale = enemy.speed / Math.sqrt(vspdSq);
            enemy.velocity.x *= scale;
            enemy.velocity.z *= scale;
          }

          // Apply knockback acceleration on top of movement velocity
          if (
            enemy.knockbackAcceleration &&
            enemy.knockbackDuration &&
            enemy.knockbackDuration > 0
          ) {
            enemy.velocity.addScaledVector(enemy.knockbackAcceleration, delta);
            enemy.knockbackDuration -= delta;
            if (enemy.knockbackDuration <= 0) {
              enemy.knockbackAcceleration = undefined;
              enemy.knockbackDuration = undefined;
            }
          }

          // Apply combined velocity
          const velMovedPos = moveWithTerrainSlide(
            enemy.position,
            _tmpVec.copy(enemy.velocity).multiplyScalar(delta),
            terrainRef.current,
            enemyCollisionRadius,
          );
          const movedByVelocity = !velMovedPos.equals(enemy.position);
          enemy.position.x = velMovedPos.x;
          enemy.position.z = velMovedPos.z;
          if (!movedByVelocity) {
            enemy.velocity.multiplyScalar(-0.4);
          }

          // Velocity dampening
          enemy.velocity.multiplyScalar(Math.pow(0.92, delta * 60));
        }

        const updatedEnemies = enemies;

        const MAX_SEP_DIST = 7.5;
        const PLAYER_CULL_SQ = 12100; // 110^2 — skip separation for off-screen enemies

        const CELL_SIZE = 8;
        const grid = new Map<string, Enemy[]>();

        for (const enemy of updatedEnemies) {
          const cellX = Math.floor(enemy.position.x / CELL_SIZE);
          const cellZ = Math.floor(enemy.position.z / CELL_SIZE);
          const key = `${cellX},${cellZ}`;

          let bucket = grid.get(key);
          if (!bucket) {
            bucket = [];
            grid.set(key, bucket);
          }

          bucket.push(enemy);
        }
        const checked = new Set<string>();

        for (const enemy of updatedEnemies) {
          if (enemy.isBoss && enemy.bossType === "reaper")
            continue;

          const cellX = Math.floor(enemy.position.x / CELL_SIZE);
          const cellZ = Math.floor(enemy.position.z / CELL_SIZE);

          // check neighboring cells only
          for (let ox = -1; ox <= 1; ox++) {
            for (let oz = -1; oz <= 1; oz++) {
              const bucket = grid.get(`${cellX + ox},${cellZ + oz}`);
              if (!bucket) continue;

              for (const other of bucket) {
                if (enemy === other) continue;

                const pairKey =
                  enemy.id < other.id
                    ? enemy.id + "|" + other.id
                    : other.id + "|" + enemy.id;

                if (checked.has(pairKey)) continue;
                checked.add(pairKey);

                if (other.isBoss && other.bossType === "reaper")
                  continue;

                const isCrow1 = enemy.type === "crow";
                if (isCrow1 !== (other.type === "crow"))
                  continue;

                const dx = enemy.position.x - other.position.x;
                const dz = enemy.position.z - other.position.z;

                const minDist =
                  getEnemyCollisionRadius(enemy) +
                  getEnemyCollisionRadius(other);

                const distSq = dx * dx + dz * dz;

                if (
                  distSq > 0 &&
                  distSq < minDist * minDist
                ) {
                  const dist = Math.sqrt(distSq);

                  const push = (minDist - dist) / 8;
                  const nx = dx / dist;
                  const nz = dz / dist;

                  const e1IsTree = enemy.type === "tree";
                  const e2IsTree = other.type === "tree";

                  if (!e1IsTree) {
                    enemy.position.x +=
                      nx * push * (e2IsTree ? 2 : 1);
                    enemy.position.z +=
                      nz * push * (e2IsTree ? 2 : 1);
                  }

                  if (!e2IsTree) {
                    other.position.x -=
                      nx * push * (e1IsTree ? 2 : 1);
                    other.position.z -=
                      nz * push * (e1IsTree ? 2 : 1);
                  }
                }
              }
            }
          }
        }

        const PLAYER_RADIUS = 0.8;
        const DAMPING = 1;

        const aliveEnemies: typeof updatedEnemies = [];

        for (const enemy of updatedEnemies) {
          const dx = enemy.position.x - position.x;
          const dz = enemy.position.z - position.z;
          const dist = Math.hypot(dx, dz);

          const enemyHitRadius = getEnemyBodyHitRadius(enemy);
          if (dist > 0 && dist < PLAYER_RADIUS + enemyHitRadius) {
            if (invincibilityTimer <= 0 && !damagedThisFrameRef.current) {
              applyPlayerDamage(enemy.position);
              damagedThisFrameRef.current = true;
            }
          }

          if (!enemy.velocity) enemy.velocity = new THREE.Vector3(0, 0, 0);
          enemy.velocity.multiplyScalar(Math.max(0, 1 - DAMPING * delta));

          if (enemy.health <= 0) {
            if (!(enemy as any).deathHandled) {
              (enemy as any).deathHandled = true;
              handleEnemyDeath(enemy);
            }
            continue;
          }

          aliveEnemies.push(enemy);
        }

        const updatedEnemyProjectiles: EnemyProjectile[] = [];
        for (const projectile of enemyProjectilesRef.current) {
          projectile.life -= delta;
          if (projectile.life <= 0) continue;

          projectile.position.addScaledVector(projectile.velocity, delta);

          const toPlayerX = projectile.position.x - position.x;
          const toPlayerZ = projectile.position.z - position.z;
          const hitDistance = Math.hypot(toPlayerX, toPlayerZ);

          if (
            hitDistance <= PLAYER_RADIUS + projectile.size &&
            invincibilityTimer <= 0 &&
            !damagedThisFrameRef.current
          ) {
            applyPlayerDamage(projectile.position);
            damagedThisFrameRef.current = true;
            continue;
          }

          if (
            Math.abs(projectile.position.x) > ROOM_SIZE ||
            Math.abs(projectile.position.z) > ROOM_SIZE
          ) {
            continue;
          }

          updatedEnemyProjectiles.push(projectile);
        }

        if (damagedThisFrameRef.current) {
          if (phase === "playing")
            cameraRef.current.shake({ strength: 100, durationMs: 100 });
        }
        enemyProjectilesRef.current = updatedEnemyProjectiles;

        updateXPOrbs(delta, position);
        updateEnemies(aliveEnemies);
        // Update mage lightning attacks
        for (const atk of mageLightningRef.current) {
          atk.animTimer += delta;
          if (atk.animTimer >= 0.09) {
            atk.animTimer = 0;
            atk.frame = (atk.frame + 1) % 4;
          }
          if (!atk.fired) {
            atk.warningTimer += delta;

            // Spawn floating particles every 0.06s during cast
            atk.particleSpawnTimer = (atk.particleSpawnTimer ?? 0) + delta;
            if (atk.particleSpawnTimer >= 0.001) {
              atk.particleSpawnTimer = 0;
              const spread = 1;
              atk.particles.push({
                x: atk.mageX + (Math.random() - 0.5) * spread,
                z: atk.mageZ - (Math.random() - 0.5) * 2,
                vx: 0,
                vy: 0,
                age: 0,
                maxAge: 0.35,
                frame: 0,
              });
            }
            // Age particles — write-index compaction avoids filter() allocation
            let _pWrite = 0;
            for (let _pi = 0; _pi < atk.particles.length; _pi++) {
              const p = atk.particles[_pi];
              p.age += delta;
              p.vy += delta * 1.4;
              p.vx += (Math.random() - 0.5) * 0.1;
              if (p.age < p.maxAge) atk.particles[_pWrite++] = p;
            }
            atk.particles.length = _pWrite;

            if (atk.warningTimer >= 1.2) {
              atk.fired = true;
              atk.fireTimer = 0.5;
              atk.particles = [];
              const tpDx = position.x - atk.targetX;
              const tpDz = position.z - atk.targetZ;
              if (
                Math.hypot(tpDx, tpDz) <= 2.0 &&
                invincibilityTimer <= 0 &&
                !damagedThisFrameRef.current
              ) {
                applyPlayerDamage(
                  new THREE.Vector3(atk.targetX, 0, atk.targetZ),
                );
                damagedThisFrameRef.current = true;
              }
            }
          } else {
            atk.fireTimer -= delta;
          }
        }
        mageLightningRef.current = mageLightningRef.current.filter(
          (atk) => !atk.fired || atk.fireTimer > 0,
        );

        useEnemies.getState().updateAutoSpawn(delta, position);
        for (const mark of footstepMarksRef.current) mark.life += delta;
        footstepMarksRef.current = footstepMarksRef.current.filter(
          (mark) => mark.life < mark.maxLife,
        );
        if (hearts <= 0) end();
      }

      drawXPOrbs(ctx);
      const { x: centerX, y: centerY } =
        cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
      // Draw enemies with viewport culling
      fireSystem.current.draw(
        ctx,
        fireSprite.current!,
        centerX,
        centerY,
        position.x,
        position.z,
        50,
      );
      for (const enemy of enemies) {
        if (
          isObjectInViewport(
            enemy.position.x,
            enemy.position.z,
            position.x,
            position.z,
            100,
          )
        ) {
          drawEnemy(ctx, enemy);
        }
      }

      const cursorCanvas = cursorCanvasRef.current;
      const cursorCtx = cursorCanvas?.getContext("2d");
      if (cursorCtx) {
        cursorCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        cursorCtx.imageSmoothingEnabled = false;
        drawCursor(cursorCtx);
      }

      const eyeCanvas = eyeCanvasRef.current;
      const eyeCtx = eyeCanvas?.getContext("2d");
      if (eyeCtx) {
        eyeCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        eyeCtx.imageSmoothingEnabled = false;

        eyeCtx.save();
        eyeCtx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        eyeCtx.scale(cameraZoom, cameraZoom);
        eyeCtx.translate(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2);

        // Draw enemy eyes with viewport culling
        for (const enemy of enemies) {
          if (
            isObjectInViewport(
              enemy.position.x,
              enemy.position.z,
              position.x,
              position.z,
              100,
            )
          ) {
            drawEnemyEyes(eyeCtx, enemy, animationNowMs);
          }
        }
        drawEnemyProjectiles(eyeCtx);
        for (const obstacle of terrainRef.current) {
          if (
            isObjectInViewport(
              obstacle.x,
              obstacle.z,
              position.x,
              position.z,
              100,
            )
          ) {
            drawEnemyEyes(eyeCtx, obstacle, animationNowMs);
          }
        }

        drawTreeLightning(eyeCtx, gameplayElapsedMsRef.current);

        drawExplosionEffects(eyeCtx);
        drawProjectilesAndTrails(eyeCtx, phase !== "playing", position);
        drawEnemyDeaths(eyeCtx, gameplayElapsedMsRef.current);
        drawSummons(eyeCtx, animationNowMs);
        drawMageLightning(eyeCtx);
        drawSummonLightning(eyeCtx);
        drawDamageNumbers(eyeCtx);

        eyeCtx.restore();
      }
      drawFootsteps(ctx);
      drawPlayer(ctx, animationNowMs);

      drawStatusEffects(ctx, animationNowMs);

      drawImpactEffects(ctx);

      drawReloadIndicator(ctx);
      drawWeapon(ctx, "revolver", phase !== "playing");
      flushHitEffects();
      ctx.restore();

      // ── Red edge vignette when player takes damage ──
      const { damageFlashTimer } = usePlayer.getState();
      if (damageFlashTimer > 0) {
        const intensity = Math.min(1, damageFlashTimer / 0.25) * 0.72;
        const grad = ctx.createRadialGradient(
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2,
          CANVAS_HEIGHT * 0.2,
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2,
          CANVAS_HEIGHT * 0.82,
        );
        grad.addColorStop(0, "rgba(200,0,0,0)");
        grad.addColorStop(1, `rgba(200,0,0,${intensity.toFixed(3)})`);
        ctx.save();
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.restore();
      }

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    position,
    enemies,
    updateEnemies,
    phase,
    updateReload,
    updateInvincibility,
    updateMuzzleFlash,
    updateSummons,
    updateFanFire,
    addProjectile,
    playHit,
    updateStatusEffects,
    handleEnemyKilledBySummon,
    applyPlayerDamage,
    addXPOrb,
    updateXPOrbs,
    updateEnemies,
    updateAutoSpawn,
    end,
    updateProjectiles,
  ]);

  function handleEnemyDeath(enemy: Enemy) {
    const ps = usePlayer.getState();
    removeEnemy(enemy.id);

    if (ps.splinterBullets) {
      const stats = ps.getProjectileStats();
      const angles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
      useProjectiles.getState().addProjectiles(
        angles.map((baseAngle) => {
          const angle = baseAngle + (Math.random() - 0.5) * 1;
          const x = Math.cos(angle);
          const z = Math.sin(angle);

          return {
            position: new THREE.Vector3(
              enemy.position.x + x * 0.6,
              enemy.position.y,
              enemy.position.z + z * 0.6
            ),
            direction: new THREE.Vector3(x, 0, z),
            size: 4,
            damage: stats.damage * 0.2,
            speed: stats.speed * 1.55,
            life: 1,
            range: Math.max(12, stats.range * 0.4),
            trailLength: 0,
            piercing: 0,
            bouncing: 0,
            homing: false,
          };
        })
      );
    }
    // Boss explosion on death
    if (enemy.isBoss) {
      const { applyExplosiveDamage } = useHit.getState();
      applyExplosiveDamage(enemy.position.clone(), 320 / 25, 80, enemies);
    }

    if (enemy.type !== "crow") {
      addXPOrb(enemy.position.clone(), 25);
    }

    if (enemy.type === "crow") {
      crowDeathAnimationsRef.current.push({
        id: String(_nextImpactId++),
        position: enemy.position.clone(),
        startedAt: gameplayElapsedMsRef.current,
        frameDurationMs: 90,
      });
    } else {
      enemyDeathAnimationsRef.current.push({
        id: String(_nextImpactId++),
        position: enemy.position.clone(),
        startedAt: gameplayElapsedMsRef.current,
        frameDurationMs: 85,
      });
    }
  }

  let grassPattern: CanvasPattern | null = null;

  const drawDungeon = (
    ctx: CanvasRenderingContext2D,
    animationNowMs: number,
  ) => {
    if (!grassPattern && grassSprite.complete) {
      grassPattern = ctx.createPattern(grassSprite, "repeat");
    }

    if (!grassPattern) return;
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );

    const floorSize = ROOM_SIZE * 50;

    const offsetX = (-position.x * 50) / 2;
    const offsetZ = (-position.z * 50) / 2;

    const cameraOffset = cameraRef.current.getRenderOffset();

    const worldOffsetX = (-position.x * 50) / 2 + cameraOffset.x;

    const worldOffsetY = (-position.z * 50) / 2 + cameraOffset.y;

    ctx.save();

    ctx.fillStyle = grassPattern;

    // move pattern with world
    ctx.translate(worldOffsetX, worldOffsetY);
    ctx.imageSmoothingEnabled = false;

    ctx.fillRect(
      -worldOffsetX - CANVAS_WIDTH,
      -worldOffsetY - CANVAS_HEIGHT,
      CANVAS_WIDTH * 3,
      CANVAS_HEIGHT * 3,
    );

    ctx.restore();

    // ============================================
    // TERRAIN OBSTACLES
    // ============================================

    terrainRef.current.forEach((obstacle) => {
      const screenX = snapToGrid(
        centerX + ((obstacle.x - position.x) * 50) / 2,
      );
      const screenY = snapToGrid(
        centerY + ((obstacle.z - position.z) * 50) / 2,
      );
      const radiusPx = obstacle.radius * 15;
      ctx.imageSmoothingEnabled = false;

      if (treeSprite.complete && treeSprite.naturalWidth > 0) {
        if (obstacle.frameQueue.length > 0) {
          obstacle.frameTimer += animationDeltaRef.current;
          if (obstacle.frameTimer >= 0.13) {
            obstacle.frameTimer = 0;
            const nextFrame = obstacle.frameQueue.shift();
            if (nextFrame != null) {
              obstacle.spriteFrame = nextFrame;
            }
          }
        }

        const frameW = treeSprite.naturalWidth / 3;
        const frameH = treeSprite.naturalHeight;
        const scale = 2;
        const drawW = frameW * scale;
        const drawH = frameH * scale;
        ctx.drawImage(
          treeSprite,
          obstacle.spriteFrame * frameW,
          0,
          frameW,
          frameH,
          screenX - drawW / 2,
          screenY - drawH / 1.5,
          drawW,
          drawH,
        );
      } else {
        ctx.fillStyle = "#2f6b2f";
        ctx.beginPath();
        ctx.arc(screenX, screenY, radiusPx, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  };

  const drawXPOrbs = (ctx: CanvasRenderingContext2D) => {
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
    const xpOrbs = useEnemies.getState().xpOrbs;

    xpOrbs.forEach((orb) => {
      const screenX = snapToGrid(
        centerX + ((orb.position.x - position.x) * 50) / 2,
      );
      const screenY = snapToGrid(
        centerY + ((orb.position.z - position.z) * 50) / 2,
      );

      // particle trail
      const trail = orb.trail;
      if (trail && trail.length > 0) {
        const isMagnetized = orb.magnetized && orb.kickTimer <= 0;
        for (let t = 0; t < trail.length; t++) {
          const tp = trail[t];
          const tx = snapToGrid(centerX + ((tp.x - position.x) * 50) / 2);
          const ty = snapToGrid(centerY + ((tp.z - position.z) * 50) / 2);
          const frac = 1 - t / trail.length;
          ctx.globalAlpha = frac * (isMagnetized ? 0.55 : 0.28);
          const r = Math.max(1, frac * (isMagnetized ? 5 : 3));
          ctx.fillStyle = isMagnetized ? "#aaffcc" : "#66cc44";
          ctx.beginPath();
          ctx.arc(tx, ty, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      const sprite = xpSprite;
      if (sprite.complete) {
        const scale = 2;
        const w = sprite.width * scale;
        const h = sprite.height * scale;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(screenX, screenY);
        ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
        ctx.restore();
      }
    });
  };

  const drawReloadIndicator = (ctx: CanvasRenderingContext2D) => {
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );

    if (isReloading) {
      const radius = 40;
      const barHeight = 8;
      const barY = snapToGrid(centerY - 60);
      const snappedCenterX = snapToGrid(centerX);

      // Background bar
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(
        snapToGrid(snappedCenterX - radius),
        barY,
        radius * 2,
        barHeight,
      );

      // progress bar
      const progress = reloadProgress / reloadTime;
      const barWidth = snapToGrid(radius * 2 * progress);

      const hue = 30 + progress * 10; // Goes from orange to yellow
      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.fillRect(
        snapToGrid(snappedCenterX - radius),
        barY,
        barWidth,
        barHeight,
      );

      // Border with glow
      ctx.strokeStyle = "#ffaa00";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        snapToGrid(snappedCenterX - radius),
        barY,
        radius * 2,
        barHeight,
      );

      ctx.strokeStyle = "rgba(255, 170, 0, 0.3)";
      ctx.lineWidth = 4;
      ctx.strokeRect(
        snapToGrid(snappedCenterX - radius - 1),
        snapToGrid(barY - 1),
        radius * 2 + 2,
        barHeight + 2,
      );

      ctx.save();
      ctx.translate(snapToGrid(centerX), snapToGrid(barY - 20));

      drawBitmapText(ctx, "RELOADING", 0, 0, font, fontWhiteImage, {
        align: "center",
        scale: 1,
      });

      ctx.restore();

      const spinAngle = progress * Math.PI * 4;
      ctx.save();
      ctx.translate(snapToGrid(centerX), snapToGrid(barY + barHeight + 15));
      ctx.rotate(spinAngle);

      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const x = Math.round(Math.cos(angle) * 8);
        const y = Math.round(Math.sin(angle) * 8);

        ctx.fillStyle = i < Math.floor(progress * 6) ? "#00ff00" : "#333333";
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  };

  const drawWeapon = (
    ctx: CanvasRenderingContext2D,
    type: string,
    isPaused: boolean,
  ) => {
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );

    const canRotate = phase === "playing" && !isPaused;

    if (canRotate) {
      const dx = mouseRef.current.x - centerX;
      const dy = mouseRef.current.y - centerY;

      weaponAngleRef.current = Math.atan2(dy, dx);
    }

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(centerX, centerY);

    if (type === "revolver") {
      const scale = 2;
      const gunRotation = weaponAngleRef.current;

      const flipGun = Math.abs(weaponAngleRef.current) > Math.PI / 2;

      ctx.rotate(gunRotation);
      ctx.translate(2, 0);

      ctx.scale(-scale, scale);

      if (flipGun) ctx.scale(1, -1);

      // ===========================
      // MUZZLE FLASH
      // ===========================

      if (muzzleFlashTimer > 0 && muzzleFlashPosition) {
        const sprite = VisualSprites.muzzleFlash;

        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-3.5, 0);

        const w = sprite.width;
        const h = sprite.height;

        ctx.drawImage(sprite, w, h / 2, w, -h);

        ctx.restore();
      }

      // ===========================
      // REVOLVER SPRITE
      // ===========================
      const sprite = WeaponSprites.revolver;
      if (
        sprite.complete &&
        sprite.naturalWidth > 0 &&
        sprite.naturalHeight > 0
      ) {
        ctx.save();
        const frameCount = 5;
        const frameWidth = Math.floor(sprite.naturalWidth / frameCount);
        const frameHeight = sprite.naturalHeight;
        const reloadFrame = 1 + Math.floor((reloadProgress * 14) % 4);
        const frameIndex = isReloading ? reloadFrame : 0;

        ctx.drawImage(
          sprite,
          frameWidth * frameIndex,
          0,
          frameWidth,
          frameHeight,
          -frameWidth,
          -frameHeight / 2,
          frameWidth,
          frameHeight,
        );

        ctx.restore();
      }
    }

    ctx.restore();
  };

  // =====================================================
  // TRAIL EMISSION (DEMO STYLE)
  // =====================================================
  const emitSegment = (
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    size: number,
    velocity: THREE.Vector3,
    projectileId: string,
  ) => {
    const dx = x1 - x0;
    const dz = z1 - z0;

    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist === 0) return;

    const step = 0.15; // slightly reduced density
    const steps = Math.floor(dist / step);

    if (steps > 120) return;

    const speed = velocity.length();
    const trailSize = Math.max(1.5, size * 0.5);
    const trailLife = Math.max(0.08, Math.min(0.2, speed * 0.0005));

    const pool = poolRef.current;
    let idx = writeIndexRef.current;

    for (let i = 0; i <= steps; i++) {
      const t = i / (steps || 1);

      const p = pool[idx];

      p.x = x0 + dx * t;
      p.y = z0 + dz * t;
      p.size = trailSize;
      p.life = trailLife;
      p.maxLife = trailLife;
      p.projectileId = projectileId;

      idx = (idx + 1) % poolSize;
    }

    writeIndexRef.current = idx;
    highWaterRef.current = Math.max(highWaterRef.current, idx);
  };
  const start = performance.now();

  const drawProjectilesAndTrails = (
    ctx: CanvasRenderingContext2D,
    isPaused: boolean,
    playerPos: THREE.Vector3,
  ) => {
    const { projectiles } = useProjectiles.getState();

    const worldToScreen = (x: number, z: number) =>
      cameraRef.current.worldToScreen(
        { x, y: z },
        { x: playerPos.x, y: playerPos.z },
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        25,
      );

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    const img = getProjectileImage();

    const drawProjectile = (x: number, y: number, size: number) => {
      ctx.drawImage(
        img,
        Math.floor(x - size / 2),
        Math.floor(y - size / 2),
        Math.floor(size),
        Math.floor(size),
      );
    };

    // -----------------------------
    // PROJECTILES
    // -----------------------------
    const activeIds = new Set<string>();

    for (const proj of projectiles) {
      activeIds.add(proj.id);

      const prev = proj.previousPosition;
      const curr = proj.position;

      if (!isPaused) {
        emitSegment(
          prev.x,
          prev.z,
          curr.x,
          curr.z,
          proj.size,
          proj.velocity,
          proj.id,
        );
      }

      const screen = worldToScreen(curr.x, curr.z);

      drawProjectile(snapToGrid(screen.x), snapToGrid(screen.y), proj.size);
    }

    // -----------------------------
    // TRAILS (OPTIMIZED PASS)
    // -----------------------------
    ctx.fillStyle = "#f5d6c1";

    const pool = poolRef.current;
    const limit = Math.min(poolSize, highWaterRef.current + 100);

    for (let i = 0; i < limit; i++) {
      const p = pool[i];
      if (p.life <= 0) continue;

      // decay
      if (!isPaused) p.life -= 0.016;

      if (p.life <= 0) continue;

      const t = p.life / p.maxLife;
      const size = p.size * (0.5 + t);

      const screen = worldToScreen(p.x, p.y);

      ctx.fillRect(
        snapToGrid(screen.x - size / 2),
        snapToGrid(screen.y - size / 2),
        snapToGrid(size),
        snapToGrid(size),
      );
    }

    ctx.restore();
  };

  const drawImpactEffects = (ctx: CanvasRenderingContext2D) => {
    const impactEffects = useVisualEffects.getState().impactEffects;
    const sprite = VisualSprites.impactSheet;
    if (!sprite.complete || sprite.naturalWidth === 0) return;

    const frameWidth = sprite.width / 2;
    const frameHeight = sprite.height;

    impactEffects.forEach((impact) => {
      const { x: centerX, y: centerY } =
        cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
      const screenX = snapToGrid(centerX + ((impact.x - position.x) * 50) / 2);
      const screenY = snapToGrid(centerY + ((impact.y - position.z) * 50) / 2);

      ctx.save();
      ctx.imageSmoothingEnabled = false;

      ctx.drawImage(
        sprite,
        frameWidth * impact.frameIndex,
        0, // source x, y
        frameWidth,
        frameHeight, // source width, height
        snapToGrid(screenX - impact.size / 2),
        snapToGrid(screenY - impact.size / 2), // dest x, y
        impact.size,
        impact.size, // dest width, height
      );
      ctx.restore();
    });
  };

  const drawExplosionEffects = (ctx: CanvasRenderingContext2D) => {
    const explosionEffects = useVisualEffects.getState().explosionEffects;
    const sprite = VisualSprites.bigExplosion;
    if (!sprite.complete || sprite.naturalWidth === 0) return;

    const frameWidth = sprite.width / 6;
    const frameHeight = sprite.height;

    explosionEffects.forEach((explosion) => {
      const { x: centerX, y: centerY } =
        cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
      const screenX = snapToGrid(
        centerX + ((explosion.x - position.x) * 50) / 2,
      );
      const screenY = snapToGrid(
        centerY + ((explosion.y - position.z) * 50) / 2,
      );
      const size = explosion.size;

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        sprite,
        frameWidth * explosion.frameIndex,
        0,
        frameWidth,
        frameHeight,
        snapToGrid(screenX - size / 2),
        snapToGrid(screenY - size / 2),
        size,
        size,
      );
      ctx.restore();
    });
  };

  const drawSummonLightning = (ctx: CanvasRenderingContext2D) => {
    const lightningEffects = useVisualEffects.getState().lightningEffects;
    const sprite = VisualSprites.lightning;

    const frameW = 32;
    const frameH = 450;
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
    for (const fx of lightningEffects) {
      const screenX = snapToGrid(centerX + ((fx.x - position.x) * 50) / 2);
      const screenY = snapToGrid(centerY + ((fx.y - position.z) * 50) / 2);
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(-fx.angle);
      ctx.imageSmoothingEnabled = false;
      const drawW = frameW * 2;
      const drawH = frameH * 2;
      ctx.drawImage(
        sprite,
        fx.frameIndex * frameW,
        0,
        frameW,
        frameH,
        -drawW,
        -drawH,
        drawW,
        drawH,
      );
      ctx.restore();
    }
  };

  const drawMageLightning = (ctx: CanvasRenderingContext2D) => {
    if (mageLightningRef.current.length === 0) return;
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );

    for (const atk of mageLightningRef.current) {
      const sx = snapToGrid(centerX + ((atk.targetX - position.x) * 50) / 2);
      const sy = snapToGrid(centerY + ((atk.targetZ - position.z) * 50) / 2);

      if (!atk.fired) {
        const progress = Math.min(1, atk.warningTimer / 1.2);
        const pulse = 0.6 + Math.sin(atk.warningTimer * Math.PI * 6) * 0.4;

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        // ── Pentagram indicator image (spins) ──
        const indImg = mageLightningIndicator;
        if (indImg.complete && indImg.naturalWidth > 0) {
          const indSize = snapToGrid(56);
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(atk.warningTimer * 10.8);
          ctx.globalAlpha = Math.max(0.5, pulse) * (0.5 + progress * 0.5);
          ctx.drawImage(indImg, -indSize / 2, -indSize / 2, indSize, indSize);
          ctx.restore();
        }

        // ── Floating static particles rising from mage ──
        const sSheet = mageStaticParticleSheet;

        if (sSheet.complete && sSheet.naturalWidth > 0) {
          const totalFrames = 4;
          const sFrameW = sSheet.naturalWidth / totalFrames;
          const sFrameH = sSheet.naturalHeight;
          const sDrawW = sFrameW * 2;
          const sDrawH = sFrameH * 2;

          for (const p of atk.particles) {
            // Animate frame based on lifetime progression
            const progress = p.age / p.maxAge;
            const frame = Math.min(
              Math.floor(progress * totalFrames),
              totalFrames - 1,
            );

            const pScreenX = snapToGrid(
              centerX + ((p.x - p.vx - position.x) * 50) / 2,
            );

            const pScreenY = snapToGrid(
              centerY + ((p.z - p.vy - position.z) * 50) / 2,
            );

            ctx.drawImage(
              sSheet,
              frame * sFrameW,
              0,
              sFrameW,
              sFrameH,
              pScreenX - sDrawW / 2,
              pScreenY - sDrawH / 2,
              sDrawW,
              sDrawH,
            );
          }

          ctx.globalAlpha = 1;
        }

        ctx.globalAlpha = 1;
        ctx.restore();
      } else if (atk.fireTimer > 0) {
        const MAX_FIRE_TIME = 0.4;

        // Normalize animation progress
        const progress = 1 - atk.fireTimer / MAX_FIRE_TIME;

        const lSheet = enemyLightningSpriteSheet;

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        const frameW = 32;
        const frameH = 450;

        // Match summon lightning animation
        const totalFrames = 5;
        const frameIndex = Math.min(
          totalFrames - 1,
          Math.floor(progress * totalFrames),
        );

        if (lSheet.complete && lSheet.naturalWidth > 0) {
          ctx.save();

          ctx.translate(sx, sy);

          const drawW = frameW * 3;
          const drawH = frameH * 3;

          ctx.drawImage(
            lSheet,
            frameIndex * frameW,
            0,
            frameW,
            frameH,
            -drawW / 2,
            -drawH,
            drawW,
            drawH,
          );

          ctx.restore();
        }

        ctx.fillStyle = "#fd5161";

        ctx.beginPath();
        ctx.arc(sx, sy, 14, 0, Math.PI * 4);
        ctx.fill();

        ctx.restore();
      }
    }
  };

  const drawDamageNumbers = (ctx: CanvasRenderingContext2D) => {
    const damageNumbers = useVisualEffects.getState().damageNumbers;
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );

    ctx.save();
    damageNumbers.forEach((dmg) => {
      const screenX = snapToGrid(centerX + ((dmg.x - position.x) * 50) / 2);
      const screenY = snapToGrid(centerY + ((dmg.y - position.z) * 50) / 2);

      const lifePercent = dmg.life / dmg.maxLife;
      const alpha = Math.max(
        0,
        Math.min(1, lifePercent < 0.7 ? 1 : 1 - (lifePercent - 0.7) / 0.3),
      );

      ctx.globalAlpha = alpha;

      drawBitmapText(
        ctx,
        dmg.damage.toString(),
        screenX,
        screenY,
        font,
        fontWhiteImage,
        {
          align: "center",
          scale: dmg.scale,
        },
      );
    });

    ctx.restore();
  };

  const drawTreeLightning = (ctx: CanvasRenderingContext2D, nowMs: number) => {
    if (treeLightningRef.current.length === 0) return;

    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );

    for (const attack of treeLightningRef.current) {
      const x1 = snapToGrid(
        centerX + ((attack.source.x - position.x) * 50) / 2,
      );
      const y1 = snapToGrid(
        centerY + ((attack.source.z - position.z) * 50) / 2,
      );
      const x2 = snapToGrid(
        centerX + ((attack.target.x - position.x) * 50) / 2,
      );
      const y2 = snapToGrid(
        centerY + ((attack.target.z - position.z) * 50) / 2,
      );

      if (nowMs < attack.connectAt) {
        const steps = 22;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const px = Math.round(THREE.MathUtils.lerp(x1, x2, t));
          const py = Math.round(THREE.MathUtils.lerp(y1, y2, t));
          const jitterX = Math.round((Math.random() - 0.5) * 8);
          const jitterY = Math.round((Math.random() - 0.5) * 8);
          ctx.fillStyle = "rgba(120,220,255,0.9)";
          ctx.beginPath();
          ctx.arc(
            snapToGrid(px + jitterX),
            snapToGrid(py + jitterY),
            2,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        continue;
      }

      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const frame = attack.frame;

      if (
        electricityLineSpriteSheet.complete &&
        electricityLineSpriteSheet.naturalWidth > 0
      ) {
        const frameW = 64;
        const frameH = 32;
        const spriteScale = 2;
        const segW = frameW * spriteScale;
        const segH = frameH * spriteScale;

        ctx.save();
        ctx.translate(x1, y1);
        ctx.rotate(angle);
        for (let offset = 0; offset < length; offset += segW - 8) {
          const drawW = Math.min(segW, length - offset + 2);
          ctx.drawImage(
            electricityLineSpriteSheet,
            frame * frameW,
            0,
            frameW,
            frameH,
            offset,
            -segH / 2,
            drawW,
            segH,
          );
        }
        ctx.restore();
      }
    }
  };

  const drawFootsteps = (ctx: CanvasRenderingContext2D) => {
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
    for (const mark of footstepMarksRef.current) {
      const alpha = 1 - mark.life / mark.maxLife;
      const screenX = snapToGrid(
        centerX + ((mark.position.x - position.x) * 50) / 2,
      );
      const screenY = snapToGrid(
        centerY + ((mark.position.z - position.z) * 50) / 2,
      );

      ctx.save();
      ctx.fillStyle = `rgba(61, 85, 85, ${Math.max(0, Math.min(1, 1.35 * alpha))})`;
      ctx.beginPath();
      const radiusX = Math.max(1, Math.round(mark.radius * alpha));
      const radiusY = Math.max(1, Math.round(mark.radius * 0.6 * alpha));
      ctx.ellipse(screenX, screenY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  const drawPlayer = (
    ctx: CanvasRenderingContext2D,
    animationNowMs: number,
  ) => {
    const playerState = usePlayer.getState();
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );

    ctx.save();
    ctx.translate(centerX, centerY);

    // Damage flash effect (brightness filter — player sprite only)
    if (playerState.damageFlashTimer > 0) {
      const flashIntensity = Math.min(1, playerState.damageFlashTimer / 0.15);
      ctx.filter = `brightness(${1 + flashIntensity * 1.5}) saturate(${1 - flashIntensity * 0.5})`;
    }

    if (playerSpriteSheet.complete && playerSpriteSheet.naturalWidth > 0) {
      const animState = playerState.isMoving
        ? playerState.isFiring
          ? PLAYER_SPRITE_ANIMATIONS.walking
          : PLAYER_SPRITE_ANIMATIONS.running
        : PLAYER_SPRITE_ANIMATIONS.idle;
      const frame =
        Math.floor((animationNowMs / 1000) * animState.fps) % animState.frames;
      const sourceX = frame * PLAYER_SPRITE_FRAME_SIZE;
      const sourceY = animState.row * PLAYER_SPRITE_FRAME_SIZE;
      ctx.scale(playerFacingRef.current, 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        playerSpriteSheet,
        sourceX,
        sourceY,
        PLAYER_SPRITE_FRAME_SIZE,
        PLAYER_SPRITE_FRAME_SIZE,
        -PLAYER_SPRITE_RENDER_SIZE / 2,
        -PLAYER_SPRITE_RENDER_SIZE / 2,
        PLAYER_SPRITE_RENDER_SIZE,
        PLAYER_SPRITE_RENDER_SIZE,
      );
    }

    ctx.restore();
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, enemy: any) => {
    if (!enemy || !enemy.position) return;
    if (enemy.position.x == null || enemy.position.z == null) return;

    if (enemy.isBoss && enemy.bossType === "lazarus") {
      return;
    }
    if (enemy.type === "crow") return;
    if (enemy.isBoss && enemy.bossType === "reaper") {
      return;
    }

    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );

    const screenX = snapToGrid(
      centerX + ((enemy.position.x - position.x) * 50) / 2,
    );
    const screenY = snapToGrid(
      centerY + ((enemy.position.z - position.z) * 50) / 2,
    );

    // Mage enemy rendering
    if (enemy.type === "mage") {
      const sheet = mageEnemySpriteSheet;
      const hasSheet =
        sheet.complete && sheet.naturalWidth > 0 && sheet.naturalHeight > 0;
      const COLS = 4;
      const frameW = hasSheet ? sheet.naturalWidth / COLS : 48;
      const frameH = hasSheet ? sheet.naturalHeight : 48;
      const isCasting = enemy.mageState === "casting";
      const animFrame = isCasting
        ? Math.floor(performance.now() / 100) % COLS
        : 0;
      const drawW = 96;
      const drawH = hasSheet ? Math.round(drawW * (frameH / frameW)) : 96;
      const facingRight = enemy.position.x <= position.x;
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.imageSmoothingEnabled = false;
      if (!facingRight) ctx.scale(-1, 1);
      if (enemy.hitFlash > 0) ctx.filter = "brightness(60)";
      if (hasSheet) {
        ctx.drawImage(
          sheet,
          animFrame * frameW,
          0,
          frameW,
          frameH,
          Math.floor(-drawW / 2),
          Math.floor(-drawH / 2),
          drawW,
          drawH,
        );
      } else {
        ctx.fillStyle = "#aa44ff";
        ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
      }
      ctx.restore();
      return;
    }
    const enemyType: EnemySpriteType = getEnemyType(enemy);
    const bodySprite = enemySpritesByType[enemyType];
    const size = bodySprite.size * bodySprite.scale;
    const bodyFacingRight = enemy.position.x <= position.x;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.imageSmoothingEnabled = false;

    if (enemyType === "eyeball") {
      ctx.rotate(enemy.rotationY ?? 0);
    } else if (!bodyFacingRight) {
      ctx.scale(-1, 1);
    }

    if (enemy.hitFlash > 0) ctx.filter = "brightness(60)";
    ctx.drawImage(
      bodySprite.img,
      Math.floor(-size / 2),
      Math.floor(-size / 2),
      Math.floor(size),
      Math.floor(size),
    );

    ctx.restore();
  };

  const drawEnemyEyes = (
    ctx: CanvasRenderingContext2D,
    enemy: any,
    animationNowMs: number,
  ) => {
    if (!enemy) return;

    if (enemy.type === "tree") {
      if (enemy.spriteFrame === 0) return;

      const { x: centerX, y: centerY } =
        cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
      const screenX = snapToGrid(centerX + ((enemy.x - position.x) * 50) / 2);
      const screenY = snapToGrid(centerY + ((enemy.z - position.z) * 50) / 2);

      if (
        treeEnemyEyesSprite.complete &&
        treeEnemyEyesSprite.naturalWidth > 0 &&
        treeEnemyEyesSprite.naturalHeight > 0
      ) {
        const frameW = treeEnemyEyesSprite.naturalWidth / 2;
        const frameH = treeEnemyEyesSprite.naturalHeight;
        const eyeFrame = enemy.spriteFrame === 1 ? 0 : 1;
        const radiusPx = enemy.radius * 25;
        const scale = 2;
        const drawW = frameW * scale;
        const drawH = frameH * scale;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          treeEnemyEyesSprite,
          eyeFrame * frameW,
          0,
          frameW,
          frameH,
          screenX - drawW / 2,
          screenY - drawH / 1.5,
          drawW,
          drawH,
        );
        ctx.restore();
      }
      return;
    }

    if (!enemy.position) return;

    if (enemy.isBoss && enemy.bossType === "lazarus") {
      const { x: centerX, y: centerY } =
        cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
      const screenX = snapToGrid(
        centerX + ((enemy.position.x - position.x) * 50) / 2,
      );
      const screenY = snapToGrid(
        centerY + ((enemy.position.z - position.z) * 50) / 2,
      );
      const bossSheet = lazarusBossSpriteSheet;
      const windupSheet = bossLaserWindupSprite;
      const laserSheet = bossLaserSpriteSheet;
      const laserContinueSheet = bossLaserContinueSprite;
      const hasBossSheet =
        bossSheet.complete &&
        bossSheet.naturalWidth > 0 &&
        bossSheet.naturalHeight > 0;
      const hasWindupSheet =
        windupSheet.complete &&
        windupSheet.naturalWidth > 0 &&
        windupSheet.naturalHeight > 0;
      const hasLaserSheet =
        laserSheet.complete &&
        laserSheet.naturalWidth > 0 &&
        laserSheet.naturalHeight > 0;
      const hasLaserContinueSheet =
        laserContinueSheet.complete &&
        laserContinueSheet.naturalWidth > 0 &&
        laserContinueSheet.naturalHeight > 0;

      const drawSize = 170;
      if (hasBossSheet) {
        const frameW = bossSheet.naturalWidth / 3;
        const frameH = bossSheet.naturalHeight / 2;
        const animFrame = Math.floor(animationNowMs / 130) % 3;
        const bodyFrame =
          enemy.attackState === "laser_windup" ||
          enemy.attackState === "laser_firing"
            ? 2
            : animFrame;
        const gasFrameIndex = 4;
        const gasSourceX = (gasFrameIndex % 3) * frameW;
        const gasSourceY = Math.floor(gasFrameIndex / 3) * frameH;
        const bodyRotation = (enemy.rotationY ?? 0) + Math.PI / 2;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(bodyRotation);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          bossSheet,
          gasSourceX,
          gasSourceY,
          frameW,
          frameH,
          -drawSize / 2,
          -drawSize / 2,
          drawSize,
          drawSize,
        );
        ctx.restore();

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(bodyRotation);
        ctx.imageSmoothingEnabled = false;
        if (enemy.hitFlash > 0) ctx.filter = "brightness(8)";
        ctx.drawImage(
          bossSheet,
          bodyFrame * frameW,
          0,
          frameW,
          frameH,
          -drawSize / 2,
          -drawSize / 2,
          drawSize,
          drawSize,
        );
        ctx.restore();
      }

      const aimAngle = enemy.rotationY ?? 0;
      const beamLengthPx = 304 * lazarusConfig.beamLengthScale;
      const beamWidthPx = 32;
      const beamOriginOffsetPx = lazarusConfig.beamOriginOffsetPx;
      const laserBaseRotation = enemy.laserBaseRotation ?? aimAngle;

      const drawTiledBeam = (
        firstSheet: HTMLImageElement,
        sourceX: number,
        sourceW: number,
        sourceH: number,
        beamAngle: number,
        startX: number,
        startY: number,
        continueSheet?: HTMLImageElement,
        continueSourceX?: number,
        continueSourceW?: number,
        continueSourceH?: number,
      ) => {
        const tileDrawH = sourceH;
        const tileStep = tileDrawH - 0.2;
        const tileCount = Math.max(1, Math.ceil(beamLengthPx / tileStep));

        ctx.save();
        ctx.translate(startX, startY);
        ctx.rotate(beamAngle + Math.PI / 2);
        ctx.imageSmoothingEnabled = false;

        for (let tile = 0; tile < tileCount; tile++) {
          const useContinueSheet = tile > 0 && !!continueSheet;
          const beamSheet = useContinueSheet ? continueSheet : firstSheet;
          const drawSourceX = useContinueSheet
            ? (continueSourceX ?? sourceX)
            : sourceX;
          const drawSourceW = useContinueSheet
            ? (continueSourceW ?? sourceW)
            : sourceW;
          const drawSourceH = useContinueSheet
            ? (continueSourceH ?? sourceH)
            : sourceH;
          const drawY = -tileStep * (tile + 1);
          ctx.drawImage(
            beamSheet,
            drawSourceX,
            0,
            drawSourceW,
            drawSourceH,
            (-beamWidthPx * 2) / 2,
            drawY * 2,
            beamWidthPx * 2,
            tileDrawH * 2,
          );
        }

        ctx.restore();
      };

      if (enemy.attackState === "laser_windup" && hasWindupSheet) {
        const pulse = 0.82 + Math.sin(animationNowMs / 85) * 0.16;

        for (const beamOffset of lazarusConfig.beamAngles) {
          const beamAngle = aimAngle + beamOffset;
          const startX = screenX + Math.cos(beamAngle) * beamOriginOffsetPx;
          const startY = screenY + Math.sin(beamAngle) * beamOriginOffsetPx;

          ctx.save();
          ctx.globalAlpha = Math.max(0.55, Math.min(1, pulse));
          drawTiledBeam(
            windupSheet,
            0,
            windupSheet.naturalWidth,
            windupSheet.naturalHeight,
            beamAngle,
            startX,
            startY,
          );
          ctx.restore();
        }
      }

      if (enemy.attackState === "laser_firing" && hasLaserSheet) {
        const frameW = laserSheet.naturalWidth / 6;
        const frameH = laserSheet.naturalHeight;
        const continueFrameW = hasLaserContinueSheet
          ? laserContinueSheet.naturalWidth / 6
          : frameW;
        const continueFrameH = hasLaserContinueSheet
          ? laserContinueSheet.naturalHeight
          : frameH;
        const fireProgress = Math.min(
          1,
          (enemy.windUpTimer ?? 0) / lazarusConfig.fireDuration,
        );

        let frame = 1;
        if (fireProgress < 0.03) {
          frame = 0;
        } else if (fireProgress > 0.92) {
          const dissipationProgress = Math.min(1, (fireProgress - 0.92) / 0.08);
          frame = Math.min(5, 2 + Math.floor(dissipationProgress * 4));
        }

        for (const beamOffset of lazarusConfig.beamAngles) {
          const beamAngle =
            laserBaseRotation +
            (enemy.windUpTimer ?? 0) * lazarusConfig.rotationSpeed +
            beamOffset;
          const startX = screenX + Math.cos(beamAngle) * beamOriginOffsetPx;
          const startY = screenY + Math.sin(beamAngle) * beamOriginOffsetPx;

          drawTiledBeam(
            laserSheet,
            frame * frameW,
            frameW,
            frameH,
            beamAngle,
            startX,
            startY,
            laserContinueSheet,
            frame * continueFrameW,
            continueFrameW,
            continueFrameH,
          );
        }
      }

      const barW = 110;
      const barH = 9;
      const barY = snapToGrid(screenY - drawSize / 2 - 24);
      const hpPct = Math.max(0, enemy.health / enemy.maxHealth);

      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.fillRect(
        snapToGrid(screenX - barW / 2 - 2),
        snapToGrid(barY - 2),
        barW + 4,
        barH + 4,
      );
      ctx.fillStyle = "#400";
      ctx.fillRect(snapToGrid(screenX - barW / 2), barY, barW, barH);
      ctx.fillStyle = hpPct > 0.45 ? "#5DFF63" : "#ffc642";
      ctx.fillRect(
        snapToGrid(screenX - barW / 2),
        barY,
        snapToGrid(barW * hpPct),
        barH,
      );
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(snapToGrid(screenX - barW / 2), barY, barW, barH);
      drawBitmapText(
        ctx,
        "BOSS",
        snapToGrid(screenX),
        snapToGrid(barY - 10),
        font,
        fontRedImage,
        {
          align: "center",
          scale: 1,
        },
      );
      return;
    }

    // -----------------------------------------------------------------------
    // REAPER BOSS RENDERING
    if (enemy.isBoss && enemy.bossType === "reaper") {
      const { x: centerX, y: centerY } =
        cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
      const screenX = snapToGrid(
        centerX + ((enemy.position.x - position.x) * 50) / 2,
      );
      const screenY = snapToGrid(
        centerY + ((enemy.position.z - position.z) * 50) / 2,
      );

      const sheet = reaperBossSpriteSheet;
      const hasSheet =
        sheet.complete && sheet.naturalWidth > 0 && sheet.naturalHeight > 0;
      // 2 rows × 4 cols spritesheet, each frame 128×128
      const COLS = 4;
      const ROWS = 2;
      const drawSize = 200;
      const rState = enemy.reaperState ?? "floating";
      const isDashing = rState === "dashing";
      const isCharging = rState === "charging";
      const isSummoning = rState === "summoning";

      // Frames 0-5 = normal (row0: 0-3, row1: 0-1), Frames 6-7 = summon (row1: 2-3)
      let animFrameIdx: number;
      if (isSummoning) {
        animFrameIdx = 6 + (Math.floor(animationNowMs / 180) % 2);
      } else if (isDashing) {
        animFrameIdx = Math.floor(animationNowMs / 70) % 6;
      } else if (isCharging) {
        animFrameIdx = 0;
      } else {
        animFrameIdx = Math.floor(animationNowMs / 150) % 6;
      }

      const frameW = hasSheet ? sheet.naturalWidth / COLS : 128;
      const frameH = hasSheet ? sheet.naturalHeight / ROWS : 128;
      const srcCol = animFrameIdx % COLS;
      const srcRow = Math.floor(animFrameIdx / COLS);
      const srcX = srcCol * frameW;
      const srcY = srcRow * frameH;

      const facingRight = enemy.position.x <= position.x;
      const vibrateX = isCharging ? Math.sin(animationNowMs / 80) * 5 : 0;

      if (isDashing && hasSheet) {
        const vLen = Math.hypot(enemy.velocity?.x ?? 0, enemy.velocity?.z ?? 0);
        if (vLen > 3) {
          const ndx = -(enemy.velocity?.x ?? 0) / vLen;
          const ndz = -(enemy.velocity?.z ?? 0) / vLen;
          for (let g = 1; g <= 5; g++) {
            ctx.save();
            ctx.globalAlpha = Math.max(1, 0.26 - g * 0.04);
            ctx.translate(screenX + ndx * g, screenY + ndz * g);
            ctx.imageSmoothingEnabled = false;
            if (!facingRight) ctx.scale(-1, 1);
            ctx.drawImage(
              sheet,
              srcX,
              srcY,
              frameW,
              frameH,
              Math.floor(-drawSize / 2),
              Math.floor(-drawSize / 2),
              drawSize,
              drawSize,
            );
            ctx.restore();
          }
        }
      }

      // Summon glow ring
      if (isSummoning) {
        const pulse = 0.4 + Math.sin(animationNowMs / 100) * 0.3;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = "#aa22ff";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(screenX, screenY, drawSize * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // Main sprite
      if (hasSheet) {
        ctx.save();
        ctx.translate(screenX + vibrateX, screenY);
        ctx.imageSmoothingEnabled = false;
        if (!facingRight) ctx.scale(-1, 1);
        if (enemy.hitFlash > 0) ctx.filter = "brightness(60)";
        ctx.drawImage(
          sheet,
          srcX,
          srcY,
          frameW,
          frameH,
          Math.floor(-drawSize / 2),
          Math.floor(-drawSize / 2),
          drawSize,
          drawSize,
        );
        ctx.restore();
      }

      const barW = 120;
      const barH = 9;
      const barY = snapToGrid(screenY - drawSize / 2 - 24);
      const hpPct = Math.max(0, enemy.health / enemy.maxHealth);

      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.fillRect(
        snapToGrid(screenX - barW / 2 - 2),
        snapToGrid(barY - 2),
        barW + 4,
        barH + 4,
      );
      ctx.fillStyle = "#400";
      ctx.fillRect(snapToGrid(screenX - barW / 2), barY, barW, barH);
      ctx.fillStyle = hpPct > 0.45 ? "#5DFF63" : "#ffc642";
      ctx.fillRect(
        snapToGrid(screenX - barW / 2),
        barY,
        snapToGrid(barW * hpPct),
        barH,
      );
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(snapToGrid(screenX - barW / 2), barY, barW, barH);
      drawBitmapText(
        ctx,
        "BOSS",
        snapToGrid(screenX),
        snapToGrid(barY - 10),
        font,
        fontRedImage,
        {
          align: "center",
          scale: 1,
        },
      );
      return;
    }

    // Mage is rendered in drawEnemy
    if (enemy.type === "mage") return;

    // Crow: rendered here in the eye/overlay layer
    if (enemy.type === "crow") {
      const { x: centerX, y: centerY } =
        cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
      const screenX = snapToGrid(
        centerX + ((enemy.position.x - position.x) * 50) / 2,
      );
      const screenY = snapToGrid(
        centerY + ((enemy.position.z - position.z) * 50) / 2,
      );
      const sheet = crowEnemySpriteSheet;
      const hasSheet =
        sheet.complete && sheet.naturalWidth > 0 && sheet.naturalHeight > 0;
      const cols = 4;
      const frameW = hasSheet ? sheet.naturalWidth / cols : 20;
      const frameH = hasSheet ? sheet.naturalHeight : 20;
      const animFrame =
        (enemy.spawnTimer ?? 0) > 0
          ? 0
          : Math.floor(animationNowMs / 120) % cols;
      const drawSize = 40;
      const facingRight = enemy.position.x <= position.x;
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.imageSmoothingEnabled = false;
      if (!facingRight) ctx.scale(-1, 1);
      if (enemy.hitFlash > 0) ctx.filter = "brightness(60)";
      if (hasSheet) {
        ctx.drawImage(
          sheet,
          animFrame * frameW,
          0,
          frameW,
          frameH,
          Math.floor(-drawSize / 2),
          Math.floor(-drawSize / 2),
          drawSize,
          drawSize,
        );
      }
      ctx.restore();
      return;
    }

    const enemyType: EnemySpriteType = getEnemyType(enemy);
    const eyeSprite = enemyEyeSpritesByType[enemyType];
    const size = eyeSprite.size * eyeSprite.scale;

    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
    const screenX = snapToGrid(
      centerX + ((enemy.position.x - position.x) * 50) / 2,
    );
    const screenY = snapToGrid(
      centerY + ((enemy.position.z - position.z) * 50) / 2,
    );
    const facingRight = enemy.position.x <= position.x;

    ctx.save();
    ctx.translate(screenX, screenY);
    if (enemyType === "eyeball") {
      ctx.rotate(enemy.rotationY ?? 0);
    } else if (!facingRight) {
      ctx.scale(-1, 1);
    }
    ctx.drawImage(
      eyeSprite.img,
      Math.floor(-size / 2),
      Math.floor(-size / 2),
      Math.floor(size),
      Math.floor(size),
    );
    ctx.restore();
  };

  const drawEnemyProjectiles = (ctx: CanvasRenderingContext2D) => {
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
    const projectileSprite = enemyEyeballProjectileSprite;
    const hasProjectileSprite =
      projectileSprite.complete &&
      projectileSprite.naturalWidth > 0 &&
      projectileSprite.naturalHeight > 0;

    for (const projectile of enemyProjectilesRef.current) {
      // Skip enemy projectiles outside viewport
      if (
        !isObjectInViewport(
          projectile.position.x,
          projectile.position.z,
          position.x,
          position.z,
          40,
        )
      ) {
        continue;
      }

      const screenX = snapToGrid(
        centerX + ((projectile.position.x - position.x) * 50) / 2,
      );
      const screenY = snapToGrid(
        centerY + ((projectile.position.z - position.z) * 50) / 2,
      );
      const pixelSize = Math.max(8, projectile.size * 50 * 1.1);

      ctx.save();

      if (hasProjectileSprite) {
        ctx.translate(screenX, screenY);
        ctx.drawImage(
          projectileSprite,
          -pixelSize / 2,
          -pixelSize / 2,
          pixelSize,
          pixelSize,
        );
      }
      ctx.restore();
    }
  };

  const drawEnemyDeaths = (
    ctx: CanvasRenderingContext2D,
    animationNowMs: number,
  ) => {
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
    const sprite = enemyDeathSpritesheet;
    const totalFrames = 4;

    const hasSprite =
      sprite.complete && sprite.naturalWidth > 0 && sprite.naturalHeight > 0;
    const frameWidth = hasSprite ? sprite.naturalWidth / totalFrames : 0;
    const frameHeight = hasSprite ? sprite.naturalHeight : 0;
    const nextAnimations: EnemyDeathAnimation[] = [];

    for (const animation of enemyDeathAnimationsRef.current) {
      const elapsedMs = animationNowMs - animation.startedAt;
      const frameIndex = Math.floor(elapsedMs / animation.frameDurationMs);

      if (frameIndex >= totalFrames) {
        continue;
      }

      nextAnimations.push(animation);

      const screenX = snapToGrid(
        centerX + ((animation.position.x - position.x) * 50) / 2,
      );
      const screenY = snapToGrid(
        centerY + ((animation.position.z - position.z) * 50) / 2,
      );
      const drawScale = 2;
      const drawWidth = frameWidth * drawScale;
      const drawHeight = frameHeight * drawScale;

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.imageSmoothingEnabled = false;
      if (hasSprite) {
        ctx.drawImage(
          sprite,
          frameIndex * frameWidth,
          0,
          frameWidth,
          frameHeight,
          -drawWidth / 2,
          -drawHeight / 2,
          drawWidth,
          drawHeight,
        );
      }
      ctx.restore();
    }

    enemyDeathAnimationsRef.current = nextAnimations;

    // ── Crow custom death animation (1 row × 4 cols, 20×20 px) ──
    const crowSprite = crowDeathSpritesheet;
    const crowHasSprite =
      crowSprite.complete &&
      crowSprite.naturalWidth > 0 &&
      crowSprite.naturalHeight > 0;
    const crowFrameW = crowHasSprite ? crowSprite.naturalWidth / 4 : 20;
    const crowFrameH = crowHasSprite ? crowSprite.naturalHeight : 20;
    const nextCrowAnimations: EnemyDeathAnimation[] = [];

    for (const animation of crowDeathAnimationsRef.current) {
      const elapsedMs = animationNowMs - animation.startedAt;
      const frameIndex = Math.floor(elapsedMs / animation.frameDurationMs);
      if (frameIndex >= 4) continue;
      nextCrowAnimations.push(animation);

      const screenX = snapToGrid(
        centerX + ((animation.position.x - position.x) * 50) / 2,
      );
      const screenY = snapToGrid(
        centerY + ((animation.position.z - position.z) * 50) / 2,
      );
      const drawW = crowFrameW * 3;
      const drawH = crowFrameH * 3;

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.imageSmoothingEnabled = false;
      if (crowHasSprite) {
        ctx.drawImage(
          crowSprite,
          frameIndex * crowFrameW,
          0,
          crowFrameW,
          crowFrameH,
          -drawW / 2,
          -drawH / 2,
          drawW,
          drawH,
        );
      }
      ctx.restore();
    }
    crowDeathAnimationsRef.current = nextCrowAnimations;
  };

  const drawSummons = (
    ctx: CanvasRenderingContext2D,
    animationNowMs: number,
  ) => {
    const summons = useSummons.getState().summons;
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );

    for (const summon of summons) {
      // Skip summons far outside viewport
      if (
        !isObjectInViewport(
          summon.position.x,
          summon.position.z,
          position.x,
          position.z,
          150,
        )
      ) {
        continue;
      }

      const screenX = snapToGrid(
        centerX + ((summon.position.x - position.x) * 50) / 2,
      );
      const screenY = snapToGrid(
        centerY + ((summon.position.z - position.z) * 50) / 2,
      );

      if (summon.type === "ghost") {
        const sprite = SummonSprites.ghostSheet;
        const isSheetReady =
          sprite.complete &&
          sprite.naturalWidth > 0 &&
          sprite.naturalHeight > 0;
        if (!isSheetReady) continue;

        const totalCols = 6;
        const totalRows = 2;
        const frameW = sprite.naturalWidth / totalCols;
        const frameH = sprite.naturalHeight / totalRows;

        const passiveFrames = 6;
        const shootFrames = 5;
        const inShootAnim = (summon.shootAnimTimer ?? 0) > 0;

        const nowSeconds = animationNowMs / 1000;
        const animFps = inShootAnim ? 5 : 10;
        const frameIndex = Math.floor(nowSeconds * animFps);

        const sx = inShootAnim
          ? (frameIndex % shootFrames) * frameW
          : (frameIndex % passiveFrames) * frameW;
        const sy = inShootAnim ? frameH : 0;

        const drawScale = 2;
        const drawW = frameW * drawScale;
        const drawH = frameH * drawScale;
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 1;
        const facing = summon.facing ?? 1;
        ctx.scale(facing, 1);

        ctx.drawImage(
          sprite,
          sx,
          sy,
          frameW,
          frameH,
          -drawW / 2,
          -drawH / 2,
          drawW,
          drawH,
        );
        ctx.restore();
      }

      if (summon.type === "dagger") {
        const sprite = SummonSprites.dagger;
        const img = getProjectileImage();
        const canDrawDagger = sprite.complete && sprite.naturalWidth > 0;
        const canDrawTrail = img.complete && img.naturalWidth > 0;

        if (summon.trail && canDrawTrail) {
          for (let i = summon.trail.length - 1; i >= 0; i--) {
            const p = summon.trail[i];
            const x = centerX + ((p.x - position.x) * 50) / 2;
            const y = centerY + ((p.z - position.z) * 50) / 2;
            const t = i / summon.trail.length;
            const size = Math.floor(40 * (1 - t * 0.9));
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
            ctx.restore();
          }
        }

        if (!canDrawDagger) continue;

        const scale = 1.5;
        const w = sprite.naturalWidth * scale;
        const h = sprite.naturalHeight * scale;
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(summon.rotation);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
        ctx.restore();
      }

      if (summon.type === "scythe") {
        const sprite = SummonSprites.scythe;
        const canDrawScythe =
          sprite.complete &&
          sprite.naturalWidth > 0 &&
          sprite.naturalHeight > 0;

        if (canDrawScythe) {
          const scale = 3;
          const w = sprite.naturalWidth * scale;
          const h = sprite.naturalHeight * scale;
          ctx.save();
          ctx.translate(screenX, screenY);
          ctx.rotate(summon.rotation ?? 0);
          ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
          ctx.restore();
        }
      }
    }
  };

  const drawStatusEffects = (
    ctx: CanvasRenderingContext2D,
    animationNowMs: number,
  ) => {
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
    const { statusEffects } = useSummons.getState();
    const FIRE_EMIT_THROTTLE_MS = 50; // Emit fire particles every 50ms instead of every frame

    statusEffects.forEach((effect) => {
      const enemy = enemies.find((e) => e.id === effect.enemyId);
      if (!enemy) return;

      const screenX = centerX + ((enemy.position.x - position.x) * 50) / 2;
      const screenY = centerY + ((enemy.position.z - position.z) * 50) / 2;

      if (effect.type === "burn") {
        // Throttle fire particle emission to reduce performance impact
        const lastEmission = fireEmissionThrottleRef.current[effect.id] || 0;
        if (animationNowMs - lastEmission >= FIRE_EMIT_THROTTLE_MS) {
          fireSystem.current.emit(enemy.position.x, enemy.position.z);
          fireSystem.current.emit(enemy.position.x, enemy.position.z);
          fireEmissionThrottleRef.current[effect.id] = animationNowMs;
        }
      }
    });

    // Cleanup throttle entries for removed effects
    const activeEffectIds = new Set(statusEffects.map((e) => e.id));
    for (const id in fireEmissionThrottleRef.current) {
      if (!activeEffectIds.has(id)) {
        delete fireEmissionThrottleRef.current[id];
      }
    }

    ctx.globalAlpha = 1;
  };

  const drawCursor = (ctx: CanvasRenderingContext2D) => {
    const size = 32;
    const half = size / 2;
    const { ammo } = usePlayer.getState();
    const x = mouseRef.current.x;
    const y = mouseRef.current.y;

    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(
      cursorSprite,
      Math.floor(x - half),
      Math.floor(y - half),
      size,
      size,
    );

    if (phase !== "playing") return;

    drawBitmapText(ctx, `${ammo}`, x + 18, y + 10, font, fontWhiteImage, {
      align: "left",
      baseline: "middle",
      scale: 1,
    });
  };

  return (
    <>
      <div
        className=""
        style={{
          cursor: "none",
          position: "relative",
          width: canvasDisplay.width,
          height: canvasDisplay.height,
          marginLeft: canvasDisplay.offsetX,
          marginTop: canvasDisplay.offsetY,
        }}
      >
        <Darkness />
        <LevelUpScreen />
        <GameUI />

        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border-2 border-gray-700"
          style={{
            cursor: "none",
            position: "relative",
            zIndex: 0,
            width: canvasDisplay.width,
            height: canvasDisplay.height,
            imageRendering: "pixelated",
          }}
        />
        <canvas
          ref={eyeCanvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{
            cursor: "none",
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
            zIndex: 2,
            width: canvasDisplay.width,
            height: canvasDisplay.height,
            imageRendering: "pixelated",
          }}
        />
        <DevTools />
        <canvas
          ref={cursorCanvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{
            cursor: "none",
            position: "absolute",
            top: canvasDisplay.offsetY,
            left: canvasDisplay.offsetX,
            pointerEvents: "none",
            zIndex: 3000,
            width: canvasDisplay.width,
            height: canvasDisplay.height,
            imageRendering: "pixelated",
          }}
        />
      </div>
    </>
  );
});
