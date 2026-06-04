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
// At the top of useHit.tsx, outside create():
export const _pendingImpacts: Array<{ x: number; y: number; z: number; size: number }> = [];
export const _pendingDamageNumbers: Array<{ x: number; y: number; damage: number }> = [];

export function flushHitEffects() {
  if (_pendingImpacts.length === 0 && _pendingDamageNumbers.length === 0) return;

  const { addImpactBatch, addDamageNumberBatch } = useVisualEffects.getState();

  if (_pendingImpacts.length > 0) {
    addImpactBatch(_pendingImpacts);       // one set() for all impacts this frame
    _pendingImpacts.length = 0;
  }
  if (_pendingDamageNumbers.length > 0) {
    addDamageNumberBatch(_pendingDamageNumbers);  // one set() for all numbers this frame
    _pendingDamageNumbers.length = 0;
  }
}


  const _tmpKnockback = new THREE.Vector3();

  export const useHit = create<HitState>((set, get) => {
    // Cache store accessors once at store creation, not per-hit:
    const getVisualEffects = () => useVisualEffects.getState();
    const getAudio = () => useAudio.getState();
    const getSummons = () => useSummons.getState();
    const getPlayer = () => usePlayer.getState();

    return {
      applyHit: (params, allEnemies = []) => {
        const { enemy, damage, impactPos, knockbackStrength = 8 } = params;

        enemy.health -= damage;
        enemy.hitFlash = 0.08;

        if (impactPos) {
          _pendingImpacts.push({ x: impactPos.x, y: impactPos.y, z: impactPos.z, size: 48 });
        }
        _pendingDamageNumbers.push({
          x: enemy.position.x + (Math.random() * 2 - 1),
          y: enemy.position.z + (Math.random() * 2 - 1),
          damage,
        });

        const knockbackOrigin = params.sourcePos ?? (params.isPlayerDamage ? getPlayer().position : impactPos);
        if (knockbackOrigin) {
          _tmpKnockback.subVectors(enemy.position, knockbackOrigin);
          _tmpKnockback.y = 0;
          if (_tmpKnockback.lengthSq() > 0.1) {
            const ps = getPlayer();
            let finalKnockback = knockbackStrength * 3 * ps.knockbackMultiplier;
            if (enemy.type === "tree") finalKnockback = 0;
            else if (enemy.type === "tank") finalKnockback *= 0.4;

            if (finalKnockback > 0) {
              _tmpKnockback.normalize();
              const knockbackDurationMs = 0.15;
              if (!enemy.knockbackAcceleration) {
                enemy.knockbackAcceleration = new THREE.Vector3();
              }
              enemy.knockbackAcceleration.copy(_tmpKnockback).multiplyScalar(finalKnockback / knockbackDurationMs);
              enemy.knockbackDuration = knockbackDurationMs;
            }
          }
        }
        if (params.burn) {
          getSummons().applyStatusEffect(enemy.id, "burn", params.burn.damage, params.burn.duration);
        }

        if (params.explosive && params.impactPos && allEnemies.length > 0) {
          get().applyExplosiveDamage(params.impactPos.clone(), params.explosive.radius, params.explosive.damage, allEnemies, params.color);
        }

        const died = get().checkDeath(enemy);
        if (died) {
          if (params.isSummonDamage) getSummons().handleEnemyKilledBySummon();
          if (params.isPlayerDamage) {
            const ps = getPlayer();
            if (ps.killClip) ps.addKillClipStack();
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
        const {
          loseHeart,
          position,
          velocity,
          invincibilityTimer,
        } = usePlayer.getState();

        if (invincibilityTimer > 0) return;

        const { playHit } = useAudio.getState();

        // Direction away from hit
        let dir = new THREE.Vector3();
        

        if (impactPos) {
          dir = position.clone().sub(impactPos).normalize();
        }

        const knockbackStrength = 12; // tune this

        // Add impulse to velocity instead of teleporting
        velocity.add(dir.multiplyScalar(knockbackStrength*999));

        loseHeart();
        playHit();
      },
}
  });
