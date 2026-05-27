import { useEffect, useRef } from "react";
import { usePlayer } from "../lib/stores/usePlayer";
import { useEnemies } from "../lib/stores/useEnemies";
import { useVisualEffects } from "../lib/stores/useVisualEffects";
import { useCamera } from "../lib/stores/useCamera";
import { useGame } from "../lib/stores/useGame";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../components/CanvasGame";

const WORLD_TO_SCREEN_SCALE = 25; // simplified (your TILE_SIZE/2)
const LIGHT_SAMPLES = 32; // quality vs perf knob

function drawLight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number
) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius)) return;

  const r = Math.max(1, radius);

  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  
  // Smooth 20MTD-style falloff (single curve, no banding)

  g.addColorStop(0.2, "rgba(255,255,255,0.95)");
  g.addColorStop(0.3, "rgba(255,255,255,0.35)");
  g.addColorStop(0.5, "rgba(255,255,255,0.15)");
  g.addColorStop(0.9, "rgba(255,255,255,0.01)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export default function Darkness() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>();

  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Skip rendering if game is paused (e.g., during level-up)
      const gameState = useGame.getState();
      if (gameState.phase === "paused") {
        frameRef.current = requestAnimationFrame(render);
        return;
      }

      const playerState = usePlayer.getState();
      const muzzleFlashPosition = playerState.muzzleFlashPosition;
      const playerPosition = playerState.position;
      const xpOrbs = useEnemies.getState().xpOrbs;
      const impactEffects = useVisualEffects.getState().impactEffects;
      const explosionEffects = useVisualEffects.getState().explosionEffects;
      const screenCenter = useCamera.getState().screenCenter;

      const cx = screenCenter.x;
      const cy = screenCenter.y;

      // =========================================
      // BASE DARKNESS (cheap full-screen fill)
      // =========================================
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#272030";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // =========================================
      // LIGHT PASS (cut holes)
      // =========================================
      ctx.globalCompositeOperation = "destination-out";

      // 1. Player light (main)
      drawLight(ctx, cx, cy, 720);

      // 2. Muzzle flash (temporary)
      if (muzzleFlashPosition) {
        drawLight(
          ctx,
          cx +
            (muzzleFlashPosition.x - playerPosition.x) *
              WORLD_TO_SCREEN_SCALE,
          cy +
            (muzzleFlashPosition.z - playerPosition.z) *
              WORLD_TO_SCREEN_SCALE,
          800
        );
      }

      // 3. Impact effects (limited influence)
      for (let i = 0; i < impactEffects.length; i++) {
        const e = impactEffects[i];

        drawLight(
          ctx,
          cx + (e.x - playerPosition.x) * WORLD_TO_SCREEN_SCALE,
          cy + (e.y - playerPosition.z) * WORLD_TO_SCREEN_SCALE,
          e.size * 1.2
        );
      }

      for (let i = 0; i < explosionEffects.length; i++) {
        const e = explosionEffects[i];

        drawLight(
          ctx,
          cx + (e.x - playerPosition.x) * WORLD_TO_SCREEN_SCALE,
          cy + (e.y - playerPosition.z) * WORLD_TO_SCREEN_SCALE,
          e.size * 1.2
        );
      }

      // 4. XP orbs (small soft glow)
      for (let i = 0; i < xpOrbs.length; i++) {
        const o = xpOrbs[i];

        drawLight(
          ctx,
          cx + (o.position.x - playerPosition.x) * WORLD_TO_SCREEN_SCALE,
          cy + (o.position.z - playerPosition.z) * WORLD_TO_SCREEN_SCALE,
          88
        );
      }

      ctx.globalCompositeOperation = "source-over";

      frameRef.current = requestAnimationFrame(render);
    };

    frameRef.current = requestAnimationFrame(render);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

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