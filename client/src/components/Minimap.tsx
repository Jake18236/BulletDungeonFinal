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
            
            {/* Room exits */}
            {currentRoom.exits.map((exit, index) => (
              <div
                key={index}
                className={`absolute w-2 h-2 bg-green-400 ${
                  exit === 'north' ? 'top-0 left-1/2 -translate-x-1/2' :
                  exit === 'south' ? 'bottom-0 left-1/2 -translate-x-1/2' :
                  exit === 'east' ? 'right-0 top-1/2 -translate-y-1/2' :
                  exit === 'west' ? 'left-0 top-1/2 -translate-y-1/2' : ''
                }`}
              />
            ))}
          </div>
          
          {/* Room coordinates */}
          <div className="absolute -bottom-5 left-0 text-xs text-gray-400">
            Room ({currentRoom.x}, {currentRoom.y})
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
