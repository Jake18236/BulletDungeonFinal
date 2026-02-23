import { useEffect, useRef } from "react";
import { usePlayer } from "../lib/stores/usePlayer";
import { useEnemies } from "../lib/stores/useEnemies";

const CANVAS_WIDTH = 1490;
const CANVAS_HEIGHT = 750;
const TILE_SIZE = 50;
const WORLD_TO_SCREEN_SCALE = TILE_SIZE;
const PIXEL_SIZE = 4;
const LIGHT_LEVELS = [0.35, 0.24, 0.14] as const;

function drawThreeStepLight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
) {
  const radii = [radius * 0.38, radius * 0.68, radius] as const;

  LIGHT_LEVELS.forEach((alpha, index) => {
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, radii[index], 0, Math.PI * 2);
    ctx.fill();
  });
}

export default function Darkness() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const lightCanvasRef = useRef<HTMLCanvasElement>();
  const darknessCanvasRef = useRef<HTMLCanvasElement>();

  const { position: playerPosition, isFiring } = usePlayer();
  const { xpOrbs } = useEnemies();

  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (!lightCanvasRef.current) {
        lightCanvasRef.current = document.createElement("canvas");
        lightCanvasRef.current.width = Math.floor(CANVAS_WIDTH / PIXEL_SIZE);
        lightCanvasRef.current.height = Math.floor(CANVAS_HEIGHT / PIXEL_SIZE);
      }

      if (!darknessCanvasRef.current) {
        darknessCanvasRef.current = document.createElement("canvas");
        darknessCanvasRef.current.width = Math.floor(CANVAS_WIDTH / PIXEL_SIZE);
        darknessCanvasRef.current.height = Math.floor(CANVAS_HEIGHT / PIXEL_SIZE);
      }

      const lightCtx = lightCanvasRef.current.getContext("2d");
      const darknessCtx = darknessCanvasRef.current.getContext("2d");
      if (!lightCtx || !darknessCtx) return;

      const scaledWidth = lightCanvasRef.current.width;
      const scaledHeight = lightCanvasRef.current.height;
      const centerX = scaledWidth / 2;
      const centerY = scaledHeight / 2;

      lightCtx.clearRect(0, 0, scaledWidth, scaledHeight);
      lightCtx.globalCompositeOperation = "source-over";
      lightCtx.globalCompositeOperation = "lighter";

      const playerRadius = (210 + (isFiring ? 18 : 0)) / PIXEL_SIZE;
      drawThreeStepLight(lightCtx, centerX, centerY, playerRadius);

      xpOrbs.forEach((orb) => {
        const x =
          centerX +
          ((orb.position.x - playerPosition.x) * WORLD_TO_SCREEN_SCALE) / PIXEL_SIZE;

        const y =
          centerY +
          ((orb.position.z - playerPosition.z) * WORLD_TO_SCREEN_SCALE) / PIXEL_SIZE;

        drawThreeStepLight(lightCtx, x, y, 36 / PIXEL_SIZE);
      });

      darknessCtx.clearRect(0, 0, scaledWidth, scaledHeight);
      darknessCtx.globalCompositeOperation = "source-over";
      darknessCtx.fillStyle = "rgba(0,0,0,0.86)";
      darknessCtx.fillRect(0, 0, scaledWidth, scaledHeight);

      darknessCtx.globalCompositeOperation = "destination-out";
      darknessCtx.drawImage(lightCanvasRef.current, 0, 0);
      darknessCtx.globalCompositeOperation = "source-over";

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        darknessCanvasRef.current,
        0,
        0,
        scaledWidth,
        scaledHeight,
        0,
        0,
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
      );


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
        imageRendering: "pixelated",
      }}
    />
  );
}
