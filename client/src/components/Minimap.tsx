import { useDungeon } from "../lib/stores/useDungeon";
import { usePlayer } from "../lib/stores/usePlayer";
import { Card, CardContent } from "./ui/card";

export default function Minimap() {
  const { currentRoom } = useDungeon();
  const { position } = usePlayer();

  if (!currentRoom) return null;

  return (
    <Card className="bg-black bg-opacity-80 text-white border-gray-600">
      <CardContent className="p-3">
        <div className="text-xs font-medium mb-2">Minimap</div>
        <div className="w-28 h-28 bg-gray-800 border border-gray-600 relative">
          {/* Current room */}
          <div className="absolute inset-1 bg-gray-700 border border-gray-500">
            {/* Player position */}
            <div 
              className="absolute w-2 h-2 bg-blue-400 rounded-full"
              style={{
                left: `${((position.x + 20) / 40) * 100}%`,
                top: `${((position.z + 20) / 40) * 100}%`,
                transform: 'translate(-50%, -50%)'
              }}
            />

          </div>

          {/* Single room */}
          <div className="absolute -bottom-5 left-0 text-xs text-gray-400">
            Room
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
