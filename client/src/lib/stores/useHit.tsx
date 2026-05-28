// client/src/lib/stores/useHit.tsx
import { create } from "zustand";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useVisualEffects } from "./useVisualEffects";
import { useAudio } from "./useAudio";
import { usePlayer } from "./usePlayer";
import { useSummons } from "./useSummons";
import { Enemy, useEnemies } from "./useEnemies";
import { useCamera } from "./useCamera";
import { GameCamera2D, getPixelPerfectScale } from "../camera";

export interface ImpactParams {
  enemy: Enemy;
  damage: number;
  impactPos?: THREE.Vector3;
  sourcePos?: THREE.Vector3;
  color?: string;
  knockbackStrength?: number;

  // Optional effects
  burn?: { damage: number; duration: number };
  curse?: boolean;
  explosive?: { radius: number; damage: number };
  chainLightning?: { chains: number; range: number; chainedEnemies: Set<string> };

  // Source tracking
  isSummonDamage?: boolean;
  isPlayerDamage?: boolean;
}

interface HitState {
  applyHit: (params: ImpactParams, allEnemies?: Enemy[]) => void;
  checkDeath: (enemy: Enemy) => boolean;
  applyExplosiveDamage: (
    center: THREE.Vector3,
    radius: number,
    damage: number,
    allEnemies: Enemy[],
    sourceColor?: string
  ) => void;
  applyChainLightning: (
    startEnemy: Enemy,
    chains: number,
    range: number,
    damage: number,
    chainedEnemies: Set<string>,
    allEnemies: Enemy[]
  ) => void;
  applyPlayerDamage: (damage: number, impactPos?: THREE.Vector3) => void;
}

export const useHit = create<HitState>((set, get) => ({
  applyHit: (params, allEnemies = []) => {
    const { enemy, damage, impactPos, knockbackStrength = 8 } = params;
    
    const { addImpact, addDamageNumber } = useVisualEffects.getState();
    const { playHit } = useAudio.getState();
    const { applyStatusEffect } = useSummons.getState();

    enemy.health -= damage;
    enemy.hitFlash = 0.08;
    
    if (impactPos) {
      addImpact(impactPos, 48);
    } 
    addDamageNumber(enemy.position.x + (Math.random() * 2 - 1), 
    enemy.position.z + (Math.random() * 2 - 1), 
    damage);

    if (!enemy.velocity) {
      enemy.velocity = new THREE.Vector3();
    }

    const playerPosition = usePlayer.getState().position;
    const knockbackOrigin = params.sourcePos ?? (params.isPlayerDamage ? playerPosition : impactPos);

    if (knockbackOrigin) {
      const dir = enemy.position.clone().sub(knockbackOrigin);
      dir.y = 0;
      if (dir.lengthSq() > 0.1) {
        const ps = usePlayer.getState();
        let finalKnockback = knockbackStrength * (ps.knockbackMultiplier);
        
        if (enemy.type === "tank") {
          finalKnockback *= 0.4;
        }
        
        dir.normalize();
        
        // Apply knockback gradually over time (0.15 seconds) for smoother acceleration
        const knockbackDurationMs = 0.1;
        if (!enemy.knockbackAcceleration) {
          enemy.knockbackAcceleration = new THREE.Vector3();
        }
        enemy.knockbackAcceleration = dir.multiplyScalar(finalKnockback / knockbackDurationMs);
        enemy.knockbackDuration = knockbackDurationMs;
      }
    }

    playHit();

    if (params.burn) {
      applyStatusEffect(enemy.id, "burn", params.burn.damage, params.burn.duration);
    }

    if (params.curse) {
      const ps = usePlayer.getState();
      const summonState = useSummons.getState();
      const curseDamage = ps.baseDamage * 2 * (1 + summonState.curseDamageBonus);
      applyStatusEffect(enemy.id, "curse", curseDamage, 1);
    }

    if (params.explosive && params.impactPos && allEnemies.length > 0) {
      get().applyExplosiveDamage(
        params.impactPos.clone(),
        params.explosive.radius,
        params.explosive.damage,
        allEnemies,
        params.color
      );
    }

    const died = get().checkDeath(enemy);

    if (died) {
      if (params.isSummonDamage) {
        useSummons.getState().handleEnemyKilledBySummon();
      }

      if (params.isPlayerDamage) {
        const ps = usePlayer.getState();
        if (ps.killClip) {
          ps.addKillClipStack();
        }
      }
    }
  },

  checkDeath: (enemy) => {
    const ps = usePlayer.getState();

    if (ps.instantKillThreshold > 0) {
      const healthPercent = enemy.health / enemy.maxHealth;
      if (healthPercent > 0 && healthPercent <= ps.instantKillThreshold) {
        enemy.health = 0;

        const { addImpact } = useVisualEffects.getState();

        return true;
      }
    }

    return enemy.health <= 0;
  },

  applyExplosiveDamage: (center, radius, damage, allEnemies, sourceColor = "#ff6600") => {
    const { addExplosion, addDamageNumber } = useVisualEffects.getState();
    const { playHit } = useAudio.getState();

    addExplosion(center, radius, 1);

    allEnemies.forEach(enemy => {
      const distance = enemy.position.distanceTo(center);
      if (distance < radius) {
        const falloff = 1 - (distance / radius);
        const finalDamage = damage * falloff;

        enemy.health -= finalDamage;

        const { addImpact } = useVisualEffects.getState();
        addImpact(enemy.position.clone(), 64);
        addDamageNumber(enemy.position.x, enemy.position.z, finalDamage);

        if (!enemy.velocity) enemy.velocity = new THREE.Vector3();
        const knockbackDir = enemy.position.clone().sub(center).normalize();
        enemy.velocity.add(knockbackDir.multiplyScalar(24 * falloff));
      }
    });

    playHit();
  },

  applyChainLightning: (startEnemy, chains, range, damage, chainedEnemies, allEnemies) => {
    if (chainedEnemies.size >= chains) return;

    const { playHit } = useAudio.getState();
    const { addDamageNumber, addImpact } = useVisualEffects.getState();

    const targets = allEnemies.filter(e =>
      e.id !== startEnemy.id &&
      !chainedEnemies.has(e.id) &&
      e.position.distanceTo(startEnemy.position) < range &&
      e.health > 0
    );

    if (targets.length === 0) return;

    const target = targets.reduce((nearest, e) => {
      const dist = e.position.distanceTo(startEnemy.position);
      const nearestDist = nearest.position.distanceTo(startEnemy.position);
      return dist < nearestDist ? e : nearest;
    });

    target.health -= damage;
    chainedEnemies.add(target.id);

    addImpact(target.position.clone());
    addDamageNumber(target.position.x, target.position.z, damage);

    playHit();

    if (chainedEnemies.size < chains) {
      get().applyChainLightning(
        target,
        chains,
        range,
        damage * 0.7,
        chainedEnemies,
        allEnemies
      );
    }
  },

  applyPlayerDamage: (impactPos) => {
    const { loseHeart, position, invincibilityTimer } = usePlayer.getState();
    if (invincibilityTimer > 0) return;
    const { playHit } = useAudio.getState();
    loseHeart();
    playHit();

  },
}));
