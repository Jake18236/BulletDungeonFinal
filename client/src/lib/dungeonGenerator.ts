export interface Room {
  type: "normal" | "treasure" | "boss";
  enemies: number;
  items: any[];
}

export function generateRoom(): Room {
  const type: Room["type"] = "normal";
  const enemies = Math.floor(Math.random() * 3) + 1;
  const items: any[] = [];
  
  return {
    type,
    enemies,
    items
  };
}

export function generateDungeonMap(size: number = 10): Map<string, Room> {
  const rooms = new Map<string, Room>();

  // Single-room dungeon.
  const startRoom = generateRoom();
  rooms.set("0,0", startRoom);

  return rooms;
}
