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

/* -------------------------------------------------------------------------- */
/*                              LEVEL UP SCREEN                               */
/* -------------------------------------------------------------------------- */

export function LevelUpScreen() {
  const { showLevelUpScreen, availableUpgrades, selectUpgrade, level } = useXP();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [animationPhase, setAnimationPhase] = useState<"beam" | "dropdown" | "ready">("beam");
  const [beamProgress, setBeamProgress] = useState(0);

  // Reset when showing
  useEffect(() => {
    if (showLevelUpScreen) {
      setAnimationPhase("beam");
      setBeamProgress(0);
      setSelectedIndex(0);
      setHoveredIndex(null);
    }
  }, [showLevelUpScreen]);

  // Beam animation
  useEffect(() => {
    if (animationPhase === "beam") {
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
  }, [animationPhase]);

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

      {/* Main upgrade container - DROPS DOWN FROM TOP */}
      <div
        className="absolute left-1/2 w-full max-w-3xl px-4 pointer-events-auto"
        style={{
          top: animationPhase === "beam" ? "-100%" : "50%",
          transform: "translate(-50%, -50%)",
          transition: animationPhase === "dropdown" || animationPhase === "ready" 
            ? "top 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" 
            : "none",
        }}
      >
        {/* Level text - FADES IN AFTER DROPDOWN */}
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

        {/* Upgrade icons - STAGGERED CASCADE */}
        <div className="flex justify-center gap-6 mb-4">
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
                className="relative hex-border cursor-pointer"
                style={{
                  width: "70px",
                  height: "70px",
                  borderColor: isSelected ? "#fbbf24" : "white",
                  borderWidth: "3px",
                  background: isSelected ? "#fbbf24" : "white",
                  pointerEvents: "auto", // allow hover immediately
                  transform: `translateY(${isReady ? "0" : "-100px"}) scale(${isHovered ? "1.1" : "1"})`,
                  opacity: isReady ? 1 : 0,
                  transition: `
                    opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.3 + i * 0.1}s,
                    transform 0.2s ease-out
                  `,
                  filter: isHovered
                    ? "drop-shadow(0 0 15px rgba(251, 191, 36, 0.8))"
                    : isSelected
                    ? "drop-shadow(0 0 10px rgba(251, 191, 36, 0.5))"
                    : "none",
                }}

              >
                <div className="hex-inner flex items-center justify-center bg-black text-white text-3xl">
                  {upgrade.icon}
                </div>
              </div>
            );
          })}
        </div>

        {/* Upgrade description - SCALES UP */}
        <div
          className="bg-black border-2 rounded-lg text-center mb-3"
          style={{
            width: "600px",
            margin: "0 auto",
            height: "200px",
            overflow: "hidden",
            borderColor: "white",
            padding: "1rem",
            transform: animationPhase === "ready" ? "translateY(0) scale(1)" : "translateY(30px) scale(0.95)",
            opacity: animationPhase === "ready" ? 1 : 0,
            transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s",
          }}
        >
          <h2 className="text-2xl font-bold text-white mb-2">{displayedUpgrade.name}</h2>
          <p className="text-gray-300 text-base">{displayedUpgrade.description}</p>
        </div>

        {/* Choose button - FINAL ENTRANCE WITH GLOW */}
        <div className="flex justify-center">
          <button
            onClick={() => animationPhase === "ready" && selectUpgrade(displayedUpgrade)}
            disabled={animationPhase !== "ready"}
            className="bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 border-2 border-red-500 text-white font-bold text-lg py-2 px-6 rounded-lg pointer-events-auto"
            style={{
              transform: animationPhase === "ready" ? "translateY(0) scale(1)" : "translateY(20px) scale(0.9)",
              opacity: animationPhase === "ready" ? 1 : 0,
              transition: `
                opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.6s,
                transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                box-shadow 0.2s ease-out
              `,
              boxShadow: animationPhase === "ready"
                ? "0 0 20px rgba(239, 68, 68, 0.4)"
                : "none",
            }}
          >
            CHOOSE
          </button>
        </div>
      </div>

      {/* Hexagon styles */}
      <style jsx>{`
        .hex-border {
          clip-path: polygon(
            25% 6.7%,
            75% 6.7%,
            100% 50%,
            75% 93.3%,
            25% 93.3%,
            0% 50%
          );
          border: 3px solid;  
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .hex-inner {
          width: 100%;
          height: 100%;
          clip-path: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .font-pixel {
          font-family: 'Pixelify Sans';
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 GAME UI                                    */
/* -------------------------------------------------------------------------- */

export default function GameUI() {
  const { phase, start, restart } = useGame();
  const { hearts, maxHearts, reset: resetPlayer } = usePlayer();
  const { isMuted, toggleMute } = useAudio();
  const { generateDungeon, reset: resetDungeon } = useDungeon();
  const { generateRoomEnemies, reset: resetEnemies } = useEnemies();

  const handleStart = () => {
    resetPlayer();
    resetEnemies();
    resetDungeon();
    generateDungeon();
    generateRoomEnemies();
    useInventory.getState().reset();
    start();
  };

  if (phase === "ready") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-90 z-50">
        <Card className="w-96 bg-gray-900 text-white border-gray-700">
          <CardContent className="p-8 text-center">
            <h1 className="text-4xl font-bold mb-4 text-blue-400">Dungeon Crawler</h1>
            <p className="text-gray-300 mb-6">
              Navigate the procedurally generated dungeon, fight enemies, and collect treasures!
            </p>
            <Button onClick={handleStart} className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3">
              Start Adventure
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

  return (
    <>
      {/* HUD */}
      <div className="fixed top-4 left-4 z-40">
        <Card className="bg-black bg-opacity-80 text-white border-gray-600">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Hearts:</span>
                <div className="flex gap-1">
                  {Array.from({ length: maxHearts }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-6 h-6 rounded-full border-2 ${
                        i < hearts
                          ? "bg-red-500 border-red-600"
                          : "bg-gray-800 border-gray-600"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="fixed top-4 right-4 z-40">
        <Button
          onClick={toggleMute}
          variant="outline"
          size="sm"
          className="bg-black bg-opacity-80 text-white border-gray-600 hover:bg-gray-800"
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </Button>
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

      {/* LEVEL UP SCREEN */}
      
    </>
  );
}