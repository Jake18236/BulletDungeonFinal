import { useEffect, useRef } from "react";
import { usePlayer } from "../lib/stores/usePlayer";
import { useEnemies } from "../lib/stores/useEnemies";
import * as THREE from "three";

const CANVAS_WIDTH = 1490;
const CANVAS_HEIGHT = 750;
const TILE_SIZE = 50;

interface LightSource {
  x: number; // Screen position
  y: number;
  innerRadius: number; // Fully bright
  middleRadius: number; // Partial darkness
  outerRadius: number; // Deep darkness fade
  intensity?: number; // 0-1, optional for dimmer lights
}

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

      
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

     
      ctx.globalCompositeOperation = "destination-out";

      const centerX = CANVAS_WIDTH / 2;
      const centerY = CANVAS_HEIGHT / 2;

      
      const lights: LightSource[] = [];

      lights.push({
        x: centerX,
        y: centerY,
        innerRadius: 200,  // Fully visible
        middleRadius: 600, // Dimmed
        outerRadius: 800,  // Dark edge
        intensity: 1,
      });

      
      if (isFiring) {
        lights.push({
          x: centerX,
          y: centerY,
          innerRadius: 150,
          middleRadius: 160,
          outerRadius: 170,
          intensity: 0.6, // Slightly dimmer than player base light
        });
      }

      //XP ORB LIGHTS
      xpOrbs.forEach((orb) => {
        const screenX = centerX + ((orb.position.x - playerPosition.x) * TILE_SIZE) / 2;
        const screenY = centerY + ((orb.position.z - playerPosition.z) * TILE_SIZE) / 2;

        // Only render lights for orbs that are on screen
        if (
          screenX >= -50 &&
          screenX <= CANVAS_WIDTH + 50 &&
          screenY >= -50 &&
          screenY <= CANVAS_HEIGHT + 50
        ) {
          lights.push({
            x: screenX,
            y: screenY,
            innerRadius: 15,
            middleRadius: 30,
            outerRadius: 50,
            intensity: 0.6,
          });
        }
      });

      // Draw each light source
      lights.forEach((light) => {
        const gradient = ctx.createRadialGradient(
          light.x,
          light.y,
          0,
          light.x,
          light.y,
          light.outerRadius
        );

        const intensity = light.intensity ?? 1.0;

        const innerStop = light.innerRadius / light.outerRadius;
        const middleStop = light.middleRadius / light.outerRadius;

        gradient.addColorStop(0, `rgba(0, 0, 0, ${intensity})`); // Fully transparent
        gradient.addColorStop(innerStop, `rgba(0, 0, 0, ${intensity * 0.9})`);
        gradient.addColorStop(middleStop, `rgba(0, 0, 0, ${intensity * 0.5})`); // Partial
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)"); // Fade to nothing

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(light.x, light.y, light.outerRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Reset composite operation
      ctx.globalCompositeOperation = "source-over";

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
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