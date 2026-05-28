import { useEffect } from "react";
import { useGame } from "./lib/stores/useGame";
import CanvasGame, { CANVAS_HEIGHT, CANVAS_WIDTH } from "./components/CanvasGame";
import GameUI from "./components/GameUI";
import DevTools from "./components/DevTools";

function App() {
  const { phase } = useGame();

  return (
    <div style={{ cursor: "none" }}>
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-gray-900 overflow-hidden relative">

        <div className="flex items-center justify-center">
          <CanvasGame />
        </div>

      <GameUI />
      

    </div>
    </div>
  );
}

export default App;