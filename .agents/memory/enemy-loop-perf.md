---
name: Enemy loop performance optimizations
description: Hot-path GC and CPU optimizations in the enemy update loop (CanvasGame.tsx + useEnemies.tsx)
---

## What was done

### CanvasGame.tsx
- `enemies.map()` → `for (const enemy of enemies)` — avoids new array + callback allocation every frame
- Lazarus/Reaper `{ ...enemy }` spread removed — direct mutation; `return updated` → `continue`
- Module-level pooled vectors `_laz1`–`_laz7`, `_rep1` replace all `new THREE.Vector3()` in Lazarus beam loop (was 20+ allocations/frame/boss during laser_firing) and Reaper dash
- Lazarus beam lateral: Pythagoras `latSq = _laz7.lengthSq() - along*along` replaces `toPlayer.clone().sub(...).length()` (was 3 clones per beam per frame)
- Reaper `dashDirection = new THREE.Vector3(...)` → `dashDirection.set(...)` with lazy init guard
- Velocity cap: `Math.hypot` → squared early exit (`vspdSq > speed²`) — avoids sqrt in common case
- Mage `enemies.filter().length` → direct count loop; squared distance `< 100` replaces `Math.sqrt(...) < 10`
- Mage heal loop `Math.sqrt(ax²+az²) < 9` → `(ax²+az²) < 81`
- Separation loop: player-distance broad-phase (`e1px²+e1pz² > 12100`) on outer loop; overlap check uses squared dist → sqrt only when actually overlapping
- Mage particle `filter()` → write-index compaction (`atk.particles.length = _pWrite`)
- Crow `Math.random()` wobble → deterministic `Math.sin(crowSeed*2.618 + t*8.3)` using `parseInt(enemy.id)`
- Crow velocity dampening: removed `Math.random()` from `Math.pow(0.92, delta*60 + Math.random())`
- All `crypto.randomUUID()` → incrementing counters (`_nextImpactId`, `_nextProjectileId`, `_nextFootstepId`)
- `const updatedEnemies = enemies;` — same reference, no copy

### useEnemies.tsx
- Added `nextPopupId`, `nextOrbId` counters alongside existing `nextEnemyId`
- Damage popup: `crypto.randomUUID()` → `String(nextPopupId++)`
- XP orb: `Math.random().toString(36)` → `String(nextOrbId++)`
- Crow spawn: `"crow_" + Date.now() + "_" + Math.random()...` → `String(nextEnemyId++)`
- Tree spawn: same pattern → `String(nextEnemyId++)`

### useProjectiles.tsx
- `crypto.randomUUID()` → `String(_nextProjectileStoreId++)` (module-level counter)

**Why:** Bullet Dungeon can spawn 500+ enemies; per-frame allocations in the hot path cause GC pauses and frame drops at high enemy counts.

**How to apply:** Any new enemy-type branch added to the update loop should mutate `enemy` directly and `continue` — never spread to a new object.
