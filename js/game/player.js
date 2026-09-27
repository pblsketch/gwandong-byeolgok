'use strict';
// 주인공 정철: 두 마음 시스템
//   관리의 마음(옥절): 붓 공격 + 옥절 시전(정화)   ← 연군·애민·우국·선정
//   신선의 마음(학의 깃): 2단 점프 + 활공, 공격 대신 바람   ← 풍류·탈속·신선 동경
(function () {
  const U = G.util, I = G.input, FX = G.fx;
  const P = {
    run: 150, sneak: 62, accG: 1500, accA: 950, fric: 1700,
    grav: 1500, maxFall: 620, jumpV: 505, jump2V: 440, glideFall: 70,
    coyote: 0.1, buffer: 0.13,
  };

  class Player {
    constructor(x, y) {
      this.w = 16; this.h = 38;
      this.x = x - this.w / 2; this.y = y - this.h;
      this.vx = 0; this.vy = 0; this.facing = 1;
      this.onGround = false; this.coyoteT = 0; this.bufT = 0;
      this.jumps = 0; this.gliding = false;
      this.attackT = 0; this.hitSet = new Set(); this.castT = 0; this.castCd = 0; this.mindCd = 0;
      this.hurtT = 0; this.invT = 0;
      this.hp = 3; this.maxHp = 3;
      this.mode = 'official';
      this.anim = 'idle'; this.animT = 0;
      this.sq = 1;           // 스쿼시&스트레치 (세로 배율)
      this.z = 10;
      this.horse = false;
      this.wasGround = false;
      this.stepT = 0;
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get feet() { return this.y + this.h; }
    unlocked(k) { return !!G.save.data.unlock[k]; }

    setMode(m, silent) {
      if (m === this.mode) return;
      this.mode = m;
      if (!silent) {
        G.audio.sfx('mind');
        FX.burst(this.cx, this.cy, m === 'immortal' ? 'feather' : 'gold', 14, { max: 120 });
        G.ui.toast(m === 'immortal' ? '신선의 마음 · 2단 점프와 활공' : '관리의 마음 · 붓 공격과 옥절', 'game');
      }
      G.hud && G.hud.pulse();
    }

    update(dt, w) {
      const input = !w.lockInput && !w.cutscene;
      const L = input && I.down('left'), R = input && I.down('right');
      const sneak = input && I.down('down') && !this.horse;
      let dir = (R ? 1 : 0) - (L ? 1 : 0);
      if (w.def.runner) dir = 1;

      if (this.hurtT > 0) this.hurtT -= dt;
      if (this.invT > 0) this.invT -= dt;
      if (this.castCd > 0) this.castCd -= dt;
      if (this.mindCd > 0) this.mindCd -= dt;

      // 가로 이동
      const maxV = w.def.runner ? w.def.runSpeed : sneak ? P.sneak : P.run;
      if (this.hurtT <= 0) {
        if (dir !== 0) {
          const acc = this.onGround ? P.accG : P.accA;
          this.vx = U.approach(this.vx, dir * maxV, acc * dt);
          if (!w.def.runner) this.facing = dir;
        } else {
          this.vx = U.approach(this.vx, 0, (this.onGround ? P.fric : P.accA * 0.6) * dt);
        }
      }
      if (this.attackT > 0 && this.onGround) this.vx *= 0.86;

      // 점프
      if (this.onGround) { this.coyoteT = P.coyote; this.jumps = 0; } else this.coyoteT -= dt;
      if (input && I.pressed('jump')) this.bufT = P.buffer; else this.bufT -= dt;
      const imm = this.mode === 'immortal';
      if (this.bufT > 0) {
        if (this.coyoteT > 0) {
          this.vy = -P.jumpV * (w.def.runner ? 1.08 : 1); this.coyoteT = 0; this.bufT = 0; this.sq = 1.22;
          G.audio.sfx('jump'); FX.burst(this.cx, this.feet, 'dust', 5, { angle: -Math.PI / 2, spread: 1.2, max: 60, g: 200 });
        } else if (imm && this.jumps < 1) {
          this.vy = -P.jump2V; this.jumps++; this.bufT = 0; this.sq = 1.25;
          G.audio.sfx('jump2'); FX.burst(this.cx, this.feet, 'feather', 8, { angle: Math.PI / 2, spread: 1.2, max: 90 });
        }
      }
      if (input && I.released('jump') && this.vy < -180) this.vy = -180;   // 짧게 누르면 낮게

      // 중력·활공
      this.gliding = imm && !this.onGround && this.vy > 0 && input && I.down('jump');
      this.vy += P.grav * dt;
      const maxFall = this.gliding ? P.glideFall : P.maxFall;
      if (this.vy > maxFall) this.vy = U.approach(this.vy, maxFall, 3000 * dt);
      if (this.gliding && Math.random() < dt * 6) FX.burst(this.cx - this.facing * 10, this.cy, 'feather', 1, { max: 30 });

      // 공격·시전·마음 전환
      if (input && I.pressed('attack') && this.attackT <= 0 && !this.horse && this.unlocked('okjeol')) this.startAttack();
      if (input && I.pressed('cast') && !this.horse) this.tryCast(w);
      if (input && I.pressed('mind') && !this.horse) {
        if (!this.unlocked('feather')) { if (this.mindCd <= 0) { G.ui.toast('아직 한 가지 마음뿐이에요 (금강대에서 열려요)', 'game'); this.mindCd = 1; } }
        else if (this.mindCd <= 0 && !w.forceMode) { this.setMode(imm ? 'official' : 'immortal'); this.mindCd = 0.25; }
      }
      if (this.attackT > 0) { this.attackT -= dt; this.attackHits(w); }
      if (this.castT > 0) {
        const before = this.castT;
        this.castT -= dt;
        if (before > 0.22 && this.castT <= 0.22) this.castPulse(w);
      }

      // 이동과 착지
      this.dropping = input && sneak && I.pressed('jump') ? 0.2 : Math.max(0, (this.dropping || 0) - dt);
      const rider = this.riding; this.riding = null;
      if (rider && rider.dx) this.x += rider.dx;
      w.moveBody(this, dt);
      if (this.onGround && !this.wasGround) { this.sq = 0.8; G.audio.sfx('land'); FX.burst(this.cx, this.feet, 'dust', 4, { angle: -Math.PI / 2, spread: 1.5, max: 50, g: 200 }); }
      this.wasGround = this.onGround;
      this.sq += (1 - this.sq) * Math.min(1, dt * 14);

      if (this.onGround && Math.abs(this.vx) > 40) {
        this.stepT -= dt;
        if (this.stepT <= 0) { this.stepT = this.horse ? 0.13 : 0.28; if (this.horse) G.audio.sfx('horse'); }
      }

      // 위험 지형
      if (w.onHazard(this)) this.fall(w);

      // 애니메이션
      const prev = this.anim;
      if (this.horse) this.anim = this.onGround ? 'gallop' : 'hjump';
      else if (this.hurtT > 0) this.anim = 'hurt';
      else if (this.castT > 0) this.anim = 'cast';
      else if (this.attackT > 0) this.anim = 'attack';
      else if (!this.onGround) this.anim = this.gliding ? 'glide' : 'jump';
      else if (Math.abs(this.vx) > 12) this.anim = 'walk';
      else this.anim = 'idle';
      if (prev !== this.anim) this.animT = 0; else this.animT += dt * (this.anim === 'walk' && sneak ? 0.5 : 1);
    }

    startAttack() {
      if (this.mode === 'immortal') {
        // 신선의 마음: 바람을 일으켜 밀어낼 뿐 해치지 않는다
        this.attackT = 0.3; this.hitSet.clear(); this.gust = true;
        G.audio.sfx('gust');
        FX.burst(this.cx + this.facing * 20, this.cy, 'feather', 8, { angle: this.facing > 0 ? 0 : Math.PI, spread: 0.5, max: 220 });
        return;
      }
      this.gust = false;
      this.attackT = 0.33; this.hitSet.clear();
      G.audio.sfx('slash');
    }
    attackBox() {
      const f = this.facing;
      return { x: f > 0 ? this.cx + 2 : this.cx - 46, y: this.y + 2, w: 44, h: 34 };
    }
    attackHits(w) {
      const age = (this.gust ? 0.3 : 0.33) - this.attackT;
      if (age < 0.06 || age > 0.22) return;
      const box = this.attackBox();
      for (const e of w.ents) {
        if (e.dead || !e.hittable || this.hitSet.has(e)) continue;
        if (U.overlap(box, e)) {
          this.hitSet.add(e);
          if (this.gust) { if (e.push) e.push(this.facing * 260); continue; }
          e.hurt(1, this.facing, w);
        }
      }
      // 붓 자국(먹물 파편)
      if (!this.gust && age < 0.1) FX.burst(this.cx + this.facing * 28, this.cy - 4, 'ink', 2, { angle: this.facing > 0 ? 0 : Math.PI, spread: 0.8, max: 140 });
    }
    tryCast(w) {
      if (!this.unlocked('okjeol')) return;
      if (this.mode !== 'official') { G.ui.toast('옥절은 관리의 마음일 때 쓸 수 있어요 · 마음 전환{mind}', 'game'); return; }
      if (this.castCd > 0 || this.castT > 0) return;
      this.castT = 0.45; this.castCd = 0.9;
      G.audio.sfx('cast');
    }
    castPulse(w) {
      FX.shake(2, 0.15);
      w.add(new G.E.Ring(this.cx, this.cy - 10));
      for (const e of w.ents) {
        if (e.dead || !e.onCast) continue;
        const d = U.dist(this.cx, this.cy, e.x + (e.w || 0) / 2, e.y + (e.h || 0) / 2);
        if (d < (e.castRange || 120)) e.onCast(w, this);
      }
    }

    // 난이도: easy = 다치지 않음, normal = 무한 목숨(하트를 다 잃으면 이정표에서 하트를 채워 다시),
    //         lives = 목숨 3개(하트가 곧 목숨, 다 잃으면 그 구간을 처음부터)
    damage(n, dir, w) {
      if (this.invT > 0 || this.out) return;
      const diff = G.save.data.settings.difficulty;
      if (diff === 'easy') { this.invT = 0.6; this.vx = dir * 160; this.vy = -200; return; }
      this.hp -= n;
      this.hurtT = 0.35; this.invT = 1.3;
      this.vx = dir * 200; this.vy = -260;
      G.audio.sfx('hurt'); FX.flash('#ff5040', 0.16); FX.shake(5, 0.3); FX.stop(0.09);
      FX.burst(this.cx, this.cy, 'ink', 10, { max: 160 });
      if (this.hp <= 0) { if (diff === 'lives') this.gameOver(w); else this.respawn(w, '먹물을 털고 다시 일어섰다'); }
    }
    fall(w) {
      if (this.falling || this.out) return;
      this.falling = true;
      const diff = G.save.data.settings.difficulty;
      if (diff !== 'easy') this.hp -= 1;
      G.audio.sfx('hurt'); FX.flash('#203040', 0.2);
      if (this.hp <= 0 && diff === 'lives') { this.gameOver(w); return; }
      this.respawn(w, this.hp <= 0 ? '먹물을 털고 다시 일어섰다' : null);
    }
    gameOver(w) {
      this.out = true; this.hp = 0; this.vx = 0;
      w.lockInput = true;
      const sc = G.scenes.cur;
      if (sc && sc.world === w && sc.gameOver) sc.gameOver();
    }
    respawn(w, msg) {
      const c = w.checkpoint || w.start;
      this.x = c.x - this.w / 2; this.y = c.y - this.h - 2;
      this.vx = this.vy = 0; this.invT = 1.2; this.hurtT = 0;
      if (this.hp <= 0) this.hp = this.maxHp;
      this.falling = false;
      w.camSnap = true;
      if (msg) G.ui.toast(msg, 'game');
      if (w.onRespawn) w.onRespawn();
    }

    draw(ctx, w) {
      if (this.invT > 0 && Math.floor(this.invT * 16) % 2 === 0 && this.hurtT <= 0) return;
      const x = this.cx, y = this.feet;
      // 마음의 기운(발밑 빛)
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.1 * Math.sin(w.time * 4);
      ctx.fillStyle = this.mode === 'immortal' ? '#bfe9ff' : '#ffd36a';
      ctx.beginPath(); ctx.ellipse(x, y, 13, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      const sx = 1 / Math.sqrt(this.sq), sy = this.sq;
      const sheet = this.horse ? 'horse' : 'hero';
      const once = ['attack', 'cast', 'hurt', 'hjump'].includes(this.anim);
      if (this.anim === 'jump') {
        // 오르는 중 / 꼭대기 / 떨어지는 중을 속도로 고른다
        const f = this.vy < -250 ? 1 : this.vy < 60 ? 2 : 3;
        const m = G.assets.meta.hero.anims.jump;
        G.assets.frame(ctx, 'hero', 'jump', (f + 0.01) / m.fps, x, y, this.facing < 0, { once: true, sx, sy });
      } else {
        G.assets.frame(ctx, sheet, this.anim, this.animT, x, y, this.facing < 0, { once, sx, sy });
      }
      if (this.gust && this.attackT > 0) {
        ctx.save(); ctx.globalAlpha = this.attackT / 0.3 * 0.6; ctx.strokeStyle = '#e8f7ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x + this.facing * 16, y - 22, 22 + (0.3 - this.attackT) * 60, -0.9, 0.9); ctx.stroke(); ctx.restore();
      }
    }
  }
  G.Player = Player;
})();
