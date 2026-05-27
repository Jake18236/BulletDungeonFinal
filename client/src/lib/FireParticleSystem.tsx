import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
type FireParticle = {
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  maxLife: number;
  frame: number;
  active: boolean;
};

export class FireParticleSystem {
  particles: FireParticle[];
  private poolIndex = 0;

  private frameSize = 8;
  private frameCount = 6;

  constructor(private max = 300000) {
    this.particles = Array.from({ length: max }, () => ({
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      life: 0,
      maxLife: 0,
      frame: 0,
      active: false,
    }));
  }

  emit(x: number, z: number) {
    // Use pool index to avoid searching from the beginning every time
    let attempts = 0;
    while (attempts < this.max) {
      const p = this.particles[this.poolIndex];
      this.poolIndex = (this.poolIndex + 1) % this.max;
      attempts++;

      if (!p.active) {
        p.active = true;

        p.x = x + (Math.random() - 0.5) * 1.0;
        p.z = z + (Math.random() - 0.5) * 1.5;

        p.vx = (Math.random() - 0.5) * 0.6;
        p.vz = -Math.random() * 1.5;

        p.life = p.maxLife = 2000 + Math.random() * 20;
        return;
      }
    }
  }

  update() {
    for (const p of this.particles) {
      if (!p.active) continue;

      p.life--;

      p.x += p.vx*0.01;
      p.z += p.vz*0.04;
      

      const age = p.maxLife - p.life;

  p.frame = Math.floor(age / 5);

  if (p.frame >= this.frameCount) {
    p.active = false;
  }
    }
  }

  draw(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLImageElement,
  centerX: number,
  centerY: number,
  playerX: number,
  playerZ: number,
  tileSize: number
) {
  const fw = this.frameSize;
  const fh = this.frameSize;

  for (const p of this.particles) {
    if (!p.active) continue;

    const sx = p.frame * fw;
    const sy = 0;

    const screenX =
      centerX +
      ((p.x - playerX) * tileSize) / 2;

    const screenY =
      centerY +
      ((p.z - playerZ) * tileSize) / 2;

    const size = fw * 3;

    ctx.drawImage(
      sprite,
      sx,
      sy,
      fw,
      fh,
      screenX - size / 2,
      screenY - size / 2,
      size,
      size
    );
  };
  }
}