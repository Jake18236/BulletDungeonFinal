import { useEffect } from "react";
import { useGame } from "./lib/stores/useGame";
import "@fontsource/inter";
import CanvasGame from "./components/CanvasGame";
import GameUI from "./components/GameUI";

function App() {
  const { phase } = useGame();

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-gray-900 overflow-hidden relative">
      {phase === "playing" && (
        <div className="flex items-center justify-center">
          <CanvasGame />
        </div>
      )}
      <GameUI />
    </div>
  );
}

export default App;
