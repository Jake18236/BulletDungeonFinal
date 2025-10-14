import { useEffect } from "react";
import { useGame } from "../lib/stores/useGame";
import { usePlayer } from "../lib/stores/usePlayer";
import { useAudio } from "../lib/stores/useAudio";
import { useInventory } from "../lib/stores/useInventory";
import { useDungeon } from "../lib/stores/useDungeon";
import { useEnemies } from "../lib/stores/useEnemies";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Progress } from "./ui/progress";
import Inventory from "./Inventory";
import Minimap from "./Minimap";
import { Volume2, VolumeX } from "lucide-react";

export default function GameUI() {
  const { phase, start, restart } = useGame();
  const { player, reset: resetPlayer } = usePlayer();
  const { isMuted, toggleMute } = useAudio();
  const { showInventory, toggleInventory } = useInventory();
  const { generateDungeon, reset: resetDungeon } = useDungeon();
  const { generateRoomEnemies, reset: resetEnemies } = useEnemies();

  // Handle inventory toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyI" && phase === "playing") {
        toggleInventory();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, toggleInventory]);

  const handleStart = () => {
    resetPlayer();
    resetEnemies();
    resetDungeon();
    generateDungeon();
    generateRoomEnemies();
    start();
  };

  const handleRestart = () => {
    restart();
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
            <div className="text-sm text-gray-400 mb-6 space-y-1">
              <p><span className="font-semibold">WASD / Arrow Keys</span> - Move</p>
              <p><span className="font-semibold">Space</span> - Attack</p>
              <p><span className="font-semibold">I</span> - Inventory</p>
            </div>
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
            <p className="text-gray-300 mb-4">
              You have fallen in the dungeon...
            </p>
            <div className="text-sm text-gray-400 mb-6 space-y-1">
              <p>Level Reached: <span className="text-white font-semibold">{player.level}</span></p>
              <p>XP Gained: <span className="text-white font-semibold">{player.xp}</span></p>
            </div>
            <Button onClick={handleRestart} className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3">
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
                <span className="text-sm font-medium w-16">Health:</span>
                <Progress 
                  value={(player.health / player.maxHealth) * 100} 
                  className="w-32 h-3"
                />
                <span className="text-xs font-mono">{player.health}/{player.maxHealth}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium w-16">XP:</span>
                <Progress 
                  value={(player.xp / player.xpToNext) * 100} 
                  className="w-32 h-3"
                />
                <span className="text-xs font-mono">{player.xp}/{player.xpToNext}</span>
              </div>
              
              <div className="flex items-center gap-4 text-sm pt-2 border-t border-gray-700">
                <span className="font-semibold">Lv {player.level}</span>
                <span>ATK: {player.attack}</span>
                <span>DEF: {player.defense}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="fixed top-4 right-4 z-40">
        <div className="flex gap-2">
          <Button
            onClick={toggleMute}
            variant="outline"
            size="sm"
            className="bg-black bg-opacity-80 text-white border-gray-600 hover:bg-gray-800"
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </Button>
        </div>
      </div>

      {/* Minimap */}
      <div className="fixed bottom-4 right-4 z-40">
        <Minimap />
      </div>

      {/* Inventory */}
      {showInventory && <Inventory />}

      {/* Instructions */}
      <div className="fixed bottom-4 left-4 z-40">
        <Card className="bg-black bg-opacity-80 text-white border-gray-600">
          <CardContent className="p-3">
            <div className="text-xs space-y-1">
              <p><span className="font-semibold">WASD:</span> Move | <span className="font-semibold">Space:</span> Attack</p>
              <p><span className="font-semibold">I:</span> Inventory</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
