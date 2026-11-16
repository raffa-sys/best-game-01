// SPDX-License-Identifier: MIT
// Nova Harvest — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. The game moves between five
// screens: title, play, paused, game over and victory.
//
// ?seed=N fixes the falling pattern. ?shot=title|play|boss|over (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createSoundBank } from './audio.js';
import { createWorld, EVENT_BOSS_DOWN, EVENT_HIT, EVENT_NOVA, EVENT_OVER, EVENT_VICTORY, EVENT_WAVE_CLEAR } from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_NOVA,
  ACTION_PAUSE,
  ACTION_RESTART,
  createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const sound = createSoundBank();
const world = createWorld(createRandom(seed), sound);
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { best: scene.best, aim: scene.aim ?? { x: 640, y: 300 }, muted: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let endless = false;
  let novaQueued = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    endless = false;
    accumulator = 0;
    screen = SCREEN_PLAY;
    sound.unlock();
    sound.startMusic();
    announce('Playing. 3 lives. Harvest shards, blast the void.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function winGame() {
    screen = SCREEN_VICTORY;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Sector cleared! Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      sound.setMuted(!sound.isMuted);
      announce(sound.isMuted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame();
      else if (screen === SCREEN_VICTORY) {
        endless = true;
        world.state.endless = true;
        world.state.victory = false;
        screen = SCREEN_PLAY;
        announce('Endless harvest. Keep going.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & (ACTION_CONFIRM | ACTION_NOVA)) sound.unlock();
    if (actions & ACTION_NOVA) novaQueued = true;
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.state.demo = true;
      const aim = { x: world.state.player.x, y: world.state.player.y - 120 };
      world.step(STEP, { x: 0, y: 0 }, aim, false, false);
      return;
    }
    const novaPressed = novaQueued;
    novaQueued = false;
    const events = world.step(STEP, input.direction(), input.aim(), input.firing(), novaPressed);
    if (events & EVENT_VICTORY && !endless) winGame();
    else if (events & EVENT_OVER) endGame();
    else if (events & EVENT_HIT) {
      announce(world.state.lives === 1 ? 'Hit. 1 life left.' : `Hit. ${world.state.lives} lives left.`);
    }
    if (events & EVENT_WAVE_CLEAR) announce(`Wave ${world.state.wave} cleared.`);
    if (events & EVENT_BOSS_DOWN) announce('Void Maw destroyed!');
    if (events & EVENT_NOVA) announce('Nova blast!');
    sound.setIntensity(world.state.enemies.some((e) => e.kind === 'boss') ? 1 : Math.min(0.7, world.state.wave / 10));
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, { best, aim: input.aim(), muted: sound.isMuted });
  }

  // Leaving the tab pauses a running game rather than letting mites feed unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Nova Harvest. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
