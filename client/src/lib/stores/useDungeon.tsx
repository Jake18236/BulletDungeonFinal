import { create } from "zustand";
import { generateRoom, type Room } from "../dungeonGenerator";

interface DungeonState {
  currentRoom: Room | null;
  visitedRooms: Map<string, Room>;
  
  // Actions
  generateDungeon: () => void;
  changeRoom: (direction: string) => void;
  reset: () => void;
}

export const useDungeon = create<DungeonState>((set, get) => ({
  currentRoom: null,
  visitedRooms: new Map(),
  
  generateDungeon: () => {
    const startRoom = generateRoom(0, 0);
    set({
      currentRoom: startRoom,
      visitedRooms: new Map([["0,0", startRoom]])
    });
  },
  
  changeRoom: (direction) => {
    const { currentRoom, visitedRooms } = get();
    if (!currentRoom) return;
    
    // Calculate new room coordinates
    let newX = currentRoom.x;
    let newY = currentRoom.y;
    
    switch (direction) {
      case "north":
        newY += 1;
        break;
      case "south":
        newY -= 1;
        break;
      case "east":
        newX += 1;
        break;
      case "west":
        newX -= 1;
        break;
    }
    
    const roomKey = `${newX},${newY}`;
    let newRoom = visitedRooms.get(roomKey);
    
    // Generate new room if not visited
    if (!newRoom) {
      newRoom = generateRoom(newX, newY);
      visitedRooms.set(roomKey, newRoom);
      
      // Generate enemies for new room
      import("./useEnemies").then(({ useEnemies }) => {
        useEnemies.getState().generateRoomEnemies();
      });
    }
    
    set({
      currentRoom: newRoom,
      visitedRooms: new Map(visitedRooms)
    });
  },
  
  reset: () => set({
    currentRoom: null,
    visitedRooms: new Map()
  })
}));
