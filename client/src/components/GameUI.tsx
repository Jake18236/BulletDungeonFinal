import { useEffect, useState } from "react";
import { useGame } from "../lib/stores/useGame";
import { usePlayer } from "../lib/stores/usePlayer";
import { useAudio } from "../lib/stores/useAudio";
import { useInventory } from "../lib/stores/useInventory";
import { useDungeon } from "../lib/stores/useDungeon";
import { useEnemies } from "../lib/stores/useEnemies";
import { useXP } from "../lib/stores/useXP";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import Inventory from "./Inventory";
import Minimap from "./Minimap";
import { Volume2, VolumeX } from "lucide-react";
import { UpgradeIcon, HeartHUD, AmmoHUD } from "./SpriteProps";


export function LevelUpScreen() {
  const { showLevelUpScreen, availableUpgrades, selectUpgrade, level } = useXP();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [animationPhase, setAnimationPhase] = useState<"beam" | "dropdown" | "ready">("beam");
  const [beamProgress, setBeamProgress] = useState(0);
  
  useEffect(() => {
    if (showLevelUpScreen) {
      // Force immediate state reset
      setAnimationPhase("beam");
      setBeamProgress(0);
      setSelectedIndex(0);
      setHoveredIndex(null);
    }
  }, [showLevelUpScreen]);
  // Beam animation
  useEffect(() => {
    if (animationPhase === "beam" && showLevelUpScreen) {
      const interval = setInterval(() => {
        setBeamProgress(prev => {
          if (prev >= 1) {
            clearInterval(interval);
            setTimeout(() => setAnimationPhase("dropdown"), 100);
            return 1;
          }
          return prev + 0.02;
        });
      }, 20);
      return () => clearInterval(interval);
    }
  }, [animationPhase, showLevelUpScreen]);

  // Dropdown animation → ready
  useEffect(() => {
    if (animationPhase === "dropdown") {
      const timeout = setTimeout(() => setAnimationPhase("ready"), 600);
      return () => clearTimeout(timeout);
    }
  }, [animationPhase]);

  if (!showLevelUpScreen || availableUpgrades.length === 0) return null;

  const displayedUpgrade = availableUpgrades[hoveredIndex ?? selectedIndex];

  return (
    <div className="fixed inset-0 z-[999] font-pixel pointer-events-none">
      {/* Background overlay */}
      <div
        className="absolute inset-0 bg-black transition-opacity duration-500"
        style={{ opacity: 0.3 }}
      />

      {/* Beam animation */}
      {animationPhase === "beam" && (
        <div
          className="absolute left-1/2 top-0 w-48 h-full"
          style={{
            transform: "translateX(-50%)",
            background: `linear-gradient(to bottom,
              rgba(255,255,255,${beamProgress * 0.3}) 0%,
              rgba(255,255,255,${beamProgress * 0.1}) 50%,
              rgba(255,255,255,0) 100%
            )`,
            boxShadow: `0 0 80px 40px rgba(255,255,255,${beamProgress * 0.2})`,
          }}
        >
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-sm"
              style={{
                left: `${20 + Math.sin(i * 3) * 30}%`,
                top: `${(i * 5 - beamProgress * 100) % 100}%`,
                opacity: beamProgress * 0.6,
                boxShadow: "0 0 10px 2px rgba(255,255,255,0.5)",
              }}
            />
          ))}
        </div>
      )}

      {/* FIXED: Only render main content after beam completes */}
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

              return (
                <div
                  key={upgrade.id}
                  onClick={() => isReady && setSelectedIndex(i)}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="relative cursor-pointer"
                  style={{
                    width: "72px",
                    height: "72px",
                    pointerEvents: isReady ? "auto" : "none",
                    transform: `scale(${isHovered ? 1.1 : 1})`,
                    opacity: isReady ? 1 : 0,
                    transition: `
                      opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.3 + i * 0.1}s,
                      transform 0.2s ease-out
                    `,
                    filter: isHovered
                      ? "drop-shadow(0 0 16px rgba(255,255,255,0.6))"
                      : "none",
                  }}
                >
                  <UpgradeIcon
                    icon={upgrade.icon}
                    selected={isSelected}
                    className="upgrade-sprite"
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
          width: 128px;
          height: 128px;
          object-fit: contain;
          pointer-events: none;
        }

        .upgrade-slot {
          width: 72px;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .upgrade-card {
          display: inline-flex;
          align-items: center;
          justify-content: center;

          transition:
            transform 120ms ease,
            filter 120ms ease,
            opacity 120ms ease;
        }

        .upgrade-card:hover {
          transform: scale(1.08);
          filter: drop-shadow(0 0 6px rgba(255,255,255,0.4));
        }

        .upgrade-card.selected {
          filter: drop-shadow(0 0 10px rgba(255,255,255,0.8));
        }
        .upgrade-card.locked {
          opacity: 0.35;
          filter: grayscale(1);
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
  const { hearts, maxHearts, ammo, maxAmmo, reset: resetPlayer } = usePlayer();
  const { generateDungeon, reset: resetDungeon } = useDungeon();
  const { generateRoomEnemies, reset: resetEnemies } = useEnemies();

  const handleStart = () => {
    resetPlayer();
    resetEnemies();
    resetDungeon();
    generateDungeon();
    generateRoomEnemies();
    start();
  };

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
          }

          .heart {
            width: 80px;
            height: 80px;
            z-index: 1;
            image-rendering: pixelated;
          }

          .heart.empty {
            opacity: 0.20;
            filter: grayscale(1);
          }
          .ammo-hud {
            display: flex;
            gap: 0px;
          }

          .ammo {
            width: 64px;
            height: 64px;
            
            z-index: 1;
            image-rendering: pixelated;
          }
          .ammo + .ammo {
            margin-left: -30px;
          }
          .ammo.empty {
            opacity: 0.1;
            filter: grayscale(1);
          }
          
          .cursor-sprite {
            position: fixed;
            pointer-events: none;
            image-rendering: pixelated;
            width: 32px;
            height: 32px;
            z-index: 9999;
          }
        `}</style>
      
    </>
  );
}