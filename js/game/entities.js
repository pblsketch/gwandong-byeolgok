'use strict';
// 세계에 놓이는 것들: 두루마리, 적(虛), 새, 구름, 이정표, 석판, 제단, 배, 파도 …
(function () {
  const U = G.util, FX = G.fx, TS = G.TS, A = G.assets;
  const E = G.E = {};
  const serif = () => 'Gowun Batang, "Noto Serif KR", serif';

  // 월드 안의 이름표
  function label(ctx, text, x, y, opt = {}) {
    ctx.save();
    ctx.font = `${opt.bold ? 700 : 400} ${opt.size || 11}px ${serif()}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 10;
    if (opt.box !== false) {
      ctx.fillStyle = opt.bg || 'rgba(243,234,212,.92)';
      ctx.fillRect(Math.round(x - w / 2), Math.round(y - 8), Math.round(w), 16);
      ctx.fillStyle = opt.edge || '#3b2f22';
      ctx.fillRect(Math.round(x - w / 2), Math.round(y + 7), Math.round(w), 1);
    }
    ctx.fillStyle = opt.color || '#1d1a16';
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  }
  G.label = label;

  // 석판 글자를 두 줄로: 띄어쓰기가 있으면 거기서, 없으면 글자(자모 묶음) 단위 가운데서 나눈다
  function splitTwo(txt) {
    if (txt.includes(' ')) { const i = txt.indexOf(' '); return [txt.slice(0, i), txt.slice(i + 1)]; }
    const g = window.Intl && Intl.Segmenter ? Array.from(new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(txt), (x) => x.segment) : Array.from(txt);
    if (g.length <= 3) return [txt];
    const h = Math.ceil(g.length / 2);
    return [g.slice(0, h).join(''), g.slice(h).join('')];
  }

  // ---------------------------------------------------------------- 연출용
  E.Ring = class { // 옥절 시전 빛 고리
    constructor(x, y) { this.x = x; this.y = y; this.t = 0; this.z = 20; }
    update(dt) { this.t += dt; if (this.t > 0.45) this.dead = true; }
    draw(ctx) {
      const k = this.t / 0.45;
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(this.x, this.y, 10 + k * 110, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = (1 - k) * 0.15; ctx.fillStyle = '#fff3c4'; ctx.fill();
      ctx.restore();
    }
  };

  // ---------------------------------------------------------------- 줍는 것
  E.Scroll = class {
    constructor(x, y, id) { this.x = x - 12; this.y = y - 34; this.w = 24; this.h = 26; this.id = id; this.t = Math.random() * 6; this.z = 5; }
    update(dt, w) {
      this.t += dt;
      const p = w.player;
      if (p && !w.lockInput && U.overlap(this, p)) { this.dead = true; w.run(() => w.collectScroll(this.id, this)); }
      if (Math.random() < dt * 3) FX.burst(this.x + 12, this.y + 12, 'spark', 1, { max: 20, life: 0.8 });
    }
    draw(ctx) {
      const y = this.y + 13 + Math.sin(this.t * 3) * 3;
      ctx.save(); ctx.globalAlpha = 0.3 + 0.15 * Math.sin(this.t * 4); ctx.fillStyle = '#fff1b8';
      ctx.beginPath(); ctx.arc(this.x + 12, y, 16, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      A.drawProp(ctx, 'scroll', this.x + 12, y, { center: true });
    }
  };
  E.Ink = class {
    constructor(x, y) { this.x = x - 6; this.y = y - 14; this.w = 12; this.h = 12; this.t = Math.random() * 6; this.z = 4; }
    update(dt, w) {
      this.t += dt;
      const p = w.player;
      if (p && U.overlap(this, p)) { this.dead = true; G.save.data.ink++; G.audio.sfx('ink'); FX.burst(this.x + 6, this.y + 6, 'ink', 4, { max: 60, g: 100 }); }
    }
    draw(ctx) { A.drawProp(ctx, 'inkstick', this.x + 6, this.y + 6 + Math.sin(this.t * 4) * 2, { center: true, scale: 0.7 }); }
  };
  E.Heart = class {
    constructor(x, y) { this.x = x - 7; this.y = y - 16; this.w = 14; this.h = 14; this.t = 0; }
    update(dt, w) {
      this.t += dt;
      const p = w.player;
      if (p && U.overlap(this, p) && p.hp < p.maxHp) { this.dead = true; p.hp++; G.audio.sfx('pickup'); }
    }
    draw(ctx) { A.drawProp(ctx, 'heart', this.x + 7, this.y + 7 + Math.sin(this.t * 4) * 2, { center: true }); }
  };

  // ---------------------------------------------------------------- 적(虛: 게임 설정)
  class Enemy {
    constructor() { this.hittable = true; this.hp = 2; this.flash = 0; this.t = Math.random() * 3; this.z = 6; this.kb = 0; }
    hurt(n, dir, w) {
      this.hp -= n; this.flash = 0.12; this.vx = dir * 170; this.vy = -140; this.kb = 0.18;
      const kill = this.hp <= 0;
      FX.stop(kill ? 0.11 : 0.07); FX.shake(kill ? 4 : 2.5, 0.2);
      G.audio.sfx(kill ? 'kill' : 'hit');
      FX.burst(this.x + this.w / 2, this.y + this.h / 2, 'ink', kill ? 18 : 8, { max: kill ? 220 : 150 });
      if (kill) this.die(w);
      if (w.onFirst) w.onFirst('enemy');
    }
    die(w) {
      this.dead = true;
      w.add(new E.Pop(this.x + this.w / 2, this.y + this.h));
      const n = this.drops || 2;
      for (let i = 0; i < n; i++) w.add(new E.Ink(this.x + this.w / 2 + (i - (n - 1) / 2) * 14, this.y + this.h));
      w.killCount = (w.killCount || 0) + 1;
    }
    push(v) { this.vx = v; this.vy = -120; this.kb = 0.3; }
    touch(w) {
      const p = w.player;
      if (p && !this.harmless && U.overlap(this, p)) p.damage(1, p.cx < this.x + this.w / 2 ? -1 : 1, w);
    }
  }
  E.Pop = class { // 먹물 요괴가 터지는 모습
    constructor(x, y) { this.x = x; this.y = y; this.t = 0; this.z = 7; }
    update(dt) { this.t += dt; if (this.t > 0.3) this.dead = true; }
    draw(ctx) { A.frame(ctx, 'enemies', 'blobpop', this.t, this.x, this.y + 8, false, { once: true }); }
  };

  E.Blob = class extends Enemy { // 먹물 요괴: 좌우로 뛰어다닌다
    constructor(x, y, opt = {}) { super(); this.w = 24; this.h = 22; this.x = x - 12; this.y = y - 22; this.vx = 0; this.vy = 0; this.dir = opt.dir || -1; this.speed = opt.speed || 38; this.range = opt.range; this.home = this.x; }
    update(dt, w) {
      this.t += dt; if (this.flash > 0) this.flash -= dt;
      if (this.kb > 0) { this.kb -= dt; }
      else {
        this.vx = this.dir * this.speed;
        // 낭떠러지·벽 앞에서 돌아선다
        const ahead = this.dir > 0 ? this.x + this.w + 2 : this.x - 2;
        const footY = this.y + this.h + 4;
        if (this.onGround && (!w.solidAtPx(ahead, footY) && w.tileAt(Math.floor(ahead / TS), Math.floor(footY / TS)) !== G.TILE.ONEWAY)) this.dir *= -1;
        if (this.hitWall) { this.dir *= -1; this.hitWall = 0; }
        if (this.range && Math.abs(this.x - this.home) > this.range * TS) this.dir = this.x > this.home ? -1 : 1;
        if (this.onGround && Math.random() < dt * 0.8) this.vy = -220;
      }
      this.vy += 1300 * dt;
      w.moveBody(this, dt);
      if (w.onHazard(this)) this.dead = true;
      this.touch(w);
    }
    draw(ctx) {
      const hop = this.onGround ? 0 : -2;
      A.frame(ctx, 'enemies', this.flash > 0 ? 'blobhurt' : 'blob', this.t, this.x + this.w / 2, this.y + this.h + 12 + hop, this.dir > 0, { flash: this.flash > 0 ? 0.8 : 0 });
    }
  };

  E.Bird = class extends Enemy { // 오작(까마귀·까치): 원문 속 새지만, 덤벼드는 것은 게임 설정
    constructor(x, y, kind = 'crow', opt = {}) {
      super(); this.kind = kind; this.w = 26; this.h = 18; this.x = x; this.y = y; this.baseY = y; this.hp = 1;
      this.dir = opt.dir || -1; this.speed = opt.speed || 90; this.amp = opt.amp || 26; this.drops = 1; this.dive = 0;
    }
    update(dt, w) {
      this.t += dt; if (this.flash > 0) this.flash -= dt;
      const p = w.player;
      if (this.kb > 0) { this.kb -= dt; this.x += this.vx * dt; this.y += this.vy * dt; this.vy += 600 * dt; }
      else {
        if (this.homeY === undefined) this.homeY = this.baseY;
        if (p && this.dive <= 0 && Math.abs(p.cx - this.x) < 120 && Math.random() < dt * 1.5) this.dive = 0.8;
        if (this.dive > 0) { this.dive -= dt; this.baseY += (p.cy - 8 - this.baseY) * dt * 2.4; }
        else this.baseY += (this.homeY - this.baseY) * dt * 1.2;
        this.y = this.baseY + Math.sin(this.t * 3) * this.amp * 0.3;
        this.x += this.dir * this.speed * dt;
        if (p && Math.abs(p.cx - this.x) > 420) this.dir = p.cx > this.x ? 1 : -1;
      }
      this.touch(w);
    }
    draw(ctx) { A.frame(ctx, 'enemies', this.kind, this.t, this.x + this.w / 2, this.y + this.h / 2 + 4, this.dir > 0, { flash: this.flash > 0 ? 0.8 : 0 }); }
  };

  E.Cloud = class extends Enemy { // 녈구름: 해를 가리려 몰려온다(기믹은 虛, 상징 의미는 實)
    constructor(x, y, target, speed) { super(); this.w = 44; this.h = 26; this.x = x; this.y = y; this.hp = 1; this.target = target; this.speed = speed || 34; this.harmless = true; this.castRange = 150; this.drops = 1; }
    update(dt, w) {
      this.t += dt; if (this.flash > 0) this.flash -= dt;
      if (this.kb > 0) { this.kb -= dt; this.x += this.vx * dt; }
      else {
        const dx = this.target.x - (this.x + this.w / 2), dy = this.target.y - (this.y + this.h / 2);
        const d = Math.hypot(dx, dy) || 1;
        this.x += dx / d * this.speed * dt; this.y += dy / d * this.speed * dt + Math.sin(this.t * 2) * 0.2;
        if (d < 24) { this.dead = true; w.onCloudReach && w.onCloudReach(this); }
      }
    }
    onCast(w) { this.hurt(1, Math.sign(this.x - w.player.cx) || 1, w); FX.burst(this.x + 22, this.y + 13, 'spark', 10, { max: 120, color: '#fff3c4' }); }
    die(w) { this.dead = true; FX.burst(this.x + 22, this.y + 13, 'dust', 16, { max: 90, g: 0, color: '#9aa0a8' }); w.cloudsCleared = (w.cloudsCleared || 0) + 1; }
    draw(ctx) { A.frame(ctx, 'enemies', 'cloud', this.t, this.x + this.w / 2, this.y + this.h / 2 + 2, this.target.x > this.x, { flash: this.flash > 0 ? 0.8 : 0, scale: 1.2 }); }
  };

  E.Wave = class { // 망양정의 거센 파도(은산): 넘어야 한다
    constructor(x, groundY, dir, speed, h) { this.x = x; this.gy = groundY; this.dir = dir; this.speed = speed || 150; this.hh = h || 34; this.w = 30; this.h = this.hh; this.y = groundY - this.hh; this.t = 0; this.z = 8; }
    update(dt, w) {
      this.t += dt; this.x += this.dir * this.speed * dt;
      if (this.t > 8) this.dead = true;
      const p = w.player;
      if (p && U.overlap({ x: this.x + 4, y: this.y + 6, w: this.w - 8, h: this.h - 6 }, p)) p.damage(1, this.dir, w);
      if (Math.random() < dt * 20) FX.burst(this.x + 15, this.y + 4, 'snow', 1, { angle: -Math.PI / 2, spread: 1, max: 80, g: 200 });
    }
    draw(ctx) {
      ctx.save();
      const x = this.x, y = this.y, h = this.hh;
      ctx.fillStyle = 'rgba(70,130,160,.9)';
      ctx.beginPath(); ctx.moveTo(x - 6, y + h);
      ctx.quadraticCurveTo(x + 4, y - 4, x + 30 * (this.dir > 0 ? 1.2 : 0.4), y + 4);
      ctx.lineTo(x + 36, y + h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f4fbff';
      for (let i = 0; i < 6; i++) ctx.fillRect(Math.round(x + i * 5), Math.round(y + 2 + Math.abs(i - 3) * 2 + Math.sin(this.t * 10 + i) * 1.5), 5, 3);
      ctx.restore();
    }
  };

  E.Shot = class { // 보스 발사체
    constructor(x, y, vx, vy, opt = {}) { this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.w = opt.r || 10; this.h = opt.r || 10; this.g = opt.g || 0; this.t = 0; this.color = opt.color || '#bfe6ff'; this.kind = opt.kind || 'drop'; this.z = 9; this.life = opt.life || 5; }
    update(dt, w) {
      this.t += dt; this.vy += this.g * dt; this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.t > this.life || this.y > w.h * TS + 40) this.dead = true;
      if (w.solidAtPx(this.x + this.w / 2, this.y + this.h)) { this.dead = true; FX.burst(this.x + this.w / 2, this.y + this.h, 'drop', 6, { angle: -Math.PI / 2, spread: 1.2, max: 90 }); }
      const p = w.player;
      if (p && U.overlap(this, p)) { this.dead = true; p.damage(1, Math.sign(this.vx) || 1, w); }
    }
    draw(ctx) {
      ctx.save();
      ctx.fillStyle = this.color; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(this.x + this.w / 2, this.y + this.h / 2, this.w / 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(this.x + this.w / 2 - 2), Math.round(this.y + 2), 2, 2);
      ctx.restore();
    }
  };
  E.Warn = class { // 아래에서 솟구치는 물기둥 예고
    constructor(x, y, delay, onFire) { this.x = x; this.y = y; this.t = 0; this.delay = delay; this.onFire = onFire; this.z = 3; }
    update(dt, w) { this.t += dt; if (this.t >= this.delay) { this.dead = true; this.onFire(w); } }
    draw(ctx) {
      const k = this.t / this.delay;
      ctx.save(); ctx.globalAlpha = 0.4 + 0.4 * Math.sin(this.t * 30); ctx.fillStyle = '#e8f7ff';
      for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(this.x - 12 + i * 6), Math.round(this.y - 3 - Math.random() * 4 * k), 3, 3);
      ctx.restore();
    }
  };
  E.Spout = class { // 물기둥(고래가 뿜는 물)
    constructor(x, y) { this.x = x - 12; this.w = 24; this.base = y; this.y = y - 130; this.h = 130; this.t = 0; this.z = 9; }
    update(dt, w) {
      this.t += dt; if (this.t > 0.9) this.dead = true;
      const k = Math.min(1, this.t / 0.15) * (this.t > 0.7 ? (0.9 - this.t) / 0.2 : 1);
      this.h = 130 * k; this.y = this.base - this.h;
      const p = w.player;
      if (p && this.h > 20 && U.overlap(this, p)) p.damage(1, p.cx < this.x + 12 ? -1 : 1, w);
      if (Math.random() < dt * 30) FX.burst(this.x + 12, this.y, 'snow', 1, { angle: -Math.PI / 2, spread: 1.4, max: 120, g: 300 });
    }
    draw(ctx) {
      ctx.save(); ctx.fillStyle = 'rgba(200,235,255,.85)';
      ctx.fillRect(Math.round(this.x + 4), Math.round(this.y), 16, Math.round(this.h));
      ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(this.x + 8), Math.round(this.y), 4, Math.round(this.h));
      ctx.restore();
    }
  };

  // ---------------------------------------------------------------- 장치·NPC
  E.Sign = class { // 이정표: 지나가면 체크포인트 + 지명 배너
    constructor(x, y, place, opt = {}) { this.x = x - 10; this.y = y - 52; this.w = 20; this.h = 52; this.place = place; this.opt = opt; this.hit = false; this.z = 2; }
    update(dt, w) {
      const p = w.player;
      if (!this.hit && p && p.cx > this.x) {
        this.hit = true;
        w.checkpoint = { x: this.x + 10, y: this.y + 52 };
        const info = (window.GD.places || {})[this.place] || {};
        if (!this.opt.silent) G.ui.banner(this.place, info.hanja, this.opt.now || info.now);
        w.visitPlace && w.visitPlace(this.place);
      }
    }
    draw(ctx) {
      A.drawProp(ctx, 'signpost', this.x + 10, this.y + 52);
      label(ctx, this.place, this.x + 10, this.y + 12, { size: 10, bold: true });
    }
  };
  E.Label = class { // 풍경에 붙이는 이름표(코드로만 쓴다: AI 그림에는 글자를 넣지 않았다)
    constructor(x, y, text, opt = {}) { this.x = x; this.y = y; this.text = text; this.opt = opt; this.z = 1; this.w = 1; }
    draw(ctx) { label(ctx, this.text, this.x, this.y, this.opt); }
  };
  E.Sprite = class { // 움직이는 장식(학, 갈매기, 용, 신선 …)
    constructor(sheet, anim, x, y, opt = {}) { Object.assign(this, { sheet, anim, x, y, opt, t: Math.random() * 2, z: opt.z || 3, w: opt.w || 40, flip: !!opt.flip }); this.vx = opt.vx || 0; this.vy = opt.vy || 0; }
    update(dt) {
      this.t += dt; this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.opt.bob) this.y += Math.sin(this.t * 2) * this.opt.bob * dt;
      if (this.opt.life && this.t > this.opt.life) this.dead = true;
    }
    draw(ctx) { A.frame(ctx, this.sheet, this.anim, this.t, this.x, this.y, this.flip, { alpha: this.opt.alpha, scale: this.opt.scale, once: this.opt.once }); }
  };
  E.Prop = class { // 소품을 개체로(깜빡임·교체가 필요한 것)
    constructor(name, x, y, opt = {}) { this.name = name; this.x = x; this.y = y; this.opt = opt; this.z = opt.z || 1; this.w = 1; this.alpha = 1; }
    draw(ctx) { A.drawProp(ctx, this.name, this.x, this.y, Object.assign({}, this.opt, { alpha: this.alpha })); }
  };

  E.Gull = class { // 백구: 뛰어오면 놀라서 날아간다 (살금살금 걸으면 괜찮다)
    constructor(x, y) { this.x = x; this.y = y; this.state = 'stand'; this.t = Math.random(); this.z = 3; this.w = 20; this.vx = 0; this.vy = 0; }
    update(dt, w) {
      this.t += dt;
      const p = w.player;
      if (this.state === 'stand' && p && Math.abs(p.cx - this.x) < 80 && Math.abs(p.feet - this.y) < 60) {
        if (Math.abs(p.vx) > 90 || !p.onGround) {
          this.state = 'fly'; this.vx = (this.x > p.cx ? 1 : -1) * 90; this.vy = -80; G.audio.sfx('whoosh');
          w.gullsScared = (w.gullsScared || 0) + 1;
        } else if (!this.friend) { this.friend = true; FX.burst(this.x, this.y - 20, 'spark', 5, { max: 40 }); w.gullsFriend = (w.gullsFriend || 0) + 1; }
      }
      if (this.state === 'fly') { this.x += this.vx * dt; this.y += this.vy * dt; this.vy -= 20 * dt; if (this.y < w.cam.y - 60) this.dead = true; }
    }
    draw(ctx) {
      A.frame(ctx, 'npcs', this.state === 'fly' ? 'gull' : 'gullstand', this.t, this.x, this.y + (this.state === 'fly' ? 0 : 6), this.state === 'fly' ? this.vx > 0 : false, { scale: 0.6 });
      if (this.friend && this.state === 'stand') A.drawProp(ctx, 'heart', this.x, this.y - 34 + Math.sin(this.t * 4) * 1.5, { center: true, scale: 0.6 });
    }
  };

  E.Tablets = class { // 음보 석판: 4음보를 순서대로 치면 다리가 놓인다
    constructor(x, y, parts, onSolve) {
      this.parts = parts; this.onSolve = onSolve; this.next = 0; this.z = 4; this.x = x; this.y = y; this.w = 1;
      this.order = U.shuffle(parts.map((p, i) => i));
      this.slabs = this.order.map((pi, k) => ({ pi, x: x + k * 44, y: y - 40 - (k % 2) * 26, w: 38, h: 34, lit: false, shake: 0 }));
      this.solved = false;
    }
    init(w) {
      for (const s of this.slabs) {
        const slab = { x: s.x, y: s.y, w: s.w, h: s.h, hittable: true, z: 4, ref: s, owner: this };
        slab.hurt = (n, dir, ww) => this.hit(s, ww);
        slab.update = () => {};
        slab.draw = () => {};
        w.add(slab);
      }
    }
    hit(s, w) {
      if (this.solved || s.lit) return;
      if (s.pi === this.next) {
        s.lit = true; this.next++;
        G.audio.sfx('correct'); FX.stop(0.06); FX.burst(s.x + 19, s.y + 17, 'spark', 10, { max: 120 });
        if (this.next >= this.parts.length) { this.solved = true; FX.shake(3, 0.3); w.run(() => this.onSolve(w)); }
      } else {
        G.audio.sfx('wrong'); s.shake = 0.3; FX.shake(2, 0.15);
        for (const t of this.slabs) t.lit = false;
        this.next = 0;
      }
    }
    update(dt) { for (const s of this.slabs) if (s.shake > 0) s.shake -= dt; }
    draw(ctx) {
      for (const s of this.slabs) {
        const ox = s.shake > 0 ? Math.sin(s.shake * 60) * 2 : 0;
        A.drawProp(ctx, 'tablet', s.x + 19 + ox, s.y + s.h + 4, { scale: 0.95 });
        ctx.save();
        if (s.lit) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffe9a0'; ctx.fillRect(s.x + 4 + ox, s.y + 6, s.w - 8, s.h - 6); ctx.globalAlpha = 1; }
        ctx.font = `700 9px ${getComputedStyle(document.documentElement).getPropertyValue('--yet')}`;
        ctx.fillStyle = s.lit ? '#7f1a14' : '#1d1a16'; ctx.textAlign = 'center';
        const txt = G.origText(this.parts[s.pi], false);
        const lines = splitTwo(txt);
        lines.forEach((l, i) => ctx.fillText(l, s.x + 19 + ox, s.y + 20 + i * 11 - (lines.length - 1) * 5));
        ctx.restore();
      }
    }
  };

  E.Altar = class { // 비를 비는 제단: 옥절로 깨운다
    constructor(x, y, onCast) { this.x = x - 28; this.y = y - 30; this.w = 56; this.h = 30; this.cb = onCast; this.used = false; this.z = 2; this.castRange = 90; this.t = 0; }
    update(dt) { this.t += dt; }
    onCast(w) { if (this.used) return; this.used = true; w.run(() => this.cb(w)); }
    draw(ctx) {
      A.drawProp(ctx, 'altar', this.x + 28, this.y + 30);
      if (!this.used) { ctx.save(); ctx.globalAlpha = 0.5 + 0.4 * Math.sin(this.t * 4); ctx.fillStyle = '#ffd35a'; ctx.fillRect(Math.round(this.x + 26), Math.round(this.y - 10), 4, 4); ctx.restore(); }
    }
  };

  E.Boat = class { // 경포의 배: 타면 건너편으로 간다
    constructor(x0, x1, y) { this.x0 = x0; this.x1 = x1; this.x = x0; this.y = y - 18; this.w = 76; this.h = 18; this.platform = true; this.platTop = 6; this.dx = 0; this.z = 4; this.go = false; this.t = 0; }
    update(dt, w) {
      this.t += dt;
      const p = w.player;
      const on = p && p.onGround && p.riding === this;
      if (on) this.go = true;
      const nx = this.go ? Math.min(this.x1, this.x + 70 * dt) : this.x;
      this.dx = nx - this.x; this.x = nx;
      if (p && Math.abs(p.feet - (this.y + this.platTop)) < 3 && p.x + p.w > this.x && p.x < this.x + this.w) p.riding = this;
    }
    draw(ctx) { A.drawProp(ctx, 'boat', this.x + this.w / 2, this.y + this.h + 4 + Math.sin(this.t * 2) * 1.5); }
  };

  E.Exit = class { // 레벨 끝
    constructor(x, y, cb) { this.x = x; this.y = y - 80; this.w = 30; this.h = 80; this.cb = cb; this.t = 0; this.z = 2; }
    update(dt, w) {
      this.t += dt;
      const p = w.player;
      if (!this.used && p && U.overlap(this, p)) { this.used = true; w.run(this.cb || ((ww) => ww.finish())); }
    }
    draw(ctx) {
      ctx.save();
      for (let i = 0; i < 4; i++) {
        ctx.globalAlpha = 0.12 + 0.06 * Math.sin(this.t * 3 + i);
        ctx.fillStyle = '#fff6d8';
        ctx.fillRect(Math.round(this.x + 6 - i * 3), Math.round(this.y), 18 + i * 6, this.h);
      }
      ctx.restore();
      label(ctx, '다음 여정 ▶', this.x + 15, this.y - 8, { size: 9 });
    }
  };

  E.Wall = class { // 보이지 않는 벽(비로봉 정상 등)
    constructor(x, y0, y1, cb) { this.x = x; this.y0 = y0; this.y1 = y1; this.cb = cb; this.w = 1; this.fired = false; }
    update(dt, w) {
      const p = w.player;
      if (p && p.x + p.w > this.x && p.feet > this.y0 && p.y < this.y1) {
        p.x = this.x - p.w - 0.5; p.vx = Math.min(0, p.vx);
        if (!this.fired) { this.fired = true; if (this.cb) w.run(this.cb); }
      }
    }
  };
  E.Current = class { // 폭포 물줄기: 아래로 떠민다
    constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; this.t = 0; this.z = 0; }
    update(dt, w) {
      this.t += dt;
      const p = w.player;
      if (p && U.overlap(this, p) && !p.onGround) p.vy += 700 * dt;
      if (Math.random() < dt * 8) FX.burst(this.x + Math.random() * this.w, this.y + this.h, 'snow', 1, { angle: -Math.PI / 2, spread: 1.4, max: 90, g: 250 });
    }
    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#dff2fb';
      ctx.fillRect(Math.round(this.x), Math.round(this.y), this.w, this.h);
      ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff';
      for (let i = 0; i < this.w; i += 4) {
        const off = ((this.t * 180 + i * 37) % 40);
        for (let yy = this.y - 40 + off; yy < this.y + this.h; yy += 40) ctx.fillRect(Math.round(this.x + i), Math.round(Math.max(this.y, yy)), 2, 14);
      }
      ctx.restore();
    }
  };
})();
