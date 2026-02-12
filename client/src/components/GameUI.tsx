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
      <style jsx>{`
        
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
  const { generateRoomEnemies, reset: resetEnemies } = useEnemies();
  const progress = showLevelUpScreen ? 1 : Math.min(xp / xpToNextLevel, 1);

  const handleStart = () => {
    resetPlayer();
    resetEnemies();
    resetDungeon();
    generateDungeon();
    generateRoomEnemies();
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
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-90 z-50">
        <Card className="w-96 bg-gray-900 text-white border-gray-700">
          <CardContent className="p-8 text-center">
            <h1 className="text-4xl font-bold mb-4 text-blue-400">Bullet Dungeon Game Thing</h1>
            <p className="text-gray-300 mb-6">
              Currently incomplete start screen.
            </p>
            <Button onClick={handleStart} className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3">
              Start Game!
            </Button>
          </CardContent>
        </Card>
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


      

      {/* Instructions */}
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

      <style jsx>{`
          
      
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
