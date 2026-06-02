import { useEffect, useRef, useState } from "react";
import { useGame } from "../lib/stores/useGame";
import { usePlayer } from "../lib/stores/usePlayer";
import { useAudio } from "../lib/stores/useAudio";
import { useEnemies } from "../lib/stores/useEnemies";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../components/CanvasGame"

import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
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

const LEVEL_UP_BEAM_SPRITESHEET = "/sprites/upgrades/level-up-spritesheet.png";
const CONTAINER_SPRITESHEET = "/sprites/upgrades/containers-spritesheet.png";
const UPGRADES_SPRITESHEET = "/sprites/upgrades/upgrades-spritesheet.png";

const hashText = (text: string) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
};


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
  const [animationPhase, setAnimationPhase] = useState<
    "dropdown" | "ready"
  >("dropdown");

  const titleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const descCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chooseCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const previewIndex =
    hoveredIndex !== null ? hoveredIndex : selectedIndex;

  const displayedUpgrade =
    availableUpgrades?.[previewIndex];

  const playerScreenX =
    (window.innerWidth - CANVAS_WIDTH) / 2 +
    CANVAS_WIDTH / 2;

  const playerScreenY =
    (window.innerHeight - CANVAS_HEIGHT) / 2 +
    CANVAS_HEIGHT / 2;

  useEffect(() => {
    if (!showLevelUpScreen) return;

    setSelectedIndex(0);
    setHoveredIndex(null);
    setIsChooseHovered(false);

    setAnimationPhase("dropdown");

    const t = setTimeout(() => {
      setAnimationPhase("ready");
    }, 450);

    return () => clearTimeout(t);
  }, [showLevelUpScreen]);

  /* -------------------------
     TITLE RENDER
  ------------------------- */
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
      {
        align: "center",
        scale: 3,
      }
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

    drawNineSlice(
      ctx,
      frameSprite,
      0,
      0,
      canvas.width,
      canvas.height,
      3
    );

    drawBitmapText(
      ctx,
      displayedUpgrade.name,
      canvas.width / 2,
      20,
      font,
      fontRedImage,
      {
        align: "center",
        scale: 4,
      }
    );

    drawWrappedText(
      ctx,
      displayedUpgrade.description,
      canvas.width / 2,
      100,
      canvas.width - 40,
      font,
      fontWhiteImage,
      {
        align: "center",
        scale: 2,
      }
    );
  }, [animationPhase, displayedUpgrade]);

  /* -------------------------
     BUTTON RENDER
  ------------------------- */
  useEffect(() => {
    if (animationPhase !== "ready") return;

    const canvas = chooseCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    drawNineSlice(
      ctx,
      frameSprite,
      0,
      0,
      canvas.width,
      canvas.height,
      2
    );

    drawBitmapText(
      ctx,
      "CHOOSE",
      canvas.width / 2,
      canvas.height / 2,
      font,
      isChooseHovered ? fontWhiteImage : fontRedImage,
      {
        align: "center",
        baseline: "middle",
        scale: 2,
      }
    );
  }, [animationPhase, isChooseHovered]);

  /* -------------------------
     EARLY EXIT
  ------------------------- */
  if (!showLevelUpScreen || availableUpgrades.length === 0) {
    return null;
  }

  /* -------------------------
     RENDER
  ------------------------- */
  return (
    <div className="fixed inset-0 z-[20] font-pixel pointer-events-none">
      {/* Background */}
      <div className="absolute inset-0 bg-black opacity-30" />

      {/* MAIN PANEL */}
      <div
        className="absolute left-1/2 w-full max-w-3xl px-4 pointer-events-auto"
        style={{
          top: animationPhase === "dropdown" ? "-100%" : "50%",
          transform: "translate(-50%, -50%)",
          transition:
            "top 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
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
        <div className="flex justify-center gap-0 mb-20">
          {availableUpgrades.map((upgrade, i) => {
            const isSelected = i === selectedIndex;
            const isHovered = i === hoveredIndex;
            const isReady = animationPhase === "ready";

            return (
              <div
                key={upgrade.id}
                onClick={() => {
                  if (isReady) setSelectedIndex(i);
                }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="relative"
                style={{
                  width: "96px",
                  height: "96px",
                  pointerEvents: isReady ? "auto" : "none",
                  opacity: isReady ? 1 : 0,
                  transition: "transform 140ms ease",
                }}
              >
                <div
                  className="upgrade-container-sprite"
                  style={{
                    backgroundImage: `url(${CONTAINER_SPRITESHEET})`,
                    backgroundPosition: `0% ${
                      (isSelected || isHovered ? 1 : 0) * 100
                    }%`,
                  }}
                />

                <div
                  className="upgrade-sprite"
                  style={{
                    backgroundImage: `url(${UPGRADES_SPRITESHEET})`,
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
              transform:
                animationPhase === "ready"
                  ? "translateY(0) scale(1)"
                  : "translateY(30px) scale(0.95)",
              transition:
                "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s",
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
              transform:
                animationPhase === "ready"
                  ? "translateY(0) scale(1)"
                  : "translateY(30px) scale(0.95)",
              transition:
                "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s",
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

      {/* STYLES */}
      <style>{`
        .upgrade-sprite {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 64px;
          height: 64px;
          transform: translate(-50%, -50%);
          image-rendering: pixelated;
          pointer-events: none;
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
  const { hearts, maxHearts, ammo, maxAmmo, xp, xpToNextLevel, level, showLevelUpScreen, reset: resetPlayer } = usePlayer();

  const { reset: resetEnemies, elapsedTime } = useEnemies();
  const { isMuted, toggleMute, masterVolume, setVolume } = useAudio();
  const [menuScreen, setMenuScreen] = useState<"main" | "settings" | "controls">("main");
  const [showInGameInstructions, setShowInGameInstructions] = useState(true);
  const progress = showLevelUpScreen ? 1 : Math.min(xp / xpToNextLevel, 1);
  const elapsedMinutes = Math.floor(elapsedTime / 60);
  const elapsedSeconds = Math.floor(elapsedTime % 60);
  const timerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerText = `${elapsedMinutes.toString().padStart(2, "0")}:${elapsedSeconds.toString().padStart(2, "0")}`;
  const levelCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const instructionsCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const showInstructions = elapsedTime < 30;
  
  const handleStart = () => {
    resetPlayer();
    resetEnemies();
    start();
  };
  const [xpFlashIndex, setXpFlashIndex] = useState(0);

  //level up screen xp bar flash
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

  // timer text
  useEffect(() => {
  const canvas = timerCanvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBitmapText(
    ctx,
    timerText,
    canvas.width / 2,
    canvas.height / 2,
    font,
    fontWhiteImage,
    {
      align: "center",
      baseline: "middle",
      scale: 2,
    }
  );
}, [timerText]);

 useEffect(() => {
  const canvas = levelCanvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBitmapText(
    ctx,
    "Level:   " + level.toString(),
    canvas.width / 2,
    canvas.height / 1.8,
    font,
    fontWhiteImage,
    {
      align: "center",
      baseline: "middle",
      scale: 1.5,
    }
  );
}, [level]);

useEffect(() => {
  if (!showInstructions) return;

  const canvas = instructionsCanvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  const cx = canvas.width / 2;

  const w = canvas.width;
const h = canvas.height;

drawBitmapText(ctx, "WASD - Move", w * 0.25, h * 0.90, font, fontWhiteImage, {
  align: "center",
  scale: 1,
});

drawBitmapText(ctx, "Left Click (Hold) - Shoot", w * 0.50, h * 0.90, font, fontWhiteImage, {
  align: "center",
  scale: 1,
});

drawBitmapText(ctx, "R - Reload", w * 0.75, h * 0.90, font, fontWhiteImage, {
  align: "center",
  scale: 1,
});

}, [showInstructions, elapsedSeconds]);

  if (phase === "ready") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/90 z-50 text-red-100">
        <div className="menu-glow absolute inset-0 pointer-events-none" />
        <div className="relative w-[34rem] px-8 py-10 menu-shell animate-[menuIn_500ms_ease-out]">
          <h1 className="text-6xl font-extrabold mb-2 text-center tracking-[0.2em] text-red-500 drop-shadow-[0_0_18px_rgba(239,68,68,0.8)] menu-font">
            Bullet Dungeon
          </h1>
          <p className="text-red-200/90 mb-8 text-center text-lg menu-font">Choose an option to begin.</p>

          {menuScreen === "main" && (
            <div className="space-y-4">
              <Button onClick={handleStart} className="menu-btn w-full text-lg py-7 menu-font">
                Play
              </Button>
              <Button onClick={() => setMenuScreen("settings")} className="menu-btn w-full text-lg py-7 menu-font">
                Settings
              </Button>
              <Button onClick={() => setMenuScreen("controls")} className="menu-btn w-full text-lg py-7 menu-font">
                Controls
              </Button>
            </div>
          )}

          {menuScreen === "settings" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-red-500/60 bg-black/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-red-100 menu-font">Audio Volume</span>
                  <Button onClick={toggleMute} variant="outline" className="gap-2 border-red-500/70 text-red-200 hover:bg-red-500/20">
                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    {isMuted ? "Muted" : `${Math.round(masterVolume * 100)}%`}
                  </Button>
                </div>
                <Slider
                  value={[Math.round(masterVolume * 100)]}
                  max={100}
                  step={1}
                  onValueChange={([value]) => setVolume(value / 100)}
                  className="[&_[role=slider]]:border-red-200/80 [&_[role=slider]]:bg-red-100 [&_[role=slider]]:shadow-[0_0_12px_rgba(248,113,113,0.7)] [&_[data-orientation=horizontal]]:h-2 [&_[data-orientation=horizontal]]:bg-red-900/50 [&_[data-orientation=horizontal]>span]:bg-red-500"
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-red-500/60 bg-black/40 p-4">
                <span className="text-red-100 menu-font">In-game help card</span>
                <Button
                  onClick={() => setShowInGameInstructions((prev) => !prev)}
                  variant="outline"
                  className="border-red-500/70 text-red-200 hover:bg-red-500/20 menu-font"
                >
                  {showInGameInstructions ? "Shown" : "Hidden"}
                </Button>
              </div>
              <Button onClick={() => setMenuScreen("main")} className="menu-btn w-full mt-2 menu-font">
                Back
              </Button>
            </div>
          )}

          {menuScreen === "controls" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-500/60 bg-black/40 p-4 text-sm text-red-100 space-y-2 menu-font">
                <p><span className="font-semibold">Move:</span> WASD</p>
                <p><span className="font-semibold">Aim:</span> Mouse cursor</p>
                <p><span className="font-semibold">Shoot:</span> Left click</p>
              </div>
              <Button onClick={() => setMenuScreen("main")} className="menu-btn w-full menu-font">
                Back
              </Button>
            </div>
          )}
        </div>

        <style>{`
          .menu-shell {
            border: none;
            background: transparent;
          }

          .menu-font {
            font-family: "Pixelify Sans", "Press Start 2P", "Inter", sans-serif;
          }

          .menu-btn {
            border: 1px solid rgba(248, 113, 113, 0.85);
            background: linear-gradient(90deg, rgba(127, 29, 29, 0.75), rgba(220, 38, 38, 0.28));
            color: #fee2e2;
            box-shadow: 0 0 14px rgba(239, 68, 68, 0.45);
            transition: transform 150ms ease, box-shadow 150ms ease, background 180ms ease;
          }

          .menu-btn:hover {
            background: linear-gradient(90deg, rgba(220, 38, 38, 0.82), rgba(127, 29, 29, 0.65));
            transform: translateY(-2px) scale(1.01);
            box-shadow: 0 0 22px rgba(239, 68, 68, 0.7);
          }

          .menu-glow {
            background: radial-gradient(circle at center, rgba(185, 28, 28, 0.2), rgba(0, 0, 0, 0.97) 55%);
            animation: pulseGlow 2400ms ease-in-out infinite;
          }

          @keyframes pulseGlow {
            0%, 100% { opacity: 0.65; }
            50% { opacity: 1; }
          }

          @keyframes menuIn {
            0% {
              opacity: 0;
              transform: translateY(16px) scale(0.97);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}</style>
      </div>
    );
  }

  if (phase === "ended") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-90 z-50">

          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-4 text-red-400">Game Over</h2>
            <p className="text-gray-300 mb-4">You have fallen in the dungeon...</p>
            <Button onClick={restart} className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3">
              Try Again
            </Button>
          </CardContent>
       
      </div>
    );
  }
// hud
  return (
    <>
      
      {/* HUD */}
      <div className="fixed top-0 left-4 z-40">
          <div
            className="xp-bar"
            style={{
              position: "fixed",
              backgroundColor: "#293448",
                top: 6,
                left: "50%",
                transform: "translateX(-50%)",
                width: CANVAS_WIDTH-40,
                height: 30,
                zIndex: 10,
            }}
          >
            <canvas
          ref={levelCanvasRef}
          width={CANVAS_WIDTH-40}
          height={30}
          style={{
  position: "absolute",
  top: 0,
  left: 0,
  pointerEvents: "none",
  }}
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

          <CardContent className="p-0">
            <div className="space-y-2">
              <div className="flex items-center gap-0">
                <div className="flex gap-1">
                  <HeartHUD
                    currentHP={hearts}
                    maxHP={maxHearts}
                  />
                </div>
              </div>
            </div>
          </CardContent>

        <CardContent className="p-0">
          <div className="space-y-0">
            <div className="gap-0">
              

                <AmmoHUD
                  ammo={ammo}
                  maxAmmo={maxAmmo}
                />

            </div>
            
          </div>
        </CardContent>
      </div>


      

      <div className="fixed top-11 right-4 z-40">
        <canvas
          ref={timerCanvasRef}
          width={120}
          height={40}
          style={{
          display: "block",
  }}
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
            margin-left: -50px;
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
      
    </>
  );
}
