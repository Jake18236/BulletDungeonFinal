import { create } from "zustand";

interface Item {
  id: string;
  name: string;
  icon: string;
  quantity: number;
  type: "consumable" | "weapon" | "armor" | "treasure";
  effect?: {
    health?: number;
    attack?: number;
    defense?: number;
  };
}

interface InventoryState {
  items: Item[];
  showInventory: boolean;
  
  // Actions
  addItem: (item: Partial<Item>) => void;
  removeItem: (id: string) => void;
  useItem: (id: string) => void;
  toggleInventory: () => void;
  reset: () => void;
}

export const useInventory = create<InventoryState>((set, get) => ({
  items: [],
  showInventory: false,
  
  addItem: (itemData) => {
    const item: Item = {
      id: Math.random().toString(36),
      name: "Unknown Item",
      icon: "?",
      quantity: 1,
      type: "treasure",
      ...itemData
    };
    
    // Check if item already exists (for stackable items)
    const existingItem = get().items.find(i => i.name === item.name && i.type === item.type);
    
    if (existingItem && item.type === "consumable") {
      // Stack consumable items
      set((state) => ({
        items: state.items.map(i => 
          i.id === existingItem.id 
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        )
      }));
    } else {
      // Add as new item
      set((state) => ({
        items: [...state.items, item]
      }));
    }
  },
  
  removeItem: (id) => set((state) => ({
    items: state.items.filter(item => item.id !== id)
  })),
  
  useItem: (id) => {
    const { items } = get();
    const item = items.find(i => i.id === id);
    
    if (!item) return;
    
    if (item.type === "consumable" && item.effect) {
      // Apply item effect to player
      import("./usePlayer").then(({ usePlayer }) => {
        const player = usePlayer.getState();
        
        if (item.effect!.health) {
          // Heal player
          const newHealth = Math.min(
            player.health + item.effect!.health,
            player.maxHealth
          );
          usePlayer.setState({ health: newHealth });
        }
      });
      
      // Reduce quantity or remove item
      if (item.quantity > 1) {
        set((state) => ({
          items: state.items.map(i => 
            i.id === id 
              ? { ...i, quantity: i.quantity - 1 }
              : i
          )
        }));
      } else {
        get().removeItem(id);
      }
    }
  },
  
  toggleInventory: () => set((state) => ({
    showInventory: !state.showInventory
  })),
  
  reset: () => set({
    items: [],
    showInventory: false
  })
}));
