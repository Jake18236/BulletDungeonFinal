
export const WeaponSprites = {
  revolver: (() => {
    const img = new Image();
    img.src = "/sprites/revolver.png"; // adjust path if needed
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
  return (
    <div className="heart-hud">
      {Array.from({ length: maxHP }).map((_, i) => {
        const filled = i < currentHP;

        return (
          <img
            key={i}
            src="/sprites/heart.png"
            alt=""
            draggable={false}
            className={`heart ${filled ? "full" : "empty"}`}
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
  return (
    <div className="ammo-hud">
      {Array.from({ length: maxAmmo }).map((_, i) => {
        const filled = i < ammo;

        return (
          <img
            key={i}
            src="/sprites/ammo.png"
            alt=""
            draggable={false}
            className={`ammo ${filled ? "full" : "empty"}`}
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
      src="/sprites/crosshair.png"
      draggable={false}
      className="cursor-sprite"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 9999,
        width: size,
        height: size,
        imageRendering: 'pixelated'
      }}
    />
  );
}


export const enemySprite = new Image();
enemySprite.src = "/sprites/enemy.png";
export const ENEMY_SPRITE_SIZE = 64;
export const ENEMY_BOSS_SPRITE_SIZE = 64;

