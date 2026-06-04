import { useEffect, useRef, useState } from "react";
import { useGame } from "../lib/stores/useGame";
import { usePlayer } from "../lib/stores/usePlayer";
import { useAudio } from "../lib/stores/useAudio";
import { useEnemies } from "../lib/stores/useEnemies";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../components/CanvasGame"

import { Button } from "./ui/button";

import { Volume2, VolumeX } from "lucide-react";
import { HeartHUD, AmmoHUD, frameSprite, drawNineSlice } from "./SpriteProps";
import { Slider } from "./ui/slider";
import fontJson from "./Lantern.json";
import { buildFont, drawBitmapText, drawWrappedText } from "../lib/font";
const font = buildFont(fontJson);

const fontWhiteImage = new Image();
fontWhiteImage.src = "/sprites/font-atlas-white.png";

const fontRedImage = new Image();
fontRedImage.src = "/sprites/font-atlas-red.png";

const CONTAINER_SPRITESHEET = "/sprites/upgrades/container-spritesheet.png";
const UPGRADES_SPRITESHEET = "/sprites/upgrade-spritesheet.png";

const SHEET_COLS = 9;
const TILE_SIZE = 32;

function getIconUV(iconIndex: number) {
  const i = iconIndex - 1;
  const col = i % SHEET_COLS;
  const row = Math.floor(i / SHEET_COLS);
  return { col, row };
}

// ─── Pixel-art canvas panel used by Start + Death screens ───────────────────
function PixelPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-1/2 top-0 -translate-x-1/2 w-full max-w-2xl px-4 pointer-events-auto">
      {children}
    </div>
  );
}

function NineSliceCanvas({
  width,
  height,
  draw,
  deps,
  style,
}: {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  deps: unknown[];
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);
    draw(ctx, width, height);
  }, [draw, width, height, ...deps]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ display: "block", imageRendering: "pixelated", ...style }}
    />
  );
}

// ─── Pixel button (bitmap text only, no frame) ────────────────────────────────
function PixelButton({
  label,
  onClick,
  width = 240,
  height = 60,
  ready,
  scale = 2,
}: {
  label: string;
  onClick: () => void;
  width?: number;
  height?: number;
  ready: boolean;
  scale?: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => { if (ready) onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ width, height, cursor: ready ? "pointer" : "default" }}
    >
      <NineSliceCanvas
        width={width}
        height={height}
        deps={[hovered, ready, scale]}
        draw={(ctx, w, h) => {
          drawBitmapText(
            ctx,
            label,
            w / 2,
            h / 2,
            font,
            hovered ? fontWhiteImage : fontRedImage,
            { align: "center", baseline: "middle", scale }
          );
        }}
      />
    </div>
  );
}

// ─── Start Screen ─────────────────────────────────────────────────────────────
function StartScreen({ onStart }: { onStart: () => void }) {
  const { isMuted, toggleMute, masterVolume, setVolume } = useAudio();
  const [menuScreen, setMenuScreen] = useState<"main" | "settings" | "controls">("main");
  const [animPhase, setAnimPhase] = useState<"dropdown" | "ready">("dropdown");
  const [showInGameInstructions, setShowInGameInstructions] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  
  useEffect(() => {
    setAnimPhase("dropdown");
    const t = setTimeout(() => setAnimPhase("ready"), 1000);
    return () => clearTimeout(t);
  }, []);

  const ready = animPhase === "ready";
  
  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="absolute inset-0 bg-black" 
        />
      <div className="absolute inset-0 menu-glow pointer-events-none" />
<div
          className="absolute left-1/2 top-1 -translate-x-1/2"
          style={{ opacity: ready ? 1 : 0, transition: "opacity 0.3s ease" }}
        >
          <NineSliceCanvas
            width={800}
            height={200}
            deps={[]}
            draw={(ctx, w, h) =>
              drawBitmapText(ctx, "BULLET ROGUELIKE", w/2, h/2, font, fontRedImage, {
                align: "center",
                baseline: undefined,
                scale: 4
              })           
            }
          />        
        </div>
      
        {/* Title */}
        
        
        
        
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
        >
        <div
          className="flex flex-col items-center gap-4"
          style={{
            opacity: ready && !isExiting ? 1 : 0,
            transform: isExiting
              ? "translateY(20px)"
              : ready
                ? "translateY(0)"
                : "translateY(20px)",
            transition:
              "opacity 0.4s ease 0.15s, transform 0.4s ease 0.15s",
          }}
        >
          {menuScreen === "main" && (
            <>
              <PixelButton label="PLAY" onClick={() => {
                  setIsExiting(true);

                  setTimeout(() => {
                    onStart();
                  }, 400); 
                }} ready={ready} width={300} height={50} scale={3} />
              <PixelButton label="SETTINGS" onClick={() => setMenuScreen("settings")} ready={ready} width={300} height={50} scale={2} />
              <PixelButton label="CONTROLS" onClick={() => setMenuScreen("controls")} ready={ready} width={300} height={50} scale={2} />
            </>
          )}
        </div>
          {menuScreen === "settings" && (
            <div className="flex flex-col items-center gap-0 py-2">
              {/* Volume row */}
              <div className="flex items-center gap-0">
                <NineSliceCanvas
                  width={200}
                  height={100}
                  deps={[]}
                  draw={(ctx, w, h) =>
                    drawBitmapText(ctx, "VOLUME", w / 2, h / 2, font, fontWhiteImage, {
                      align: "center", baseline: "middle", scale: 2,
                    })
                  }
                />
                <div style={{ width: 160 }}>
                  <Slider
                    value={[Math.round(masterVolume * 100)]}
                    max={100}
                    step={1}
                    onValueChange={([v]) => setVolume(v / 100)}
                    className="[&_[role=slider]]:border-red-200/80 [&_[role=slider]]:bg-red-100 [&_[role=slider]]:shadow-[0_0_12px_rgba(248,113,113,0.7)] [&_[data-orientation=horizontal]]:h-2 [&_[data-orientation=horizontal]]:bg-red-900/50 [&_[data-orientation=horizontal]>span]:bg-red-500"
                  />
                </div>
                <div
                  onClick={toggleMute}
                  className="cursor-pointer pointer-events-auto"
                  style={{ color: "#fee2e2", opacity: 0.8 }}
                >
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </div>
              </div>

              {/* Help card toggle */}
              <div className="flex items-center gap-4">
                <NineSliceCanvas
                  width={200}
                  height={36}
                  deps={[]}
                  draw={(ctx, w, h) =>
                    drawBitmapText(ctx, "HELP CARD", w / 2, h / 2, font, fontWhiteImage, {
                      align: "center", baseline: "middle", scale: 2,
                    })
                  }
                />
                <PixelButton
                  label={showInGameInstructions ? "ON" : "OFF"}
                  onClick={() => setShowInGameInstructions(p => !p)}
                  ready={ready}
                  width={80}
                  height={40}
                />
              </div>

              <PixelButton label="BACK" onClick={() => setMenuScreen("main")} ready={ready} width={160} height={48} />
            </div>
          )}

          {menuScreen === "controls" && (
            <div className="flex flex-col items-center gap-4 py-2">
              {[
                ["MOVE", "WASD"],
                ["AIM", "MOUSE"],
                ["SHOOT", "LEFT CLICK"],
              ].map(([action, key]) => (
                <div key={action} className="flex items-center gap-6">
                  <NineSliceCanvas
                    width={140}
                    height={36}
                    deps={[]}
                    draw={(ctx, w, h) =>
                      drawBitmapText(ctx, action, w / 2, h / 2, font, fontRedImage, {
                        align: "center", baseline: "middle", scale: 2,
                      })
                    }
                  />
                  <NineSliceCanvas
                    width={220}
                    height={36}
                    deps={[]}
                    draw={(ctx, w, h) =>
                      drawBitmapText(ctx, key, w / 2, h / 2, font, fontWhiteImage, {
                        align: "center", baseline: "middle", scale: 2,
                      })
                    }
                  />
                </div>
              ))}
              <div className="mt-4">
                <PixelButton label="BACK" onClick={() => setMenuScreen("main")} ready={ready} width={160} height={48} />
              </div>
            </div>
          )}
        </div>
      

      <style>{`
        .menu-glow {
          background: radial-gradient(circle at center, rgba(185,28,28,0.4), rgba(0,0,0,0.97) 55%);
          animation: pulseGlow 2400ms ease-in-out infinite;
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Death Screen ─────────────────────────────────────────────────────────────
function DeathScreen({ onRestart }: { onRestart: () => void }) {
  const { elapsedTime } = useEnemies();
  const { level } = usePlayer();
  const [animPhase, setAnimPhase] = useState<"dropdown" | "ready">("dropdown");

  const elapsedMinutes = Math.floor(elapsedTime / 60);
  const elapsedSeconds = Math.floor(elapsedTime % 60);
  const timerText = `${elapsedMinutes.toString().padStart(2, "0")}:${elapsedSeconds.toString().padStart(2, "0")}`;

  useEffect(() => {
    setAnimPhase("dropdown");
    const t = setTimeout(() => setAnimPhase("ready"), 20);
    return () => clearTimeout(t);
  }, []);

  const ready = animPhase === "ready";

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="absolute inset-0 bg-black opacity-80" />

      <PixelPanel animPhase={animPhase}>
        {/* Title */}
        <div
          className="flex justify-center mb-8"
          style={{ opacity: ready ? 1 : 0, transition: "opacity 0.3s ease" }}
        >
          <NineSliceCanvas
            width={520}
            height={100}
            deps={[ready, 2]}
            draw={(ctx, w, h) =>
              drawBitmapText(ctx, "GAME OVER", w / 2, h / 2, font, fontRedImage, {
                align: "center", baseline: "middle", scale: 5,
              })
            }
          />
        </div>

        {/* Flavor text */}
        <div
          className="flex justify-center mb-4"
          style={{
            opacity: ready ? 1 : 0,
            transition: "opacity 0.3s ease 0.1s",
          }}
        >
          <NineSliceCanvas
            width={580}
            height={36}
            deps={[ready]}
            draw={(ctx, w, h) =>
              drawBitmapText(ctx, "You have fallen in the dungeon...", w / 2, h / 2, font, fontWhiteImage, {
                align: "center", baseline: "middle", scale: 2,
              })
            }
          />
        </div>

        {/* Stats */}
        <div
          className="flex justify-center gap-12 mb-8"
          style={{
            opacity: ready ? 1 : 0,
            transform: ready ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.4s ease 0.2s, transform 0.4s ease 0.2s",
          }}
        >
          <NineSliceCanvas
            width={180}
            height={40}
            deps={[timerText, ready]}
            draw={(ctx, w, h) =>
              drawBitmapText(ctx, "TIME  " + timerText, w / 2, h / 2, font, fontRedImage, {
                align: "center", baseline: "middle", scale: 2,
              })
            }
          />
          <NineSliceCanvas
            width={180}
            height={40}
            deps={[level, ready]}
            draw={(ctx, w, h) =>
              drawBitmapText(ctx, "LEVEL  " + level, w / 2, h / 2, font, fontRedImage, {
                align: "center", baseline: "middle", scale: 2,
              })
            }
          />
        </div>

        {/* Try Again button */}
        <div
          className="flex justify-center"
          style={{
            opacity: ready ? 1 : 0,
            transform: ready ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.4s ease 0.35s, transform 0.4s ease 0.35s",
          }}
        >
          <PixelButton label="TRY AGAIN" onClick={onRestart} ready={ready} width={240} height={60} scale={2} />
        </div>
      </PixelPanel>
    </div>
  );
}

// ─── Level Up Screen ──────────────────────────────────────────────────────────
export function LevelUpScreen() {
  const {
    level,
    availableUpgrades,
    showLevelUpScreen,
    selectUpgrade,
  } = usePlayer();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isChooseHovered, setIsChooseHovered] = useState(false);
  const [animationPhase, setAnimationPhase] =
    useState<"dropdown" | "ready">("dropdown");

  const titleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const descCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chooseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const pendingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const previewIndex =
    hoveredIndex !== null ? hoveredIndex : selectedIndex;

  const displayedUpgrade =
    availableUpgrades?.[previewIndex];

  useEffect(() => {
    if (pendingTimeout.current) {
      clearTimeout(pendingTimeout.current);
      pendingTimeout.current = null;
    }

    if (showLevelUpScreen) {
      setIsVisible(true);
      setSelectedIndex(0);
      setHoveredIndex(null);
      setIsChooseHovered(false);
      setAnimationPhase("dropdown");

      pendingTimeout.current = setTimeout(() => {
        setAnimationPhase("ready");
        pendingTimeout.current = null;
      }, 20);
    } else {
      setAnimationPhase("dropdown");

      pendingTimeout.current = setTimeout(() => {
        setIsVisible(false);
        pendingTimeout.current = null;
      }, 250);
    }

    return () => {
      if (pendingTimeout.current) {
        clearTimeout(pendingTimeout.current);
        pendingTimeout.current = null;
      }
    };
  }, [showLevelUpScreen]);

  useEffect(() => {
    if (animationPhase !== "ready") return;

    const canvas = titleCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBitmapText(
      ctx,
      "CHOOSE AN UPGRADE",
      canvas.width / 2,
      50,
      font,
      fontRedImage,
      { align: "center", scale: 3 }
    );
  }, [animationPhase]);

  useEffect(() => {
    if (animationPhase !== "ready") return;
    if (!displayedUpgrade) return;

    const canvas = descCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawNineSlice(ctx, frameSprite, 0, 0, canvas.width, canvas.height, 3);

    drawBitmapText(
      ctx,
      displayedUpgrade.name,
      canvas.width / 2,
      20,
      font,
      fontRedImage,
      { align: "center", scale: 4 }
    );

    drawWrappedText(
      ctx,
      displayedUpgrade.description,
      canvas.width / 2,
      100,
      canvas.width - 40,
      font,
      fontWhiteImage,
      { align: "center", scale: 2 }
    );
  }, [animationPhase, displayedUpgrade]);

  useEffect(() => {
    if (animationPhase !== "ready") return;

    const canvas = chooseCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    drawNineSlice(ctx, frameSprite, 0, 0, canvas.width, canvas.height, 2);

    drawBitmapText(
      ctx,
      "CHOOSE",
      canvas.width / 2,
      canvas.height / 2,
      font,
      isChooseHovered ? fontWhiteImage : fontRedImage,
      { align: "center", baseline: "middle", scale: 2 }
    );
  }, [animationPhase, isChooseHovered]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[20] font-pixel pointer-events-none">
      <div className="absolute inset-0 bg-black opacity-30" />

      <div
        className="absolute left-1/2 w-full max-w-3xl px-4 pointer-events-auto"
        style={{
          top: animationPhase === "dropdown" ? "-100%" : "50%",
          transform: "translate(-50%, -50%)",
          transition: "top 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* TITLE */}
        <div className="text-center mb-4">
          <canvas
            ref={titleCanvasRef}
            width={600}
            height={120}
            style={{
              display: "block",
              margin: "0 auto",
              opacity: animationPhase === "ready" ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}
          />
        </div>

        {/* UPGRADES */}
        <div className="flex justify-center gap-0 mb-5">
          {availableUpgrades.map((upgrade, i) => {
            const isSelected = i === selectedIndex;
            const isHovered = i === hoveredIndex;
            const isReady = animationPhase === "ready";
            const { col, row } = getIconUV(upgrade.icon);

            const SPRITE_PX = 32;
            const SCALE = 2.5;
            return (
              <div
                key={upgrade.id}
                onClick={() => { if (isReady) setSelectedIndex(i); }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="relative"
                style={{
                  width: "120px",
                  height: "120px",
                  pointerEvents: isReady ? "auto" : "none",
                  opacity: isReady ? 1 : 0,
                }}
              >
                <div
                  className="upgrade-container-sprite"
                  style={{
                    backgroundImage: `url(${CONTAINER_SPRITESHEET})`,
                    backgroundPosition: `0% ${(isSelected || isHovered ? 1 : 0) * 100}%`,
                  }}
                />
                <div
                  className="upgrade-sprite"
                  style={{
                    backgroundImage: `url(${UPGRADES_SPRITESHEET})`,
                    width: `${SPRITE_PX * SCALE}px`,
                    height: `${SPRITE_PX * SCALE}px`,
                    backgroundPosition: `${-col * SPRITE_PX * SCALE}px ${-row * SPRITE_PX * SCALE}px`,
                    backgroundSize: `${SHEET_COLS * SPRITE_PX * SCALE}px`,
                    transform: `translate(-50%, -50%) scale(${isHovered || isSelected ? 1.5 : 1})`,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* DESCRIPTION */}
        <div className="flex justify-center">
          <canvas
            ref={descCanvasRef}
            width={800}
            height={300}
            style={{
              display: "block",
              transform: animationPhase === "ready" ? "translateY(0) scale(1)" : "translateY(30px) scale(0.95)",
              transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s",
            }}
          />
        </div>

        {/* BUTTON */}
        <div className="flex justify-center mt-6">
          <div
            onClick={() => {
              if (animationPhase === "ready") {
                selectUpgrade(displayedUpgrade);
                setIsChooseHovered(false);
              }
            }}
            onMouseEnter={() => setIsChooseHovered(true)}
            onMouseLeave={() => setIsChooseHovered(false)}
            style={{
              width: "200px",
              height: "60px",
              transform: animationPhase === "ready" ? "translateY(0) scale(1)" : "translateY(30px) scale(0.95)",
              transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s",
            }}
          >
            <canvas
              ref={chooseCanvasRef}
              width={200}
              height={60}
              style={{ display: "block" }}
            />
          </div>
        </div>
      </div>

      <style>{`
        .upgrade-sprite {
          position: absolute;
          left: 50%;
          top: 50%;
          image-rendering: pixelated;
          pointer-events: none;
          transform: translate(-50%, -50%);
        }
        .upgrade-container-sprite {
          position: absolute;
          inset: 0;
          background-size: 200% 200%;
          image-rendering: pixelated;
        }
        .font-pixel {
          font-family: 'Pixelify Sans';
        }
      `}</style>
    </div>
  );
}

export default function GameUI() {
  const { phase, start, restart } = useGame();
  const {
    hearts, maxHearts, ammo, maxAmmo,
    xp, xpToNextLevel, level,
    showLevelUpScreen,
    reset: resetPlayer,
  } = usePlayer();

  const { reset: resetEnemies, elapsedTime } = useEnemies();
  const { isMuted, toggleMute, masterVolume, setVolume } = useAudio();

  const [showInGameInstructions, setShowInGameInstructions] = useState(true);
  const progress = showLevelUpScreen ? 1 : Math.min(xp / xpToNextLevel, 1);
  const elapsedMinutes = Math.floor(elapsedTime / 60);
  const elapsedSeconds = Math.floor(elapsedTime % 60);
  const timerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerText = `${elapsedMinutes.toString().padStart(2, "0")}:${elapsedSeconds.toString().padStart(2, "0")}`;
  const levelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const instructionsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const showInstructions = elapsedTime < 30;
  const [hideInstructionsForever, setHideInstructionsForever] = useState(false);

  const handleStart = () => {
    resetPlayer();
    resetEnemies();
    start();
  };
  const [xpFlashIndex, setXpFlashIndex] = useState(0);

  useEffect(() => {
    if (!showLevelUpScreen) {
      setXpFlashIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setXpFlashIndex(prev => (prev + 1) % 3);
    }, 180);
    return () => clearInterval(interval);
  }, [showLevelUpScreen]);

  useEffect(() => {
    const canvas = timerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBitmapText(ctx, timerText, canvas.width / 2, canvas.height / 2, font, fontWhiteImage, {
      align: "center", baseline: "middle", scale: 2,
    });
  }, [timerText]);

  useEffect(() => {
    const canvas = levelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBitmapText(ctx, "Level:   " + level.toString(), canvas.width / 2, canvas.height / 1.8, font, fontWhiteImage, {
      align: "center", baseline: "middle", scale: 1.5,
    });
  }, [level]);

  useEffect(() => {
    if (showLevelUpScreen) setHideInstructionsForever(true);
  }, [showLevelUpScreen]);

  useEffect(() => {
    if (!showInstructions || hideInstructionsForever) return;
    const canvas = instructionsCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (showLevelUpScreen) return;
    ctx.imageSmoothingEnabled = false;
    const w = canvas.width;
    const h = canvas.height;
    drawBitmapText(ctx, "WASD - Move", w * 0.35, h * 0.90, font, fontWhiteImage, { align: "center", scale: 1 });
    drawBitmapText(ctx, "Left Click (Hold) - Shoot", w * 0.65, h * 0.90, font, fontWhiteImage, { align: "center", scale: 1 });
  }, [showInstructions, elapsedSeconds, showLevelUpScreen, hideInstructionsForever]);

  // ── Ammo overlap: compute a negative margin that grows as ammo count increases
  // Base overlap at ≤5 ammo: -50px. For every ammo above 5, add -4px more overlap.
  const ammoOverlap = maxAmmo <= 5 ? -50 : Math.min(-50 - (maxAmmo - 5) * 4, -72);

  if (phase === "ready") {
    return <StartScreen onStart={handleStart} />;
  }

  if (phase === "ended") {
    return <DeathScreen onRestart={restart} />;
  }

  return (
    <>
      <div className="fixed top-0 left-4 z-40">
        <div
          className="xp-bar"
          style={{
            position: "fixed",
            backgroundColor: "#293448",
            top: 6,
            left: "50%",
            transform: "translateX(-50%)",
            width: CANVAS_WIDTH - 40,
            height: 30,
            zIndex: 10,
          }}
        >
          <canvas
            ref={levelCanvasRef}
            width={CANVAS_WIDTH - 40}
            height={30}
            style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
          />
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              backgroundColor: showLevelUpScreen
                ? ["#3d5555", "#293448", "#58705f"][xpFlashIndex]
                : "#58705f",
              borderRadius: 0,
              transition: "width 120ms linear",
            }}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-0">
            <div className="flex gap-1">
              <HeartHUD currentHP={hearts} maxHP={maxHearts} />
            </div>
          </div>
        </div>

        <div className="space-y-0">
          <div className="gap-0">
            <AmmoHUD
              ammo={ammo}
              maxAmmo={maxAmmo}
              compact={maxAmmo > 5}
            />
          </div>
        </div>
      </div>

      <div className="fixed top-11 right-4 z-40">
        <canvas
          ref={timerCanvasRef}
          width={120}
          height={40}
          style={{ display: "block" }}
        />
      </div>

      {showInstructions && (
        <canvas
          ref={instructionsCanvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 50,
          }}
        />
      )}

      <style>{`
        .heart-hud {
          display: flex;
          gap: 0px;
          margin-top: 35px;
          user-select: none;
        }
        .heart {
          z-index: 1;
          image-rendering: pixelated;
        }
        .heart + .heart {
          z-index: 1;
          image-rendering: pixelated;
          margin-left: -20px;
        }
        .heart.empty {
          opacity: 0.20;
          filter: grayscale(0.8);
        }

        /* Ammo HUD — overlap controlled via CSS variable set inline */
        .ammo-hud {
          display: flex;
          gap: 0px;
          margin-left: -15px;
          user-select: none;
        }
        .ammo {
          z-index: 1;
          image-rendering: pixelated;
        }
        .ammo + .ammo {
          margin-left: var(--ammo-gap, -50px);
        }
        .ammo.empty {
          opacity: 0.1;
          filter: grayscale(1);
        }

        .cursor-sprite {
          position: fixed;
          pointer-events: none;
          image-rendering: pixelated;
          z-index: 9999;
        }
      `}</style>

      {/* Inject the computed ammo gap as a CSS variable on the document root */}
      <style>{`:root { --ammo-gap: ${ammoOverlap}px; }`}</style>
    </>
  );
}