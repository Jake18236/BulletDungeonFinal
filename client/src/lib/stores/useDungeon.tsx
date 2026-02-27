import { create } from "zustand";
import { generateRoom, type Room } from "../dungeonGenerator";

interface DungeonState {
  currentRoom: Room | null;

  // Actions
  generateDungeon: () => void;
  reset: () => void;
}

export const useDungeon = create<DungeonState>((set) => ({
  currentRoom: null,

  generateDungeon: () => {
    const startRoom = generateRoom();
    set({
      currentRoom: startRoom,
    });
  },

  reset: () => set({
    currentRoom: null,
  })
}));
