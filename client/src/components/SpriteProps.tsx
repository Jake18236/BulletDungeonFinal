import { useEffect, useState, useRef } from "react";
import { useGame } from "../lib/stores/useGame";
import { usePlayer } from "../lib/stores/usePlayer";


export type SpriteIcon = {
  normal: string;
  selected: string;
};

export const BASE_SPRITE_SIZE = 32; // native sprite resolution
export const BASE_SCALE = 2;        // global pixel upscaling factor

export type SpriteDef = {
  img: HTMLImageElement;
  size: number; // sprite pixel resolution
  scale: number;    // relative world/UI size
};

export type EnemySpriteType = "basic" | "tank" | "eyeball" | "tree";

export const WeaponSprites = {
  revolver: (() => {
    const img = new Image();
    img.src = "/sprites/revolver-spritesheet.png";
    return img;
  })(),
};

export function UpgradeIcon({
  icon,
  selected,
  className = "",
}: {
  icon: SpriteIcon | string;
  selected?: boolean;
  className?: string;
}) {
  if (typeof icon === "string") {
    return <span className={className}>{icon}</span>;
  }

  return (
    <img
      src={selected ? icon.selected : icon.normal}
      alt=""
      draggable={false}
      className={`image-rendering-pixelated select-none ${className}`}
    />
  );
}

type HeartHUDProps = {
  currentHP: number;
  maxHP: number;
};

export function HeartHUD({ currentHP, maxHP }: HeartHUDProps) {
  const size = BASE_SPRITE_SIZE * BASE_SCALE * 1.5;

  return (
    <div className="heart-hud">
      {Array.from({ length: maxHP }).map((_, i) => {
        const filled = i < currentHP;

        return (
          <img
            key={i}
            src="/sprites/heart.png"
            draggable={false}
            style={{
              width: size,
              height: size,
            }}
            className={`heart ${filled ? "full" : "empty"} image-rendering-pixelated`}
          />
        );
      })}
    </div>
  );
}

type AmmoHUDProps = {
  ammo: number;
  maxAmmo: number;
};

export function AmmoHUD({ ammo, maxAmmo }: AmmoHUDProps) {
  const size = BASE_SPRITE_SIZE * BASE_SCALE * 1.5;

  return (
    <div className="ammo-hud">
      {Array.from({ length: maxAmmo }).map((_, i) => {
        const filled = i < ammo;

        return (
          <img
            key={i}
            src="/sprites/ammo.png"
            draggable={false}
            style={{
              width: size,
              height: size,
            }}
            className={`ammo ${filled ? "full" : "empty"} image-rendering-pixelated`}
          />
        );
      })}
    </div>
  );
}

type CursorSpriteProps = {
  x: number;
  y: number;
};

export const cursorSprite = (() => {
  const img = new Image();
  img.src = "/sprites/crosshair.png";
  return img;
})();

let projectileImage: HTMLImageElement | null = null;

export function getProjectileImage() {
  if (!projectileImage) {
    projectileImage = new Image();
    projectileImage.src = "/sprites/bulletB.png";
  }
  return projectileImage;
}

let enemyProjectileImage: HTMLImageElement | null = null;

const createEnemySprite = (src: string, size = 32, scale = BASE_SCALE): SpriteDef => ({
  img: (() => {
    const img = new Image();
    img.src = src;
    return img;
  })(),
  size,
  scale,
});

export const enemySpritesByType: Record<EnemySpriteType, SpriteDef> = {
  basic: createEnemySprite("/sprites/enemy/basic-enemy.png", 32, BASE_SCALE),
  tank: createEnemySprite("/sprites/enemy/tank-enemy.png", 48, BASE_SCALE),
  eyeball: createEnemySprite("/sprites/enemy/eyeball-enemy.png", 48, BASE_SCALE),
  tree: createEnemySprite("/sprites/enemy/tree-enemy.png", 48, BASE_SCALE),
};

export const enemyEyeSpritesByType: Record<EnemySpriteType, SpriteDef> = {
  basic: createEnemySprite("/sprites/enemy/basic-enemy-eyes.png", 32, BASE_SCALE),
  tank: createEnemySprite("/sprites/enemy/tank-enemy-eyes.png", 48, BASE_SCALE),
  eyeball: createEnemySprite("/sprites/enemy/eyeball-enemy-eyes.png", 48, BASE_SCALE),
  tree: createEnemySprite("/sprites/enemy/tree-enemy-eyes.png", 96, BASE_SCALE),
};

export function drawNineSlice(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
) {
  const c = 10;     // source corner size
  const sc = c * scale; // destination corner size = 50

  const iw = image.width;
  const ih = image.height;

  const midW = iw - c * 2;
  const midH = ih - c * 2;

  const destMidW = width - sc * 2;
  const destMidH = height - sc * 2;

  // safety clamp
  if (destMidW < 0 || destMidH < 0) return;

  // ───────── CORNERS (scaled up) ─────────

  // TL
  ctx.drawImage(image, 0, 0, c, c, x, y, sc, sc);

  // TR
  ctx.drawImage(image, iw - c, 0, c, c, x + width - sc, y, sc, sc);

  // BL
  ctx.drawImage(image, 0, ih - c, c, c, x, y + height - sc, sc, sc);

  // BR
  ctx.drawImage(image, iw - c, ih - c, c, c, x + width - sc, y + height - sc, sc, sc);

  // ───────── EDGES ─────────

  // top
  ctx.drawImage(image, c, 0, midW, c, x + sc, y, destMidW, sc);

  // bottom
  ctx.drawImage(image, c, ih - c, midW, c, x + sc, y + height - sc, destMidW, sc);

  // left
  ctx.drawImage(image, 0, c, c, midH, x, y + sc, sc, destMidH);

  // right
  ctx.drawImage(image, iw - c, c, c, midH, x + width - sc, y + sc, sc, destMidH);

  // ───────── CENTER ─────────

  ctx.drawImage(
    image,
    c, c, midW, midH,
    x + sc, y + sc,
    destMidW, destMidH
  );
}

export const frameSprite = (() => {
  const img = new Image();
  img.src = "/sprites/frame-sprite.png";
  return img;
})();

export const enemySprite = enemySpritesByType.basic;

export const bossEnemySprite: SpriteDef = {
  img: enemySprite.img,
  size: 32,
  scale: BASE_SCALE,
};

export const xpSprite = (() => {
  const img = new Image();
  img.src = "/sprites/xp.png";
  return img;
})();

export const SummonSprites = {
  ghostSheet: (() => {
    const img = new Image();
    img.src = "/sprites/ghost-spritesheet.png";
    return img;
  })(),
  scythe: (() => {
    const img = new Image();
    img.src = "/sprites/scythe.png";
    return img;
  })(),
  dagger: (() => {
    const img = new Image();
    img.src = "/sprites/dagger.png";
    return img;
  })(),
};

export const enemyEyeballProjectileSprite = (() => {
  const img = new Image();
  img.src = "/sprites/enemy/enemy-projectile.png";
  return img;
})();

export const enemyDeathSpritesheet = (() => {
  const img = new Image();
  img.src = "/sprites/enemy/enemy-death-spritesheet.png";
  return img;
})();

export const lazarusBossSpriteSheet = (() => {
  const img = new Image();
  img.src = "/sprites/enemy/shoggoth-boss.png";
  return img;
})();

export const bossLaserSpriteSheet = (() => {
  const img = new Image();
  img.src = "/sprites/enemy/boss-laser.png";
  return img;
})();

export const bossLaserContinueSprite = (() => {
  const img = new Image();
  img.src = "/sprites/enemy/boss-laser-continued.png";
  return img;
})();

export const bossLaserWindupSprite = (() => {
  const img = new Image();
  img.src = "/sprites/enemy/boss-laser-windup.png";
  return img;
})();

export const octopusBossSpriteSheet = (() => {
  const img = new Image();
  img.src = "/sprites/enemy/octopus-boss.png";
  return img;
})();

export const crowEnemySpriteSheet = (() => {
  const img = new Image();
  img.src = "/sprites/enemy/crow-enemy.png";
  return img;
})();

export const mageEnemySpriteSheet = (() => {
  const img = new Image();
  img.src = "/sprites/enemy/mage-enemy.png";
  return img;
})();

export const VisualSprites = {
  impactSheet: (() => {
    const img = new Image();
    img.src = "/sprites/impact-spritesheet.png"; // your spritesheet
    return img;
  })(),
  muzzleFlash: (() => {
    const img = new Image();
    img.src = "/sprites/muzzle-flash.png";
    return img;
  })(),
  bigExplosion: (() => {
    const img = new Image();
    img.src = "/sprites/other-explosion.png";
    return img;
  })(),
  lightning: (() => {
    const img = new Image();
    img.src = "/sprites/lightning.png";
    return img;
  })(),
};



export const xpBarFillSprite = "/sprites/xp-bar-fill.png";
export const xpBarFrameSprite = "/sprites/xp-bar-frame.png";


export const XP_BAR_BASE_WIDTH = 256;
export const XP_BAR_BASE_HEIGHT = 8;
export const XP_BAR_SCALE = 3;

export const XP_BAR_WIDTH = XP_BAR_BASE_WIDTH * XP_BAR_SCALE;

export const XP_BAR_HEIGHT = XP_BAR_BASE_HEIGHT * XP_BAR_SCALE;


type XPHUDProps = {
  xp: number;
  xpToNextLevel: number;
};