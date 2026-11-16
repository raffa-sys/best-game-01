// SPDX-License-Identifier: MIT
// Nova Harvest — every pixel the player sees. A fixed 1280x720 canvas: a
// parallax starfield, nebula wash, pre-rendered glow sprites, the entities, the
// HUD, and the title / pause / game-over / victory screens. Nothing here loads
// a file; all art is drawn from code.

import { FIELD, NOVA_MAX, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const TAU = Math.PI * 2;

/** A 128x128 radial glow sprite, white core fading to the colour, then clear. */
function makeGlow(color) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}

/** Deterministic star layers, so the title screen looks the same every visit. */
function makeStars(seed, count, maxY) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let v = s;
    v = Math.imul(v ^ (v >>> 15), v | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({ x: next() * FIELD.width, y: next() * maxY, r: 0.6 + next() * 1.7, tw: next() * TAU, sp: 0.4 + next() * 1.6 });
  }
  return stars;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const glow = {
    cyan: makeGlow('#22d3ee'),
    gold: makeGlow('#fbbf24'),
    magenta: makeGlow('#e879f9'),
    pink: makeGlow('#f472b6'),
    purple: makeGlow('#c084fc'),
    red: makeGlow('#f43f5e'),
    green: makeGlow('#34d399'),
    white: makeGlow('#e2e8f0'),
    shield: makeGlow('#38bdf8'),
    rapid: makeGlow('#facc15'),
    magnet: makeGlow('#a78bfa'),
    heart: makeGlow('#fb7185'),
  };
  const starsFar = makeStars(11, 130, FIELD.height);
  const starsNear = makeStars(77, 70, FIELD.height);
  const nebulae = [
    { x: 240, y: 150, r: 330, color: PALETTE.nebulaCyan },
    { x: 1080, y: 560, r: 380, color: PALETTE.nebulaMagenta },
    { x: 980, y: 110, r: 260, color: PALETTE.nebulaGold },
  ];

  function drawGlow(sprite, x, y, size, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  function drawStar(x, y, r, rot, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.quadraticCurveTo(0, 0, 0, r);
    ctx.quadraticCurveTo(0, 0, -r, 0);
    ctx.quadraticCurveTo(0, 0, 0, -r);
    ctx.fill();
    ctx.restore();
  }

  function drawHeart(x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 16, size / 16);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.bezierCurveTo(-9, -3, -6, -11, 0, -5);
    ctx.bezierCurveTo(6, -11, 9, -3, 0, 5);
    ctx.fill();
    ctx.restore();
  }

  function drawBackground(state) {
    const grad = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.spaceTop);
    grad.addColorStop(1, PALETTE.spaceBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const n of nebulae) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, n.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }
    for (const layer of [starsFar, starsNear]) {
      const speed = layer === starsFar ? 6 : 16;
      const off = (state.time * speed) % FIELD.height;
      for (const s of layer) {
        const y = (s.y + off) % FIELD.height;
        const a = 0.35 + 0.65 * Math.abs(Math.sin(state.time * s.sp + s.tw));
        ctx.globalAlpha = a;
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(s.x, y, s.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawShard(s) {
    const pulse = 1 + Math.sin(s.phase * 3) * 0.12;
    drawGlow(glow.gold, s.x, s.y, 64 * pulse, 0.9);
    drawStar(s.x, s.y, s.radius * pulse, s.phase * s.spin, PALETTE.shard);
    ctx.fillStyle = PALETTE.shardCore;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3.5, 0, TAU);
    ctx.fill();
  }

  function drawEnemy(e) {
    if (e.kind === 'mite') {
      drawGlow(glow.magenta, e.x, e.y, 90, 0.85);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : PALETTE.mite;
      ctx.beginPath();
      for (let k = 0; k < 8; k += 1) {
        const a = (k / 8) * TAU;
        const r = k % 2 === 0 ? e.radius + 7 : e.radius - 3;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2e1065';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius - 8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fdf4ff';
      ctx.beginPath();
      ctx.arc(-4, -2, 2.6, 0, TAU);
      ctx.arc(5, -2, 2.6, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (e.kind === 'weaver') {
      drawGlow(glow.pink, e.x, e.y, 84, 0.85);
      ctx.save();
      ctx.translate(e.x, e.y);
      const flap = Math.sin(e.phase * 9) * 0.5;
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : PALETTE.weaver;
      ctx.beginPath();
      ctx.moveTo(0, -e.radius - 4);
      ctx.lineTo(e.radius, 0);
      ctx.lineTo(0, e.radius + 4);
      ctx.lineTo(-e.radius, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fbcfe8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-e.radius, -6 - flap * 8);
      ctx.lineTo(-e.radius - 12, -14 - flap * 10);
      ctx.moveTo(e.radius, -6 - flap * 8);
      ctx.lineTo(e.radius + 12, -14 - flap * 10);
      ctx.stroke();
      ctx.fillStyle = '#831843';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (e.kind === 'spitter') {
      drawGlow(glow.purple, e.x, e.y, 92, 0.85);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : PALETTE.spitter;
      ctx.beginPath();
      for (let k = 0; k < 6; k += 1) {
        const a = (k / 6) * TAU + e.phase * 0.4;
        const px = Math.cos(a) * e.radius;
        const py = Math.sin(a) * e.radius;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ede9fe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius - 8, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#4c1d95';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (e.kind === 'boss') {
      drawGlow(glow.red, e.x, e.y, 320, 0.9);
      ctx.save();
      ctx.translate(e.x, e.y);
      const pulse = 1 + Math.sin(e.phase * 2.2) * 0.04;
      ctx.scale(pulse, pulse);
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#881337';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, TAU);
      ctx.fill();
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : PALETTE.boss;
      for (let k = 0; k < 10; k += 1) {
        const a = (k / 10) * TAU + e.phase * 0.25;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (e.radius - 6), Math.sin(a) * (e.radius - 6));
        ctx.lineTo(Math.cos(a + 0.18) * (e.radius - 6), Math.sin(a + 0.18) * (e.radius - 6));
        ctx.lineTo(Math.cos(a + 0.09) * (e.radius - 22), Math.sin(a + 0.09) * (e.radius - 22));
        ctx.closePath();
        ctx.fill();
      }
      const core = 26 + Math.sin(e.phase * 3) * 5;
      ctx.fillStyle = '#fff1f2';
      ctx.beginPath();
      ctx.arc(0, 0, core, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(0, 0, core * 0.55, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawOrb(o) {
    drawGlow(glow.red, o.x, o.y, 46, 0.9);
    ctx.fillStyle = PALETTE.orb;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.radius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff1f2';
    ctx.beginPath();
    ctx.arc(o.x, o.y, 3, 0, TAU);
    ctx.fill();
  }

  function drawBolt(b) {
    ctx.strokeStyle = PALETTE.bolt;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    drawGlow(glow.cyan, b.x, b.y, 22, 0.8);
  }

  function drawPlayer(p, time) {
    if (p.invulnerable > 0 && Math.floor(time * 14) % 2 === 0) return;
    drawGlow(glow.cyan, p.x, p.y, 110, 0.9);
    if (p.shield) {
      ctx.strokeStyle = 'rgba(56,189,248,0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 12 + Math.sin(time * 5) * 2, 0, TAU);
      ctx.stroke();
    }
    const flame = 14 + p.thrust * 16 + Math.sin(time * 40) * 4;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(251,146,60,0.9)';
    ctx.beginPath();
    ctx.moveTo(-14, -5);
    ctx.lineTo(-14 - flame, 0);
    ctx.lineTo(-14, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-12, -13);
    ctx.lineTo(-7, -4);
    ctx.lineTo(-7, 4);
    ctx.lineTo(-12, 13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(6, 0, 5.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0f766e';
    ctx.beginPath();
    ctx.arc(6, 0, 2.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawPowerup(p) {
    const colors = { shield: '#38bdf8', rapid: '#facc15', magnet: '#a78bfa', heart: '#fb7185' };
    const color = colors[p.power] ?? '#fff';
    const bob = Math.sin(p.phase * 3) * 3;
    drawGlow(glow[p.power] ?? glow.white, p.x, p.y + bob, 70, 0.9);
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyph = { shield: 'S', rapid: 'R', magnet: 'M', heart: '+' }[p.power] ?? '?';
    if (p.power === 'heart') drawHeart(0, 1, 15, color);
    else ctx.fillText(glyph, 0, 1);
    ctx.restore();
  }

  function drawHud(state, best) {
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(2,6,23,0.55)';
    ctx.fillRect(0, 0, FIELD.width, 64);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.fillText(String(state.score).padStart(6, '0'), 24, 42);
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dimText;
    ctx.fillText(`BEST ${best}`, 26, 58);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.fillText(`WAVE ${state.wave}`, FIELD.width / 2, 30);
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dimText;
    ctx.fillText(`${state.kills} KILLS  ·  ${state.shards} SHARDS`, FIELD.width / 2, 52);
    ctx.textAlign = 'right';
    for (let i = 0; i < 3; i += 1) {
      drawHeart(FIELD.width - 24 - i * 30, 26, 17, i < state.lives ? PALETTE.heart : 'rgba(148,163,184,0.35)');
    }
    const barW = 190;
    const barX = FIELD.width - 24 - barW;
    const barY = 46;
    ctx.fillStyle = 'rgba(148,163,184,0.35)';
    ctx.fillRect(barX, barY, barW, 10);
    ctx.fillStyle = state.nova >= NOVA_MAX ? PALETTE.gold : '#22d3ee';
    ctx.fillRect(barX, barY, (barW * state.nova) / NOVA_MAX, 10);
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = state.nova >= NOVA_MAX ? PALETTE.gold : PALETTE.dimText;
    ctx.textAlign = 'right';
    ctx.fillText(state.nova >= NOVA_MAX ? 'NOVA READY — E' : 'NOVA', barX - 10, barY + 9);
    if (state.combo > 1) {
      ctx.textAlign = 'left';
      ctx.font = '800 24px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(`COMBO x${state.combo}`, 24, 96);
    }
    const boss = state.enemies.find((e) => e.kind === 'boss');
    if (boss) {
      const bw = 420;
      const bx = (FIELD.width - bw) / 2;
      const by = 76;
      ctx.fillStyle = 'rgba(2,6,23,0.6)';
      ctx.fillRect(bx - 10, by - 18, bw + 20, 34);
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.danger;
      ctx.textAlign = 'center';
      ctx.fillText('VOID MAW', FIELD.width / 2, by - 4);
      ctx.fillStyle = 'rgba(148,163,184,0.4)';
      ctx.fillRect(bx, by + 2, bw, 8);
      ctx.fillStyle = PALETTE.boss;
      ctx.fillRect(bx, by + 2, (bw * Math.max(0, boss.hp)) / boss.maxHp, 8);
    }
  }

  function drawBanner(text, sub, alpha) {
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = '800 54px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(94,234,212,0.8)';
    ctx.shadowBlur = 24;
    ctx.fillText(text, FIELD.width / 2, FIELD.height / 2 - 40);
    ctx.shadowBlur = 0;
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dimText;
    ctx.fillText(sub, FIELD.width / 2, FIELD.height / 2 + 4);
    ctx.globalAlpha = 1;
  }

  function drawWorld(state) {
    for (const s of state.shardsArr) drawShard(s);
    for (const p of state.powerups) drawPowerup(p);
    for (const e of state.enemies) drawEnemy(e);
    for (const o of state.orbs) drawOrb(o);
    for (const b of state.bolts) drawBolt(b);
    drawPlayer(state.player, state.time);
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const r of state.rings) {
      ctx.globalAlpha = Math.max(0, r.life / r.maxLife) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.font = '800 19px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function overlay(alpha) {
    ctx.fillStyle = `rgba(2,6,23,${alpha})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function centeredLines(lines, startY, gap) {
    ctx.textAlign = 'center';
    lines.forEach((line, i) => {
      ctx.font = line.font;
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, FIELD.width / 2, startY + i * gap);
    });
  }

  function drawTitle(state, best) {
    overlay(0.62);
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(94,234,212,0.9)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#ecfeff';
    ctx.font = '800 92px system-ui, sans-serif';
    ctx.fillText('NOVA', FIELD.width / 2, 250);
    ctx.fillStyle = PALETTE.gold;
    ctx.shadowColor = 'rgba(251,191,36,0.9)';
    ctx.fillText('HARVEST', FIELD.width / 2, 340);
    ctx.shadowBlur = 0;
    centeredLines(
      [
        { text: 'Harvest the star shards. Blast the void. Charge your Nova.', font: '600 22px system-ui, sans-serif', color: PALETTE.text },
        { text: 'WASD / Arrows — fly      Mouse — aim      Click / Space — fire', font: '600 18px system-ui, sans-serif', color: PALETTE.dimText },
        { text: 'E — Nova blast      P — pause      M — mute      R — restart', font: '600 18px system-ui, sans-serif', color: PALETTE.dimText },
      ],
      396,
      32,
    );
    ctx.font = '800 26px system-ui, sans-serif';
    ctx.fillStyle = Math.floor(state.time * 2) % 2 === 0 ? PALETTE.gold : PALETTE.text;
    ctx.fillText('PRESS ENTER OR CLICK TO START', FIELD.width / 2, 540);
    if (best > 0) {
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.dimText;
      ctx.fillText(`BEST SCORE ${best}`, FIELD.width / 2, 580);
    }
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.fillText('Beat the Void Maw on wave 10 to clear the sector — then keep harvesting.', FIELD.width / 2, 660);
  }

  function drawPaused() {
    overlay(0.6);
    centeredLines(
      [
        { text: 'PAUSED', font: '800 64px system-ui, sans-serif', color: PALETTE.text },
        { text: 'Press P or Enter to keep harvesting', font: '600 20px system-ui, sans-serif', color: PALETTE.dimText },
      ],
      330,
      44,
    );
  }

  function drawOver(state, best) {
    overlay(0.68);
    centeredLines(
      [
        { text: 'SIGNAL LOST', font: '800 72px system-ui, sans-serif', color: PALETTE.danger },
        { text: 'The void takes your harvester… this time.', font: '600 21px system-ui, sans-serif', color: PALETTE.text },
        { text: `SCORE ${state.score}      BEST ${best}`, font: '800 26px system-ui, sans-serif', color: PALETTE.gold },
        { text: `WAVE ${state.wave}   ·   ${state.kills} KILLS   ·   ${state.shards} SHARDS`, font: '600 18px system-ui, sans-serif', color: PALETTE.dimText },
        { text: 'PRESS R OR CLICK TO HARVEST AGAIN', font: '800 22px system-ui, sans-serif', color: PALETTE.text },
      ],
      250,
      52,
    );
  }

  function drawVictory(state, best) {
    overlay(0.6);
    centeredLines(
      [
        { text: 'SECTOR CLEARED!', font: '800 72px system-ui, sans-serif', color: PALETTE.gold },
        { text: 'The Void Maw is dust. The starlight is yours.', font: '600 21px system-ui, sans-serif', color: PALETTE.text },
        { text: `SCORE ${state.score}      BEST ${best}`, font: '800 26px system-ui, sans-serif', color: PALETTE.gold },
        { text: `WAVE ${state.wave}   ·   ${state.kills} KILLS   ·   ${state.shards} SHARDS`, font: '600 18px system-ui, sans-serif', color: PALETTE.dimText },
        { text: 'PRESS ENTER TO KEEP HARVESTING  ·  R TO RESTART', font: '800 22px system-ui, sans-serif', color: PALETTE.text },
      ],
      250,
      52,
    );
  }

  function drawReticle(aim) {
    ctx.strokeStyle = 'rgba(165,243,252,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(aim.x, aim.y, 13, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(aim.x - 19, aim.y);
    ctx.lineTo(aim.x - 7, aim.y);
    ctx.moveTo(aim.x + 7, aim.y);
    ctx.lineTo(aim.x + 19, aim.y);
    ctx.moveTo(aim.x, aim.y - 19);
    ctx.lineTo(aim.x, aim.y - 7);
    ctx.moveTo(aim.x, aim.y + 7);
    ctx.lineTo(aim.x, aim.y + 19);
    ctx.stroke();
  }

  return {
    draw(state, screen, ui) {
      ctx.save();
      if (state.shake > 0.2) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
      }
      drawBackground(state);
      drawWorld(state);
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
        drawHud(state, ui.best);
        if (state.wavePhase === 'intro' && screen === SCREEN_PLAY) {
          drawBanner(`WAVE ${state.wave}`, state.wave % 5 === 0 ? 'Something huge stirs in the dark…' : 'Harvest shards — the void is coming', Math.min(1, state.waveTimer));
        } else if (state.wavePhase === 'clear' && screen === SCREEN_PLAY) {
          drawBanner('WAVE CLEARED', `Bonus banked — wave ${state.wave + 1} approaches`, Math.min(1, state.waveTimer));
        }
        if (screen === SCREEN_PLAY) drawReticle(ui.aim);
      }
      if (screen === SCREEN_TITLE) drawTitle(state, ui.best);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawOver(state, ui.best);
      else if (screen === SCREEN_VICTORY) drawVictory(state, ui.best);
      if (ui.muted) {
        ctx.textAlign = 'right';
        ctx.font = '700 13px system-ui, sans-serif';
        ctx.fillStyle = PALETTE.dimText;
        ctx.fillText('MUTED (M)', FIELD.width - 16, FIELD.height - 14);
      }
      ctx.restore();
    },
  };
}
