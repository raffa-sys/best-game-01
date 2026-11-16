// SPDX-License-Identifier: MIT
// Nova Harvest — the screenshot scenes behind ?shot=title|play|boss|over.
// Each one plays the real rules forward from a fresh world for a fixed number
// of steps, steered by a simple autopilot (chase the nearest shard, keep the
// void at arm's length, fire at the nearest enemy, spend a full Nova when the
// screen is crowded), so every frame is what a short game really looks like
// and the same seed always gives the same frame.

import { FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const TITLE_SECONDS = 5;
const PLAY_SECONDS = 2.5;
const BOSS_SECONDS = 4;
const OVER_SCORE_SECONDS = 12;
const OVER_LIMIT_SECONDS = 300;
const SAMPLE = STEP;

/** The nearest thing of a kind, by distance from the player. */
function nearest(state, list) {
  let best = null;
  let bestD = Infinity;
  for (const item of list) {
    const d = Math.hypot(item.x - state.player.x, item.y - state.player.y);
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return { item: best, dist: bestD };
}

/** Steer: toward the nearest shard, away from any enemy too close, guns on the nearest foe. */
function autopilot(state) {
  const player = state.player;
  let mx = 0;
  let my = 0;
  const shard = nearest(state, state.shardsArr);
  if (shard.item) {
    mx += (shard.item.x - player.x) / Math.max(60, shard.dist);
    my += (shard.item.y - player.y) / Math.max(60, shard.dist);
  }
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - player.x, e.y - player.y) || 1;
    if (d < 150) {
      mx += ((player.x - e.x) / d) * (1.6 - d / 150);
      my += ((player.y - e.y) / d) * (1.6 - d / 150);
    }
  }
  const foe = nearest(state, state.enemies);
  const aim = foe.item ? { x: foe.item.x, y: foe.item.y } : { x: player.x, y: player.y - 100 };
  const firing = foe.item !== null && foe.dist < 520;
  const crowded = state.enemies.filter((e) => Math.hypot(e.x - player.x, e.y - player.y) < 320).length;
  const nova = state.nova >= 100 && crowded >= 3;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  return { move: { x: mx, y: my }, aim, firing, nova };
}

/** A hurried pilot for the game-over scene: drifts, never fires, never dodges. */
function weakPilot(state) {
  const player = state.player;
  const dx = FIELD.width / 2 - player.x;
  const dy = FIELD.height / 2 - player.y;
  const len = Math.hypot(dx, dy) || 1;
  return { move: { x: (dx / len) * 0.3, y: (dy / len) * 0.3 }, aim: { x: player.x, y: player.y - 100 }, firing: false, nova: false };
}

function simulate(world, seconds, pilot) {
  let events = 0;
  let lastAim = { x: 640, y: 300 };
  const steps = Math.round(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const input = pilot(world.state);
    lastAim = input.aim;
    events = world.step(SAMPLE, input.move, input.aim, input.firing, input.nova);
    if (events & EVENT_OVER) break;
    if (world.state.victory) break;
  }
  return { events, lastAim };
}

/**
 * Set `world` to the named scene (title, play, boss or over; any other name is
 * title) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  if (name === 'boss') {
    world.debugBossScene();
    const { lastAim } = simulate(world, BOSS_SECONDS, autopilot);
    return { screen: SCREEN_PLAY, best: 2450, aim: lastAim };
  }
  if (name === 'over') {
    world.reset();
    // Score a little first, then fall apart: a game over with a real score.
    simulate(world, OVER_SCORE_SECONDS, autopilot);
    simulate(world, OVER_LIMIT_SECONDS, weakPilot);
    return { screen: SCREEN_OVER, best: world.state.score, aim: { x: 640, y: 300 } };
  }
  if (name === 'play') {
    world.debugPlayScene();
    const { lastAim } = simulate(world, PLAY_SECONDS, autopilot);
    const over = world.state.lives === 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score + 420, aim: lastAim };
  }
  world.reset();
  world.state.demo = true;
  const { lastAim } = simulate(world, TITLE_SECONDS, autopilot);
  return { screen: SCREEN_TITLE, best: 1250, aim: lastAim };
}
