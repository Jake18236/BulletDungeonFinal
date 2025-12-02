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
  equippedWeaponId?: string;
  showInventory: boolean;

  addItem: (item: Partial<Item>) => void;
  removeItem: (id: string) => void;
  useItem: (id: string) => void;
  equipWeapon: (id: string) => void;
  toggleInventory: () => void;
  reset: () => void;
}

export const useInventory = create<InventoryState>((set, get) => ({
  items: [],
  equippedWeaponId: undefined,
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

    const existing = get().items.find(i => i.name === item.name && i.type === item.type);

    if (existing && item.type === "consumable") {
      set(state => ({
        items: state.items.map(i =>
          i.id === existing.id ? { ...i, quantity: i.quantity + item.quantity } : i
        )
      }));
    } else {
      set(state => ({ items: [...state.items, item] }));
    }
  },

  removeItem: (id) => set(state => ({ items: state.items.filter(i => i.id !== id) })),

  useItem: (id) => {
    const item = get().items.find(i => i.id === id);
    if (!item) return;

    if (item.type === "weapon") {
      get().equipWeapon(id);
      return;
    }

    // handle consumables here if needed
    if (item.type === "consumable" && item.effect) {
      import("./usePlayer").then(({ usePlayer }) => {
        const player = usePlayer.getState();
        if (item.effect!.health) {
          const newHealth = Math.min(player.health + item.effect!.health, player.maxHealth);
          usePlayer.setState({ health: newHealth });
        }
      });

      if (item.quantity > 1) {
        set(state => ({
          items: state.items.map(i =>
            i.id === id ? { ...i, quantity: i.quantity - 1 } : i
          )
        }));
      } else {
        get().removeItem(id);
      }
    }
  },

  equipWeapon: (id) => set({ equippedWeaponId: id }),

  toggleInventory: () => set(state => ({ showInventory: !state.showInventory })),

  reset: () => set({
    items: [
      { id: "sword", name: "Sword", icon: "🗡️", quantity: 1, type: "weapon" },
      { id: "revolver", name: "Revolver", icon: "🏹", quantity: 1, type: "weapon" },
    ],

    showInventory: false,
    equippedWeaponId: "revolver",
  })
}));