import { useEffect, useRef } from "react";
import { usePlayer } from "../lib/stores/usePlayer";
import { useEnemies } from "../lib/stores/useEnemies";
import { useVisualEffects } from "../lib/stores/useVisualEffects";
import { useCamera } from "../lib/stores/useCamera";
import { useGame } from "../lib/stores/useGame";
import { useSummons } from "../lib/stores/useSummons";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../components/CanvasGame";

const LIGHT_SAMPLES = 32;

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
function drawSteppedLight(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  const steps = [1, 0.72, 0.48, 0.3, 0.16];
  for (let i = 0; i < steps.length; i++) {
    const alpha = steps[i] * 0.22;
    const stepRadius = radius * ((steps.length - i) / steps.length);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, stepRadius), 0, Math.PI * 2);
    ctx.fill();
  }
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
      const statusEffects = useSummons.getState().statusEffects;
      const enemies = useEnemies.getState().enemies;
      const lightningEffects = useVisualEffects.getState().lightningEffects;

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
              25,
          cy +
            (muzzleFlashPosition.z - playerPosition.z) *
              25,
          800
        );
      }

      // 3. Impact effects (limited influence)
      for (let i = 0; i < impactEffects.length; i++) {
        const e = impactEffects[i];

        drawLight(
          ctx,
          cx + (e.x - playerPosition.x) * 25,
          cy + (e.y - playerPosition.z) * 25,
          e.size * 1.2
        );
      }
      for (const effect of statusEffects) {
        if (effect.type !== "burn") continue;
        const enemy = enemies.find(e => e.id === effect.enemyId);
        if (!enemy) continue;
        drawSteppedLight(
          ctx,
          cx + (enemy.position.x - playerPosition.x) * 25,
          cy + (enemy.position.z - playerPosition.z) * 25,
          105,
        );
      }
      for (const l of lightningEffects) {
        drawSteppedLight(
          ctx,
          cx + (l.x - playerPosition.x) * 25,
          cy + (l.y - playerPosition.z) * 25,
          210,
        );
      }

      // 4. XP orbs (small soft glow)
      for (let i = 0; i < xpOrbs.length; i++) {
        const o = xpOrbs[i];

        drawLight(
          ctx,
          cx + (o.position.x - playerPosition.x) * 25,
          cy + (o.position.z - playerPosition.z) * 25,
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
