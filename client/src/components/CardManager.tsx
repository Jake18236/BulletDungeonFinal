import React, { useState } from "react";
import { useSpellSlots, CARD_LIBRARY, Card } from "../lib/stores/useSpellSlots";
import { Button } from "./ui/button";
import { X } from "lucide-react";

export default function CardManager() {
  const { 
    slots, 
    activeSlotId, 
    availableCards, 
    addCardToSlot, 
    removeCardFromSlot,
    getSlotStats 
  } = useSpellSlots();
  
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState(1);

  const activeSlot = slots.find(s => s.id === selectedSlotId);
  const stats = getSlotStats(selectedSlotId);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed top-20 right-4 z-50 bg-purple-600 hover:bg-purple-700"
      >
        📇 Cards (C)
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 text-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto border-2 border-purple-500">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-2xl font-bold">Card Manager</h2>
          <Button
            onClick={() => setIsOpen(false)}
            variant="ghost"
            size="sm"
          >
            <X />
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
          {/* Left: Slot Selection & Cards */}
          <div>
            <h3 className="text-xl font-semibold mb-4">Select Slot to Modify</h3>
            
            {/* Slot selector */}
            <div className="flex gap-2 mb-6">
              {slots.map(slot => (
                <button
                  key={slot.id}
                  onClick={() => setSelectedSlotId(slot.id)}
                  className={`px-4 py-2 rounded-lg font-bold transition-all
                    ${selectedSlotId === slot.id 
                      ? 'bg-purple-600 border-2 border-yellow-400' 
                      : 'bg-gray-700 border-2 border-gray-600 hover:border-gray-400'
                    }
                  `}
                >
                  Slot {slot.id}
                </button>
              ))}
            </div>

            {/* Current cards in slot */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-2">
                Cards in Slot {selectedSlotId}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {activeSlot?.cards.map(card => (
                  <div
                    key={card.id}
                    className={`p-3 rounded-lg border-2 relative
                      ${card.isBuff 
                        ? 'bg-green-900 border-green-600' 
                        : 'bg-red-900 border-red-600'
                      }
                    `}
                  >
                    <button
                      onClick={() => removeCardFromSlot(selectedSlotId, card.id)}
                      className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                    <div className="text-2xl mb-1">{card.icon}</div>
                    <div className="font-semibold text-sm">{card.name}</div>
                    <div className="text-xs opacity-75">{card.description}</div>
                  </div>
                ))}
                {activeSlot?.cards.length === 0 && (
                  <div className="col-span-2 text-center text-gray-500 py-8">
                    No cards equipped. Add cards from the library below.
                  </div>
                )}
              </div>
            </div>

            {/* Stats preview */}
            <div className="bg-gray-800 p-4 rounded-lg">
              <h4 className="text-lg font-semibold mb-3">Slot Stats</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>💥 Damage: <span className="font-bold">{stats.damage.toFixed(1)}</span></div>
                <div>🚀 Speed: <span className="font-bold">{stats.speed.toFixed(1)}</span></div>
                <div>📏 Range: <span className="font-bold">{stats.range.toFixed(1)}</span></div>
                <div>⏱️ Reload: <span className="font-bold">{(0.5 * stats.reload).toFixed(2)}s</span></div>
                <div>🔱 Projectiles: <span className="font-bold">{stats.projectileCount}</span></div>
                <div>🎯 Accuracy: <span className="font-bold">{(stats.accuracy * 100).toFixed(0)}%</span></div>
                {stats.homing && <div className="col-span-2 text-purple-400">🎯 Homing Enabled</div>}
                {stats.piercing > 0 && <div className="col-span-2 text-yellow-400">➡️ Pierce {stats.piercing} enemies</div>}
                {stats.bouncing > 0 && <div className="col-span-2 text-green-400">⚡ Bounce {stats.bouncing} times</div>}
                {stats.explosive && <div className="col-span-2 text-orange-400">💣 Explosive (R: {stats.explosive.radius}, D: {stats.explosive.damage})</div>}
                {stats.chainLightning && <div className="col-span-2 text-cyan-400">⚡ Chain to {stats.chainLightning.chains} enemies</div>}
              </div>
            </div>
          </div>

          {/* Right: Available Cards Library */}
          <div>
            <h3 className="text-xl font-semibold mb-4">Card Library</h3>
            
            {/* Buffs */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-2 text-green-400">✨ Buffs</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(CARD_LIBRARY)
                  .filter(([_, card]) => card.isBuff)
                  .map(([type, cardData]) => {
                    const card: Card = {
                      id: `new_${type}_${Date.now()}`,
                      ...cardData
                    };
                    
                    return (
                      <button
                        key={type}
                        onClick={() => addCardToSlot(selectedSlotId, card)}
                        className="p-3 bg-green-900 border-2 border-green-600 rounded-lg hover:border-green-400 transition-all text-left"
                      >
                        <div className="text-2xl mb-1">{card.icon}</div>
                        <div className="font-semibold text-sm">{card.name}</div>
                        <div className="text-xs opacity-75">{card.description}</div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Debuffs */}
            <div>
              <h4 className="text-lg font-semibold mb-2 text-red-400">⚠️ Debuffs</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(CARD_LIBRARY)
                  .filter(([_, card]) => !card.isBuff)
                  .map(([type, cardData]) => {
                    const card: Card = {
                      id: `new_${type}_${Date.now()}`,
                      ...cardData
                    };
                    
                    return (
                      <button
                        key={type}
                        onClick={() => addCardToSlot(selectedSlotId, card)}
                        className="p-3 bg-red-900 border-2 border-red-600 rounded-lg hover:border-red-400 transition-all text-left"
                      >
                        <div className="text-2xl mb-1">{card.icon}</div>
                        <div className="font-semibold text-sm">{card.name}</div>
                        <div className="text-xs opacity-75">{card.description}</div>
                      </button>
                    );
                  })}
              </div>
            </div>

            
          </div>
        </div>
      </div>
    </div>
  );
}