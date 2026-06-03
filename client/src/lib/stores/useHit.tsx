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
  applyPlayerDamage: (impactPos: THREE.Vector3) => void;
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
      const _knockbackDir = new THREE.Vector3();

      _knockbackDir.subVectors(enemy.position, knockbackOrigin);
      _knockbackDir.y = 0;
      if (_knockbackDir.lengthSq() > 0.1) {
        const ps = usePlayer.getState();
        let finalKnockback = knockbackStrength*3 * (ps.knockbackMultiplier);

        if (enemy.type === "tree") {
          finalKnockback = 0;
        } else if (enemy.type === "tank") {
          finalKnockback *= 0.4;
        } else if (enemy.type === "mage") {
          finalKnockback *= 0.5;
        }

        if (finalKnockback > 0) {
          _knockbackDir.normalize();

          const knockbackDurationMs = 0.15;
          if (!enemy.knockbackAcceleration) {
            enemy.knockbackAcceleration = new THREE.Vector3();
          }
          enemy.knockbackAcceleration.copy(_knockbackDir).multiplyScalar(finalKnockback / knockbackDurationMs);
          enemy.knockbackDuration = knockbackDurationMs;
        }
      }
    }

    playHit();

    if (params.burn) {
      applyStatusEffect(enemy.id, "burn", params.burn.damage, params.burn.duration);
    }

    if (params.explosive && params.impactPos) {
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

  applyExplosiveDamage: (center, radius, damage, allEnemies) => {
    const { addExplosion, addDamageNumber } = useVisualEffects.getState();
    const { playHit } = useAudio.getState();
    const { applyStatusEffect } = useSummons.getState();

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

        applyStatusEffect(enemy.id, "burn", 4, 3.0);
      }
    });

    playHit();
  },


  applyPlayerDamage: (impactPos) => {
    const { loseHeart, position, velocity, invincibilityTimer } = usePlayer.getState();
    if (invincibilityTimer > 0) return;
    const { playHit } = useAudio.getState();

    // Calculate knockback direction from impact position
    let dir = new THREE.Vector3(0, 0, 0);
    if (impactPos) {
      dir = position.clone().sub(impactPos).normalize();
    }
      const knockbackDurationMs = 0.2;
      
      position.multiplyScalar(5 * knockbackDurationMs);

    loseHeart();
    playHit();
  },
}));
