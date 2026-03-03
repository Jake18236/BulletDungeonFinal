export const BASE_SPRITE_SIZE = 32; // native sprite resolution
export const GLOBAL_SCALE = 2;
export const BASE_SCALE = GLOBAL_SCALE; // global pixel upscaling factor

const loadImage = (src: string) => {
  const img = new Image();
  img.src = src;
  return img;
};

export type SpriteDef = {
  img: HTMLImageElement;
  size: number; // sprite pixel resolution
  scale: number;    // relative world/UI size
};

export type EnemySpriteType = "basic" | "tank" | "eyeball" | "tree";

export const WeaponSprites = {
  revolver: loadImage("/sprites/revolver.png"),
};

export const UI_SPRITES = {
  levelUpBeamSheet: "/sprites/upgrades/level-up-spritesheet.png",
  containerSheet: "/sprites/upgrades/containers-spritesheet.png",
  upgradesSheet: "/sprites/upgrades/upgrades-spritesheet.png",
  heart: "/sprites/heart.png",
  ammo: "/sprites/ammo.png",
  crosshair: "/sprites/crosshair.png",
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
            src={UI_SPRITES.heart}
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
            src={UI_SPRITES.ammo}
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
  const size = 32;
  const half = size / 2;

  return (
    <img
      src={UI_SPRITES.crosshair}
      draggable={false}
      className="cursor-sprite image-rendering-pixelated"
      style={{
        width: size,
        height: size,
        left: Math.floor(x - half),
        top: Math.floor(y - half),
      }}
    />
  );
}

let projectileImage: HTMLImageElement | null = null;

export function getProjectileImage() {
  if (!projectileImage) {
    projectileImage = new Image();
    projectileImage.src = "/sprites/bulletF.png";
  }
  return projectileImage;
}

let enemyProjectileImage: HTMLImageElement | null = null;

const createEnemySprite = (src: string, size = 32, scale = GLOBAL_SCALE): SpriteDef => ({
  img: loadImage(src),
  size,
  scale,
});

export const enemySpritesByType: Record<EnemySpriteType, SpriteDef> = {
  basic: createEnemySprite("/sprites/enemy/basic-enemy.png", 32, GLOBAL_SCALE),
  tank: createEnemySprite("/sprites/enemy/tank-enemy.png", 48, GLOBAL_SCALE),
  eyeball: createEnemySprite("/sprites/enemy/eyeball-enemy.png", 48, GLOBAL_SCALE),
  tree: createEnemySprite("/sprites/enemy/tree-enemy.png", 48, GLOBAL_SCALE),
};

export const enemyEyeSpritesByType: Record<EnemySpriteType, SpriteDef> = {
  basic: createEnemySprite("/sprites/enemy/basic-enemy-eyes.png", 32, GLOBAL_SCALE),
  tank: createEnemySprite("/sprites/enemy/tank-enemy-eyes.png", 48, GLOBAL_SCALE),
  eyeball: createEnemySprite("/sprites/enemy/eyeball-enemy-eyes.png", 48, GLOBAL_SCALE),
  tree: createEnemySprite("/sprites/enemy/tree-enemy-eyes.png", 96, GLOBAL_SCALE),
};

export const enemySprite = enemySpritesByType.basic;

export const bossEnemySprite: SpriteDef = {
  img: enemySprite.img,
  size: 32,
  scale: GLOBAL_SCALE,
};

export const xpSprite = loadImage("/sprites/xp.png");

export const SummonSprites = {
  ghostSheet: loadImage("/sprites/ghost-spritesheet.png"),
  scythe: loadImage("/sprites/scythe.png"),
  dagger: loadImage("/sprites/dagger.png"),
};

export const enemyEyeballProjectileSprite = loadImage("/sprites/enemy/enemy-projectile.png");

export const enemyDeathSpritesheet = loadImage("/sprites/enemy/enemy-death-spritesheet.png");

export const lazarusBossSpriteSheet = loadImage("/sprites/enemy/lazarus-boss.png");

export const bossLaserSpriteSheet = loadImage("/sprites/enemy/boss-laser.png");

export const bossLaserContinueSprite = loadImage("/sprites/enemy/boss-laser-continued.png");

export const bossLaserWindupSprite = loadImage("/sprites/enemy/boss-laser-windup.png");

export const VisualSprites = {
  impactSheet: loadImage("/sprites/impact-spritesheet.png"),
  muzzleFlash: loadImage("/sprites/muzzle-flash.png"),
};

export const EnvironmentSprites = {
  grass: loadImage("/textures/grass.png"),
  treeEnemy: loadImage("/sprites/enemy/tree-enemy.png"),
  treeEnemyEyes: loadImage("/sprites/enemy/tree-enemy-eyes.png"),
  electricityLine: loadImage("/sprites/electricity-line-spritesheet.png"),
  tentacleSheet: loadImage("/sprites/tentacle-spritesheet.png"),
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
