import { useEffect, useState } from "react";

export const BASE_SPRITE_SIZE = 32; // native sprite resolution
export const BASE_SCALE = 3;        // global pixel upscaling factor

export type SpriteDef = {
  img: HTMLImageElement;
  size: number; // sprite pixel resolution
  scale: number;    // relative world/UI size
};

export type EnemySpriteType = "basic" | "tank" | "eyeball";

export const WeaponSprites = {
  revolver: (() => {
    const img = new Image();
    img.src = "/sprites/revolver.png";
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
  const size = BASE_SPRITE_SIZE * BASE_SCALE;

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
  const size = BASE_SPRITE_SIZE * BASE_SCALE;

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

export function CursorSprite({ x, y }: CursorSpriteProps) {

  const scale = 0.5;
  const size = 32 * BASE_SCALE * scale;
  const half = size / 2;

  return (
    <img
      src="/sprites/crosshair.png"
      draggable={false}
      className="cursor-sprite image-rendering-pixelated"
      style={{
        width: size,
        height: size,
        left: Math.round(x - half),
        top: Math.round(y - half),
      }}
    />
  );
}

let projectileImage: HTMLImageElement | null = null;

export function getProjectileImage() {
  if (!projectileImage) {
    projectileImage = new Image();
    projectileImage.src = "/sprites/bullet.png";
  }
  return projectileImage;
}


const createEnemySprite = (src: string, size = 32, scale = 2): SpriteDef => ({
  img: (() => {
    const img = new Image();
    img.src = src;
    return img;
  })(),
  size,
  scale,
});

export const enemySpritesByType: Record<EnemySpriteType, SpriteDef> = {
  basic: createEnemySprite("/sprites/enemy/basic-enemy.png", 32, 2),
  tank: createEnemySprite("/sprites/enemy/tank-enemy.png", 32, 2.5),
  eyeball: createEnemySprite("/sprites/enemy/eyeball-enemy.png", 32, 1.8),
};

export const enemyEyeSpritesByType: Record<EnemySpriteType, SpriteDef> = {
  basic: createEnemySprite("/sprites/enemy/basic-enemy-eyes.png", 32, 2),
  tank: createEnemySprite("/sprites/enemy/tank-enemy-eyes.png", 32, 2.5),
  eyeball: createEnemySprite("/sprites/enemy/eyeball-enemy-eyes.png", 32, 1.8),
};

export const enemySprite = enemySpritesByType.basic;

export const enemyFlashSprite: SpriteDef = {
  img: (() => {
    const img = new Image();
    img.src = "/sprites/enemy-flash.png";
    return img;
  })(),

  scale: 2.0,
  size: 32,
};

export const bossEnemySprite: SpriteDef = {
  img: enemySprite.img,
  size: 32,
  scale: 2.2,
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
  img.src = "/sprites/enemy/enemy-eyeball-projectile.png";
  return img;
})();

export const enemyDeathSpritesheet = (() => {
  const img = new Image();
  img.src = "/sprites/enemy/enemy-death-spritesheet.png";
  return img;
})();

export const VisualSprites = {
  impactSheet: (() => {
    const img = new Image();
    img.src = "/sprites/impact-spritesheet.png"; // your spritesheet
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
