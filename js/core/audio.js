'use strict';
// 소리: Codex는 오디오를 만들 수 없어서 WebAudio로 국악풍 소리를 합성한다.
// 가야금(퉁기는 소리)·대금(부는 소리)·장구(타악)를 흉내 내고, 5음계 선율을 자동으로 만든다.
(function () {
  let ctx = null, master, musicBus, sfxBus, echo;
  const A = G.audio = { musicVol: 0.55, sfxVol: 0.8, muted: false, track: null };

  A.unlock = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = A.muted ? 0 : 1; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = A.musicVol; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = A.sfxVol; sfxBus.connect(master);
    // 공간감: 되먹임 지연
    echo = ctx.createDelay(1.0); echo.delayTime.value = 0.28;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    echo.connect(lp); lp.connect(fb); fb.connect(echo);
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    lp.connect(wet); wet.connect(musicBus);
    A.ctx = ctx;
    if (A.pendingTrack) { const t = A.pendingTrack; A.pendingTrack = null; A.play(t); }
  };
  A.setMuted = function (m) { A.muted = m; if (master) master.gain.value = m ? 0 : 1; };
  A.setMusicVol = function (v) { A.musicVol = v; if (musicBus) musicBus.gain.value = v; };

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  function env(g, t, a, peak, dec, sustain = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + dec);
  }

  // ---------------- 악기 ----------------
  const INST = {
    // 가야금: 삼각파 + 배음, 짧게 퉁기고 살짝 흘러내리는 농현
    gayageum(t, midi, dur, vel, out) {
      const f = mtof(midi);
      const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.setValueAtTime(f * 1.012, t); o1.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
      const g = ctx.createGain(), g2 = ctx.createGain(); g2.gain.value = 0.25;
      env(g, t, 0.004, 0.32 * vel, Math.min(1.6, dur + 0.7));
      o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(out); g.connect(echo);
      o1.start(t); o2.start(t); o1.stop(t + dur + 1); o2.stop(t + dur + 1);
    },
    // 대금: 사인파 + 떨림(비브라토) + 숨소리
    daegeum(t, midi, dur, vel, out) {
      const f = mtof(midi);
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2;
      const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.8);
      lfo.connect(lg); lg.connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2 * vel, t + 0.09);
      g.gain.setValueAtTime(0.2 * vel, t + Math.max(0.1, dur - 0.08)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
      const n = noise(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 2;
      const ng = ctx.createGain(); ng.gain.value = 0.05 * vel;
      n.connect(bp); bp.connect(ng); ng.connect(g);
      o.connect(g); g.connect(out); g.connect(echo);
      o.start(t); lfo.start(t); n.start(t); o.stop(t + dur + 0.3); lfo.stop(t + dur + 0.3); n.stop(t + dur + 0.3);
    },
    // 장구: 덩(양면) / 쿵(북편) / 덕(채편)
    janggu(t, kind, vel, out) {
      if (kind === 'kung' || kind === 'deong') {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.18);
        const g = ctx.createGain(); env(g, t, 0.003, 0.55 * vel, 0.3);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.4);
      }
      if (kind === 'deok' || kind === 'deong') {
        const n = noise(), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
        const g = ctx.createGain(); env(g, t, 0.002, 0.28 * vel, 0.07);
        n.connect(hp); hp.connect(g); g.connect(out); n.start(t); n.stop(t + 0.12);
      }
    },
    drone(t, midi, dur, vel, out) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(midi);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 * vel, t + 0.6); g.gain.setValueAtTime(0.05 * vel, t + dur - 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.1);
    },
  };

  // ---------------- 선율 생성 ----------------
  // 평조(솔라도레미)와 계면조(라도레미솔) 5음계
  const SCALES = { pyeong: [0, 2, 5, 7, 9], gyemyeon: [0, 3, 5, 7, 10] };
  function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  const TRACKS = {
    title:   { seed: 11, bpm: 66, root: 62, scale: 'pyeong', lead: 'daegeum', bars: 8, beats: 4, drum: 'none', pluck: 'sparse' },
    journey: { seed: 23, bpm: 100, root: 64, scale: 'pyeong', lead: 'gayageum', bars: 8, beats: 12, drum: 'gutgeori', pluck: 'lead' },
    mountain:{ seed: 37, bpm: 80, root: 62, scale: 'pyeong', lead: 'daegeum', bars: 8, beats: 4, drum: 'soft', pluck: 'arp' },
    sea:     { seed: 41, bpm: 92, root: 65, scale: 'pyeong', lead: 'gayageum', bars: 8, beats: 12, drum: 'semachi', pluck: 'lead' },
    boss:    { seed: 53, bpm: 138, root: 57, scale: 'gyemyeon', lead: 'gayageum', bars: 8, beats: 4, drum: 'hwimori', pluck: 'lead', drone: 45 },
    night:   { seed: 67, bpm: 58, root: 60, scale: 'gyemyeon', lead: 'daegeum', bars: 8, beats: 4, drum: 'none', pluck: 'sparse' },
    dream:   { seed: 71, bpm: 64, root: 67, scale: 'pyeong', lead: 'gayageum', bars: 8, beats: 4, drum: 'none', pluck: 'arp', drone: 55 },
    sad:     { seed: 83, bpm: 62, root: 60, scale: 'gyemyeon', lead: 'daegeum', bars: 8, beats: 4, drum: 'soft', pluck: 'sparse' },
  };

  function buildTrack(def) {
    const rnd = seeded(def.seed);
    const sc = SCALES[def.scale];
    const deg2midi = (d) => def.root + Math.floor(d / 5) * 12 + sc[((d % 5) + 5) % 5];
    const notes = [];
    const beatDur = 60 / def.bpm * (def.beats === 12 ? 0.5 : 1);
    const barBeats = def.beats === 12 ? 12 : 4;
    let deg = 5;
    const rhythms4 = [[1, 1, 1, 1], [2, 1, 1], [1, 1, 2], [0.5, 0.5, 1, 2], [3, 1], [1.5, 0.5, 2], [4]];
    const rhythms12 = [[3, 3, 3, 3], [2, 1, 3, 3, 3], [3, 2, 1, 6], [6, 3, 3], [2, 1, 2, 1, 6]];
    for (let bar = 0; bar < def.bars; bar++) {
      let pos = bar * barBeats;
      const rs = def.beats === 12 ? rhythms12 : rhythms4;
      const r = rs[Math.floor(rnd() * rs.length)];
      for (let i = 0; i < r.length; i++) {
        const step = [-2, -1, -1, 0, 1, 1, 2][Math.floor(rnd() * 7)];
        deg = Math.max(2, Math.min(9, deg + step));
        if (bar % 4 === 3 && i === r.length - 1) deg = 5;           // 4마디마다 으뜸음으로
        if (def.pluck === 'sparse' && rnd() < 0.2 && i > 0) { pos += r[i]; continue; }
        notes.push({ t: pos * beatDur, midi: deg2midi(deg), dur: r[i] * beatDur * 0.95, inst: def.lead, vel: 0.8 + rnd() * 0.2 });
        if (def.pluck === 'arp' && i === 0) {
          for (let k = 0; k < 3; k++) notes.push({ t: (pos + k * 0.5) * beatDur, midi: deg2midi(deg - 5 + k * 2), dur: beatDur, inst: 'gayageum', vel: 0.35 });
        }
        pos += r[i];
      }
      // 장단
      const b0 = bar * barBeats;
      const D = (off, k, v = 1) => notes.push({ t: (b0 + off) * beatDur, drum: k, vel: v });
      if (def.drum === 'gutgeori') { D(0, 'deong'); D(3, 'deok', 0.7); D(5, 'deok', 0.5); D(6, 'kung'); D(8, 'deok', 0.6); D(9, 'kung', 0.8); D(11, 'deok', 0.5); }
      if (def.drum === 'semachi') { D(0, 'deong'); D(4, 'deok', 0.6); D(6, 'kung'); D(8, 'deok', 0.6); D(10, 'kung', 0.7); }
      if (def.drum === 'hwimori') { D(0, 'deong'); D(1, 'deok', 0.6); D(2, 'kung'); D(3, 'deok', 0.7); D(3.5, 'deok', 0.5); }
      if (def.drum === 'soft') { D(0, 'kung', 0.5); D(2, 'deok', 0.3); }
      if (def.drone && bar % 2 === 0) notes.push({ t: b0 * beatDur, midi: def.drone, dur: barBeats * beatDur * 2, inst: 'drone', vel: 1 });
    }
    return { notes, length: def.bars * barBeats * beatDur };
  }

  let sched = null, loopStart = 0, idx = 0, cur = null;
  A.play = function (name) {
    if (A.track === name && sched) return;
    A.track = name;
    if (!ctx) { A.pendingTrack = name; return; }
    A.stopMusic(true);
    const def = TRACKS[name];
    if (!def) return;
    cur = buildTrack(def);
    cur.notes.sort((a, b) => a.t - b.t);
    loopStart = ctx.currentTime + 0.1; idx = 0;
    const bus = ctx.createGain(); bus.gain.value = 0.0001; bus.connect(musicBus);
    bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.2);
    cur.bus = bus;
    sched = setInterval(() => {
      if (!cur) return;
      const ahead = ctx.currentTime + 0.25;
      while (true) {
        const n = cur.notes[idx];
        const t = loopStart + n.t;
        if (t > ahead) break;
        if (t >= ctx.currentTime - 0.05) {
          if (n.drum) INST.janggu(t, n.drum, n.vel, cur.bus);
          else INST[n.inst](t, n.midi, n.dur, n.vel, cur.bus);
        }
        idx++;
        if (idx >= cur.notes.length) { idx = 0; loopStart += cur.length; }
      }
    }, 60);
  };
  A.stopMusic = function (fast) {
    if (sched) { clearInterval(sched); sched = null; }
    if (cur && cur.bus && ctx) {
      const b = cur.bus; b.gain.cancelScheduledValues(ctx.currentTime);
      b.gain.setValueAtTime(b.gain.value, ctx.currentTime);
      b.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (fast ? 0.4 : 1.2));
      setTimeout(() => b.disconnect(), 1500);
    }
    cur = null;
    if (!fast) A.track = null;
  };

  // ---------------- 효과음 ----------------
  function tone(type, f0, f1, dur, vol, t0 = 0) {
    const t = ctx.currentTime + t0;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); env(g, t, 0.005, vol, dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(dur, vol, f0, f1, type = 'bandpass', t0 = 0, q = 1) {
    const t = ctx.currentTime + t0;
    const n = noise(), f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, 0.004, vol, dur);
    n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t); n.stop(t + dur + 0.05);
  }
  const SFX = {
    jump: () => tone('square', 260, 520, 0.12, 0.08),
    jump2: () => { tone('sine', 520, 1040, 0.16, 0.1); hiss(0.2, 0.05, 3000, 6000, 'highpass'); },
    land: () => hiss(0.06, 0.12, 400, 200, 'lowpass'),
    slash: () => hiss(0.14, 0.25, 900, 3500, 'bandpass', 0, 1.4),
    gust: () => hiss(0.3, 0.15, 500, 1800, 'bandpass', 0, 0.8),
    hit: () => { tone('square', 180, 60, 0.12, 0.2); hiss(0.08, 0.25, 2000, 400, 'lowpass'); },
    kill: () => { hiss(0.35, 0.3, 1200, 150, 'lowpass'); tone('sine', 300, 80, 0.3, 0.2); },
    hurt: () => { tone('sawtooth', 300, 90, 0.25, 0.18); },
    pickup: () => { [0, 4, 7, 12].forEach((s, i) => tone('triangle', mtof(76 + s), mtof(76 + s), 0.12, 0.12, i * 0.05)); },
    ink: () => tone('triangle', 900, 1400, 0.06, 0.07),
    scroll: () => { hiss(0.35, 0.12, 3000, 800, 'bandpass', 0, 0.6); [0, 5, 7].forEach((s, i) => INST.gayageum(ctx.currentTime + 0.1 + i * 0.09, 74 + s, 0.4, 0.8, sfxBus)); },
    correct: () => { [0, 4, 7, 12].forEach((s, i) => INST.gayageum(ctx.currentTime + i * 0.06, 72 + s, 0.5, 1, sfxBus)); tone('sine', 1568, 1568, 0.4, 0.06, 0.25); },
    wrong: () => { tone('square', 160, 120, 0.25, 0.12); tone('square', 150, 110, 0.3, 0.1, 0.12); },
    cast: () => { [0, 7, 12, 19].forEach((s, i) => tone('sine', mtof(79 + s), mtof(79 + s), 0.4, 0.07, i * 0.05)); hiss(0.5, 0.08, 4000, 9000, 'highpass'); },
    mind: () => { tone('sine', 880, 1320, 0.2, 0.1); tone('sine', 660, 990, 0.25, 0.06, 0.05); },
    select: () => tone('triangle', 660, 660, 0.05, 0.08),
    confirm: () => { tone('triangle', 660, 660, 0.06, 0.1); tone('triangle', 990, 990, 0.08, 0.1, 0.05); },
    blip: () => tone('triangle', 520 + Math.random() * 80, 520, 0.025, 0.025),
    boss: () => { tone('sawtooth', 120, 40, 0.6, 0.25); hiss(0.6, 0.25, 800, 100, 'lowpass'); },
    thunder: () => { hiss(1.4, 0.35, 300, 60, 'lowpass'); tone('sine', 60, 30, 1.2, 0.3); },
    wave: () => hiss(1.1, 0.25, 600, 2500, 'bandpass', 0, 0.5),
    rain: () => hiss(1.5, 0.12, 5000, 3000, 'highpass'),
    bell: () => { INST.gayageum(ctx.currentTime, 86, 1.2, 0.7, sfxBus); tone('sine', mtof(98), mtof(98), 1.2, 0.04); },
    horse: () => { hiss(0.05, 0.15, 500, 300, 'lowpass'); hiss(0.05, 0.12, 500, 300, 'lowpass', 0.12); },
    whoosh: () => hiss(0.4, 0.18, 300, 2000, 'bandpass', 0, 0.7),
    stamp: () => { tone('square', 120, 60, 0.1, 0.25); hiss(0.1, 0.2, 800, 200, 'lowpass'); },
  };
  A.sfx = function (name) {
    if (!ctx || A.muted) return;
    const f = SFX[name];
    if (f) try { f(); } catch (e) { /* 무시 */ }
  };
})();
