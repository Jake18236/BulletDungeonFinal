import React, { useEffect } from "react";
import { useSpellSlots } from "../lib/stores/useSpellSlots";


export default function SpellSlotsHUD() {
  const { slots, activeSlotId, setActiveSlot, getSlotStats } = useSpellSlots();

  // Hotkeys 1-5 for slot selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key >= "1" && key <= "5") {
        const slotId = parseInt(key);
        setActiveSlot(slotId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveSlot]);

  return (
    <div className="fixed bottom-1 left-1/2 transform -translate-x-1/2 pointer-events-auto">
      <div className="flex gap-2">
        {slots.map((slot) => {
          const isActive = slot.id === activeSlotId;
          const stats = getSlotStats(slot.id);
          const cooldownPercent = slot.isOnCooldown 
            ? ((slot.cooldown / slot.maxCooldown) * 100)
            : 0;

          return (
            <div
              key={slot.id}
              className={`relative w-20 h-20 rounded-lg border-4 cursor-pointer transition-all
                ${isActive 
                  ? 'border-yellow-400 bg-gray-800 scale-110' 
                  : 'border-gray-600 bg-gray-900 hover:border-gray-400'
                }
                ${slot.isOnCooldown ? 'opacity-50' : ''}
              `}
              onClick={() => setActiveSlot(slot.id)}
            >
              {/* Slot number */}
              <div className="absolute top-1 left-1 text-white text-xs font-bold bg-black bg-opacity-50 px-1 rounded">
                {slot.id}
              </div>

              {/* Cooldown overlay */}
              {slot.isOnCooldown && (
                <div 
                  className="absolute bottom-0 left-0 right-0 bg-red-500 bg-opacity-40 transition-all"
                  style={{ height: `${cooldownPercent}%` }}
                />
              )}

              {/* Cards in slot */}
              <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-0.5 p-1">
                {slot.cards.slice(0, 4).map((card, idx) => (
                  <div 
                    key={card.id}
                    className={`text-lg ${card.isBuff ? '' : 'opacity-60'}`}
                    title={card.name}
                  >
                    {card.icon}
                  </div>
                ))}
                {slot.cards.length > 4 && (
                  <div className="text-xs text-white">+{slot.cards.length - 4}</div>
                )}
              </div>

              {/* Stats preview on hover */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block">
                <div className="bg-black bg-opacity-90 text-white text-xs p-2 rounded whitespace-nowrap">
                  <div>DMG: {stats.damage.toFixed(0)}</div>
                  <div>SPD: {stats.speed.toFixed(0)}</div>
                  <div>RNG: {stats.range.toFixed(0)}</div>
                  {stats.projectileCount > 1 && <div>x{stats.projectileCount}</div>}
                  {stats.homing && <div>🎯 Homing</div>}
                  {stats.piercing > 0 && <div>➡️ Pierce {stats.piercing}</div>}
                  {stats.bouncing > 0 && <div>⚡ Bounce {stats.bouncing}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active slot details */}
      <div className="mt-2 text-center">
        <div className="bg-black bg-opacity-80 text-white text-sm px-4 py-2 rounded-lg inline-block">
          {(() => {
            const stats = getSlotStats(activeSlotId);
            return (
              <div className="flex gap-4">
                <span>💥 {stats.damage.toFixed(0)}</span>
                <span>🚀 {stats.speed.toFixed(0)}</span>
                <span>📏 {stats.range.toFixed(0)}</span>
                {stats.projectileCount > 1 && <span>🔱 x{stats.projectileCount}</span>}
                {stats.homing && <span>🎯</span>}
                {stats.piercing > 0 && <span>➡️ {stats.piercing}</span>}
                {stats.bouncing > 0 && <span>⚡ {stats.bouncing}</span>}
                {stats.explosive && <span>💣</span>}
                {stats.chainLightning && <span>⚡</span>}
              </div>
            );
          })()}
        </div>
      </div>

      
    </div>
  );
}