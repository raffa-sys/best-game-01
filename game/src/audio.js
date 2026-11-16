// SPDX-License-Identifier: MIT
// Nova Harvest — every sound is synthesised with WebAudio: no audio files, no
// network. Effects are short oscillator/noise bursts; the music is a small
// generative sequencer (bass + arpeggio in A minor) whose tempo follows the wave.

/** A minor pentatonic-ish ladder the music and the pickup chime share. */
const SCALE = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
const BASS = [55.0, 65.41, 49.0, 73.42];

/** Master volumes: effects sit above the music bed. */
const VOL = { master: 0.5, sfx: 0.9, music: 0.32 };

export function createSoundBank() {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let noiseBuffer = null;
  let muted = false;
  let musicTimer = null;
  let step = 0;
  let nextTime = 0;
  let intensity = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOL.master;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = VOL.sfx;
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = VOL.music;
      musicBus.connect(master);
      const length = ctx.sampleRate;
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  /** Call from any user gesture: browsers only let audio start after one. */
  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone({ freq, freqEnd, type = 'sine', at = 0, dur = 0.15, vol = 0.5, bus = null }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(bus ?? sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise({ at = 0, dur = 0.2, vol = 0.4, freq = 1200, bus = null }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.25), t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus ?? sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  function musicStep() {
    if (!ctx) return;
    const spb = 60 / (112 + intensity * 26);
    const eighth = spb / 2;
    while (nextTime < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % BASS.length;
      if (step % 8 === 0) {
        tone({ freq: BASS[bar], type: 'triangle', at: nextTime - ctx.currentTime, dur: eighth * 7, vol: 0.5, bus: musicBus });
      }
      if (step % 2 === 0) {
        const degree = [0, 2, 4, 7, 4, 2, 5, 7][(step / 2) % 8];
        tone({ freq: SCALE[degree] * 2, type: 'sine', at: nextTime - ctx.currentTime, dur: eighth * 1.8, vol: 0.16, bus: musicBus });
      }
      if (step % 4 === 2) {
        tone({ freq: SCALE[0] * 4, type: 'sine', at: nextTime - ctx.currentTime, dur: eighth, vol: 0.07, bus: musicBus });
      }
      step += 1;
      nextTime += eighth;
    }
  }

  return {
    unlock,
    get isMuted() {
      return muted;
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : VOL.master;
    },
    /** 0 (calm) to 1 (boss): raises the music tempo. */
    setIntensity(value) {
      intensity = Math.max(0, Math.min(1, value));
    },
    startMusic() {
      if (!ensure() || musicTimer !== null) return;
      step = 0;
      nextTime = ctx.currentTime + 0.1;
      musicTimer = window.setInterval(musicStep, 90);
    },
    stopMusic() {
      if (musicTimer !== null) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
    },
    shoot() {
      if (!ensure()) return;
      tone({ freq: 880, freqEnd: 220, type: 'square', dur: 0.09, vol: 0.16 });
    },
    collect(pitchStep = 0) {
      if (!ensure()) return;
      const f = SCALE[Math.min(SCALE.length - 1, 4 + pitchStep)];
      tone({ freq: f, dur: 0.12, vol: 0.3 });
      tone({ freq: f * 1.5, at: 0.05, dur: 0.16, vol: 0.22 });
    },
    explode(big = false) {
      if (!ensure()) return;
      noise({ dur: big ? 0.55 : 0.3, vol: big ? 0.6 : 0.4, freq: big ? 900 : 1600 });
      tone({ freq: big ? 160 : 220, freqEnd: 40, type: 'sawtooth', dur: big ? 0.5 : 0.28, vol: 0.35 });
    },
    hit() {
      if (!ensure()) return;
      tone({ freq: 320, freqEnd: 70, type: 'sawtooth', dur: 0.3, vol: 0.5 });
      noise({ dur: 0.22, vol: 0.35, freq: 900 });
    },
    nova() {
      if (!ensure()) return;
      tone({ freq: 120, freqEnd: 1400, type: 'sine', dur: 0.55, vol: 0.5 });
      noise({ dur: 0.6, vol: 0.3, freq: 3200 });
      tone({ freq: 660, freqEnd: 1320, at: 0.1, dur: 0.4, vol: 0.2 });
    },
    powerup() {
      if (!ensure()) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ freq: f, at: i * 0.06, dur: 0.18, vol: 0.28 }));
    },
    waveClear() {
      if (!ensure()) return;
      [392.0, 523.25, 659.25].forEach((f, i) => tone({ freq: f, at: i * 0.09, dur: 0.25, vol: 0.3 }));
    },
    bossRoar() {
      if (!ensure()) return;
      tone({ freq: 90, freqEnd: 45, type: 'sawtooth', dur: 0.9, vol: 0.5 });
      noise({ dur: 0.8, vol: 0.3, freq: 500 });
    },
    gameOver() {
      if (!ensure()) return;
      [392.0, 329.63, 261.63, 196.0].forEach((f, i) => tone({ freq: f, at: i * 0.22, dur: 0.4, vol: 0.3, type: 'triangle' }));
    },
    victory() {
      if (!ensure()) return;
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone({ freq: f, at: i * 0.1, dur: 0.35, vol: 0.3, type: 'triangle' }));
    },
    click() {
      if (!ensure()) return;
      tone({ freq: 660, dur: 0.06, vol: 0.2 });
    },
  };
}
