export interface CameraTarget {
  x: number;
  y: number;
}

export interface CameraMouse {
  x: number;
  y: number;
}

export interface CameraShake {
  strength: number;
  durationMs: number;
}

interface ActiveCameraShake {
  strength: number;
  remainingMs: number;
  durationMs: number;
}

export interface CameraUpdateOptions {
  deltaSeconds: number;
  target: CameraTarget;
  mouse: CameraMouse;
  viewportWidth: number;
  viewportHeight: number;
}

export interface CameraCenter {
  x: number;
  y: number;
}

export interface PixelPerfectScale {
  scale: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export function getPixelPerfectScale(
  referenceWidth: number,
  referenceHeight: number,
  availableWidth: number,
  availableHeight: number,
): PixelPerfectScale {
  const scale = Math.max(1, Math.floor(Math.min(availableWidth / referenceWidth, availableHeight / referenceHeight)));
  const width = referenceWidth * scale;
  const height = referenceHeight * scale;

  return {
    scale,
    width,
    height,
    offsetX: Math.floor((availableWidth - width) / 2),
    offsetY: Math.floor((availableHeight - height) / 2),
  };
}

export class GameCamera2D {
  private pullX = 0;
  private pullY = 0;
  private activeShakes: ActiveCameraShake[] = [];
  private shakeX = 0;
  private shakeY = 0;

  constructor(
    private readonly maxMousePullPx = 50,
    private readonly smoothing = 8,
  ) {}

  update(options: CameraUpdateOptions) {
    const {
      deltaSeconds,
      mouse,
      viewportWidth,
      viewportHeight,
    } = options;

    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;
    const mouseDx = mouse.x - centerX;
    const mouseDy = mouse.y - centerY;
    const distance = Math.hypot(mouseDx, mouseDy);
    const pullFactor = distance > 0 ? Math.min(1, distance / 260) : 0;

    const targetPullX = distance > 0 ? (mouseDx / distance) * this.maxMousePullPx * pullFactor : 0;
    const targetPullY = distance > 0 ? (mouseDy / distance) * this.maxMousePullPx * pullFactor : 0;

    const blend = 1 - Math.exp(-this.smoothing * deltaSeconds);
    this.pullX += (targetPullX - this.pullX) * blend;
    this.pullY += (targetPullY - this.pullY) * blend;

    if (this.activeShakes.length > 0) {
      const deltaMs = deltaSeconds * 1000;
      let combinedStrength = 0;

      this.activeShakes = this.activeShakes
        .map((shake) => {
          const remainingMs = Math.max(0, shake.remainingMs - deltaMs);
          const intensity = shake.durationMs > 0 ? remainingMs / shake.durationMs : 0;
          combinedStrength += shake.strength * intensity;
          return {
            ...shake,
            remainingMs,
          };
        })
        .filter((shake) => shake.remainingMs > 0);

      const strength = combinedStrength * 30;
      const targetX = (Math.random() * 2 - 1) * strength;
      const targetY = (Math.random() * 2 - 1) * strength;

      const shakeBlend = 1 - Math.exp(-25 * deltaSeconds);
      this.shakeX += (targetX - this.shakeX) * shakeBlend;
      this.shakeY += (targetY - this.shakeY) * shakeBlend;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  shake({ strength, durationMs }: CameraShake) {
    if (durationMs <= 0 || strength <= 0) return;
    this.activeShakes.push({
      strength,
      durationMs,
      remainingMs: durationMs,
    });
  }

  getRenderOffset() {
    return {
      x: -this.pullX + this.shakeX,
      y: -this.pullY + this.shakeY,
    };
  }

  getPlayerScreenCenter(viewportWidth: number, viewportHeight: number): CameraCenter {
    const renderOffset = this.getRenderOffset();
    return {
      x: viewportWidth / 2 + renderOffset.x,
      y: viewportHeight / 2 + renderOffset.y,
    };
  }

  worldToScreen(
    world: CameraTarget,
    focus: CameraTarget,
    viewportWidth: number,
    viewportHeight: number,
    worldUnitsToPixels: number,
  ): CameraCenter {
    const center = this.getPlayerScreenCenter(viewportWidth, viewportHeight);
    return {
      x: center.x + (world.x - focus.x) * worldUnitsToPixels,
      y: center.y + (world.y - focus.y) * worldUnitsToPixels,
    };
  }
}
