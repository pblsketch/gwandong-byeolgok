'use strict';
// 소리: 브라우저 안에서 국악기 소리를 합성하고, 직접 작곡한 곡을 악보(아래 TRACKS)대로 연주한다.
//  - 가야금: 줄을 튕기는 소리를 흉내 내는 Karplus-Strong 합성 + 농현(떨기)
//  - 대금: 사인파 + 숨소리 + 늦게 들어오는 떨림, 음 사이를 미끄러지듯 잇기
//  - 해금: 톱니파를 걸러 낸 비음 섞인 활 소리
//  - 장구(덩·쿵·덕·기덕), 북, 징, 아쟁풍 지속음, 은은한 배경음
//  - 잔향: 합성한 공간 울림(ConvolverNode)
(function () {
  let ctx = null, master, musicBus, sfxBus, revIn, comp;
  const A = G.audio = { musicVol: 0.6, sfxVol: 0.85, muted: false, track: null };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  A.unlock = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = A.muted ? 0 : 1;
    comp.connect(master); master.connect(ctx.destination);
    A.analyser = ctx.createAnalyser(); A.analyser.fftSize = 2048; master.connect(A.analyser);   // 음량 점검용
    musicBus = ctx.createGain(); musicBus.gain.value = A.musicVol; musicBus.connect(comp);
    sfxBus = ctx.createGain(); sfxBus.gain.value = A.sfxVol; sfxBus.connect(comp);
    // 잔향: 지수적으로 사그라드는 잡음으로 만든 공간 울림
    const rev = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) { const k = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, 2.4) * (i < 400 ? i / 400 : 1); }
    }
    rev.buffer = ir;
    revIn = ctx.createGain(); revIn.gain.value = 1;
    const revOut = ctx.createGain(); revOut.gain.value = 0.32;
    const revLp = ctx.createBiquadFilter(); revLp.type = 'lowpass'; revLp.frequency.value = 5200;
    revIn.connect(rev); rev.connect(revLp); revLp.connect(revOut); revOut.connect(comp);
    A.ctx = ctx;
    if (A.pendingTrack) { const t = A.pendingTrack; A.pendingTrack = null; A.play(t); }
  };
  A.setMuted = function (m) { A.muted = m; if (master) master.gain.value = m ? 0 : 1; };
  A.setMusicVol = function (v) { A.musicVol = v; if (musicBus) musicBus.gain.value = v; };

  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  function gainNode(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function filt(type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; return b; }
  function send(node, out, wet) { node.connect(out); if (wet > 0) { const s = gainNode(wet); node.connect(s); s.connect(revIn); } }

  // ---------------------------------------------------------------- 가야금 (Karplus-Strong)
  const ksCache = {};
  function ksBuffer(midi) {
    if (ksCache[midi]) return ksCache[midi];
    const sr = ctx.sampleRate, f = mtof(midi);
    const N = Math.max(2, Math.round(sr / f));
    const len = Math.floor(sr * (midi < 60 ? 3.2 : 2.4));
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    for (let pass = 0; pass < 2; pass++) for (let i = 1; i < N; i++) ring[i] = (ring[i] + ring[i - 1]) * 0.5;   // 명주실처럼 부드러운 소리
    const decay = 0.9955 + 0.003 * Math.min(1, Math.max(0, (midi - 45) / 40));
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const a = ring[idx], b = ring[(idx + 1) % N];
      ring[idx] = (a + b) * 0.5 * decay;
      d[i] = a;
      idx = (idx + 1) % N;
    }
    return (ksCache[midi] = buf);
  }
  function gayageum(t, midi, dur, vel, orn, out, wet = 0.28) {
    const src = ctx.createBufferSource();
    src.buffer = ksBuffer(Math.round(midi));
    const r = src.playbackRate;
    r.setValueAtTime(orn.includes('<') ? 0.945 : 1, t);
    if (orn.includes('<')) r.linearRampToValueAtTime(1, t + 0.09);
    if (orn.includes('~') && dur > 0.35) {                 // 농현: 줄을 눌렀다 놓았다
      for (let k = 0, tt = t + 0.18; tt < t + dur; k++, tt += 0.11) r.linearRampToValueAtTime(k % 2 ? 1 : 1.022, tt);
      r.linearRampToValueAtTime(1, t + dur);
    }
    if (orn.includes('>')) { r.setValueAtTime(1, t + Math.max(0.05, dur - 0.18)); r.linearRampToValueAtTime(0.95, t + dur); }
    const lp = filt('lowpass', 3800), body = filt('peaking', 900, 1); body.gain.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.55, t);
    g.gain.setTargetAtTime(0.0001, t + dur + 0.05, 0.35);
    src.connect(body); body.connect(lp); lp.connect(g); send(g, out, wet);
    src.start(t); src.stop(t + dur + 2.2);
  }

  // ---------------------------------------------------------------- 대금
  function daegeum(t, midi, dur, vel, orn, out, prev, wet = 0.36) {
    const f = mtof(midi);
    const o1 = ctx.createOscillator(); o1.type = 'sine';
    const o2 = ctx.createOscillator(); o2.type = 'triangle';
    const o3 = ctx.createOscillator(); o3.type = 'sine';
    const set = (fq, at) => { o1.frequency.setValueAtTime(fq, at); o2.frequency.setValueAtTime(fq, at); o3.frequency.setValueAtTime(fq * 2, at); };
    const ramp = (fq, at) => { o1.frequency.linearRampToValueAtTime(fq, at); o2.frequency.linearRampToValueAtTime(fq, at); o3.frequency.linearRampToValueAtTime(fq * 2, at); };
    if (prev) { set(mtof(prev), t); ramp(f, t + 0.07); }
    else if (orn.includes('<')) { set(f * 0.94, t); ramp(f, t + 0.1); }
    else set(f, t);
    if (orn.includes('>')) { const s = t + Math.max(0.1, dur - 0.2); set(f, s); ramp(f * 0.955, t + dur); }
    // 늦게 들어오는 떨림(떠는 소리)
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.3;
    const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t);
    const vs = t + Math.min(0.45, dur * 0.4), depth = f * (orn.includes('~') ? 0.016 : 0.006);
    lg.gain.linearRampToValueAtTime(0, vs); lg.gain.linearRampToValueAtTime(depth, Math.min(t + dur, vs + 0.4));
    lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    const mix = ctx.createGain(); mix.gain.value = 1;
    const g2 = gainNode(0.14), g3 = gainNode(0.05);
    o1.connect(mix); o2.connect(g2); g2.connect(mix); o3.connect(g3); g3.connect(mix);
    // 숨소리 + 첫소리의 바람 잡음
    const n = noise(), bp = filt('bandpass', f * 1.6, 0.9), ng = gainNode(0.035 * vel);
    n.connect(bp); bp.connect(ng); ng.connect(mix);
    const ch = noise(), hp = filt('highpass', 2500), cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0001, t); cg.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.01); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    ch.connect(hp); hp.connect(cg); cg.connect(mix);
    const env = ctx.createGain();
    const peak = 0.2 * vel;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + (prev ? 0.03 : 0.08));
    env.gain.setValueAtTime(peak, t + Math.max(0.09, dur - 0.06));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.16);
    const lp = filt('lowpass', 4200);
    mix.connect(lp); lp.connect(env); send(env, out, wet);
    const end = t + dur + 0.3;
    [o1, o2, o3, lfo, n, ch].forEach((s) => { s.start(t); s.stop(end); });
  }

  // ---------------------------------------------------------------- 해금
  function haegeum(t, midi, dur, vel, orn, out, prev, wet = 0.3) {
    const f = mtof(midi);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.detune.value = 7;
    const setF = (fq, at) => { o1.frequency.setValueAtTime(fq, at); o2.frequency.setValueAtTime(fq, at); };
    const rampF = (fq, at) => { o1.frequency.linearRampToValueAtTime(fq, at); o2.frequency.linearRampToValueAtTime(fq, at); };
    if (prev) { setF(mtof(prev), t); rampF(f, t + 0.06); }
    else if (orn.includes('<')) { setF(f * 0.9, t); rampF(f, t + 0.12); }
    else setF(f, t);
    if (orn.includes('>')) { const s = t + Math.max(0.08, dur - 0.18); setF(f, s); rampF(f * 0.95, t + dur); }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 6.2;
    const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * (orn.includes('~') ? 0.02 : 0.009), t + Math.min(dur, 0.35));
    lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    const bp = filt('bandpass', 1100, 0.8), pk = filt('peaking', 2500, 1.4); pk.gain.value = 6;
    const lp = filt('lowpass', 3600);
    const env = ctx.createGain(), peak = 0.11 * vel;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + (prev ? 0.04 : 0.1));
    env.gain.setValueAtTime(peak, t + Math.max(0.1, dur - 0.05));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.14);
    o1.connect(bp); o2.connect(bp); bp.connect(pk); pk.connect(lp); lp.connect(env); send(env, out, wet);
    const end = t + dur + 0.25;
    [o1, o2, lfo].forEach((s) => { s.start(t); s.stop(end); });
  }

  // ---------------------------------------------------------------- 지속음·배경음
  function drone(t, midi, dur, vel, out) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(midi);
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = mtof(midi) * 1.5; o2.detune.value = -4;
    const lp = filt('lowpass', 520, 0.7);
    const g = ctx.createGain(), g2 = gainNode(0.3);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045 * vel, t + 0.9);
    g.gain.setValueAtTime(0.045 * vel, t + Math.max(1, dur - 0.9)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); send(g, out, 0.2);
    o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
  function pad(t, midi, dur, vel, out) {
    const lp = filt('lowpass', 1800);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 * vel, t + 1.2);
    g.gain.setValueAtTime(0.05 * vel, t + Math.max(1.3, dur - 1)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.2);
    for (const dt of [-7, 0, 7]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(midi); o.detune.value = dt;
      o.connect(lp); o.start(t); o.stop(t + dur + 1.3);
    }
    lp.connect(g); send(g, out, 0.5);
  }

  // ---------------------------------------------------------------- 타악: 장구·북·징
  function hit(t, kind, vel, out) {
    const kung = (tt, v) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(96, tt); o.frequency.exponentialRampToValueAtTime(56, tt + 0.2);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.6 * v, tt + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.38);
      o.connect(g); send(g, out, 0.12); o.start(tt); o.stop(tt + 0.42);
      const n = noise(), lp = filt('lowpass', 380), ng = ctx.createGain();
      ng.gain.setValueAtTime(0.2 * v, tt); ng.gain.exponentialRampToValueAtTime(0.0001, tt + 0.06);
      n.connect(lp); lp.connect(ng); ng.connect(out); n.start(tt); n.stop(tt + 0.08);
    };
    const deok = (tt, v) => {
      const n = noise(), bp = filt('bandpass', 2700, 2.5), g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.42 * v, tt + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.07);
      n.connect(bp); bp.connect(g); send(g, out, 0.15); n.start(tt); n.stop(tt + 0.09);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(820, tt); o.frequency.exponentialRampToValueAtTime(560, tt + 0.04);
      const og = ctx.createGain(); og.gain.setValueAtTime(0.12 * v, tt); og.gain.exponentialRampToValueAtTime(0.0001, tt + 0.05);
      o.connect(og); og.connect(out); o.start(tt); o.stop(tt + 0.06);
    };
    if (kind === 'kung') kung(t, vel);
    else if (kind === 'deok') deok(t, vel);
    else if (kind === 'deong') { kung(t, vel); deok(t, vel * 0.9); }
    else if (kind === 'gideok') { deok(t - 0.07, vel * 0.45); deok(t, vel); }
    else if (kind === 'buk') {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(74, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.45);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.75 * vel, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g); send(g, out, 0.2); o.start(t); o.stop(t + 0.65);
      const n = noise(), lp = filt('lowpass', 260), ng = ctx.createGain();
      ng.gain.setValueAtTime(0.3 * vel, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      n.connect(lp); lp.connect(ng); ng.connect(out); n.start(t); n.stop(t + 0.12);
    } else if (kind === 'jing') {
      const f0 = 108;
      [[1, 1], [2.02, 0.55], [2.74, 0.4], [3.46, 0.28], [4.22, 0.18], [5.4, 0.1]].forEach(([m, a], i) => {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(f0 * m * 1.012, t); o.frequency.exponentialRampToValueAtTime(f0 * m, t + 1.2);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * a * vel, t + 0.03 + i * 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2 - i * 0.4);
        o.connect(g); send(g, out, 0.45); o.start(t); o.stop(t + 4.3);
      });
    }
  }

  // ---------------------------------------------------------------- 악보 읽기
  // 표기: 음(1~5, 0=쉼) + 옥타브(^ 위, v 아래) : 길이(단위 수) + 꾸밈(~ 떨기, < 밀어 올리기, > 꺾어 내리기)
  // 예) "1:4 2:2 3:2 | 4:6~ 1^:2" — | 는 마디 구분(보기 편하게)
  const MODES = { pyeong: [0, 2, 5, 7, 9], gyemyeon: [0, 3, 5, 7, 10] };
  function parse(str, mode, tonic) {
    const out = [];
    let pos = 0;
    for (const tok of str.split(/\s+/)) {
      if (!tok || tok === '|') continue;
      const m = tok.match(/^([0-5])([\^v]*):(\d+(?:\.\d+)?)([~<>]*)$/);
      if (!m) { console.warn('악보 오류', tok); continue; }
      const deg = +m[1], dur = +m[3];
      if (deg > 0) {
        let oct = 0; for (const c of m[2]) oct += c === '^' ? 1 : -1;
        out.push({ pos, dur, midi: tonic + MODES[mode][deg - 1] + 12 * oct, orn: m[4] || '' });
      }
      pos += dur;
    }
    return { notes: out, len: pos };
  }
  const snap = (midi, mode, tonic) => {   // 선법 밖의 음을 가장 가까운 선법 음으로
    const pcs = MODES[mode].map((x) => (x + tonic) % 12);
    for (let d = 0; d < 6; d++) for (const s of [0, -1, 1]) { const m = midi + d * s; if (pcs.includes(((m % 12) + 12) % 12)) return m; }
    return midi;
  };

  // 장단(마디 안의 위치, 소리, 세기)
  const JANGDAN = {
    jungmori8: [[0, 'deong', 0.55], [4, 'kung', 0.4], [6, 'deok', 0.25]],
    gutgeori12: [[0, 'deong', 0.9], [3, 'gideok', 0.6], [5, 'deok', 0.4], [6, 'kung', 0.8], [8, 'deok', 0.5], [9, 'kung', 0.7], [11, 'deok', 0.4]],
    jungjung12: [[0, 'deong', 0.6], [3, 'deok', 0.3], [6, 'kung', 0.55], [9, 'deok', 0.35], [10, 'deok', 0.22]],
    semachi9: [[0, 'deong', 0.9], [3, 'deok', 0.5], [5, 'deok', 0.35], [6, 'kung', 0.8], [7, 'deok', 0.4]],
    jajin12: [[0, 'deong', 1], [0, 'buk', 0.9], [2, 'deok', 0.55], [3, 'kung', 0.8], [5, 'deok', 0.55], [6, 'kung', 0.9], [6, 'buk', 0.7], [8, 'deok', 0.55], [9, 'kung', 0.8], [11, 'gideok', 0.65]],
    night12: [[0, 'kung', 0.45], [9, 'deok', 0.2]],
  };

  // ---------------------------------------------------------------- 곡 (직접 작곡)
  const TRACKS = {
    // 타이틀: 대금이 느리게 부르고 가야금이 받쳐 준다
    title: {
      mode: 'pyeong', tonic: 74, unit: 60 / 132, bar: 8, jangdan: 'jungmori8', jing: [0], drone: 50,
      lead: { inst: 'daegeum', vel: 0.95, mel: '1:4 2:2 3:2 | 4:6 3:1 4:1 | 5:4 4:2 3:2 | 4:8~ | 5:3 1^:1 5:2 4:2 | 3:4 2:2 3:2 | 4:3 5:1 4:2 3:2 | 1:8~ | 3:2 4:2 5:4 | 1^:6 5:1 1^:1 | 2^:4 1^:2 5:2 | 4:8~ | 5:2 4:2 3:2 2:2 | 3:6 4:2 | 2:3 1:1 2:2 3:2 | 1:8~' },
      acc: { inst: 'gayageum', style: 'beats', beat: 2, oct: -12, vel: 0.55 },
    },
    // 1장 부임길: 굿거리 장단에 가야금이 경쾌하게, 해금이 길게 받친다
    journey: {
      mode: 'pyeong', tonic: 64, unit: 60 / 216, bar: 12, jangdan: 'gutgeori12', drone: 40,
      lead: { inst: 'gayageum', vel: 0.9, mel: '1:3 2:2 3:1 4:3 3:3 | 4:2 5:1 4:3 3:3 2:3 | 3:3 3:2 4:1 5:3 4:2 3:1 | 2:3 3:3 1:6~ | 1:3 2:2 3:1 4:3 5:3 | 1^:2 5:1 4:3 5:3 4:3 | 3:3 4:2 5:1 4:3 3:2 2:1 | 1:12~ | 5:3 1^:3 2^:3 1^:2 5:1 | 4:3 5:2 1^:1 5:6~ | 3^:3 2^:2 1^:1 5:3 4:3 | 5:3 4:2 3:1 4:6~ | 5:3 1^:3 2^:3 1^:2 5:1 | 4:3 5:2 4:1 3:6~ | 2:3 3:2 4:1 3:3 2:3 | 1:12~' },
      second: { inst: 'haegeum', style: 'long', min: 3, oct: 0, vel: 0.55 },
      acc: { inst: 'gayageum', style: 'bass', beat: 6, oct: -12, vel: 0.5 },
    },
    // 2장 내금강: 대금이 높이 솟고 가야금이 폭포처럼 흘러내린다
    mountain: {
      mode: 'pyeong', tonic: 69, unit: 60 / 156, bar: 12, jangdan: 'jungjung12', jing: [0, 8], drone: 45,
      lead: { inst: 'daegeum', vel: 0.95, mel: '4:6 5:3 1^:3 | 2^:6 1^:3 5:3 | 4:3 5:3 4:3 3:3 | 4:12~ | 5:6 4:3 3:3 | 2:3 3:3 4:6 | 5:3 4:3 3:3 2:3 | 1:12~ | 3^:6 4^:3 3^:3 | 2^:6 1^:3 5:3 | 1^:3 2^:3 1^:3 5:3 | 4:12~ | 5:6 1^:3 5:3 | 4:3 3:3 2:6 | 3:3 4:3 5:3 4:3 | 1:12~' },
      acc: { inst: 'gayageum', style: 'arp', beat: 3, oct: -12, vel: 0.42 },
    },
    // 3장 관동팔경: 세마치 장단, 바닷바람처럼 밝게
    sea: {
      mode: 'pyeong', tonic: 65, unit: 60 / 190, bar: 9, jangdan: 'semachi9', drone: 41,
      lead: { inst: 'gayageum', vel: 0.9, mel: '1:3 2:3 3:3 | 4:6~ 5:3 | 4:3 3:3 2:3 | 3:9~ | 4:3 5:3 1^:3 | 2^:6~ 1^:3 | 5:3 4:3 3:3 | 4:9~ | 5:3 1^:3 2^:3 | 1^:6~ 5:3 | 4:3 5:3 4:3 | 3:6 2:3 | 3:3 4:3 5:3 | 4:3 3:3 2:3 | 3:3 2:3 3:3 | 1:9~' },
      second: { inst: 'daegeum', style: 'long', min: 6, oct: 12, vel: 0.5 },
      acc: { inst: 'gayageum', style: 'bass', beat: 3, oct: -12, vel: 0.45 },
    },
    // 보스: 자진모리, 계면조. 해금이 몰아치고 북과 징이 울린다
    boss: {
      mode: 'gyemyeon', tonic: 69, unit: 60 / 330, bar: 12, jangdan: 'jajin12', jing: [0, 4, 8, 12], drone: 45,
      lead: { inst: 'haegeum', vel: 1, mel: '1:2 1:1 2:2 3:1 4:3 3:3 | 4:2 5:1 4:3 3:3 2:3 | 1:2 1:1 2:2 3:1 4:3 5:3 | 1^:6~ 5:3 4:3 | 4:2 5:1 1^:3 5:3 4:3 | 3:3 4:3 3:3 2:3> | 1:3 2:3 3:3 2:3 | 1:12~ | 1^:3 2^:3 1^:3 5:3 | 4:3 5:3 4:3 3:3 | 4:2 4:1 5:3 4:3 3:3 | 2:6> 1:6 | 1^:3 2^:3 3^:3 2^:3 | 1^:3 5:3 4:6~ | 3:3 4:3 3:3 2:3> | 1:12~' },
      acc: { inst: 'gayageum', style: 'ostinato', vel: 0.6, mel: '1v:2 1v:1 5vv:1 1v:2 3v:3 2v:3' },
    },
    // 새벽·밤: 계면조 대금 독주, 떠는 소리와 꺾는 소리
    night: {
      mode: 'gyemyeon', tonic: 69, unit: 60 / 110, bar: 12, jangdan: 'night12', drone: 45,
      lead: { inst: 'daegeum', vel: 0.9, mel: '5v:6 1:3 2:3 | 3:9~ 2:3> | 1:3 2:3 3:3 4:3 | 3:12~ | 4:6 5:3 4:3 | 3:6~ 2:3 1:3 | 2:3 3:3> 2:3 1:3 | 1:12~' },
      acc: { inst: 'gayageum', style: 'beats', beat: 6, oct: -12, vel: 0.45 },
    },
    // 꿈: 높은 가야금과 은은한 배경음
    dream: {
      mode: 'pyeong', tonic: 74, unit: 60 / 96, bar: 8, jangdan: null, drone: null,
      lead: { inst: 'gayageum', vel: 0.75, mel: '1^:4 5:4 | 2^:6~ 1^:2 | 5:4 4:4 | 5:8~ | 3^:4 2^:4 | 1^:6~ 5:2 | 4:4 5:2 4:2 | 1:8~' },
      acc: { inst: 'pad', style: 'chord', oct: -12, vel: 0.9 },
    },
  };
  TRACKS.sad = TRACKS.night;

  function buildTrack(def) {
    const u = def.unit, ev = [];
    const L = parse(def.lead.mel, def.mode, def.tonic);
    const total = L.len;
    let prevEnd = -1, prevMidi = null;
    for (const n of L.notes) {
      const legato = def.lead.inst !== 'gayageum' && Math.abs(n.pos - prevEnd) < 0.01;
      ev.push({ t: n.pos * u, inst: def.lead.inst, midi: n.midi, dur: n.dur * u * (def.lead.inst === 'gayageum' ? 1 : 0.97), vel: def.lead.vel, orn: n.orn, prev: legato ? prevMidi : null });
      prevEnd = n.pos + n.dur; prevMidi = n.midi;
    }
    // 둘째 소리(헤테로포니: 같은 선율을 길게 따라 부른다)
    const S = def.second;
    if (S) for (const n of L.notes) if (n.dur >= S.min) ev.push({ t: n.pos * u, inst: S.inst, midi: n.midi + S.oct, dur: n.dur * u * 0.95, vel: S.vel, orn: n.orn.replace('<', '') });
    // 반주
    const C = def.acc;
    if (C) {
      if (C.style === 'beats' || C.style === 'bass') {
        for (const n of L.notes) {
          if (n.pos % C.beat !== 0) continue;
          const m = C.style === 'bass' ? snap(n.midi + C.oct - (n.midi - def.tonic >= 12 ? 12 : 0), def.mode, def.tonic) : n.midi + C.oct;
          ev.push({ t: n.pos * u, inst: C.inst, midi: m, dur: Math.min(n.dur, C.beat * 2) * u, vel: C.vel, orn: n.dur >= C.beat * 2 ? '~' : '' });
        }
      } else if (C.style === 'arp') {
        for (let b = 0; b * def.bar < total; b++) {
          const first = L.notes.find((n) => n.pos >= b * def.bar) || L.notes[0];
          const root = first.midi + C.oct - 12 * Math.max(0, Math.floor((first.midi - def.tonic) / 12));
          const tones = [root, snap(root + 7, def.mode, def.tonic), root + 12, snap(root + 7, def.mode, def.tonic)];
          for (let k = 0; k * C.beat < def.bar; k++) ev.push({ t: (b * def.bar + k * C.beat) * u, inst: C.inst, midi: tones[k % 4], dur: C.beat * u * 1.5, vel: C.vel * (k === 0 ? 1.15 : 0.85), orn: '' });
        }
      } else if (C.style === 'ostinato') {
        const O = parse(C.mel, def.mode, def.tonic);
        for (let b = 0; b * def.bar < total; b++) for (const n of O.notes) ev.push({ t: (b * def.bar + n.pos) * u, inst: C.inst, midi: n.midi, dur: n.dur * u, vel: C.vel, orn: '' });
      } else if (C.style === 'chord') {
        for (let b = 0; b * def.bar < total; b++) {
          const first = L.notes.find((n) => n.pos >= b * def.bar) || L.notes[0];
          const root = def.tonic + C.oct + ((first.midi - def.tonic) % 12 + 12) % 12;
          for (const m of [root - 12, snap(root - 5, def.mode, def.tonic), root]) ev.push({ t: b * def.bar * u, inst: 'pad', midi: m, dur: def.bar * u, vel: C.vel, orn: '' });
        }
      }
    }
    // 장단·징·지속음
    const bars = Math.round(total / def.bar);
    for (let b = 0; b < bars; b++) {
      if (def.jangdan) for (const [p, k, v] of JANGDAN[def.jangdan]) ev.push({ t: (b * def.bar + p) * u, drum: k, vel: v });
      if (def.jing && def.jing.includes(b)) ev.push({ t: b * def.bar * u + 0.01, drum: 'jing', vel: 0.9 });
      if (def.drone && b % 2 === 0) ev.push({ t: b * def.bar * u, inst: 'drone', midi: def.drone, dur: def.bar * 2 * u, vel: 1 });
    }
    ev.sort((a, b) => a.t - b.t);
    return { notes: ev, length: total * u };
  }

  function playEvent(n, t, out) {
    if (n.drum) return hit(t, n.drum, n.vel, out);
    if (n.inst === 'gayageum') gayageum(t, n.midi, n.dur, n.vel, n.orn, out);
    else if (n.inst === 'daegeum') daegeum(t, n.midi, n.dur, n.vel, n.orn, out, n.prev);
    else if (n.inst === 'haegeum') haegeum(t, n.midi, n.dur, n.vel, n.orn, out, n.prev);
    else if (n.inst === 'drone') drone(t, n.midi, n.dur, n.vel, out);
    else if (n.inst === 'pad') pad(t, n.midi, n.dur, n.vel, out);
  }

  let sched = null, loopStart = 0, idx = 0, cur = null;
  const built = {};
  A.play = function (name) {
    if (A.track === name && sched) return;
    A.track = name;
    if (!ctx) { A.pendingTrack = name; return; }
    A.stopMusic(true);
    const def = TRACKS[name];
    if (!def) return;
    cur = Object.assign({}, built[name] || (built[name] = buildTrack(def)));
    loopStart = ctx.currentTime + 0.15; idx = 0;
    const bus = ctx.createGain(); bus.gain.value = 0.0001; bus.connect(musicBus);
    bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.0);
    cur.bus = bus;
    const tick = () => {
      if (!cur || cur.bus !== bus) return;
      const ahead = ctx.currentTime + 0.3;
      for (let guard = 0; guard < 400; guard++) {
        const n = cur.notes[idx];
        const t = loopStart + n.t;
        if (t > ahead) break;
        if (t >= ctx.currentTime - 0.05) { try { playEvent(n, t, bus); } catch (e) { /* 무시 */ } }
        idx++;
        if (idx >= cur.notes.length) { idx = 0; loopStart += cur.length; }
      }
    };
    tick();
    sched = setInterval(tick, 70);
  };
  A.stopMusic = function (fast) {
    if (sched) { clearInterval(sched); sched = null; }
    if (cur && cur.bus && ctx) {
      const b = cur.bus; b.gain.cancelScheduledValues(ctx.currentTime);
      b.gain.setValueAtTime(Math.max(0.0001, b.gain.value), ctx.currentTime);
      b.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (fast ? 0.5 : 1.2));
      setTimeout(() => b.disconnect(), 3000);
    }
    cur = null;
    if (!fast) A.track = null;
  };

  // ---------------------------------------------------------------- 효과음
  function tone(type, f0, f1, dur, vol, t0 = 0) {
    const t = ctx.currentTime + t0;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(dur, vol, f0, f1, type = 'bandpass', t0 = 0, q = 1) {
    const t = ctx.currentTime + t0;
    const n = noise(), f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t); n.stop(t + dur + 0.05);
  }
  const pl = (m, dt = 0, v = 0.8, dur = 0.5) => gayageum(ctx.currentTime + dt, m, dur, v, '', sfxBus, 0.25);
  const SFX = {
    jump: () => { tone('triangle', 330, 620, 0.1, 0.07); hiss(0.08, 0.04, 1500, 3000, 'highpass'); },
    jump2: () => { tone('sine', 620, 1240, 0.14, 0.08); hiss(0.2, 0.05, 3000, 6000, 'highpass'); },
    land: () => hiss(0.06, 0.1, 500, 200, 'lowpass'),
    slash: () => hiss(0.13, 0.22, 900, 3800, 'bandpass', 0, 1.4),
    gust: () => hiss(0.3, 0.13, 500, 1800, 'bandpass', 0, 0.8),
    hit: () => { hit(ctx.currentTime, 'deong', 0.9, sfxBus); hiss(0.07, 0.18, 2000, 400, 'lowpass'); },
    kill: () => { hit(ctx.currentTime, 'buk', 0.9, sfxBus); hiss(0.3, 0.2, 1200, 150, 'lowpass'); },
    hurt: () => { tone('sawtooth', 280, 90, 0.22, 0.12); hit(ctx.currentTime, 'kung', 0.7, sfxBus); },
    pickup: () => { [0, 2, 4].forEach((s, i) => pl([74, 76, 79][s % 3] + (i === 2 ? 5 : 0), i * 0.06, 0.7, 0.4)); },
    ink: () => pl(86, 0, 0.35, 0.2),
    scroll: () => { hiss(0.35, 0.1, 3000, 800, 'bandpass', 0, 0.6); [74, 79, 81].forEach((m, i) => pl(m, 0.1 + i * 0.09, 0.8, 0.8)); },
    correct: () => { [72, 76, 79, 84].forEach((m, i) => pl(m, i * 0.06, 0.85, 0.7)); hit(ctx.currentTime + 0.02, 'deok', 0.5, sfxBus); },
    wrong: () => { tone('square', 150, 120, 0.22, 0.08); tone('square', 142, 110, 0.28, 0.07, 0.12); },
    cast: () => { [79, 86, 91].forEach((m, i) => pl(m, i * 0.05, 0.6, 0.9)); hiss(0.5, 0.06, 4000, 9000, 'highpass'); },
    mind: () => { pl(79, 0, 0.6, 0.6); pl(86, 0.07, 0.5, 0.7); },
    select: () => pl(79, 0, 0.35, 0.15),
    confirm: () => { pl(74, 0, 0.5, 0.3); pl(81, 0.05, 0.5, 0.4); },
    blip: () => tone('triangle', 520 + Math.random() * 80, 520, 0.022, 0.02),
    boss: () => { hit(ctx.currentTime, 'jing', 1, sfxBus); hit(ctx.currentTime, 'buk', 1, sfxBus); },
    thunder: () => { hiss(1.4, 0.3, 300, 60, 'lowpass'); tone('sine', 60, 30, 1.2, 0.25); },
    wave: () => hiss(1.1, 0.22, 600, 2500, 'bandpass', 0, 0.5),
    rain: () => hiss(1.5, 0.1, 5000, 3000, 'highpass'),
    bell: () => { hit(ctx.currentTime, 'jing', 0.5, sfxBus); },
    horse: () => { hiss(0.05, 0.12, 500, 300, 'lowpass'); hiss(0.05, 0.1, 500, 300, 'lowpass', 0.12); },
    whoosh: () => hiss(0.4, 0.15, 300, 2000, 'bandpass', 0, 0.7),
    stamp: () => { hit(ctx.currentTime, 'kung', 0.8, sfxBus); hiss(0.08, 0.15, 800, 200, 'lowpass'); },
  };
  A.sfx = function (name) {
    if (!ctx || A.muted) return;
    const f = SFX[name];
    if (f) try { f(); } catch (e) { /* 무시 */ }
  };
  A.TRACKS = TRACKS;
  A._parse = parse;   // 악보 점검용
})();
