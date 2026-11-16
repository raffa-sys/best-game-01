// SPDX-License-Identifier: MIT
// Nova Harvest — the simulation: waves, movement, firing, collisions, scoring,
// Nova blasts, bosses and the win. It knows nothing about the screen or the
// canvas; the renderer paints `world.state`, and main.js feeds it input.

import {
  COMBO_MAX,
  COMBO_WINDOW,
  ENEMY,
  FIELD,
  LIVES,
  NOVA_KILL,
  NOVA_MAX,
  NOVA_SHARD,
  PLAYER,
  POWERUP,
  SCORE,
  SHARD,
  WIN_WAVE,
  wavePlan,
} from './config.js';
import {
  makeBolt,
  makeEnemy,
  makeFloater,
  makeOrb,
  makeParticle,
  makePlayer,
  makePowerup,
  makeRing,
  makeShard,
} from './entities.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WAVE_CLEAR = 4;
export const EVENT_BOSS_DOWN = 8;
export const EVENT_VICTORY = 16;
export const EVENT_NOVA = 32;

const TAU = Math.PI * 2;

export function createWorld(random, sound) {
  const state = freshState();

  function freshState() {
    return {
      time: 0,
      score: 0,
      combo: 1,
      comboTimer: 0,
      lives: LIVES,
      wave: 0,
      wavePhase: 'intro',
      waveTimer: 0,
      spawnQueue: [],
      spawnTimer: 0,
      shardTimer: 0,
      nova: 0,
      novaCooldown: 0,
      shards: 0,
      kills: 0,
      demo: false,
      victory: false,
      endless: false,
      over: false,
      shake: 0,
      player: makePlayer(),
      bolts: [],
      enemies: [],
      shardsArr: [],
      orbs: [],
      powerups: [],
      particles: [],
      floaters: [],
      rings: [],
    };
  }

  function reset() {
    const keep = state;
    Object.assign(keep, freshState());
    startWave(1);
  }

  function startWave(n) {
    state.wave = n;
    state.wavePhase = 'intro';
    state.waveTimer = 2.2;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.shardTimer = 0.6;
    const plan = wavePlan(n);
    for (let i = 0; i < plan.mites; i += 1) state.spawnQueue.push('mite');
    for (let i = 0; i < plan.weavers; i += 1) state.spawnQueue.push('weaver');
    for (let i = 0; i < plan.spitters; i += 1) state.spawnQueue.push('spitter');
    shuffle(state.spawnQueue);
  }

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random.next() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }

  function spawnFromQueue() {
    const kind = state.spawnQueue.pop();
    if (!kind) return;
    const edge = random.int(0, 2);
    let x;
    let y;
    if (edge === 0) {
      x = random.range(40, FIELD.width - 40);
      y = -30;
    } else if (edge === 1) {
      x = -30;
      y = random.range(60, FIELD.height - 160);
    } else {
      x = FIELD.width + 30;
      y = random.range(60, FIELD.height - 160);
    }
    state.enemies.push(makeEnemy(kind, x, y, state.wave));
  }

  function spawnBoss() {
    const boss = makeEnemy('boss', FIELD.width / 2, 110, state.wave);
    state.enemies.push(boss);
    sound.bossRoar();
  }

  function explodeAt(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random.range(0, TAU);
      const s = random.range(speed * 0.3, speed);
      state.particles.push(
        makeParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, random.range(0.35, 0.8), random.range(2, 5), color),
      );
    }
    if (state.particles.length > 420) state.particles.splice(0, state.particles.length - 420);
  }

  function addScore(base, x, y) {
    const points = base * state.combo;
    state.score += points;
    state.floaters.push(makeFloater(x, y, `+${points}`, '#fde68a'));
    state.combo = Math.min(COMBO_MAX, state.combo + 1);
    state.comboTimer = COMBO_WINDOW;
    return points;
  }

  function chargeNova(amount) {
    state.nova = Math.min(NOVA_MAX, state.nova + amount);
  }

  function dropLoot(x, y) {
    if (random.chance(POWERUP.heartChance) && state.lives < LIVES) {
      state.powerups.push(makePowerup('heart', x, y));
      return;
    }
    if (!random.chance(POWERUP.dropChance)) return;
    state.powerups.push(makePowerup(random.pick(['shield', 'rapid', 'magnet']), x, y));
  }

  function killEnemy(index, byNova) {
    const enemy = state.enemies[index];
    state.enemies.splice(index, 1);
    state.kills += 1;
    const colors = { mite: '#e879f9', weaver: '#f472b6', spitter: '#c084fc', boss: '#f43f5e' };
    explodeAt(enemy.x, enemy.y, colors[enemy.kind] ?? '#fff', enemy.kind === 'boss' ? 90 : 22, enemy.kind === 'boss' ? 340 : 220);
    state.rings.push(makeRing(enemy.x, enemy.y, enemy.radius * 4, colors[enemy.kind] ?? '#fff'));
    sound.explode(enemy.kind === 'boss');
    if (enemy.kind === 'boss') {
      addScore(SCORE.boss, enemy.x, enemy.y);
      state.shake = Math.max(state.shake, 14);
      dropLoot(enemy.x, enemy.y);
      if (state.wave >= WIN_WAVE && !state.endless) {
        state.victory = true;
        sound.victory();
        return EVENT_BOSS_DOWN | EVENT_VICTORY;
      }
      return EVENT_BOSS_DOWN;
    }
    addScore(byNova ? SCORE.novaKill : SCORE[enemy.kind], enemy.x, enemy.y);
    chargeNova(NOVA_KILL);
    if (random.chance(0.45)) {
      state.shardsArr.push(makeShard(enemy.x, enemy.y, random));
    }
    dropLoot(enemy.x, enemy.y);
    return 0;
  }

  function hitPlayer() {
    const player = state.player;
    if (player.invulnerable > 0 || state.demo) {
      if (state.demo) explodeAt(player.x, player.y, '#5eead4', 6, 120);
      return 0;
    }
    if (player.shield) {
      player.shield = false;
      player.invulnerable = 1.2;
      explodeAt(player.x, player.y, '#38bdf8', 26, 240);
      state.rings.push(makeRing(player.x, player.y, 90, '#38bdf8'));
      sound.hit();
      return EVENT_HIT;
    }
    state.lives -= 1;
    state.combo = 1;
    state.comboTimer = 0;
    player.invulnerable = PLAYER.invulnerable;
    explodeAt(player.x, player.y, '#5eead4', 46, 320);
    state.rings.push(makeRing(player.x, player.y, 130, '#5eead4'));
    state.shake = Math.max(state.shake, 12);
    sound.hit();
    if (state.lives <= 0) {
      state.over = true;
      sound.gameOver();
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function fireNova() {
    state.nova = 0;
    state.novaCooldown = PLAYER.novaCooldown;
    state.rings.push(makeRing(state.player.x, state.player.y, 620, '#a5f3fc'));
    state.rings.push(makeRing(state.player.x, state.player.y, 420, '#fbbf24'));
    state.shake = Math.max(state.shake, 10);
    sound.nova();
    let events = EVENT_NOVA;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      events |= killEnemy(i, true);
    }
    state.orbs.length = 0;
    return events;
  }

  function updatePlayer(dt, move, aim, firing) {
    const player = state.player;
    player.vx += move.x * PLAYER.accel * dt;
    player.vy += move.y * PLAYER.accel * dt;
    const drag = Math.max(0, 1 - PLAYER.drag * dt);
    player.vx *= drag;
    player.vy *= drag;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER.speed) {
      player.vx = (player.vx / speed) * PLAYER.speed;
      player.vy = (player.vy / speed) * PLAYER.speed;
    }
    player.x = Math.max(20, Math.min(FIELD.width - 20, player.x + player.vx * dt));
    player.y = Math.max(80, Math.min(FIELD.height - 20, player.y + player.vy * dt));
    player.angle = Math.atan2(aim.y - player.y, aim.x - player.x);
    player.thrust = Math.min(1, speed / PLAYER.speed);
    player.fireTimer -= dt;
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.rapidTimer = Math.max(0, player.rapidTimer - dt);
    player.magnetTimer = Math.max(0, player.magnetTimer - dt);
    if (firing && player.fireTimer <= 0) {
      const cooldown = player.rapidTimer > 0 ? PLAYER.fireCooldown * 0.55 : PLAYER.fireCooldown;
      player.fireTimer = cooldown;
      const spread = player.rapidTimer > 0 ? 0.09 : 0;
      state.bolts.push(makeBolt(player.x + Math.cos(player.angle) * 22, player.y + Math.sin(player.angle) * 22, player.angle - spread));
      state.bolts.push(makeBolt(player.x + Math.cos(player.angle) * 22, player.y + Math.sin(player.angle) * 22, player.angle + spread));
      if (player.rapidTimer > 0) {
        state.bolts.push(makeBolt(player.x, player.y, player.angle));
      }
      sound.shoot();
    }
    if (player.thrust > 0.25) {
      state.particles.push(
        makeParticle(
          player.x - Math.cos(player.angle) * 18,
          player.y - Math.sin(player.angle) * 18,
          -player.vx * 0.25 + random.range(-20, 20),
          -player.vy * 0.25 + random.range(-20, 20),
          random.range(0.2, 0.4),
          random.range(2, 4),
          '#5eead4',
        ),
      );
    }
  }

  function updateEnemies(dt) {
    const player = state.player;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      e.flash = Math.max(0, e.flash - dt);
      e.phase += dt;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (e.kind === 'mite') {
        e.vx += (dx / dist) * 420 * dt;
        e.vy += (dy / dist) * 420 * dt;
        const s = Math.hypot(e.vx, e.vy);
        if (s > e.speed) {
          e.vx = (e.vx / s) * e.speed;
          e.vy = (e.vy / s) * e.speed;
        }
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.angle += dt * 2;
      } else if (e.kind === 'weaver') {
        e.y += e.speed * 0.75 * dt;
        e.x += Math.sin(e.phase * 2.4) * 190 * dt + (dx / dist) * 40 * dt;
        if (e.y > FIELD.height + 30) {
          state.enemies.splice(i, 1);
        }
      } else if (e.kind === 'spitter') {
        const want = 260;
        const toward = dist > want + 30 ? 1 : dist < want - 30 ? -1 : 0;
        e.vx += (dx / dist) * 260 * toward * dt;
        e.vy += (dy / dist) * 260 * toward * dt;
        e.x += e.vx * dt + Math.cos(e.phase * 1.4) * 60 * dt;
        e.y += e.vy * dt;
        e.vx *= 0.98;
        e.vy *= 0.98;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && dist < 560) {
          e.shootTimer = random.range(1.8, 2.6);
          state.orbs.push(makeOrb(e.x, e.y, Math.atan2(dy, dx)));
          sound.shoot();
        }
      } else if (e.kind === 'boss') {
        e.x = FIELD.width / 2 + Math.sin(e.phase * 0.45) * 380;
        e.y = 120 + Math.sin(e.phase * 0.8) * 46;
        e.burstTimer -= dt;
        e.shootTimer -= dt;
        e.spawnTimer -= dt;
        if (e.burstTimer <= 0) {
          e.burstTimer = 2.6;
          for (let k = 0; k < 12; k += 1) {
            state.orbs.push(makeOrb(e.x, e.y, (k / 12) * TAU + e.phase));
          }
          sound.shoot();
        }
        if (e.shootTimer <= 0) {
          e.shootTimer = 1.5;
          const base = Math.atan2(dy, dx);
          for (const off of [-0.28, 0, 0.28]) state.orbs.push(makeOrb(e.x, e.y, base + off));
        }
        if (e.spawnTimer <= 0 && state.enemies.length < 22) {
          e.spawnTimer = 6;
          state.enemies.push(makeEnemy('mite', e.x - 70, e.y + 40, state.wave));
          state.enemies.push(makeEnemy('mite', e.x + 70, e.y + 40, state.wave));
        }
      }
    }
  }

  function updateShards(dt) {
    const player = state.player;
    for (let i = state.shardsArr.length - 1; i >= 0; i -= 1) {
      const s = state.shardsArr[i];
      s.phase += dt;
      s.life -= dt;
      if (player.magnetTimer > 0) {
        const dx = player.x - s.x;
        const dy = player.y - s.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < SHARD.magnetRadius) {
          s.vx += (dx / d) * 900 * dt;
          s.vy += (dy / d) * 900 * dt;
        }
      }
      s.x += (s.vx + Math.sin(s.phase * 2) * s.sway * 0.4) * dt;
      s.y += s.vy * dt;
      s.vx *= 0.96;
      if (s.y > FIELD.height + 24 || s.life <= 0) state.shardsArr.splice(i, 1);
    }
  }

  function updateProjectiles(dt) {
    for (let i = state.bolts.length - 1; i >= 0; i -= 1) {
      const b = state.bolts[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        state.bolts.splice(i, 1);
      }
    }
    for (let i = state.orbs.length - 1; i >= 0; i -= 1) {
      const o = state.orbs[i];
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.life -= dt;
      if (o.life <= 0 || o.x < -20 || o.x > FIELD.width + 20 || o.y < -20 || o.y > FIELD.height + 20) {
        state.orbs.splice(i, 1);
      }
    }
    for (let i = state.powerups.length - 1; i >= 0; i -= 1) {
      const p = state.powerups[i];
      p.phase += dt;
      p.life -= dt;
      p.y += p.vy * dt;
      if (p.y > FIELD.height + 24 || p.life <= 0) state.powerups.splice(i, 1);
    }
  }

  function updateFx(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.y -= 42 * dt;
      f.life -= dt;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }
    for (let i = state.rings.length - 1; i >= 0; i -= 1) {
      const r = state.rings[i];
      r.life -= dt;
      r.radius += (r.maxRadius - r.radius) * Math.min(1, dt * 7);
      if (r.life <= 0) state.rings.splice(i, 1);
    }
    state.shake = Math.max(0, state.shake - dt * 26);
  }

  function collide() {
    let events = 0;
    const player = state.player;
    for (let bi = state.bolts.length - 1; bi >= 0; bi -= 1) {
      const b = state.bolts[bi];
      for (let ei = state.enemies.length - 1; ei >= 0; ei -= 1) {
        const e = state.enemies[ei];
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        const rr = b.radius + e.radius;
        if (dx * dx + dy * dy < rr * rr) {
          state.bolts.splice(bi, 1);
          e.hp -= 1;
          e.flash = 0.09;
          explodeAt(b.x, b.y, '#a5f3fc', 4, 140);
          if (e.hp <= 0) events |= killEnemy(ei, false);
          break;
        }
      }
    }
    for (let i = state.shardsArr.length - 1; i >= 0; i -= 1) {
      const s = state.shardsArr[i];
      const dx = s.x - player.x;
      const dy = s.y - player.y;
      const rr = s.radius + player.radius + 6;
      if (dx * dx + dy * dy < rr * rr) {
        state.shardsArr.splice(i, 1);
        state.shards += 1;
        addScore(SCORE.shard, s.x, s.y);
        chargeNova(NOVA_SHARD);
        explodeAt(s.x, s.y, '#fbbf24', 8, 150);
        sound.collect(Math.min(6, state.combo));
      }
    }
    for (let i = state.powerups.length - 1; i >= 0; i -= 1) {
      const p = state.powerups[i];
      const dx = p.x - player.x;
      const dy = p.y - player.y;
      const rr = p.radius + player.radius + 6;
      if (dx * dx + dy * dy < rr * rr) {
        state.powerups.splice(i, 1);
        applyPowerup(p.power);
      }
    }
    if (player.invulnerable <= 0) {
      for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
        const e = state.enemies[i];
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        const rr = e.radius + player.radius - 4;
        if (dx * dx + dy * dy < rr * rr) {
          events |= hitPlayer();
          break;
        }
      }
      if (!(events & EVENT_OVER)) {
        for (let i = state.orbs.length - 1; i >= 0; i -= 1) {
          const o = state.orbs[i];
          const dx = o.x - player.x;
          const dy = o.y - player.y;
          const rr = o.radius + player.radius - 4;
          if (dx * dx + dy * dy < rr * rr) {
            state.orbs.splice(i, 1);
            events |= hitPlayer();
            break;
          }
        }
      }
    }
    return events;
  }

  function applyPowerup(power) {
    const player = state.player;
    const names = { shield: 'SHIELD UP', rapid: 'RAPID FIRE', magnet: 'SHARD MAGNET', heart: '+1 LIFE' };
    if (power === 'shield') player.shield = true;
    if (power === 'rapid') player.rapidTimer = POWERUP.rapidSeconds;
    if (power === 'magnet') player.magnetTimer = POWERUP.magnetSeconds;
    if (power === 'heart') state.lives = Math.min(LIVES, state.lives + 1);
    state.floaters.push(makeFloater(player.x, player.y - 34, names[power], '#a5f3fc'));
    sound.powerup();
  }

  /**
   * Advance the world one fixed step. `move` is {x, y}, `aim` is {x, y},
   * `firing` holds the fire button, `novaPressed` is this frame's Nova press.
   * Returns a bitmask of EVENT_* flags.
   */
  function step(dt, move, aim, firing, novaPressed) {
    if (state.over || state.victory) return 0;
    state.time += dt;
    state.novaCooldown = Math.max(0, state.novaCooldown - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 1;
    }
    let events = 0;

    if (state.wavePhase === 'intro') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) {
        state.wavePhase = 'active';
        const plan = wavePlan(state.wave);
        state.spawnTimer = 0.4;
        if (plan.boss) spawnBoss();
      }
    } else if (state.wavePhase === 'active') {
      const plan = wavePlan(state.wave);
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          state.spawnTimer = plan.interval * random.range(0.7, 1.3);
          spawnFromQueue();
        }
      }
      state.shardTimer -= dt;
      if (state.shardTimer <= 0) {
        state.shardTimer = SHARD.spawnInterval * random.range(0.8, 1.3);
        state.shardsArr.push(makeShard(random.range(40, FIELD.width - 40), -20, random));
      }
      if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
        const bonus = SCORE.waveClear * state.wave;
        state.score += bonus;
        state.floaters.push(makeFloater(FIELD.width / 2, FIELD.height / 2 - 60, `WAVE BONUS +${bonus}`, '#fbbf24'));
        sound.waveClear();
        events |= EVENT_WAVE_CLEAR;
        state.wavePhase = 'clear';
        state.waveTimer = 2.4;
      }
    } else if (state.wavePhase === 'clear') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) startWave(state.wave + 1);
    }

    updatePlayer(dt, move, aim, firing);
    if (novaPressed && state.nova >= NOVA_MAX && state.novaCooldown <= 0) {
      events |= fireNova();
    }
    updateEnemies(dt);
    updateShards(dt);
    updateProjectiles(dt);
    updateFx(dt);
    events |= collide();
    if (state.over) return events | EVENT_OVER;
    if (state.victory) return events | EVENT_VICTORY;
    return events;
  }

  /** A boss-fight tableau for the screenshot scene: wave 5, boss up, HUD busy. */
  function debugBossScene() {
    Object.assign(state, freshState());
    state.wave = 5;
    state.wavePhase = 'active';
    state.score = 2450;
    state.combo = 4;
    state.comboTimer = COMBO_WINDOW;
    state.nova = 40;
    state.shards = 31;
    state.kills = 42;
    state.player.x = FIELD.width / 2;
    state.player.y = FIELD.height - 150;
    state.player.angle = -Math.PI / 2;
    spawnBoss();
    for (let i = 0; i < 4; i += 1) {
      state.enemies.push(makeEnemy('mite', random.range(120, FIELD.width - 120), random.range(180, 420), 5));
    }
    for (let i = 0; i < 6; i += 1) {
      state.shardsArr.push(makeShard(random.range(80, FIELD.width - 80), random.range(120, 480), random));
    }
  }

  /** A mid-combat tableau for the screenshot scene: wave 3, the field busy. */
  function debugPlayScene() {
    Object.assign(state, freshState());
    state.wave = 3;
    state.wavePhase = 'active';
    state.score = 1820;
    state.combo = 4;
    state.comboTimer = COMBO_WINDOW;
    state.nova = 72;
    state.shards = 19;
    state.kills = 23;
    state.player.x = FIELD.width / 2;
    state.player.y = FIELD.height - 190;
    state.player.angle = -Math.PI / 2;
    const spots = [
      ['mite', 300, 220],
      ['mite', 900, 180],
      ['mite', 1080, 380],
      ['weaver', 480, 300],
      ['weaver', 820, 420],
      ['spitter', 1120, 220],
    ];
    for (const [kind, x, y] of spots) state.enemies.push(makeEnemy(kind, x, y, 3));
    for (let i = 0; i < 5; i += 1) {
      state.shardsArr.push(makeShard(random.range(120, FIELD.width - 120), random.range(140, 520), random));
    }
    state.powerups.push(makePowerup('magnet', 760, 300));
    state.orbs.push(makeOrb(900, 260, Math.PI * 0.75));
    state.orbs.push(makeOrb(420, 340, Math.PI * 0.25));
    state.spawnQueue = ['mite', 'mite', 'weaver', 'mite'];
  }

  return { state, reset, step, startWave, debugBossScene, debugPlayScene };
}
