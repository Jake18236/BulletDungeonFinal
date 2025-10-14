interface Combatant {
  attack: number;
  defense: number;
  health: number;
}

export function processCombat(attacker: Combatant, defender: Combatant): number {
  // Calculate damage with some randomness
  const baseDamage = attacker.attack;
  const randomFactor = 0.8 + Math.random() * 0.4; // 80% to 120% of base damage
  const rawDamage = Math.floor(baseDamage * randomFactor);
  
  // Apply defense
  const damage = Math.max(1, rawDamage - defender.defense);
  
  // Apply damage to defender
  defender.health = Math.max(0, defender.health - damage);
  
  return damage;
}

export function calculateHitChance(attacker: Combatant, defender: Combatant): number {
  // Simple hit chance calculation
  const baseChance = 0.85; // 85% base hit chance
  const levelDifference = (attacker.attack - defender.defense) * 0.01; // 1% per point difference
  
  return Math.max(0.1, Math.min(0.95, baseChance + levelDifference));
}

export function isHit(attacker: Combatant, defender: Combatant): boolean {
  const hitChance = calculateHitChance(attacker, defender);
  return Math.random() < hitChance;
}

export function calculateCriticalHit(): { isCritical: boolean; multiplier: number } {
  const critChance = 0.1; // 10% critical hit chance
  const isCritical = Math.random() < critChance;
  const multiplier = isCritical ? 1.5 + Math.random() * 0.5 : 1; // 1.5x to 2x damage
  
  return { isCritical, multiplier };
}
