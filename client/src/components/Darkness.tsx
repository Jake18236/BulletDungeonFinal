import { useEffect, useRef } from "react";
import { usePlayer } from "../lib/stores/usePlayer";
import { useEnemies } from "../lib/stores/useEnemies";
import { useVisualEffects } from "../lib/stores/useVisualEffects";

const CANVAS_WIDTH = 1490;
const CANVAS_HEIGHT = 750;
const TILE_SIZE = 50;
const WORLD_TO_SCREEN_SCALE = TILE_SIZE / 2;
const PIXEL_SIZE = 2;
const LIGHT_LEVELS = [1, 0.3, 0.5] as const;

function drawThreeStepLight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius)) {
    return;
  }

  const snappedRadius =
    Math.max(1, Math.round(radius / PIXEL_SIZE) * PIXEL_SIZE);

  if (!Number.isFinite(snappedRadius)) {
    return;
  }

  const gradient = ctx.createRadialGradient(
    x,
    y,
    0,
    x,
    y,
    snappedRadius,
  );

  gradient.addColorStop(0, "rgb(255, 255, 255)");
    gradient.addColorStop(0.45, "rgba(255,255,255)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.5)");
    gradient.addColorStop(0.70, "rgba(255,255,255, 0.25)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, snappedRadius, 0, Math.PI * 2);
  ctx.fill();
}

export default function Darkness() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const { position: playerPosition, muzzleFlashPosition } = usePlayer();
  const { xpOrbs } = useEnemies();
  const { impactEffects } = useVisualEffects();

  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const centerX = CANVAS_WIDTH / 2;
      const centerY = CANVAS_HEIGHT / 2;

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.globalCompositeOperation = "destination-out";
      drawThreeStepLight(ctx, centerX, centerY, 300);

      if (muzzleFlashPosition) {
        const x =
          centerX +
          (muzzleFlashPosition.x - playerPosition.x) * WORLD_TO_SCREEN_SCALE;
        const y =
          centerY +
          (muzzleFlashPosition.z - playerPosition.z) * WORLD_TO_SCREEN_SCALE;
        drawThreeStepLight(ctx, x, y, 264);
      }

      impactEffects.forEach((impact) => {
        const x =
          centerX +
          (impact.x - playerPosition.x) * WORLD_TO_SCREEN_SCALE;
        const y =
          centerY +
          (impact.y - playerPosition.z) * WORLD_TO_SCREEN_SCALE;
        const sizeScale = 1;
        drawThreeStepLight(ctx, x, y, impact.size * sizeScale);
      });

      xpOrbs.forEach((orb) => {
        const x =
          centerX +
          (orb.position.x - playerPosition.x) * WORLD_TO_SCREEN_SCALE;

        const y =
          centerY +
          (orb.position.z - playerPosition.z) * WORLD_TO_SCREEN_SCALE;

        drawThreeStepLight(ctx, x, y, 32);
      });
      ctx.globalCompositeOperation = "source-over";

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [playerPosition, xpOrbs, impactEffects, muzzleFlashPosition]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 1,
        imageRendering: "pixelated",
      }}
    />
  );
}
