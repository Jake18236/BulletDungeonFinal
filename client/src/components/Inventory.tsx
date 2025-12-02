import React, { useEffect } from "react";
import { useInventory } from "../lib/stores/useInventory";

export default function InventoryUI() {
  const inventory = useInventory();

  const slots = Array(8).fill(null);
  inventory.items.forEach((item, idx) => {
    if (idx < slots.length) slots[idx] = item;
  });
  
  // --- Handle hotkeys 1-8 ---
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key >= "1" && e.key <= "8") {
        const index = parseInt(e.key) - 1;
        const item = slots[index];
        if (item) {
          inventory.equipWeapon(item.id);
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [slots]);

  return (
    
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 pointer-events-auto">
      {slots.map((item, idx) => (
        <div
          key={idx}
          className={`w-12 h-12 border-2 border-gray-700 rounded-md flex items-center justify-center
                      ${inventory.equippedWeaponId === item?.id ? "border-yellow-400" : ""}`}
          onClick={() => item && inventory.equipWeapon(item.id)}
        >
          {item ? <img src={item.icon} alt={item.name} className="w-10 h-10" /> : null}
        </div>
      ))}
    </div>
  );
}