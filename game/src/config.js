// SPDX-License-Identifier: MIT
// Nova Harvest — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const FIELD = { width: 1280, height: 720 };

/** localStorage key for the best score. */
export const BEST_KEY = 'nova-harvest-best';

export const LIVES = 3;

/** Score values. Every kill or pickup is multiplied by the live combo. */
export const SCORE = {
  shard: 10,
  mite: 50,
  weaver: 70,
  spitter: 80,
  boss: 1000,
  waveClear: 150,
  novaKill: 25,
};

/** Nova meter: 0..100. A full meter buys one screen-clearing blast. */
export const NOVA_MAX = 100;
export const NOVA_SHARD = 9;
export const NOVA_KILL = 5;

/** Combo: each kill or pickup inside the window raises the multiplier by one step. */
export const COMBO_WINDOW = 3.0;
export const COMBO_MAX = 8;

export const PLAYER = {
  radius: 16,
  speed: 430,
  accel: 2600,
  drag: 4.2,
  fireCooldown: 0.16,
  boltSpeed: 780,
  invulnerable: 2.0,
  novaCooldown: 0.4,
};

export const BOLT = { radius: 5, damage: 1, life: 1.1 };
export const ORB = { radius: 7, speed: 210, damage: 1 };

/** Enemy kinds: hit points, speed, radius, score kind. */
export const ENEMY = {
  mite: { hp: 1, speed: 150, radius: 15 },
  weaver: { hp: 2, speed: 185, radius: 16 },
  spitter: { hp: 2, speed: 120, radius: 17 },
  boss: { hp: 240, speed: 55, radius: 64 },
};

/** Waves: how many of each enemy the wave sends, and how fast they arrive. */
export function wavePlan(wave) {
  const mites = 6 + wave * 3;
  const weavers = wave >= 2 ? 1 + wave : 0;
  const spitters = wave >= 3 ? Math.floor(wave / 2) : 0;
  const boss = wave % 5 === 0;
  const interval = Math.max(0.45, 1.15 - wave * 0.06);
  return { mites, weavers, spitters, boss, interval };
}

/** The win wave: beating its boss clears the sector. */
export const WIN_WAVE = 10;

export const SHARD = {
  radius: 11,
  fallSpeed: 55,
  sway: 34,
  spawnInterval: 1.15,
  magnetRadius: 170,
};

/** Power-up drop chance per kill, and how long each lasts. */
export const POWERUP = {
  dropChance: 0.07,
  heartChance: 0.012,
  rapidSeconds: 8,
  magnetSeconds: 10,
  shieldHits: 1,
};

/** The palette: deep indigo space, cyan player, gold shards, magenta void. */
export const PALETTE = {
  spaceTop: '#0a0e2a',
  spaceBottom: '#160a33',
  nebulaCyan: 'rgba(56, 189, 248, 0.20)',
  nebulaMagenta: 'rgba(217, 70, 239, 0.16)',
  nebulaGold: 'rgba(251, 191, 36, 0.12)',
  player: '#5eead4',
  playerCore: '#ecfeff',
  bolt: '#a5f3fc',
  shard: '#fbbf24',
  shardCore: '#fff7d6',
  mite: '#e879f9',
  weaver: '#f472b6',
  spitter: '#c084fc',
  boss: '#f43f5e',
  orb: '#fb7185',
  heart: '#fb7185',
  shield: '#38bdf8',
  rapid: '#facc15',
  magnet: '#a78bfa',
  text: '#e2e8f0',
  dimText: '#94a3b8',
  gold: '#fbbf24',
  danger: '#fb7185',
};
