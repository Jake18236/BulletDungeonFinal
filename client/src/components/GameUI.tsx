import { useEffect, useState } from "react";
import { useGame } from "../lib/stores/useGame";
import { usePlayer } from "../lib/stores/usePlayer";
import { useAudio } from "../lib/stores/useAudio";
import { useDungeon } from "../lib/stores/useDungeon";
import { useEnemies } from "../lib/stores/useEnemies";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../components/CanvasGame"

import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Volume2, VolumeX } from "lucide-react";
import { HeartHUD, AmmoHUD, } from "./SpriteProps";
import { Slider } from "./ui/slider";

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

  const { level, availableUpgrades, showLevelUpScreen, xp, selectUpgrade } = usePlayer();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [animationPhase, setAnimationPhase] = useState<"beam" | "dropdown" | "ready">("beam");
  const [beamProgress, setBeamProgress] = useState(0);
  const [beamFrame, setBeamFrame] = useState(0);
  
  useEffect(() => {
    if (showLevelUpScreen) {
      // Force immediate state reset
      setAnimationPhase("beam");
      setBeamProgress(0);
      setBeamFrame(0);
      setSelectedIndex(0);
      setHoveredIndex(null);
    }
  }, [showLevelUpScreen]);
  // Beam animation
  useEffect(() => {
    if (animationPhase === "beam" && showLevelUpScreen) {
      const interval = setInterval(() => {
        setBeamProgress(prev => {
          if (prev >= 0.480) {
            clearInterval(interval);
            setTimeout(() => setAnimationPhase("dropdown"), 0);
            return 1;
          }
          return prev + 0.02;
        });
      }, 20);
      return () => clearInterval(interval);
    }
  }, [animationPhase, showLevelUpScreen]);

  useEffect(() => {
    if (animationPhase !== "beam" || !showLevelUpScreen) return;

    const interval = setInterval(() => {
      setBeamFrame((prev) => (prev + 1) % 6);
    }, 80);

    return () => clearInterval(interval);
  }, [animationPhase, showLevelUpScreen]);

  // Dropdown animation → ready
  useEffect(() => {
    if (animationPhase === "dropdown") {
      const timeout = setTimeout(() => setAnimationPhase("ready"), 100);
      return () => clearTimeout(timeout);
    }
  }, [animationPhase]);

  if (!showLevelUpScreen || availableUpgrades.length === 0) return null;

  const displayedUpgrade = availableUpgrades[hoveredIndex ?? selectedIndex];
  const playerScreenX = (window.innerWidth - CANVAS_WIDTH) / 2 + CANVAS_WIDTH / 2;
  const playerScreenY = (window.innerHeight - CANVAS_HEIGHT) / 2 + CANVAS_HEIGHT / 2;

  return (
    <div className="fixed inset-0 z-[20] font-pixel pointer-events-none">
      {/* Background overlay */}
      <div
        className="absolute inset-0 bg-black transition-opacity duration-500"
        style={{ opacity: 0.3 }}
      />

      {/* Beam animation */}
      {animationPhase === "beam" && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${playerScreenX}px`,
            top: `${playerScreenY + 24}px`,
            width: "128px",
            height: "420px",
            transform: "translate(-50%, -100%)",

            backgroundImage: `url(${LEVEL_UP_BEAM_SPRITESHEET})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: "600% 100%",
            backgroundPosition: `${(beamFrame / 5) * 100}% 0%`,
            opacity: 1.5,
            filter: "none",
          }}
        />
      )}

      {animationPhase !== "beam" && (
        <div
          className="absolute left-1/2 w-full max-w-3xl px-4 pointer-events-auto"
          style={{
            top: animationPhase === "dropdown" ? "-100%" : "50%",
            transform: "translate(-50%, -50%)",
            transition: animationPhase === "dropdown" || animationPhase === "ready" 
              ? "top 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" 
              : "none",
          }}
        >
          {/* Level text */}
          <div className="text-center mb-4">
            <h1
              className="text-5xl font-pixel bold text-red-500 drop-shadow-lg mb-2"
              style={{
                transform: animationPhase === "ready" ? "translateY(0) scale(1)" : "translateY(-50px) scale(0.8)",
                opacity: animationPhase === "ready" ? 1 : 0,
                transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s",
              }}
            >
              Choose an Upgrade
            </h1>
            <p
              className="text-xl text-gray-300 font-bold"
              style={{
                transform: animationPhase === "ready" ? "translateY(0)" : "translateY(-30px)",
                opacity: animationPhase === "ready" ? 1 : 0,
                transition: "all 0.4s ease-out 0.2s",
              }}
            >
              Level {level}
            </p>
          </div>

          {/* Upgrade icons */}
          <div className="flex justify-center gap-0 mb-20">
            {availableUpgrades.map((upgrade, i) => {
              const isSelected = i === selectedIndex;
              const isHovered = i === hoveredIndex;
              const isReady = animationPhase === "ready";
              const iconSeed = hashText(`${upgrade.id}-${i}`);
              const iconRow = iconSeed % 4;
              const iconCol = Math.floor(iconSeed / 4) % 4;
              const containerRow = isSelected || isHovered ? 1 : 0;

              return (
                <div
                  key={upgrade.id}
                  onClick={() => isReady && setSelectedIndex(i)}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="relative cursor-pointer"
                  style={{
                    width: "96px",
                    height: "96px",
                    pointerEvents: isReady ? "auto" : "none",
                    transform: `scale(${isHovered ? 1.2 : 1})`,
                    opacity: isReady ? 1 : 0,
                    transition: "transform 140ms ease",
                  }}
                >
                  <div
                    className="upgrade-container-sprite"
                    style={{
                      backgroundImage: `url(${CONTAINER_SPRITESHEET})`,
                      backgroundPosition: `0% ${containerRow * 100}%`,
                    }}
                  />
                  <div
                    className="upgrade-filler-sprite"
                    style={{
                      backgroundImage: `url(${CONTAINER_SPRITESHEET})`,
                      backgroundPosition: `100% ${containerRow * 100}%`,
                    }}
                  />
                  <div
                    className="upgrade-sprite"
                    style={{
                      backgroundImage: `url(${UPGRADES_SPRITESHEET})`,
                      backgroundSize: "400% 400%",
                      backgroundPosition: `${(iconCol / 3) * 100}% ${(iconRow / 3) * 100}%`,
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Upgrade description */}
          <div
            className="bg-black border-2 rounded-lg text-center mb-3"
            style={{
              width: "600px",
              margin: "0 auto",
              height: "200px",
              overflow: "hidden",
              borderColor: "white",
              padding: "1rem",
              transform:
                animationPhase === "ready"
                  ? "translateY(0) scale(1)"
                  : "translateY(30px) scale(0.95)",
              opacity: animationPhase === "ready" ? 1 : 0,
              transition:
                "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s",
            }}
          >
            <h2 className="text-5xl font-bold text-white mb-2">
              {displayedUpgrade.name}
            </h2>
            <p className="text-2xl text-gray-300">
              {displayedUpgrade.description}
            </p>
          </div>

          {/* Choose button */}
          <div className="flex justify-center">
            <button
              onClick={() =>
                animationPhase === "ready" &&
                selectUpgrade(displayedUpgrade)
              }
              disabled={animationPhase !== "ready"}
              className="bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 border-2 border-red-500 text-white font-bold text-lg py-2 px-6 rounded-lg pointer-events-auto"
              style={{
                transform:
                  animationPhase === "ready"
                    ? "translateY(0) scale(1)"
                    : "translateY(20px) scale(0.9)",
                opacity: animationPhase === "ready" ? 1 : 0,
                transition: `
                  opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.6s,
                  transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                  box-shadow 0.2s ease-out
                `,
                boxShadow:
                  animationPhase === "ready"
                    ? "0 0 20px rgba(239, 68, 68, 0.4)"
                    : "none",
              }}
            >
              CHOOSE
            </button>
          </div>
        </div>
      )}

      {/* Hexagon styles */}
      <style>{`
        
        .upgrade-sprite {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 64px;
          height: 64px;
          transform: translate(-50%, -50%);
          background-repeat: no-repeat;
          image-rendering: pixelated;
          pointer-events: none;
        }

        .upgrade-container-sprite,
        .upgrade-filler-sprite {
          gap: 5px;
          position: absolute;
          inset: 0;
          background-size: 200% 200%;
          background-repeat: no-repeat;
          
          pointer-events: none;
          image-rendering: pixelated;
        }

        .upgrade-filler-sprite {
          opacity: 1;
          pointer-events: none;
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
  const { generateDungeon, reset: resetDungeon } = useDungeon();
  const { reset: resetEnemies, elapsedTime } = useEnemies();
  const { isMuted, toggleMute, masterVolume, setVolume } = useAudio();
  const [menuScreen, setMenuScreen] = useState<"main" | "settings" | "controls">("main");
  const [showInGameInstructions, setShowInGameInstructions] = useState(true);
  const progress = showLevelUpScreen ? 1 : Math.min(xp / xpToNextLevel, 1);
  const elapsedMinutes = Math.floor(elapsedTime / 60);
  const elapsedSeconds = Math.floor(elapsedTime % 60);
  const timerText = `${elapsedMinutes.toString().padStart(2, "0")}:${elapsedSeconds.toString().padStart(2, "0")}`;

  const handleStart = () => {
    resetPlayer();
    resetEnemies();
    resetDungeon();
    generateDungeon();
    start();
  };
  const [xpFlash, setXpFlash] = useState(false);

  useEffect(() => {
    if (!showLevelUpScreen) {
      setXpFlash(false);
      return;
    }

    const interval = setInterval(() => {
      setXpFlash((prev) => !prev);
    }, 300); // flash speed (adjust to taste)

    return () => clearInterval(interval);
  }, [showLevelUpScreen]);


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
        <Card className="w-96 bg-gray-900 text-white border-gray-700">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-4 text-red-400">Game Over</h2>
            <p className="text-gray-300 mb-4">You have fallen in the dungeon...</p>
            <Button onClick={restart} className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3">
              Try Again
            </Button>
          </CardContent>
        </Card>
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
              position: "absolute",
                top: 6,
                left: 700,
                transform: "translateX(-50%)",
                width: 720,
                height: 20,
                backgroundColor: "rgba(0,0,0,0.6)",
                border: "2px solid #1f2933",
                borderRadius: 6,
                zIndex: 100,
            }}
          >
            <div
              style={{
                width: `${progress * 100}%`,
                height: "100%",
                backgroundColor: showLevelUpScreen
                  ? xpFlash
                    ? "#22c55e"   // bright green
                    : "#166534"   // dark green
                  : "#60ff87",   // normal XP color
                borderRadius: 4,
                transition: "width 120ms linear",
              }}
            />
            <span
              style={{
                position: "absolute",
                right: -36,
                top: -4,
                fontSize: 11,
                color: "#e5e7eb",
                fontFamily: "monospace",
              }}
            >
              Lv {level}
            </span>
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


      

      <div className="fixed top-4 right-4 z-40">
        <Card className="bg-black bg-opacity-80 text-white border-gray-600">
          <CardContent className="px-4 py-2">
            <p className="text-lg font-mono">{timerText}</p>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      {showInGameInstructions && (
        <div className="fixed bottom-4 left-4 z-40">
          <Card className="bg-black bg-opacity-80 text-white border-gray-600">
            <CardContent className="p-3">
              <div className="text-xs space-y-1">
                <p>
                  <span className="font-semibold">WASD:</span> Move
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <style>{`
          
      
          .heart-hud {
            display: flex;
            gap: 0px;
            margin-top: 20px;
            
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
