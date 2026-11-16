// SPDX-License-Identifier: MIT
// Nova Harvest — one factory per thing that flies, floats or explodes. Every
// entity is a plain object; the world moves them, the renderer draws them.

import { BOLT, ENEMY, FIELD, ORB, PLAYER, SHARD } from './config.js';

/** The harvester drone the player flies. */
export function makePlayer() {
  return {
    kind: 'player',
    x: FIELD.width / 2,
    y: FIELD.height - 120,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    fireTimer: 0,
    invulnerable: 0,
    shield: false,
    rapidTimer: 0,
    magnetTimer: 0,
    thrust: 0,
  };
}

/** A pulse bolt fired toward the aim point. */
export function makeBolt(x, y, angle) {
  return {
    kind: 'bolt',
    x,
    y,
    vx: Math.cos(angle) * 780,
    vy: Math.sin(angle) * 780,
    radius: BOLT.radius,
    life: BOLT.life,
    angle,
  };
}

/** A slow void orb, spat by spitters and the boss. */
export function makeOrb(x, y, angle) {
  return {
    kind: 'orb',
    x,
    y,
    vx: Math.cos(angle) * ORB.speed,
    vy: Math.sin(angle) * ORB.speed,
    radius: ORB.radius,
    life: 6,
  };
}

/** A void enemy. kind is 'mite' | 'weaver' | 'spitter' | 'boss'. */
export function makeEnemy(kind, x, y, wave) {
  const spec = ENEMY[kind];
  const hpScale = kind === 'boss' ? 1 + (wave - 5) * 0.12 : 1 + Math.max(0, wave - 6) * 0.08;
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: spec.radius,
    hp: Math.round(spec.hp * hpScale),
    maxHp: Math.round(spec.hp * hpScale),
    speed: spec.speed * (1 + Math.min(0.5, wave * 0.02)),
    angle: 0,
    phase: Math.random() * Math.PI * 2,
    shootTimer: 1.5 + Math.random(),
    spawnTimer: 6,
    burstTimer: 2.5,
    flash: 0,
    spin: 0,
  };
}

/** A golden star shard, drifting down with a sway; collecting it scores and charges Nova. */
export function makeShard(x, y, random) {
  return {
    kind: 'shard',
    x,
    y,
    vx: 0,
    vy: SHARD.fallSpeed * random.range(0.8, 1.25),
    radius: SHARD.radius,
    phase: random.range(0, Math.PI * 2),
    sway: SHARD.sway * random.range(0.7, 1.3),
    spin: random.range(0.5, 1.5),
    life: 14,
  };
}

/** A power-up: 'shield' | 'rapid' | 'magnet' | 'heart'. */
export function makePowerup(kind, x, y) {
  return {
    kind: 'powerup',
    power: kind,
    x,
    y,
    vx: 0,
    vy: 46,
    radius: 15,
    phase: Math.random() * Math.PI * 2,
    life: 12,
  };
}

/** A spark, ember or smoke puff: purely visual, fades out. */
export function makeParticle(x, y, vx, vy, life, size, color) {
  return { kind: 'particle', x, y, vx, vy, life, maxLife: life, size, color };
}

/** A floating score popup that rises and fades. */
export function makeFloater(x, y, text, color) {
  return { kind: 'floater', x, y, text, color, life: 1.1, maxLife: 1.1 };
}

/** An expanding shockwave ring, drawn as a stroked circle. */
export function makeRing(x, y, maxRadius, color) {
  return { kind: 'ring', x, y, radius: 8, maxRadius, color, life: 0.6, maxLife: 0.6 };
}
