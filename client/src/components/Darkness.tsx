import { useEffect, useRef } from "react";
import { usePlayer } from "../lib/stores/usePlayer";
import { useEnemies } from "../lib/stores/useEnemies";

const CANVAS_WIDTH = 1490;
const CANVAS_HEIGHT = 750;
const TILE_SIZE = 50;
const WORLD_TO_SCREEN_SCALE = TILE_SIZE;

export default function Darkness() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  const { position: playerPosition, isFiring } = usePlayer();
  const { xpOrbs } = useEnemies();

  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Base darkness
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.globalCompositeOperation = "destination-out";

      const centerX = CANVAS_WIDTH / 2;
      const centerY = CANVAS_HEIGHT / 2;

      // --- PLAYER LIGHT (guaranteed circular) ---
      const radius = 210 + (isFiring ? 18 : 0);

      const playerGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius
      );

      playerGradient.addColorStop(0.0, "rgba(0,0,0,1)");
      playerGradient.addColorStop(0.7, "rgba(0,0,0,0.8)");
      playerGradient.addColorStop(0.8, "rgba(0,0,0,0.45)");
      playerGradient.addColorStop(0.85, "rgba(0,0,0,0.2)");
      playerGradient.addColorStop(1.0, "rgba(0,0,0,0)");

      ctx.fillStyle = playerGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      // --- XP LIGHTS (correct world → screen mapping) ---
      xpOrbs.forEach((orb) => {
        const WORLD_SCALE = WORLD_TO_SCREEN_SCALE;

        const x =
          centerX + (orb.position.x - playerPosition.x) * WORLD_SCALE;

        const y =
          centerY + (orb.position.z - playerPosition.z) * WORLD_SCALE;


        const orbRadius = 36;

        const orbGradient = ctx.createRadialGradient(
          x,
          y,
          0,
          x,
          y,
          orbRadius
        );

        orbGradient.addColorStop(0, "rgba(0,0,0,0.9)");
        orbGradient.addColorStop(1, "rgba(0,0,0,0)");

        ctx.fillStyle = orbGradient;
        ctx.beginPath();
        ctx.arc(x, y, orbRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalCompositeOperation = "source-over";


      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [playerPosition, xpOrbs, isFiring]);

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
      }}
    />
  );
}
