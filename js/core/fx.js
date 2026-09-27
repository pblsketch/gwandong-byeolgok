'use strict';
// 게임의 손맛: 히트스톱, 화면 흔들림, 번쩍임, 파티클, 떠오르는 글자
(function () {
  const U = G.util;
  const FX = G.fx = {
    hitstop: 0,        // 남은 멈춤 시간(초). 이 동안 세계 업데이트를 멈춘다
    shakeT: 0, shakeMag: 0, sx: 0, sy: 0,
    flashT: 0, flashDur: 0, flashColor: '#fff',
    parts: [], texts: [],
    slowmo: 1,
  };

  FX.stop = (sec) => { FX.hitstop = Math.max(FX.hitstop, sec); };
  FX.shake = (mag, sec = 0.25) => { FX.shakeMag = Math.max(FX.shakeMag * (FX.shakeT > 0 ? 1 : 0), mag); FX.shakeT = Math.max(FX.shakeT, sec); };
  FX.flash = (color = '#fff', sec = 0.12) => { FX.flashColor = color; FX.flashT = FX.flashDur = sec; };

  // 파티클 종류: ink(먹물 방울), spark(빛), petal(꽃잎), drop(물방울), feather, dust, snow
  FX.burst = function (x, y, kind, n, opt = {}) {
    for (let i = 0; i < n; i++) {
      const a = opt.angle !== undefined ? opt.angle + U.rand(-opt.spread || -0.6, opt.spread || 0.6) : U.rand(0, Math.PI * 2);
      const sp = U.rand(opt.min || 40, opt.max || 180);
      FX.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opt.up || 0),
        life: U.rand(0.35, opt.life || 0.8), t: 0, kind,
        size: U.rand(opt.smin || 1.5, opt.smax || 3.5),
        g: opt.g !== undefined ? opt.g : (kind === 'spark' ? 0 : kind === 'feather' || kind === 'petal' || kind === 'snow' ? 40 : 500),
        rot: U.rand(0, 6.28), vr: U.rand(-6, 6),
        color: opt.color,
        drag: opt.drag || (kind === 'spark' ? 3 : kind === 'feather' || kind === 'petal' ? 2.5 : 0.6),
      });
    }
  };
  FX.text = function (x, y, str, color = '#fff', size = 12) {
    FX.texts.push({ x, y, str, color, size, t: 0, life: 1.0 });
  };

  FX.update = function (dt) {
    if (FX.shakeT > 0) {
      FX.shakeT -= dt;
      const m = FX.shakeMag * Math.max(0, FX.shakeT) / 0.25;
      FX.sx = U.rand(-m, m); FX.sy = U.rand(-m, m);
      if (FX.shakeT <= 0) { FX.sx = FX.sy = 0; FX.shakeMag = 0; }
    }
    if (FX.flashT > 0) FX.flashT -= dt;
    for (let i = FX.parts.length - 1; i >= 0; i--) {
      const p = FX.parts[i];
      p.t += dt;
      if (p.t >= p.life) { FX.parts.splice(i, 1); continue; }
      p.vx -= p.vx * p.drag * dt; p.vy -= p.vy * p.drag * dt * 0.5;
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    for (let i = FX.texts.length - 1; i >= 0; i--) {
      const t = FX.texts[i]; t.t += dt; t.y -= 26 * dt;
      if (t.t > t.life) FX.texts.splice(i, 1);
    }
  };

  const COL = { ink: '#15120f', spark: '#ffe7a0', petal: '#f39bb6', drop: '#bfe6ff', feather: '#ffffff', dust: '#c9b99a', snow: '#ffffff', gold: '#ffd35a', leaf: '#6fae4b' };
  FX.draw = function (ctx) {
    for (const p of FX.parts) {
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.fillStyle = p.color || COL[p.kind] || '#fff';
      if (p.kind === 'spark' || p.kind === 'gold') {
        const s = p.size * (0.6 + k);
        ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.ceil(s), Math.ceil(s));
      } else if (p.kind === 'feather' || p.kind === 'petal') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -p.size / 3, p.size * 2, p.size * 0.7);
        ctx.restore();
      } else {
        const s = Math.max(1, Math.round(p.size * (p.kind === 'ink' ? 0.6 + k * 0.6 : 1)));
        ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
      }
    }
    ctx.globalAlpha = 1;
    for (const t of FX.texts) {
      const k = 1 - t.t / t.life;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.font = `900 ${t.size}px ${getComputedStyle(document.documentElement).getPropertyValue('--sans') || 'sans-serif'}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  };
  // 화면 전체 번쩍임(카메라 변환 밖에서 그린다)
  FX.drawScreen = function (ctx) {
    if (FX.flashT > 0) {
      ctx.globalAlpha = Math.max(0, FX.flashT / FX.flashDur) * 0.55;
      ctx.fillStyle = FX.flashColor;
      ctx.fillRect(0, 0, G.W, G.H);
      ctx.globalAlpha = 1;
    }
  };
  FX.clear = function () { FX.parts.length = 0; FX.texts.length = 0; FX.hitstop = 0; FX.shakeT = 0; FX.sx = FX.sy = 0; FX.flashT = 0; };
})();
