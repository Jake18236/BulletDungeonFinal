export interface Room {
  x: number;
  y: number;
  exits: string[];
  type: "normal" | "treasure" | "boss";
  enemies: number;
  items: any[];
}

export function generateRoom(x: number, y: number): Room {
  // Generate 1-4 exits randomly
  const possibleExits = ["north", "south", "east", "west"];
  const numExits = Math.floor(Math.random() * 3) + 1; // 1-3 exits
  const exits: string[] = [];
  
  // Ensure at least one exit
  while (exits.length < numExits) {
    const exit = possibleExits[Math.floor(Math.random() * possibleExits.length)];
    if (!exits.includes(exit)) {
      exits.push(exit);
    }
  }
  
  // Determine room type
  const rand = Math.random();
  let type: "normal" | "treasure" | "boss" = "normal";
  
  if (rand < 0.1) {
    type = "treasure";
  } else if (rand < 0.05 && (Math.abs(x) > 3 || Math.abs(y) > 3)) {
    type = "boss";
  }
  
  // Generate enemies count based on room type
  let enemies = 0;
  if (type === "normal") {
    enemies = Math.floor(Math.random() * 3) + 1; // 1-3 enemies
  } else if (type === "boss") {
    enemies = 1; // Boss enemy
  }
  
  // Generate items for treasure rooms
  const items: any[] = [];
  if (type === "treasure") {
    items.push({
      type: "consumable",
      name: "Health Potion",
      icon: "🧪",
      effect: { health: 30 }
    });
  }
  
  return {
    x,
    y,
    exits,
    type,
    enemies,
    items
  };
}

export function generateDungeonMap(size: number = 10): Map<string, Room> {
  const rooms = new Map<string, Room>();
  
  // Generate starting room
  const startRoom = generateRoom(0, 0);
  rooms.set("0,0", startRoom);
  
  // Generate connected rooms using a simple algorithm
  const toGenerate = [{ x: 0, y: 0 }];
  const generated = new Set(["0,0"]);
  
  while (toGenerate.length > 0 && rooms.size < size) {
    const current = toGenerate.shift()!;
    const currentRoom = rooms.get(`${current.x},${current.y}`)!;
    
    // For each exit in current room, potentially generate a connected room
    currentRoom.exits.forEach(exit => {
      let newX = current.x;
      let newY = current.y;
      
      switch (exit) {
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
      
      if (!generated.has(roomKey) && Math.random() < 0.7) {
        const newRoom = generateRoom(newX, newY);
        rooms.set(roomKey, newRoom);
        generated.add(roomKey);
        toGenerate.push({ x: newX, y: newY });
      }
    });
  }
  
  return rooms;
}
