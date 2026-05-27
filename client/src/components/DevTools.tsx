import { useEffect, useState } from "react";
import { usePlayer } from "../lib/stores/usePlayer";
import { useEnemies } from "../lib/stores/useEnemies";
import { useProjectiles } from "../lib/stores/useProjectiles";
import { useGame } from "../lib/stores/useGame";
import { useVisualEffects } from "../lib/stores/useVisualEffects";
import * as THREE from "three";

const DEVTOOLS_STYLES = {
  container: {
    position: "fixed" as const,
    top: "10px",
    right: "10px",
    width: "350px",
    maxHeight: "90vh",
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    border: "2px solid #444",
    borderRadius: "8px",
    padding: "10px",
    overflowY: "auto" as const,
    zIndex: 10000,
    color: "#fff",
    fontSize: "12px",
    fontFamily: "monospace",
  },
  header: {
    marginBottom: "10px",
    paddingBottom: "5px",
    borderBottom: "1px solid #444",
  },
  section: {
    marginBottom: "12px",
    padding: "8px",
    backgroundColor: "rgba(40, 40, 40, 0.5)",
    borderRadius: "4px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px",
  },
  button: {
    padding: "4px 8px",
    backgroundColor: "#333",
    color: "#fff",
    border: "1px solid #666",
    borderRadius: "3px",
    cursor: "pointer",
    marginRight: "5px",
    fontSize: "11px",
  },
  input: {
    width: "60px",
    padding: "3px 5px",
    backgroundColor: "#222",
    color: "#fff",
    border: "1px solid #555",
    borderRadius: "3px",
  },
  label: {
    color: "#aaa",
    fontSize: "11px",
  },
  value: {
    color: "#4fc3f7",
    fontWeight: "bold",
  },
};

export function DevTools() {
  const [isOpen, setIsOpen] = useState(false);
  const [godMode, setGodMode] = useState(false);
  const [spawnType, setSpawnType] = useState<"basic" | "tank" | "eyeball">("basic");
  const [spawnCount, setSpawnCount] = useState(1);
  const [xpAmount, setXpAmount] = useState(100);

  const player = usePlayer();
  const enemies = useEnemies();
  const projectiles = useProjectiles();
  const game = useGame();
  const vfx = useVisualEffects();

  // Toggle with 'O' key
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "o" || e.key === "O") {
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  // God mode - set hearts to max every frame
  useEffect(() => {
    if (!godMode) return;
    const interval = setInterval(() => {
      if (player.hearts < player.maxHearts) {
        usePlayer.setState({ hearts: player.maxHearts });
      }
    }, 100);
    return () => clearInterval(interval);
  }, [godMode, player.hearts, player.maxHearts]);

  const spawnEnemies = () => {
    for (let i = 0; i < spawnCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 20 + Math.random() * 20;
      const position = new THREE.Vector3(
        player.position.x + Math.cos(angle) * distance,
        0,
        player.position.z + Math.sin(angle) * distance
      );
      enemies.addEnemy({
        position,
        type: spawnType,
        health: spawnType === "tank" ? 200 : spawnType === "eyeball" ? 30 : 50,
        maxHealth: spawnType === "tank" ? 200 : spawnType === "eyeball" ? 30 : 50,
      });
    }
  };

  const clearEnemies = () => {
    enemies.reset();
  };

  const addXP = () => {
    player.addXP(xpAmount);
  };

  const levelUp = () => {
    player.addXP(player.xpToNextLevel - player.xp + 1);
  };

  const refillAmmo = () => {
    usePlayer.setState({ ammo: player.maxAmmo, isReloading: false });
  };

  const healPlayer = () => {
    usePlayer.setState({ hearts: player.maxHearts });
  };

  const teleportToCenter = () => {
    usePlayer.setState({ position: new THREE.Vector3(0, 0, 0) });
  };

  const clearProjectiles = () => {
    projectiles.reset();
  };

  const killAllEnemies = () => {
    enemies.enemies.forEach(enemy => {
      enemy.health = 0;
    });
  };

  if (!isOpen) {
    return (
      <div
        style={{
          position: "fixed",
          top: "10px",
          right: "10px",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          color: "#fff",
          padding: "5px 10px",
          borderRadius: "5px",
          zIndex: 10000,
          fontSize: "12px",
        }}
      >
        Press O to open DevTools
      </div>
    );
  }

  const fps = Math.round(1000 / (performance.now() - (window as any).lastFrameTime || performance.now()));
  (window as any).lastFrameTime = performance.now();

  return (
    <div style={DEVTOOLS_STYLES.container}>
      <div style={DEVTOOLS_STYLES.header}>
        <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "5px" }}>
          DEVELOPER TOOLS (Press O to close)
        </div>
        <div style={DEVTOOLS_STYLES.row}>
          <span style={DEVTOOLS_STYLES.label}>FPS: </span>
          <span style={DEVTOOLS_STYLES.value}>{fps}</span>
        </div>
      </div>

      {/* PLAYER STATS */}
      <div style={DEVTOOLS_STYLES.section}>
        <div style={{ fontWeight: "bold", marginBottom: "5px" }}>Player Stats</div>
        <div style={DEVTOOLS_STYLES.row}>
          <span style={DEVTOOLS_STYLES.label}>Position: </span>
          <span style={DEVTOOLS_STYLES.value}>
            {player.position.x.toFixed(1)}, {player.position.z.toFixed(1)}
          </span>
        </div>
        <div style={DEVTOOLS_STYLES.row}>
          <span style={DEVTOOLS_STYLES.label}>Health: </span>
          <span style={DEVTOOLS_STYLES.value}>{player.hearts}/{player.maxHearts}</span>
        </div>
        <div style={DEVTOOLS_STYLES.row}>
          <span style={DEVTOOLS_STYLES.label}>Level: </span>
          <span style={DEVTOOLS_STYLES.value}>{player.level}</span>
        </div>
        <div style={DEVTOOLS_STYLES.row}>
          <span style={DEVTOOLS_STYLES.label}>XP: </span>
          <span style={DEVTOOLS_STYLES.value}>{player.xp}/{player.xpToNextLevel}</span>
        </div>
        <div style={DEVTOOLS_STYLES.row}>
          <span style={DEVTOOLS_STYLES.label}>Ammo: </span>
          <span style={DEVTOOLS_STYLES.value}>{player.ammo}/{player.maxAmmo}</span>
        </div>
        <div style={DEVTOOLS_STYLES.row}>
          <span style={DEVTOOLS_STYLES.label}>Damage: </span>
          <span style={DEVTOOLS_STYLES.value}>{player.baseDamage.toFixed(1)}</span>
        </div>
        <div style={DEVTOOLS_STYLES.row}>
          <span style={DEVTOOLS_STYLES.label}>Speed: </span>
          <span style={DEVTOOLS_STYLES.value}>{player.speed.toFixed(1)}</span>
        </div>
        <div style={DEVTOOLS_STYLES.row}>
          <span style={DEVTOOLS_STYLES.label}>Fire Rate: </span>
          <span style={DEVTOOLS_STYLES.value}>{(1 / player.firerate).toFixed(2)}/s</span>
        </div>
      </div>

      {/* TOGGLES */}
      <div style={DEVTOOLS_STYLES.section}>
        <div style={{ fontWeight: "bold", marginBottom: "5px" }}>Toggles</div>
        <div style={DEVTOOLS_STYLES.row}>
          <button style={DEVTOOLS_STYLES.button} onClick={() => setGodMode(!godMode)}>
            God Mode: {godMode ? "ON" : "OFF"}
          </button>
        </div>
        <div style={DEVTOOLS_STYLES.row}>
          <button style={DEVTOOLS_STYLES.button} onClick={healPlayer}>Heal</button>
          <button style={DEVTOOLS_STYLES.button} onClick={refillAmmo}>Refill Ammo</button>
          <button style={DEVTOOLS_STYLES.button} onClick={teleportToCenter}>Center</button>
        </div>
      </div>

      {/* ENEMIES */}
      <div style={DEVTOOLS_STYLES.section}>
        <div style={{ fontWeight: "bold", marginBottom: "5px" }}>Enemies ({enemies.enemies.length})</div>
        <div style={DEVTOOLS_STYLES.row}>
          <select
            value={spawnType}
            onChange={(e) => setSpawnType(e.target.value as any)}
            style={DEVTOOLS_STYLES.input}
          >
            <option value="basic">Basic</option>
            <option value="tank">Tank</option>
            <option value="eyeball">Eyeball</option>
          </select>
          <input
            type="number"
            value={spawnCount}
            onChange={(e) => setSpawnCount(parseInt(e.target.value) || 1)}
            style={DEVTOOLS_STYLES.input}
            min="1"
            max="50"
          />
          <button style={DEVTOOLS_STYLES.button} onClick={spawnEnemies}>Spawn</button>
        </div>
        <div style={DEVTOOLS_STYLES.row}>
          <button style={DEVTOOLS_STYLES.button} onClick={clearEnemies}>Clear All</button>
          <button style={DEVTOOLS_STYLES.button} onClick={killAllEnemies}>Kill All</button>
        </div>
      </div>

      {/* XP */}
      <div style={DEVTOOLS_STYLES.section}>
        <div style={{ fontWeight: "bold", marginBottom: "5px" }}>Experience</div>
        <div style={DEVTOOLS_STYLES.row}>
          <input
            type="number"
            value={xpAmount}
            onChange={(e) => setXpAmount(parseInt(e.target.value) || 0)}
            style={DEVTOOLS_STYLES.input}
            min="1"
          />
          <button style={DEVTOOLS_STYLES.button} onClick={addXP}>Add XP</button>
          <button style={DEVTOOLS_STYLES.button} onClick={levelUp}>Level Up</button>
        </div>
      </div>

      {/* UPGRADES */}
      <div style={DEVTOOLS_STYLES.section}>
        <div style={{ fontWeight: "bold", marginBottom: "5px" }}>Taken Upgrades ({player.takenUpgrades.size})</div>
        <div style={{ maxHeight: "100px", overflowY: "auto", fontSize: "10px" }}>
          {Array.from(player.takenUpgrades).map(id => (
            <div key={id} style={DEVTOOLS_STYLES.row}>
              <span style={{ color: "#888" }}>{id}</span>
            </div>
          ))}
        </div>
      </div>

      {/* PERFORMANCE */}
      <div style={DEVTOOLS_STYLES.section}>
        <div style={{ fontWeight: "bold", marginBottom: "5px" }}>Performance</div>
        <div style={DEVTOOLS_STYLES.row}>
          <span style={DEVTOOLS_STYLES.label}>Projectiles: </span>
          <span style={DEVTOOLS_STYLES.value}>{projectiles.projectiles.length}</span>
        </div>
        <div style={DEVTOOLS_STYLES.row}>
          <span style={DEVTOOLS_STYLES.label}>XP Orbs: </span>
          <span style={DEVTOOLS_STYLES.value}>{enemies.xpOrbs.length}</span>
        </div>
        <div style={DEVTOOLS_STYLES.row}>
          <span style={DEVTOOLS_STYLES.label}>Particles: </span>
          <span style={DEVTOOLS_STYLES.value}>{vfx.particles.length}</span>
        </div>
        <div style={DEVTOOLS_STYLES.row}>
          <span style={DEVTOOLS_STYLES.label}>Damage Numbers: </span>
          <span style={DEVTOOLS_STYLES.value}>{vfx.damageNumbers.length}</span>
        </div>
        <div style={DEVTOOLS_STYLES.row}>
          <button style={DEVTOOLS_STYLES.button} onClick={clearProjectiles}>Clear Projectiles</button>
          <button style={DEVTOOLS_STYLES.button} onClick={() => vfx.reset()}>Clear VFX</button>
        </div>
      </div>

      {/* TIME */}
      <div style={DEVTOOLS_STYLES.section}>
        <div style={{ fontWeight: "bold", marginBottom: "5px" }}>Game Time</div>
        <div style={DEVTOOLS_STYLES.row}>
          <span style={DEVTOOLS_STYLES.label}>Elapsed: </span>
          <span style={DEVTOOLS_STYLES.value}>
            {Math.floor(enemies.elapsedTime / 60)}:{Math.floor(enemies.elapsedTime % 60).toString().padStart(2, "0")}
          </span>
        </div>
        <div style={DEVTOOLS_STYLES.row}>
          <span style={DEVTOOLS_STYLES.label}>Phase: </span>
          <span style={DEVTOOLS_STYLES.value}>{game.phase}</span>
        </div>
      </div>
    </div>
  );
}

export default DevTools;
