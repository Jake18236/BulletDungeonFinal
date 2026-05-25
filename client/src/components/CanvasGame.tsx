import { useEffect, useMemo, useRef, useState, memo } from "react";
import * as THREE from "three";
import { usePlayer } from "../lib/stores/usePlayer";
import { ENEMY_TYPE_CONFIG, SHOGGOTH_CONFIG, useEnemies, type Enemy } from "../lib/stores/useEnemies";
import { bounceAgainstBounds } from "../lib/collision";
import { useGame } from "../lib/stores/useGame";
import { useAudio } from "../lib/stores/useAudio";


import { useProjectiles, TrailParticle } from "../lib/stores/useProjectiles";
import { useHit } from "../lib/stores/useHit";
import { useSummons } from "../lib/stores/useSummons";
import { useCamera } from "../lib/stores/useCamera";
import { useVisualEffects } from "../lib/stores/useVisualEffects";
import { GameCamera2D, getPixelPerfectScale } from "../lib/camera";
import fontJson from "./Lantern.json";
import { buildFont, drawBitmapText } from "../lib/font";
import GameUI from "./GameUI"  
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
} from "./SpriteProps";

const font = buildFont(fontJson);

const fontWhiteImage = new Image();
fontWhiteImage.src = "/sprites/font-atlas-white.png";

const fontRedImage = new Image();
fontRedImage.src = "/sprites/font-atlas-red.png";

usePlayer.setState({ splinterBullets: true });

const TILE_SIZE = 50;
export const CANVAS_WIDTH = window.innerWidth;
export const CANVAS_HEIGHT = window.innerHeight;
const ROOM_SIZE = 2000;
const LAZARUS_BASE_BEAM_LENGTH_WORLD = (304 * 4) / (TILE_SIZE / 2);
const LAZARUS_BEAM_LENGTH_WORLD = LAZARUS_BASE_BEAM_LENGTH_WORLD * SHOGGOTH_CONFIG.beamLengthScale;

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

const { addSummon } = useSummons.getState();


function generateRoomTerrain(): TerrainObstacle[] {
  const trees: TerrainObstacle[] = [];
  let obstacleId = 0;
  const seed = 1337;
  const random = (n: number) => {
    const value = Math.sin(seed * 0.13 + n * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  };

  const radialBands = [
    { radius: 30, count: 0 },
    { radius: 58, count: 0 },
    { radius: 88, count: 0 },
    { radius: 130, count: 0 },
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
  const combined = radius; // Pre-compute to avoid repeated addition
  
  for (let i = 0; i < 2; i++) {
    for (const obs of obstacles) {
      const dx = resolved.x - obs.x;
      const dz = resolved.z - obs.z;
      const distSq = dx * dx + dz * dz;
      const combinedRadius = combined + obs.radius;
      const threshold = combinedRadius * combinedRadius;
      
      if (distSq >= threshold) continue;

      const dist = Math.max(Math.sqrt(distSq), 0.0001);
      const pushOut = ((combined + obs.radius) - dist + 0.01) / dist;
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
  // Optimized: reuse vector math, early exit
  const targetX = currentPos.x + move.x;
  const targetZ = currentPos.z + move.z;
  
  // Quick check without creating new vector
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

function getEnemyType(enemy: { type?: string }): "basic" | "tank" | "eyeball" {
  if (enemy.type === "tank" || enemy.type === "eyeball") return enemy.type;
  return "basic";
}

function getEnemyBodyHitRadius(enemy: { type?: string; isBoss?: boolean; bossType?: string }) {
  if (enemy.isBoss && enemy.bossType === "lazarus") {
    return SHOGGOTH_CONFIG.bodyHitRadius;
  }
  return ENEMY_TYPE_CONFIG[getEnemyType(enemy)].bodyHitRadius;
}

function getEnemyCollisionRadius(enemy: { type?: string }) {
  return ENEMY_TYPE_CONFIG[getEnemyType(enemy)].collisionRadius;
}

function distancePointToSegment(point: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2) {
  // Optimized: avoid cloning vectors, use direct math
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


function pickTreeLightningAttack(nowMs: number, trees: TerrainObstacle[]): TreeLightningAttack | null {
  if (trees.length < 2) return null;

  // Single pass to find eligible trees
  const eligibleTrees: TerrainObstacle[] = [];
  for (const tree of trees) {
    if (nowMs >= tree.cooldownUntil && !tree.lockedByLightning) {
      eligibleTrees.push(tree);
    }
  }

  if (eligibleTrees.length < 2) return null;

  const source = eligibleTrees[Math.floor(Math.random() * eligibleTrees.length)];
  
  // Single pass to find nearby trees with distance - avoid map/sort
  const nearbyTrees: { tree: TerrainObstacle; dist: number }[] = [];
  for (const tree of trees) {
    if (tree !== source && nowMs >= tree.cooldownUntil && !tree.lockedByLightning) {
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
  const target = nearbyTrees[Math.floor(Math.random() * Math.min(6, nearbyTrees.length))].tree;
  
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

// Snap coordinates to 2-pixel grid for consistent pixelation
const snapToGrid = (value: number) => Math.round(value / 1) * 1;

export default memo(function CanvasGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eyeCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const animationDeltaRef = useRef<number>(0);
  const enemyProjectilesRef = useRef<EnemyProjectile[]>([]);
  const enemyDeathAnimationsRef = useRef<EnemyDeathAnimation[]>([]);
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


  const projectileTrailLastPosRef = useRef<Map<string, THREE.Vector3>>(new Map());
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
  const updateMuzzleFlash = usePlayer((state) => state.updateMuzzleFlash);
  const muzzleFlashTimer = usePlayer((state) => state.muzzleFlashTimer);
  const muzzleFlashPosition = usePlayer((state) => state.muzzleFlashPosition);
  const ammo = usePlayer((state) => state.ammo);
  const updateFanFire = usePlayer((state) => state.updateFanFire);
  const movePlayer = usePlayer((state) => state.move);
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
  const handleEnemyKilledBySummon = useSummons((state) => state.handleEnemyKilledBySummon);
  const playHit = useAudio((state) => state.playHit);
  const playSuccess = useAudio((state) => state.playSuccess);
  const screenCenter = useCamera((state) => state.screenCenter);




  const poolSize = 20000;

  const poolRef = useRef<TrailParticle[]>([]);
  const writeIndexRef = useRef(0);

  if (poolRef.current.length === 0) {
    for (let i = 0; i < poolSize; i++) {
      poolRef.current.push({
        x: 0,
        y: 0,
        size: 3,
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
      const scaled = getPixelPerfectScale(CANVAS_WIDTH, CANVAS_HEIGHT, window.innerWidth, window.innerHeight);
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
    Object.values(VisualSprites).forEach(img => {
      if (!img.complete) {
        img.onload = () => {};
      }
    });
  }, []);

  
  useEffect(() => {
    terrainRef.current = generateRoomTerrain();
    treeLightningRef.current = [];
    treeLightningSpawnTimerRef.current = 0;
    footstepMarksRef.current = [];
    footstepSpawnTimerRef.current = 0;
    projectileTrailLastPosRef.current.clear();
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
      if (e.code === "KeyR" && !playerState.isReloading && playerState.ammo < maxAmmo) {
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
    if (!canInteract || e.button !== 0) return;
    isMouseDown.current = true;
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (e.button !== 0) return;
    isMouseDown.current = false;
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

  return () => {
    window.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mouseup", handleMouseUp);
    window.removeEventListener("mousemove", handleMouseMove);
  };
}, [canInteract]);


  const spawnEyeballProjectile = (enemy: any) => {
    const direction = new THREE.Vector3(position.x - enemy.position.x, 0, position.z - enemy.position.z).normalize();
    enemyProjectilesRef.current.push({
      id: crypto.randomUUID(),
      position: enemy.position.clone(),
      velocity: direction.multiplyScalar(ENEMY_TYPE_CONFIG.eyeball.projectileSpeed ?? 9),
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
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const animationNowMs = phase === "playing" ? currentTime : pausedAnimationTimeRef.current;
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
      useCamera.getState().setScreenCenter(
        cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT),
      );
      
      

      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      drawDungeon(ctx, animationNowMs);
      

      if (phase === "playing") {
        
        const ps = usePlayer.getState();
        updateReload(delta);
        updateInvincibility(delta);
        updateMuzzleFlash();
        updateSummons(delta, position, enemies, addProjectile, playHit);
        updateFanFire(delta, () => {
          const fanIndex = usePlayer.getState().fanFireIndex;
          const angle = (fanIndex / 10) * Math.PI * 2;
          const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
          const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
          const aimAngle = Math.atan2(
            mouseRef.current.y - centerY,
            mouseRef.current.x - centerX,
          );
          const gunOffsetPixels = 3;
          const gunOffset = gunOffsetPixels / (TILE_SIZE / 2);
          const gunPosition = ps.position.clone().add(
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
            trailLength: stats.trailLength,
            homing: false,
            piercing: stats.piercing,
            bouncing: stats.bouncing,
          });

          playHit();
        });
        
        updateStatusEffects(delta, enemies, (enemyId, damage) => {
          const enemy = enemies.find(e => e.id === enemyId);
          if (enemy) {
            enemy.health -= damage;
            if (enemy.health <= 0) {
              handleEnemyKilledBySummon();

              const ps = usePlayer.getState();
              if (ps.splinterBullets) {
                const stats = ps.getProjectileStats();
                const addProjectile = useProjectiles.getState().addProjectile;

                for (let i = 0; i < 3; i++) {
                  const angle = (i / 3) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
                  const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

                  addProjectile({
                    position: enemy.position.clone(),
                    direction,
                    size: 1,
                    damage: stats.damage * 0.2,
                    speed: stats.speed * 1.5,
                    life: stats.life,
                    range: stats.range * 2,
                    trailLength: 3,
                    piercing: 2,
                    bouncing: 0,
                    homing: false,
                  });
                }
              }
            }
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
              const newAttack = pickTreeLightningAttack(nowMs, terrainRef.current);
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

            const lineStart = new THREE.Vector2(attack.source.x, attack.source.z);
            const lineEnd = new THREE.Vector2(attack.target.x, attack.target.z);
            const playerPoint = new THREE.Vector2(position.x, position.z);
            const lineHitRadius = 1.35;
            const playerRadius = 0.8;
            const distanceToBeam = distancePointToSegment(playerPoint, lineStart, lineEnd);

            attack.damageTimer += delta;
            if (distanceToBeam <= lineHitRadius + playerRadius && invincibilityTimer <= 0 && !damagedThisFrameRef.current && attack.damageTimer >= 0.2) {
              applyPlayerDamage(1, new THREE.Vector3(position.x, 0, position.z));
              damagedThisFrameRef.current = true;
              attack.damageTimer = 0;
            }
          }

          treeLightningRef.current = treeLightningRef.current.filter((attack) => nowMs < attack.endsAt);
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

        if (isMouseDown.current && !isReloading && ammo > 0 && canFire.current) {
            if (fireShot()) {
              const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);

              const stats = usePlayer.getState().getProjectileStats();
              const baseAngle = Math.atan2(
                mouseRef.current.y - centerY,
                mouseRef.current.x - centerX
              );
              const horizontalAim = Math.cos(baseAngle);
              if (horizontalAim < 0) {
                playerFacingRef.current = -1;
              } else if (horizontalAim > 0) {
                playerFacingRef.current = 1;
              }
              const handOffset = 0;
              const barrelLength = 2;
              const totalOffsetPixels = handOffset + barrelLength;
              const totalOffset = totalOffsetPixels / (TILE_SIZE / 2);
              const barrelFlashPosition = ps.position.clone().add(
                new THREE.Vector3(
                  Math.cos(baseAngle) * totalOffset*1.5,
                  0,
                  Math.sin(baseAngle) * totalOffset*1.5,
                ),
              );

              // Helper function to fire a projectile in a direction
              const fireProjectileInDirection = (angle: number, damageMultiplier: number = 1) => {
                const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
                const barrelPosition = ps.position.clone().add(
                  new THREE.Vector3(
                    Math.cos(angle) * totalOffset,
                    0,
                    Math.sin(angle) * totalOffset,
                  ),
                );

                const projectileExplosive = ps.lastAmmoExplosive && ammo === 1
                  ? { radius: 6, damage: 50 }
                  : stats.explosive;

                const projectileBurn = ps.incendiary
                  ? { damage: 4, duration: 3 }
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
                  explosive: projectileExplosive,
                  chainLightning: stats.chainLightning,
                  trailLength: stats.trailLength,
                  burn: projectileBurn,
                });
                
              };

              // Normal projectiles
              const spreadAngle = stats.projectileCount > 1 ? 0.15 : 0;
              for (let i = 0; i < stats.projectileCount; i++) {
                let angle = baseAngle;
                if (stats.projectileCount > 1) {
                  const offset = (i - (stats.projectileCount - 1) / 2) * spreadAngle;
                  angle += offset;
                }

                const inaccuracy = (1 - stats.accuracy);
                angle += ((Math.random() / 4) - 0.125) * inaccuracy;

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
              if (phase === "playing") cameraRef.current.shake({ strength: 35, durationMs: 60 });
              ps.fireMuzzleFlash(barrelFlashPosition);
              

              playHit();

              const summonState = useSummons.getState();
                if (summonState.electroMage) {
                  const newCounter = summonState.electroShotCounter + 1;
                  useSummons.setState({ electroShotCounter: newCounter });

                  if (newCounter >= 2) {
                    useSummons.setState({ electroShotCounter: 0 });

                    // Strike nearest enemy with lightning
                    if (enemies.length > 0) {
                      const nearest = enemies.reduce((acc, e) => {
                        const d = position.distanceTo(e.position);
                        return d < acc.dist ? { enemy: e, dist: d } : acc;
                      }, { enemy: null as any, dist: Infinity });

                      if (nearest.enemy && nearest.dist < 150) {
                        let damage = 22;
                        if (summonState.electroMastery) {
                          damage += 12;
                        }
                        nearest.enemy.health -= damage;

                        // Energized: 20% chance to refill 3 ammo
                        if (summonState.energized && Math.random() < 0.2) {
                          usePlayer.setState({ ammo: Math.min(ammo + 3, maxAmmo) });
                        }
                      }
                    }
                  }
                }

                
              fireTimer.current = firerate;
              canFire.current = false;
            }
          
        }


        let moveX = 0;
        let moveZ = 0;

        if (keysPressed.current.has("KeyW") || keysPressed.current.has("ArrowUp")) moveZ -= 1;
        if (keysPressed.current.has("KeyS") || keysPressed.current.has("ArrowDown")) moveZ += 1;
        if (keysPressed.current.has("KeyA") || keysPressed.current.has("ArrowLeft")) moveX -= 1;
        if (keysPressed.current.has("KeyD") || keysPressed.current.has("ArrowRight")) moveX += 1;
        
        if (moveX < 0 && !((isMouseDown.current && !isReloading && ammo > 0))) {
          playerFacingRef.current = -1;
        } else if (moveX > 0  && !((isMouseDown.current && !isReloading && ammo > 0))) {
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
          const movedPos = moveWithTerrainSlide(currentPos, moveStep, terrainRef.current, 0.8);

          const bounced = bounceAgainstBounds(movedPos, new THREE.Vector3(0,0,0), ROOM_SIZE, 1);
          usePlayer.setState({ position: bounced.position });

          footstepSpawnTimerRef.current += delta;
          if (footstepSpawnTimerRef.current >= 0.11) {
            footstepSpawnTimerRef.current = 0;
            const moveDir = new THREE.Vector3(dx, 0, dz).normalize();
            const side = footstepSideRef.current;
            footstepSideRef.current = side === 1 ? -1 : 1;
            const lateral = new THREE.Vector3(-moveDir.z, 0, moveDir.x).multiplyScalar(0.35 * side);
            footstepMarksRef.current.push({
              id: crypto.randomUUID(),
              position: bounced.position.clone().sub(moveDir.clone().multiplyScalar(0.35)).add(lateral),
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
          ROOM_SIZE,
          (enemyId, damage, knockback, projectileData) => {
            const enemy = enemies.find((e) => e.id === enemyId);
            if (enemy) {
              applyHit({
                enemy,
                damage,
                impactPos: projectileData?.impactPos,
                color: projectileData?.color || "#ffffff",
                knockbackStrength: knockback.length(),
                explosive: projectileData?.explosive,
                chainLightning: projectileData?.chainLightning,
                burn: projectileData?.burn,
                isPlayerDamage: true,
              }, enemies);
            }
          },
          phase !== "playing",
        );


      const updatedEnemies = enemies.map((enemy) => {
      // BOSS LOGIC
        enemy.hitFlash = Math.max(enemy.hitFlash - delta, 0);


        // #########################################################################
        if (enemy.isBoss && enemy.bossType === "lazarus") {
          const updated = { ...enemy };

          if (!updated.isEnraged && updated.health < updated.maxHealth * 0.45) {
            updated.isEnraged = true;
            updated.maxProjectileCooldown = 1;
            updated.maxWindUpTime = 0.8;
            updated.speed *= 1.15;
          }

          const dirToPlayer = new THREE.Vector3().subVectors(position, updated.position);
          const distanceToPlayer = dirToPlayer.length();
          const safeDirection = distanceToPlayer > 0.001 ? dirToPlayer.clone().normalize() : new THREE.Vector3(1, 0, 0);
          const orbitDirection = new THREE.Vector3(-safeDirection.z, 0, safeDirection.x);

          const canAdvance = distanceToPlayer > SHOGGOTH_CONFIG.idealDistance;
          const canRetreat = distanceToPlayer < SHOGGOTH_CONFIG.minDistance;

          if (updated.attackState === "chasing") {
            let moveDirection = new THREE.Vector3();
            if (canAdvance) {
              moveDirection.copy(safeDirection);
            } else if (canRetreat) {
              moveDirection.copy(safeDirection).multiplyScalar(-0.65);
            }

            if (moveDirection.lengthSq() > 0) {
              updated.position.add(moveDirection.normalize().multiplyScalar(updated.speed * delta));
            }

            updated.rotationY = Math.atan2(safeDirection.z, safeDirection.x);
            updated.projectileCooldown = (updated.projectileCooldown ?? 0) - delta;
            if (updated.projectileCooldown <= 0 && distanceToPlayer <= SHOGGOTH_CONFIG.maxDistance) {
              updated.attackState = "laser_windup";

              
              updated.windUpTimer = 0;
              updated.clawWindUp = 0;
              updated.clawGlowIntensity = 0;
              updated.dashDirection = safeDirection.clone();
            }
          } else if (updated.attackState === "laser_windup") {
            
            updated.windUpTimer = (updated.windUpTimer ?? 0) + delta;
            const windupProgress = Math.min(updated.windUpTimer / (updated.maxWindUpTime ?? 1), 1);
            const lockedDirection = (updated.dashDirection && updated.dashDirection.lengthSq() > 0)
              ? updated.dashDirection.clone().normalize()
              : safeDirection;

            updated.rotationY = Math.atan2(lockedDirection.z, lockedDirection.x);
            updated.clawWindUp = windupProgress;
            updated.clawGlowIntensity = windupProgress;
            updated.velocity.multiplyScalar(0.82);

            if (updated.windUpTimer >= (updated.maxWindUpTime ?? 1)) {
              updated.attackState = "laser_firing";
              
              updated.windUpTimer = 0;
              updated.laserBaseRotation = updated.rotationY ?? Math.atan2(lockedDirection.z, lockedDirection.x);
              updated.projectileCooldown = SHOGGOTH_CONFIG.beamDamageInterval;
              playHit();
            }
          } else if (updated.attackState === "laser_firing") {
            if (phase === "playing") cameraRef.current.shake({ strength: 5, durationMs: 1000});
            updated.windUpTimer = (updated.windUpTimer ?? 0) + delta;
            const fireDuration = SHOGGOTH_CONFIG.fireDuration;
            const spinAmount = (updated.windUpTimer ?? 0) * SHOGGOTH_CONFIG.rotationSpeed;
            const baseRotation = updated.laserBaseRotation ?? updated.rotationY ?? 0;
            const currentRotation = baseRotation + spinAmount;
            updated.rotationY = currentRotation;

            const circleStrafe = orbitDirection.clone().multiplyScalar(updated.speed * 0.42 * delta);
            updated.position.add(circleStrafe);
            
            updated.projectileCooldown = (updated.projectileCooldown ?? 0) - delta;
            if (updated.projectileCooldown <= 0) {
              const beamOriginOffsetWorld = SHOGGOTH_CONFIG.beamOriginOffsetPx / (TILE_SIZE / 2);
              for (const beamOffset of SHOGGOTH_CONFIG.beamAngles) {
                
                const beamAngle = currentRotation + beamOffset;
                const beamDirection = new THREE.Vector3(Math.cos(beamAngle), 0, Math.sin(beamAngle));
                const beamOrigin = updated.position.clone().add(beamDirection.clone().multiplyScalar(beamOriginOffsetWorld));
                const toPlayer = new THREE.Vector3().subVectors(position, beamOrigin);
                const along = toPlayer.dot(beamDirection);
                const lateral = toPlayer.clone().sub(beamDirection.clone().multiplyScalar(along)).length();

                if (
                  along >= 0.35 &&
                  along <= LAZARUS_BEAM_LENGTH_WORLD &&
                  lateral <= SHOGGOTH_CONFIG.beamHalfWidthWorld &&
                  invincibilityTimer <= 0 &&
                  !damagedThisFrameRef.current
                ) {
                  applyPlayerDamage(
                    updated.isEnraged ? 1 : 1,
                    beamOrigin.clone().add(beamDirection.clone().multiplyScalar(Math.min(along, LAZARUS_BEAM_LENGTH_WORLD))),
                  );
                  damagedThisFrameRef.current = true;
                }
              }

              updated.projectileCooldown = SHOGGOTH_CONFIG.beamDamageInterval;
            }

            if (updated.windUpTimer >= fireDuration) {
              updated.attackState = "recovering";
              updated.windUpTimer = updated.isEnraged ? 0.35 : 0.5;
              updated.projectileCooldown = updated.maxProjectileCooldown ?? 3.8;
              updated.laserBaseRotation = updated.rotationY;
            }
          } else if (updated.attackState === "recovering") {
            updated.windUpTimer = (updated.windUpTimer ?? 0) - delta;
            updated.clawGlowIntensity = Math.max((updated.clawGlowIntensity ?? 0) - delta * 2.8, 0);
            updated.clawWindUp = Math.max((updated.clawWindUp ?? 0) - delta * 2.8, 0);

            if (updated.windUpTimer <= 0) {
              updated.attackState = "chasing";
            }
          }

          return updated;
        }
        const dx = position.x - enemy.position.x;
        const dz = position.z - enemy.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const enemyCollisionRadius = getEnemyCollisionRadius(enemy);

        if (distance >= 1) {
          const dirX = dx / distance;
          const dirZ = dz / distance;

          const isEyeball = enemy.type === "eyeball";
          if (isEyeball) {
            enemy.rotationY = Math.atan2(dirZ, dirX);
            const isRangedAttacking = (enemy as any).isRangedAttacking ?? false;

            if (distance <= (ENEMY_TYPE_CONFIG.eyeball.engageDistancePx ?? 100) / (TILE_SIZE / 2)) {
              (enemy as any).isRangedAttacking = true;
            } else if (distance > (ENEMY_TYPE_CONFIG.eyeball.disengageDistancePx ?? 150) / (TILE_SIZE / 2)) {
              (enemy as any).isRangedAttacking = false;
            } else {
              (enemy as any).isRangedAttacking = isRangedAttacking;
            }

            if ((enemy as any).isRangedAttacking) {
              (enemy as any).rangedShotCooldown = ((enemy as any).rangedShotCooldown ?? 0) - delta;
              if ((enemy as any).rangedShotCooldown <= 0) {
                spawnEyeballProjectile(enemy);
                (enemy as any).rangedShotCooldown = ENEMY_TYPE_CONFIG.eyeball.projectileFireInterval ?? 1.1;
              }
            } else {
              const moveAmount = enemy.speed * delta;
              const movedEnemyPos = moveWithTerrainSlide(
                enemy.position,
                new THREE.Vector3(dirX * moveAmount, 0, dirZ * moveAmount),
                terrainRef.current,
                enemyCollisionRadius,
              );
              enemy.position.x = movedEnemyPos.x;
              enemy.position.z = movedEnemyPos.z;
            }
          } else {
            const moveAmount = enemy.speed * delta;
            const movedEnemyPos = moveWithTerrainSlide(
              enemy.position,
              new THREE.Vector3(dirX * moveAmount, 0, dirZ * moveAmount),
              terrainRef.current,
              enemyCollisionRadius,
            );
            enemy.position.x = movedEnemyPos.x;
            enemy.position.z = movedEnemyPos.z;
          }
        }

        if (!enemy.velocity) enemy.velocity = new THREE.Vector3(0, 0, 0);

        // Apply gradual knockback acceleration if active
        if (enemy.knockbackAcceleration && enemy.knockbackDuration && enemy.knockbackDuration > 0) {
          const accelToApply = enemy.knockbackAcceleration.clone().multiplyScalar(delta);
          enemy.velocity.add(accelToApply);
          enemy.knockbackDuration -= delta;
          if (enemy.knockbackDuration <= 0) {
            enemy.knockbackAcceleration = undefined;
            enemy.knockbackDuration = undefined;
          }
        }

        const velMovedPos = moveWithTerrainSlide(
          enemy.position,
          enemy.velocity.clone().multiplyScalar(delta),
          terrainRef.current,
          enemyCollisionRadius,
        );
        const movedByVelocity = !velMovedPos.equals(enemy.position);
        enemy.position.x = velMovedPos.x;
        enemy.position.z = velMovedPos.z;
        if (!movedByVelocity) {
          // Gentler bounce-back to feel more physical
          enemy.velocity.multiplyScalar(-0.5);
        }

        // Reduced and more realistic velocity dampening
        // This allows enemies to feel more grounded while still losing momentum
        enemy.velocity.multiplyScalar(
        Math.pow(0.95, delta * 60)
        );
        return enemy;
      });
          

        for (let i = 0; i < updatedEnemies.length; i++) {
          for (let j = i + 1; j < updatedEnemies.length; j++) {
            const e1 = updatedEnemies[i];
            const e2 = updatedEnemies[j];
            const dx = e1.position.x - e2.position.x;
            const dz = e1.position.z - e2.position.z;
            const dist = Math.hypot(dx, dz);
            const minDist = getEnemyCollisionRadius(e1) + getEnemyCollisionRadius(e2);

            if (dist > 0 && dist < minDist) {
              const push = (minDist - dist) / 8;
              const nx = dx / dist;
              const nz = dz / dist;
              e1.position.x += nx * push;
              e1.position.z += nz * push;
              e2.position.x -= nx * push;
              e2.position.z -= nz * push;
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
              applyPlayerDamage(1, enemy.position);
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

          projectile.position.add(projectile.velocity.clone().multiplyScalar(delta));

          const toPlayerX = projectile.position.x - position.x;
          const toPlayerZ = projectile.position.z - position.z;
          const hitDistance = Math.hypot(toPlayerX, toPlayerZ);

          if (hitDistance <= PLAYER_RADIUS + projectile.size && invincibilityTimer <= 0 && !damagedThisFrameRef.current) {
            applyPlayerDamage(Math.max(1, Math.round(projectile.damage)), projectile.position);
            damagedThisFrameRef.current = true;
            continue;
          }

          if (Math.abs(projectile.position.x) > ROOM_SIZE || Math.abs(projectile.position.z) > ROOM_SIZE) {
            continue;
          }

          updatedEnemyProjectiles.push(projectile);
        }

        if(damagedThisFrameRef.current) {
          if (phase === "playing") cameraRef.current.shake({ strength: 100, durationMs: 100 });
        }
        enemyProjectilesRef.current = updatedEnemyProjectiles;

        updateXPOrbs(delta, position);
        updateEnemies(aliveEnemies);
        
        useEnemies.getState().updateAutoSpawn(delta, position);
        footstepMarksRef.current = footstepMarksRef.current
          .map((mark) => ({ ...mark, life: mark.life + delta }))
          .filter((mark) => mark.life < mark.maxLife);
        if (hearts <= 0) end();
      }
      
      drawXPOrbs(ctx);
      enemies.forEach(enemy => drawEnemy(ctx, enemy));

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
        enemies.forEach(enemy => drawEnemyEyes(eyeCtx, enemy, animationNowMs));
        terrainRef.current.forEach((obstacle) => drawEnemyEyes(eyeCtx, obstacle, animationNowMs));
        drawTreeLightning(eyeCtx, gameplayElapsedMsRef.current);
        drawEnemyProjectiles(eyeCtx);
        drawProjectilesAndTrails(eyeCtx, phase !== "playing", position);
        drawSummons(eyeCtx, animationNowMs);
        drawDamageNumbers(eyeCtx); 
      }
      drawFootsteps(ctx);
      drawPlayer(ctx, animationNowMs);
      
      drawStatusEffects(ctx, animationNowMs);
      drawExplosionEffects(ctx);
      drawImpactEffects(ctx); // ADD - behind projectiles
      
      drawEnemyDeaths(ctx, gameplayElapsedMsRef.current);
      
      
      drawReloadIndicator(ctx);
      drawWeapon(ctx, "revolver", phase !== "playing");
    
      
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

    addXPOrb(enemy.position.clone(), 25);
    enemyDeathAnimationsRef.current.push({
      id: crypto.randomUUID(),
      position: enemy.position.clone(),
      startedAt: gameplayElapsedMsRef.current,
      frameDurationMs: 85,
    });
    removeEnemy(enemy.id);
    
    if (ps.splinterBullets) {
      const stats = ps.getProjectileStats();
      const addProjectile = useProjectiles.getState().addProjectile;

      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

        addProjectile({
          position: enemy.position.clone().add(direction.clone().multiplyScalar(0.6)),
          size: 4,
          direction,
          damage: stats.damage * 0.2,
          speed: stats.speed * 1.35,
          life: 1.2,
          range: Math.max(12, stats.range * 0.4),
          trailLength: 1,
          piercing: 2,
          bouncing: 0,
          homing: false,
        });
      }
    }
  }

  let grassPattern: CanvasPattern | null = null;

  const drawDungeon = (ctx: CanvasRenderingContext2D, animationNowMs: number) => {
    if (!grassPattern && grassSprite.complete) {
    grassPattern = ctx.createPattern(grassSprite, "repeat");
  }

  if (!grassPattern) return;
  const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
  
  const floorSize = ROOM_SIZE * TILE_SIZE;

  const offsetX = (-position.x * TILE_SIZE) / 2;
  const offsetZ = (-position.z * TILE_SIZE) / 2;

  // Camera offset in pixels
  const pixelOffsetX = (-position.x * TILE_SIZE) / 2;
  const pixelOffsetZ = (-position.z * TILE_SIZE) / 2;
  const cameraOffset = cameraRef.current.getRenderOffset();

  // full world offset INCLUDING camera pull
  const worldOffsetX =
    (-position.x * TILE_SIZE) / 2 + cameraOffset.x;

  const worldOffsetY =
    (-position.z * TILE_SIZE) / 2 + cameraOffset.y;

  ctx.save();

  ctx.fillStyle = grassPattern;

  // move pattern with world
  ctx.translate(worldOffsetX, worldOffsetY);
ctx.imageSmoothingEnabled = false;

  ctx.fillRect(
    -worldOffsetX - CANVAS_WIDTH,
    -worldOffsetY - CANVAS_HEIGHT,
    CANVAS_WIDTH * 3,
    CANVAS_HEIGHT * 3
  );
  
  

  ctx.restore();


    // ============================================
    // TERRAIN OBSTACLES
    // ============================================

    terrainRef.current.forEach((obstacle) => {
      const screenX = snapToGrid(centerX + ((obstacle.x - position.x) * TILE_SIZE) / 2);
      const screenY = snapToGrid(centerY + ((obstacle.z - position.z) * TILE_SIZE) / 2);
      const radiusPx = obstacle.radius * (TILE_SIZE / 2);
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

    // ============================================
    // WALLS
    // ============================================

    const wallThickness = 20;

    ctx.fillRect(
      snapToGrid(centerX - floorSize / 2 + offsetX),
      snapToGrid(centerY - floorSize / 2 - wallThickness + offsetZ),
      floorSize,
      wallThickness,
    );
    ctx.fillRect(
      snapToGrid(centerX - floorSize / 2 + offsetX),
      snapToGrid(centerY + floorSize / 2 + offsetZ),
      floorSize,
      wallThickness,
    );
    ctx.fillRect(
      snapToGrid(centerX + floorSize / 2 + offsetX),
      snapToGrid(centerY - floorSize / 2 + offsetZ),
      wallThickness,
      floorSize,
    );
    ctx.fillRect(
      snapToGrid(centerX - floorSize / 2 - wallThickness + offsetX),
      snapToGrid(centerY - floorSize / 2 + offsetZ),
      wallThickness,
      floorSize,
    );


  };

  const drawXPOrbs = (ctx: CanvasRenderingContext2D) => {
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
    const xpOrbs = useEnemies.getState().xpOrbs;

    xpOrbs.forEach((orb) => {
      const screenX = snapToGrid(centerX + ((orb.position.x - position.x) * TILE_SIZE) / 2);
      const screenY = snapToGrid(centerY + ((orb.position.z - position.z) * TILE_SIZE) / 2);

      const sprite = xpSprite; // assume you imported or loaded xp.png as xpImage

      if (sprite.complete) {
        const scale = 2; // adjust size as needed
        const w = sprite.width * scale;
        const h = sprite.height * scale;

        ctx.save();
        ctx.imageSmoothingEnabled = false; // pixelated
        ctx.translate(screenX, screenY);
        ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
        ctx.restore();
      }
    });
  };

  const drawReloadIndicator = (ctx: CanvasRenderingContext2D) => {
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);

    if (isReloading) {
      const radius = 40;
      const barHeight = 8;
      const barY = snapToGrid(centerY - 60);
      const snappedCenterX = snapToGrid(centerX);

      // Background bar
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(snapToGrid(snappedCenterX - radius), barY, radius * 2, barHeight);

      // Progress bar - use solid color instead of gradient
      const progress = reloadProgress / reloadTime;
      const barWidth = snapToGrid(radius * 2 * progress);

      // Simple color based on progress instead of gradient
      const hue = 30 + (progress * 10); // Goes from orange to yellow
      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.fillRect(snapToGrid(snappedCenterX - radius), barY, barWidth, barHeight);

      // Border with glow
      ctx.strokeStyle = "#ffaa00";
      ctx.lineWidth = 2;
      ctx.strokeRect(snapToGrid(snappedCenterX - radius), barY, radius * 2, barHeight);

      // Outer glow
      ctx.strokeStyle = "rgba(255, 170, 0, 0.3)";
      ctx.lineWidth = 4;
      ctx.strokeRect(snapToGrid(snappedCenterX - radius - 1), snapToGrid(barY - 1), radius * 2 + 2, barHeight + 2);

      
      ctx.save();
      ctx.translate(snapToGrid(centerX), snapToGrid(barY - 20));
  
      
      drawBitmapText(
      ctx,
      "RELOADING",
      0,
      0,
      font,
      fontWhiteImage,
      {
        align: "center",
        scale: 1 
      }
      );

      ctx.restore();

      // Spinning chamber indicator
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
    isPaused: boolean
  ) => {
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);

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
        ctx.scale(-1,1)
        ctx.translate(-3.5,0)
        
        const w = sprite.width;
        const h = sprite.height;

        ctx.drawImage(sprite, w, h / 2, w, -h);

        ctx.restore();
      }
      
      // ===========================
      // REVOLVER SPRITE
      // ===========================
      const sprite = WeaponSprites.revolver;
      if (sprite.complete && sprite.naturalWidth > 0 && sprite.naturalHeight > 0) {
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
    speed: number,
    projectileId: string,
  ) => {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const step = 0.1; // controls trail density

    if (dist === 0) return;

    const steps = Math.floor(dist / step);
    const trailSize = Math.max(1.5, size * 0.55);
    const trailLife = Math.min(0.2, Math.max(0.01, speed * 0.001));

    for (let i = 0; i <= steps; i++) {
      const t = i / (steps || 1);
      const x = x0 + dx * t;
      const z = z0 + dz * t;

      const p = poolRef.current[writeIndexRef.current];
      p.x = x;
      p.y = z;
      p.size = trailSize;
      p.life = trailLife;
      p.maxLife = trailLife;
      p.projectileId = projectileId;

      writeIndexRef.current = (writeIndexRef.current + 1) % poolSize;
    }
  };


const drawProjectilesAndTrails = (
  ctx: CanvasRenderingContext2D,
  isPaused: boolean,
  playerPos: THREE.Vector3
) => {
  const { projectiles } = useProjectiles.getState();

  const worldToScreen = (x: number, z: number) =>
    cameraRef.current.worldToScreen(
      { x, y: z },
      { x: playerPos.x, y: playerPos.z },
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      TILE_SIZE / 2
    );

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  const img = getProjectileImage();

  const drawProjectile = (
    x: number,
    y: number,
    size: number
  ) => {
    ctx.drawImage(
      img,
      Math.floor(x - size / 2),
      Math.floor(y - size / 2),
      Math.floor(size),
      Math.floor(size)
    );
  };


  // =====================================================
  // PROJECTILES
  // =====================================================
  const activeProjectileIds = new Set(projectiles.map((proj) => proj.id));

  for (let proj of projectiles) {
    const prev = {
      x: proj.previousPosition.x,
      z: proj.previousPosition.z,
    };

    const curr = {
      x: proj.position.x,
      z: proj.position.z,
    };

    if (!isPaused) {
      emitSegment(prev.x, prev.z, curr.x, curr.z, proj.size, proj.speed, proj.id);
    }

    const screenPos = worldToScreen(curr.x, curr.z);
    const snappedX = snapToGrid(screenPos.x);
    const snappedY = snapToGrid(screenPos.y);

    ctx.globalAlpha = 1;

    drawProjectile(
      snappedX,
      snappedY,
      Math.floor(proj.size)
    );
  }

  ctx.fillStyle = "#f5d6c1";

  for (let i = 0; i < poolSize; i++) {
    const p = poolRef.current[i];

    if (p.life <= 0) continue;
    if (p.projectileId && !activeProjectileIds.has(p.projectileId)) {
      p.life = 0;
      continue;
    }

    if (!isPaused) {
      p.life -= 0.016;
    }

    const t = p.life / p.maxLife;
    const size = p.size * (0.5 + t);

    const screenPos = worldToScreen(p.x, p.y);

    ctx.fillRect(
      snapToGrid(screenPos.x - size / 2),
      snapToGrid(screenPos.y - size / 2),
      snapToGrid(size),
      snapToGrid(size)
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

    impactEffects.forEach(impact => {
      const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
      const screenX = snapToGrid(centerX + ((impact.x - position.x) * TILE_SIZE)/2);
      const screenY = snapToGrid(centerY + ((impact.y - position.z) * TILE_SIZE)/2);

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      
      ctx.drawImage(
        sprite,
        frameWidth * impact.frameIndex, 0,  // source x, y
        frameWidth, frameHeight,            // source width, height
        snapToGrid(screenX - impact.size/2), snapToGrid(screenY - impact.size/2),  // dest x, y
        impact.size, impact.size            // dest width, height
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

    explosionEffects.forEach(explosion => {
      const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
      const screenX = snapToGrid(centerX + ((explosion.x - position.x) * TILE_SIZE) / 2);
      const screenY = snapToGrid(centerY + ((explosion.y - position.z) * TILE_SIZE) / 2);
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

  const drawDamageNumbers = (ctx: CanvasRenderingContext2D) => {
    const damageNumbers = useVisualEffects.getState().damageNumbers;
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    damageNumbers.forEach(dmg => {
      const screenX = snapToGrid(centerX + ((dmg.x - position.x) * TILE_SIZE) / 2);
      const screenY = snapToGrid(centerY + ((dmg.y - position.z) * TILE_SIZE) / 2);

      const lifePercent = dmg.life / dmg.maxLife;
      const alpha = Math.max(0, Math.min(1, lifePercent < 0.7 ? 1 : (1 - (lifePercent - 0.7) / 0.3)));

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
    scale: dmg.scale // IMPORTANT: use integers
  }
);
    });

    ctx.restore();
  };

  const drawTreeLightning = (ctx: CanvasRenderingContext2D, nowMs: number) => {
    if (treeLightningRef.current.length === 0) return;

    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);

    for (const attack of treeLightningRef.current) {
      const x1 = snapToGrid(centerX + ((attack.source.x - position.x) * TILE_SIZE) / 2);
      const y1 = snapToGrid(centerY + ((attack.source.z - position.z) * TILE_SIZE) / 2);
      const x2 = snapToGrid(centerX + ((attack.target.x - position.x) * TILE_SIZE) / 2);
      const y2 = snapToGrid(centerY + ((attack.target.z - position.z) * TILE_SIZE) / 2);

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
          ctx.arc(snapToGrid(px + jitterX), snapToGrid(py + jitterY), 2, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }

      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const frame = nowMs >= attack.dissipateAt ? 4 : attack.frame;

      if (electricityLineSpriteSheet.complete && electricityLineSpriteSheet.naturalWidth > 0) {
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
      } else {
        ctx.strokeStyle = nowMs >= attack.dissipateAt ? "rgba(130,130,255,0.35)" : "rgba(130,220,255,0.9)";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(snapToGrid(x1), snapToGrid(y1));
        ctx.lineTo(snapToGrid(x2), snapToGrid(y2));
        ctx.stroke();
      }
    }
  };

  const drawFootsteps = (ctx: CanvasRenderingContext2D) => {
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
    for (const mark of footstepMarksRef.current) {
      const alpha = 1 - mark.life / mark.maxLife;
      const screenX = snapToGrid(centerX + ((mark.position.x - position.x) * TILE_SIZE) / 2);
      const screenY = snapToGrid(centerY + ((mark.position.z - position.z) * TILE_SIZE) / 2);

      ctx.save();
      ctx.fillStyle = `rgba(61, 85, 85, ${Math.max(0, Math.min(1, 1.35 * alpha))})`;
      ctx.beginPath();
      const radiusX = Math.max(1, Math.round(mark.radius * alpha));
      const radiusY = Math.max(1, Math.round((mark.radius * 0.6) * alpha));
      ctx.ellipse(screenX, screenY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

const drawPlayer = (ctx: CanvasRenderingContext2D, animationNowMs: number) => {
    const playerState = usePlayer.getState();
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    ctx.translate(centerX, centerY);

    // Flashing effect during invincibility
    if (playerState.invincibilityTimer > 0) {
      const flashFrequency = 0.15; // Flash every 150ms
      const flash = Math.sin((playerState.invincibilityTimer / flashFrequency) * Math.PI * 4) > 0;
      if (!flash) {
        ctx.restore();
        return; // Skip drawing to create flash effect
      }
    }

    if (playerSpriteSheet.complete && playerSpriteSheet.naturalWidth > 0) {
      const animState = playerState.isMoving
        ? (playerState.isFiring ? PLAYER_SPRITE_ANIMATIONS.walking : PLAYER_SPRITE_ANIMATIONS.running)
        : PLAYER_SPRITE_ANIMATIONS.idle;
      const frame = Math.floor((animationNowMs / 1000) * animState.fps) % animState.frames;
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

    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);

    const screenX = snapToGrid(centerX + ((enemy.position.x - position.x) * TILE_SIZE) / 2);
    const screenY = snapToGrid(centerY + ((enemy.position.z - position.z) * TILE_SIZE) / 2);

    const enemyType: EnemySpriteType = getEnemyType(enemy);
    const bodySprite = enemySpritesByType[enemyType];
    const size = bodySprite.size * bodySprite.scale;
    const facingRight = enemy.position.x <= position.x;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.imageSmoothingEnabled = false;

    if (enemyType === "eyeball") {
      ctx.rotate(enemy.rotationY ?? 0);
    } else if (!facingRight) {
      ctx.scale(-1, 1);
    }

    if (enemy.hitFlash > 0) ctx.filter = "brightness(60)";
    ctx.drawImage(bodySprite.img, Math.floor(-size / 2), Math.floor(-size / 2), Math.floor(size), Math.floor(size));
    ctx.filter = "none";

    ctx.restore();
  };

  const drawEnemyEyes = (ctx: CanvasRenderingContext2D, enemy: any, animationNowMs: number) => {
    if (!enemy) return;

    if (enemy.type === "tree") {
      if (enemy.spriteFrame === 0) return;

      const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
      const screenX = snapToGrid(centerX + ((enemy.x - position.x) * TILE_SIZE) / 2);
      const screenY = snapToGrid(centerY + ((enemy.z - position.z) * TILE_SIZE) / 2);

      if (treeEnemyEyesSprite.complete && treeEnemyEyesSprite.naturalWidth > 0 && treeEnemyEyesSprite.naturalHeight > 0) {
        const frameW = treeEnemyEyesSprite.naturalWidth / 2;
        const frameH = treeEnemyEyesSprite.naturalHeight;
        const eyeFrame = enemy.spriteFrame === 1 ? 0 : 1;
        const radiusPx = enemy.radius * (TILE_SIZE / 2);
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
      const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
      const screenX = snapToGrid(centerX + ((enemy.position.x - position.x) * TILE_SIZE) / 2);
      const screenY = snapToGrid(centerY + ((enemy.position.z - position.z) * TILE_SIZE) / 2);
      const bossSheet = lazarusBossSpriteSheet;
      const windupSheet = bossLaserWindupSprite;
      const laserSheet = bossLaserSpriteSheet;
      const laserContinueSheet = bossLaserContinueSprite;
      const hasBossSheet = bossSheet.complete && bossSheet.naturalWidth > 0 && bossSheet.naturalHeight > 0;
      const hasWindupSheet = windupSheet.complete && windupSheet.naturalWidth > 0 && windupSheet.naturalHeight > 0;
      const hasLaserSheet = laserSheet.complete && laserSheet.naturalWidth > 0 && laserSheet.naturalHeight > 0;
      const hasLaserContinueSheet =
        laserContinueSheet.complete && laserContinueSheet.naturalWidth > 0 && laserContinueSheet.naturalHeight > 0;

      const drawSize = 170;
      if (hasBossSheet) {
        const frameW = bossSheet.naturalWidth / 3;
        const frameH = bossSheet.naturalHeight / 2;
        const animFrame = Math.floor(animationNowMs / 130) % 3;
        const bodyFrame = enemy.attackState === "laser_windup" || enemy.attackState === "laser_firing" ? 2 : animFrame;
        const gasFrameIndex = 4;
        const gasSourceX = (gasFrameIndex % 3) * frameW;
        const gasSourceY = Math.floor(gasFrameIndex / 3) * frameH;
        const bodyRotation = (enemy.rotationY ?? 0) + Math.PI / 2;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(bodyRotation);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bossSheet, gasSourceX, gasSourceY, frameW, frameH, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        ctx.restore();

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(bodyRotation);
        ctx.imageSmoothingEnabled = false;
        if (enemy.hitFlash > 0) ctx.filter = "brightness(8)";
        ctx.drawImage(bossSheet, bodyFrame * frameW, 0, frameW, frameH, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        ctx.filter = "none";
        ctx.restore();
      }

      const aimAngle = enemy.rotationY ?? 0;
      const beamLengthPx = 304 * SHOGGOTH_CONFIG.beamLengthScale;
      const beamWidthPx = 32;
      const beamOriginOffsetPx = SHOGGOTH_CONFIG.beamOriginOffsetPx;
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
          const drawSourceX = useContinueSheet ? (continueSourceX ?? sourceX) : sourceX;
          const drawSourceW = useContinueSheet ? (continueSourceW ?? sourceW) : sourceW;
          const drawSourceH = useContinueSheet ? (continueSourceH ?? sourceH) : sourceH;
          const drawY = -tileStep * (tile + 1);
          ctx.drawImage(
            beamSheet,
            drawSourceX,
            0,
            drawSourceW,
            drawSourceH,
            -beamWidthPx * 2 / 2,
            drawY * 2,
            beamWidthPx * 2,
            tileDrawH * 2,
          );
        }

        ctx.restore();
      };

      if (enemy.attackState === "laser_windup" && hasWindupSheet) {
        const pulse = 0.82 + Math.sin(animationNowMs / 85) * 0.16;

        for (const beamOffset of SHOGGOTH_CONFIG.beamAngles) {
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
        const continueFrameW = hasLaserContinueSheet ? laserContinueSheet.naturalWidth / 6 : frameW;
        const continueFrameH = hasLaserContinueSheet ? laserContinueSheet.naturalHeight : frameH;
        const fireProgress = Math.min(1, (enemy.windUpTimer ?? 0) / SHOGGOTH_CONFIG.fireDuration);

        let frame = 1;
        if (fireProgress < 0.03) {
          frame = 0;
        } else if (fireProgress > 0.92) {
          const dissipationProgress = Math.min(1, (fireProgress - 0.92) / 0.08);
          frame = Math.min(5, 2 + Math.floor(dissipationProgress * 4));
        }

        for (const beamOffset of SHOGGOTH_CONFIG.beamAngles) {
          const beamAngle = laserBaseRotation + ((enemy.windUpTimer ?? 0) * SHOGGOTH_CONFIG.rotationSpeed) + beamOffset;
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
      ctx.fillRect(snapToGrid(screenX - barW / 2 - 2), snapToGrid(barY - 2), barW + 4, barH + 4);
      ctx.fillStyle = "#400";
      ctx.fillRect(snapToGrid(screenX - barW / 2), barY, barW, barH);
      ctx.fillStyle = hpPct > 0.45 ? "#5DFF63" : "#ffc642";
      ctx.fillRect(snapToGrid(screenX - barW / 2), barY, snapToGrid(barW * hpPct), barH);
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
    scale: 1
    }
    );
      return;
    }

    const enemyType: EnemySpriteType = getEnemyType(enemy);
    const eyeSprite = enemyEyeSpritesByType[enemyType];
    const size = eyeSprite.size * eyeSprite.scale;

    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
    const screenX = snapToGrid(centerX + ((enemy.position.x - position.x) * TILE_SIZE) / 2);
    const screenY = snapToGrid(centerY + ((enemy.position.z - position.z) * TILE_SIZE) / 2);
    const facingRight = enemy.position.x <= position.x;

    ctx.save();
    ctx.translate(screenX, screenY);
    if (enemyType === "eyeball") {
      ctx.rotate(enemy.rotationY ?? 0);
    } else if (!facingRight) {
      ctx.scale(-1, 1);
    }
    ctx.drawImage(eyeSprite.img, Math.floor(-size / 2), Math.floor(-size / 2), Math.floor(size), Math.floor(size));
    ctx.restore();
  };

  const drawEnemyProjectiles = (ctx: CanvasRenderingContext2D) => {
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
    const projectileSprite = enemyEyeballProjectileSprite;
    const hasProjectileSprite = projectileSprite.complete && projectileSprite.naturalWidth > 0 && projectileSprite.naturalHeight > 0;

    for (const projectile of enemyProjectilesRef.current) {
      const screenX = snapToGrid(centerX + ((projectile.position.x - position.x) * TILE_SIZE) / 2);
      const screenY = snapToGrid(centerY + ((projectile.position.z - position.z) * TILE_SIZE) / 2);
      const pixelSize = Math.max(8, projectile.size * TILE_SIZE * 1.1);

      ctx.save();

      if (hasProjectileSprite) {
        const angle = Math.atan2(projectile.velocity.z, projectile.velocity.x);
        ctx.translate(screenX, screenY);
        ctx.rotate(angle);
        ctx.drawImage(projectileSprite, -pixelSize / 2, -pixelSize / 2, pixelSize, pixelSize);
      }
      ctx.restore();
    }
  };
  
  const drawEnemyDeaths = (ctx: CanvasRenderingContext2D, animationNowMs: number) => {
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
    const sprite = enemyDeathSpritesheet;
    const totalFrames = 4;

    const hasSprite = sprite.complete && sprite.naturalWidth > 0 && sprite.naturalHeight > 0;
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

      const screenX = snapToGrid(centerX + ((animation.position.x - position.x) * TILE_SIZE) / 2);
      const screenY = snapToGrid(centerY + ((animation.position.z - position.z) * TILE_SIZE) / 2);
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
  };

  const drawSummons = (ctx: CanvasRenderingContext2D, animationNowMs: number) => {
    const summons = useSummons.getState().summons;
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);

    summons.forEach((summon) => {
      const screenX = snapToGrid(centerX + ((summon.position.x - position.x) * TILE_SIZE) / 2);
      const screenY = snapToGrid(centerY + ((summon.position.z - position.z) * TILE_SIZE) / 2);

      if (summon.type === "ghost") {
        const sprite = SummonSprites.ghostSheet;
        const isSheetReady = sprite.complete && sprite.naturalWidth > 0 && sprite.naturalHeight > 0;
        if (!isSheetReady) return;

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

        const sx = inShootAnim ? (frameIndex % shootFrames) * frameW : (frameIndex % passiveFrames) * frameW;
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

        ctx.drawImage(sprite, sx, sy, frameW, frameH, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
        return;
      }

      if (summon.type === "dagger") {
        const sprite = SummonSprites.dagger;
        const img = getProjectileImage();
        const canDrawDagger = sprite.complete && sprite.naturalWidth > 0;
        const canDrawTrail = img.complete && img.naturalWidth > 0;

        if (summon.trail && canDrawTrail) {
          for (let i = summon.trail.length - 1; i >= 0; i--) {
            const p = summon.trail[i];
            const x = centerX + ((p.x - position.x) * TILE_SIZE) / 2;
            const y = centerY + ((p.z - position.z) * TILE_SIZE) / 2;
            const t = i / summon.trail.length;
            const size = Math.floor(40 * (1 - t * 0.9));

            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
            ctx.restore();
          }
        }

        if (!canDrawDagger) return;

        const scale = 1.5;
        const w = sprite.naturalWidth * scale;
        const h = sprite.naturalHeight * scale;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(summon.rotation);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
        ctx.restore();
        return;
      }

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.imageSmoothingEnabled = false;

      if (summon.type === "scythe") {
        const sprite = SummonSprites.scythe;
        const canDrawScythe = sprite.complete && sprite.naturalWidth > 0 && sprite.naturalHeight > 0;

        if (canDrawScythe) {
          const scale = 3;
          const w = sprite.naturalWidth * scale;
          const h = sprite.naturalHeight * scale;
          ctx.rotate(summon.rotation ?? 0);
          ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
        }
      } else if (summon.type === "spear") {
        ctx.fillStyle = "#ffaa00";
        ctx.strokeStyle = "#cc8800";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(0, -25);
        ctx.lineTo(5, -15);
        ctx.lineTo(2, -12);
        ctx.lineTo(0, -18);
        ctx.lineTo(-2, -12);
        ctx.lineTo(-5, -15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#8b4513";
        ctx.fillRect(-2, -12, 4, 30);

        ctx.globalAlpha = 0.4;
        ctx.fillStyle = "#ffaa00";
        ctx.beginPath();
        ctx.arc(0, -15, 10, 0, Math.PI * 2);
        ctx.fill();
      } else if (summon.type === "electrobug") {
        ctx.fillStyle = "#00ffff";

        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.4;
        ctx.fillStyle = "#00ffff";
        ctx.beginPath();
        ctx.ellipse(-6, -2, 5, 3, -0.3, 0, Math.PI * 2);
        ctx.ellipse(6, -2, 5, 3, 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#00ffff";
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-3, -6);
        ctx.lineTo(-5, -10);
        ctx.moveTo(3, -6);
        ctx.lineTo(5, -10);
        ctx.stroke();
      }

      ctx.restore();
    });
  };

  const drawStatusEffects = (ctx: CanvasRenderingContext2D, animationNowMs: number) => {
    const { x: centerX, y: centerY } = cameraRef.current.getPlayerScreenCenter(CANVAS_WIDTH, CANVAS_HEIGHT);
    const { statusEffects } = useSummons.getState();

    statusEffects.forEach(effect => {
      const enemy = enemies.find(e => e.id === effect.enemyId);
      if (!enemy) return;

      const screenX = centerX + ((enemy.position.x - position.x) * TILE_SIZE) / 2;
      const screenY = centerY + ((enemy.position.z - position.z) * TILE_SIZE) / 2;

      if (effect.type === "burn") {
        // Flame particles
        ctx.fillStyle = "#ff6600";
        ctx.globalAlpha = 0.8;
        for (let i = 0; i < 3; i++) {
          const angle = (animationNowMs / 200 + i) % (Math.PI * 2);
          const x = screenX + Math.cos(angle) * 15;
          const y = screenY + Math.sin(angle) * 15 - 10;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (effect.type === "curse") {
        // Dark aura
        ctx.strokeStyle = "#9900ff";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 20 + Math.sin(animationNowMs / 200) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

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
    size
  );

  if (phase !== "playing") return;

  

  drawBitmapText(
    ctx,
    `${ammo}`,
    x + 18,
    y + 10,
    font,
    fontWhiteImage,
    {
      align: "left",
      baseline: "middle",
      scale: 1,
    }
  );
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
