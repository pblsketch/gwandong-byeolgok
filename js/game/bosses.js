'use strict';
// 보스전(모두 虛: 게임 설정). 피하다가 빈틈에 붓을 맞히면 '시구 대결' 문제가 나온다.
// 정답이면 묵직한 반격(히트스톱·화면 흔들림), 오답이면 한 대 맞는다. 세 번 맞히면 이긴다.
(function () {
  const U = G.util, FX = G.fx, TS = G.TS, A = G.assets, E = G.E;

  class Boss {
    constructor(opt) {
      this.hp = 3; this.maxHp = 3; this.t = 0; this.phase = 'intro'; this.pt = 0; this.z = 7;
      this.hittable = false; this.flash = 0; this.hurtT = 0;
      this.pool = U.shuffle(opt.pool || []); this.qi = 0; this.wrong = [];
      this.arena = opt.arena; this.name = opt.name;
      this.onWin = opt.onWin;
    }
    nextQuiz() {
      if (this.qi < this.pool.length) return this.pool[this.qi++];
      if (this.wrong.length) return this.wrong.shift();
      return U.choice(this.pool);
    }
    // 붓에 맞으면 시구 대결 시작
    hurt(n, dir, w) {
      if (!this.hittable || this.busy) return;
      this.busy = true; this.hittable = false;
      FX.stop(0.1); FX.shake(3, 0.2); G.audio.sfx('hit');
      FX.burst(this.x + this.w / 2, this.y + this.h / 2, 'ink', 12, { max: 180 });
      w.run(async () => {
        const q = this.nextQuiz();
        const ok = q ? await G.ui.quiz(q, { kind: '시구 대결', sub: this.quizSub }) : true;
        if (ok) {
          this.hp--; this.flash = 0.4; this.hurtT = 0.8;
          FX.stop(0.22); FX.shake(9, 0.5); FX.flash('#ffffff', 0.25); G.audio.sfx('boss');
          FX.burst(this.x + this.w / 2, this.y + this.h / 2, 'spark', 30, { max: 260, color: '#ffe7a0' });
          FX.burst(this.x + this.w / 2, this.y + this.h / 2, 'ink', 20, { max: 240 });
          FX.text(this.x + this.w / 2, this.y - 10, '반격!', '#ffe27a', 16);
        } else {
          if (q) this.wrong.push(q);
          this.taunt && this.taunt(w);
          w.player.damage(1, -1, w);
        }
        this.busy = false;
        this.phase = 'recover'; this.pt = 0;
        if (this.hp <= 0) { this.phase = 'dead'; this.pt = 0; w.run(() => this.onWin(w, this)); }
      });
    }
    drawBar(ctx) {
      const x = G.W / 2 - 110, y = 30;
      ctx.save();
      ctx.fillStyle = 'rgba(6,36,40,.85)'; ctx.fillRect(x - 6, y - 16, 232, 30);
      ctx.strokeStyle = '#22c3b5'; ctx.lineWidth = 1; ctx.strokeRect(x - 6.5, y - 16.5, 233, 31);
      ctx.font = '700 9px "Noto Sans KR", sans-serif'; ctx.fillStyle = '#bff7f0'; ctx.textAlign = 'left';
      ctx.fillText('🎮 虛 · ' + this.name, x, y - 5);
      for (let i = 0; i < this.maxHp; i++) {
        ctx.fillStyle = i < this.hp ? '#e25a4a' : 'rgba(255,255,255,.15)';
        ctx.fillRect(x + i * 74, y + 1, 70, 6);
      }
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- 이백의 환영 (불정대)
  E.LiBai = class extends Boss {
    constructor(arena, opt) {
      super(Object.assign({ name: '이백의 환영', pool: (window.KB.bossQuiz || {}).libai }, opt));
      this.w = 60; this.h = 90; this.arena = arena;
      this.x = arena.x1 - 120; this.y = arena.top + 20; this.home = { x: this.x, y: this.y };
      this.anim = 'idle'; this.quizSub = '이백의 환영이 묻는다';
    }
    taunt() { G.ui.toast('이백의 환영: "허허, 여산 폭포가 더 낫지 않겠소?"', 'game'); }
    update(dt, w) {
      this.t += dt; this.pt += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.hurtT > 0) this.hurtT -= dt;
      const p = w.player, ar = this.arena;
      if (this.busy || this.phase === 'dead' || this.phase === 'intro') { this.anim = this.hurtT > 0 ? 'hurt' : 'idle'; if (this.phase === 'dead') this.y -= 20 * dt; return; }
      const floatY = Math.sin(this.t * 1.6) * 8;
      if (this.phase === 'recover' && this.pt > 1.2) { this.phase = 'rain'; this.pt = 0; }
      if (this.phase === 'rain') {
        // 술비: 위에서 술방울이 떨어진다
        this.anim = 'idle';
        this.x += ((ar.x0 + ar.x1) / 2 + Math.sin(this.t * 0.7) * (ar.x1 - ar.x0) * 0.35 - this.x - this.w / 2) * dt;
        this.y = this.home.y + floatY;
        if (Math.random() < dt * (3.2 + (3 - this.hp))) w.add(new E.Shot(U.rand(ar.x0 + 10, ar.x1 - 10), ar.top - 20, 0, 60, { g: 300, color: '#f2d38a', r: 9 }));
        if (this.pt > 3.2) { this.phase = 'arc'; this.pt = 0; }
      } else if (this.phase === 'arc') {
        // 폭포처럼 휘어지는 술줄기
        this.anim = 'attack';
        if (this.pt > 0.4 && !this.fired) {
          this.fired = true;
          for (let i = 0; i < 3 + (3 - this.hp); i++) {
            const dir = p.cx < this.x ? -1 : 1;
            w.add(new E.Shot(this.x + this.w / 2, this.y + 30, dir * U.rand(90, 200), -U.rand(200, 340), { g: 520, color: '#cfeaff', r: 10 }));
          }
          G.audio.sfx('wave');
        }
        if (this.pt > 1.1) { this.phase = 'open'; this.pt = 0; this.fired = false; }
      } else if (this.phase === 'open') {
        // 빈틈: 땅 가까이 내려와 빛난다 → 붓으로 치면 시구 대결
        this.anim = 'idle';
        const gy = ar.floor - this.h - 6;
        this.y += (gy - this.y) * dt * 3;
        this.hittable = this.pt > 0.4;
        if (this.pt > 4.2) { this.hittable = false; this.phase = 'rise'; this.pt = 0; }
      } else if (this.phase === 'rise') {
        this.y += (this.home.y - this.y) * dt * 3;
        if (this.pt > 0.8) { this.phase = 'rain'; this.pt = 0; }
      }
      // 몸에 닿으면 아프다(빈틈일 땐 안전)
      if (!this.hittable && U.overlap({ x: this.x + 10, y: this.y + 10, w: this.w - 20, h: this.h - 20 }, p)) p.damage(1, p.cx < this.x + this.w / 2 ? -1 : 1, w);
    }
    draw(ctx, w) {
      const cx = this.x + this.w / 2, by = this.y + this.h + 10;
      if (this.hittable) {
        ctx.save(); ctx.globalAlpha = 0.35 + 0.25 * Math.sin(this.t * 10); ctx.fillStyle = '#fff3c4';
        ctx.beginPath(); ctx.ellipse(cx, this.y + this.h / 2, 46, 58, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      A.frame(ctx, 'libai', this.anim, this.t, cx, by, w.player && w.player.cx > cx, { flash: this.flash > 0 ? 0.9 : 0, alpha: this.phase === 'dead' ? Math.max(0, 1 - this.pt / 2) : 0.92, once: this.anim === 'attack' || this.anim === 'hurt' });
      if (this.hittable) G.label(ctx, '지금이에요! 붓으로 치기', cx, this.y - 14, { size: 9, bg: 'rgba(6,36,40,.9)', color: '#bff7f0', edge: '#22c3b5' });
      if (this.phase === 'dead') this.pt += 0; // 사라지는 중
    }
  };

  // ---------------------------------------------------------------- 노한 고래 (망양정)
  E.Whale = class extends Boss {
    constructor(arena, opt) {
      super(Object.assign({ name: '노한 고래', pool: (window.KB.bossQuiz || {}).whale }, opt));
      this.arena = arena; this.w = 150; this.h = 110;
      this.x = arena.sea + 80; this.y = arena.floor + 40; this.anim = 'rise'; this.vis = 0; this.quizSub = '노한 고래가 묻는다';
    }
    taunt() { G.ui.toast('노한 고래: "부르르! 파도가 더 거세진다!"', 'game'); }
    update(dt, w) {
      this.t += dt; this.pt += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.hurtT > 0) this.hurtT -= dt;
      const p = w.player, ar = this.arena;
      if (this.busy || this.phase === 'intro') return;
      if (this.phase === 'dead') { this.anim = 'foam'; this.vis = Math.max(0, 1 - this.pt / 2.5); return; }
      if (this.phase === 'recover') { this.vis = Math.max(0, this.vis - dt * 2); if (this.pt > 1.4) { this.phase = 'waves'; this.pt = 0; this.n = 0; } }
      if (this.phase === 'waves') {
        // 은산(銀山) 같은 파도가 밀려온다
        this.anim = 'rise'; this.vis = Math.min(0.6, this.vis + dt); this.x = ar.sea + 120; this.y = ar.floor - 30;
        if (this.pt > 1.25 * (this.n || 0) + 0.3 && (this.n || 0) < 3 + (3 - this.hp)) {
          this.n = (this.n || 0) + 1;
          w.add(new E.Wave(ar.sea - 10, ar.floor, -1, 150 + (3 - this.hp) * 25, 30 + Math.random() * 14));
          G.audio.sfx('wave');
        }
        if (this.pt > 1.25 * (3 + (3 - this.hp)) + 1.2) { this.phase = 'spout'; this.pt = 0; this.n = 0; }
      } else if (this.phase === 'spout') {
        // 뿜어 올리는 물기둥: 발밑이 반짝이면 피하자
        this.vis = Math.max(0.2, this.vis - dt);
        if (this.pt > 0.9 * (this.n || 0) && (this.n || 0) < 4) {
          this.n = (this.n || 0) + 1;
          const x = U.clamp(p.cx + U.rand(-20, 20), ar.x0 + 20, ar.sea - 20);
          w.add(new E.Warn(x, ar.floor, 0.7, (ww) => { ww.add(new E.Spout(x, ar.floor)); G.audio.sfx('wave'); FX.shake(2, 0.2); }));
        }
        // 오월 하늘의 백설: 물보라 (몇 방울은 아프다)
        if (Math.random() < dt * 4) w.add(new E.Shot(U.rand(ar.x0, ar.sea), ar.top - 10, U.rand(-20, 20), 40, { g: 120, color: '#ffffff', r: 7 }));
        if (this.pt > 4.2) { this.phase = 'open'; this.pt = 0; }
      } else if (this.phase === 'open') {
        // 빈틈: 물가로 머리를 내민다
        this.anim = 'rise'; this.vis = Math.min(1, this.vis + dt * 2);
        this.x += (ar.sea - 40 - this.x) * dt * 3; this.y += (ar.floor - this.h + 30 - this.y) * dt * 3;
        this.hittable = this.pt > 0.5;
        if (this.pt > 4.5) { this.hittable = false; this.phase = 'dive'; this.pt = 0; }
      } else if (this.phase === 'dive') {
        this.anim = 'dive'; this.vis = Math.max(0, this.vis - dt * 1.5); this.x += 60 * dt; this.y += 40 * dt;
        if (this.pt > 1) { this.phase = 'waves'; this.pt = 0; this.n = 0; }
      }
    }
    draw(ctx, w) {
      if (this.vis <= 0.01) return;
      const cx = this.x + this.w / 2, by = this.y + this.h + 40;
      if (this.hittable) {
        ctx.save(); ctx.globalAlpha = 0.3 + 0.2 * Math.sin(this.t * 10); ctx.fillStyle = '#e8f7ff';
        ctx.beginPath(); ctx.ellipse(cx - 40, this.y + 40, 60, 40, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      A.frame(ctx, 'whale', this.anim, this.t, cx, by, false, { alpha: this.vis, flash: this.flash > 0 ? 0.9 : 0, once: this.anim !== 'rise' });
      if (this.hittable) G.label(ctx, '지금이에요! 붓으로 치기', cx - 60, this.y - 20, { size: 9, bg: 'rgba(6,36,40,.9)', color: '#bff7f0', edge: '#22c3b5' });
    }
  };
})();
