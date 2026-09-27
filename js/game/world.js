'use strict';
// 레벨 세계: 타일맵(PPU 32), 충돌, 카메라, 그리기, 스크립트
(function () {
  const U = G.util, TS = G.TS;
  const EMPTY = 0, SOLID = 1, ONEWAY = 2, HAZARD = 3;
  const SKINS = ['grass', 'granite', 'sand', 'plank', 'roof', 'cloud', 'earth', 'none'];
  G.TILE = { EMPTY, SOLID, ONEWAY, HAZARD };

  class World {
    constructor(def) {
      this.def = def;
      this.id = def.id;
      this.w = def.w; this.h = def.h || 12;
      this.t = new Uint8Array(this.w * this.h);
      this.skin = new Uint8Array(this.w * this.h);
      this.ents = []; this.decoBack = []; this.decoFront = [];
      this.triggers = [];
      this.water = [];                 // {x0,x1,h}
      this.bgZones = def.bg ? [{ x: 0, bg: def.bg }] : [];
      this.tint = def.tint || null;    // {color, alpha}
      this.weather = def.weather || null;
      this.time = 0;
      this.cam = { x: 0, y: 0 };
      this.lockInput = false;
      this.scripts = 0;
      this.done = false;
      this.baseSkin = def.skin || 'grass';
      this.checkpoint = null;
      this.banners = {};
      this.camTarget = null;
      this.sun = null;                 // 의상대 등에서 쓰는 해
      this.fog = def.fog !== undefined ? def.fog : 0.5;
    }
    // ---------- 건축 도구 (y는 '바닥에서 몇 칸 높이'로 센다) ----------
    idx(x, r) { return r * this.w + x; }                 // r: 위에서부터 행
    row(h) { return this.h - h; }                        // 높이 h의 표면 → 행 번호
    set(x, r, type, skin) {
      if (x < 0 || x >= this.w || r < 0 || r >= this.h) return;
      this.t[this.idx(x, r)] = type;
      this.skin[this.idx(x, r)] = SKINS.indexOf(skin || this.baseSkin);
    }
    ground(x0, x1, h, skin) { for (let x = x0; x < x1; x++) for (let k = 0; k < h; k++) this.set(x, this.h - 1 - k, SOLID, skin); return this; }
    clear(x0, x1, h0, h1) { for (let x = x0; x < x1; x++) for (let k = h0; k < h1; k++) this.set(x, this.h - 1 - k, EMPTY); return this; }
    block(x, h, w, hh, skin) { for (let i = 0; i < w; i++) for (let k = 0; k < hh; k++) this.set(x + i, this.h - h - k, SOLID, skin); return this; }  // 바닥이 높이 h-hh .. 윗면이 높이 h
    plat(x, h, w, skin = 'plank') { for (let i = 0; i < w; i++) this.set(x + i, this.h - h, ONEWAY, skin); return this; }
    hazard(x0, x1, h = 1) { for (let x = x0; x < x1; x++) for (let k = 0; k < h; k++) this.set(x, this.h - 1 - k, HAZARD); this.water.push({ x0, x1, h }); return this; }
    wy(h) { return (this.h - h) * TS; }                  // 높이 h의 표면 월드 y
    wx(x) { return x * TS; }
    add(e) { e.world = this; this.ents.push(e); if (e.init) e.init(this); return e; }
    deco(name, x, h, opt = {}) { (opt.front ? this.decoFront : this.decoBack).push({ name, x: x * TS, y: this.wy(h) + (opt.dy || 0), opt }); return this; }
    trigger(x0, x1, fn, opt = {}) { this.triggers.push({ x0: x0 * TS, x1: x1 * TS, fn, once: opt.once !== false, fired: false, cond: opt.cond }); return this; }
    bgAt(x, bg) { this.bgZones.push({ x: x * TS, bg }); this.bgZones.sort((a, b) => a.x - b.x); return this; }

    tileAt(tx, ty) {
      if (tx < 0 || tx >= this.w) return SOLID;
      if (ty < 0 || ty >= this.h) return EMPTY;
      return this.t[ty * this.w + tx];
    }
    solidAtPx(x, y) { return this.tileAt(Math.floor(x / TS), Math.floor(y / TS)) === SOLID; }

    // ---------- 충돌 이동(AABB) ----------
    moveBody(b, dt) {
      b.onGround = false;
      // 가로
      b.x += b.vx * dt;
      let top = Math.floor(b.y / TS), bot = Math.floor((b.y + b.h - 1) / TS);
      if (b.vx > 0) {
        const tx = Math.floor((b.x + b.w) / TS);
        for (let ty = top; ty <= bot; ty++) if (this.tileAt(tx, ty) === SOLID) { b.x = tx * TS - b.w - 0.01; b.vx = 0; b.hitWall = 1; break; }
      } else if (b.vx < 0) {
        const tx = Math.floor(b.x / TS);
        for (let ty = top; ty <= bot; ty++) if (this.tileAt(tx, ty) === SOLID) { b.x = (tx + 1) * TS + 0.01; b.vx = 0; b.hitWall = -1; break; }
      }
      // 세로
      const prevBottom = b.y + b.h;
      b.y += b.vy * dt;
      const l = Math.floor((b.x + 1) / TS), r = Math.floor((b.x + b.w - 1) / TS);
      if (b.vy > 0) {
        const ty = Math.floor((b.y + b.h) / TS);
        for (let tx = l; tx <= r; tx++) {
          const t = this.tileAt(tx, ty);
          if (t === SOLID || (t === ONEWAY && !b.dropping && prevBottom <= ty * TS + 1)) {
            b.y = ty * TS - b.h; b.vy = 0; b.onGround = true; break;
          }
        }
        // 움직이는 발판(배 등)
        if (!b.onGround && !b.dropping) {
          for (const e of this.ents) {
            if (!e.platform || e.dead) continue;
            const pt = e.y + (e.platTop || 0);
            if (b.x + b.w > e.x + 2 && b.x < e.x + e.w - 2 && prevBottom <= pt + 2 && b.y + b.h >= pt) {
              b.y = pt - b.h; b.vy = 0; b.onGround = true; b.riding = e; break;
            }
          }
        }
      } else if (b.vy < 0) {
        const ty = Math.floor(b.y / TS);
        for (let tx = l; tx <= r; tx++) if (this.tileAt(tx, ty) === SOLID) { b.y = (ty + 1) * TS; b.vy = 0; break; }
      }
    }
    onHazard(b) {
      const l = Math.floor((b.x + 2) / TS), r = Math.floor((b.x + b.w - 2) / TS), ty = Math.floor((b.y + b.h - 2) / TS);
      for (let tx = l; tx <= r; tx++) if (this.tileAt(tx, ty) === HAZARD) return true;
      return b.y > this.h * TS + 40;
    }

    // ---------- 스크립트 ----------
    async run(fn) {
      this.scripts++;
      try { await fn(this); } catch (e) { console.error(e); }
      this.scripts--;
    }

    update(dt) {
      this.time += dt;
      const p = this.player;
      if (p) {
        const cx = p.x + p.w / 2;
        for (const tr of this.triggers) {
          if (tr.fired && tr.once) continue;
          if (cx >= tr.x0 && cx <= tr.x1 && (!tr.cond || tr.cond(this))) {
            if (!tr.fired || !tr.once) { tr.fired = true; this.run(tr.fn); }
          }
        }
      }
      if (this.tick) this.tick(this, dt);
      for (const e of this.ents) if (!e.dead && e.update) e.update(dt, this);
      this.ents = this.ents.filter((e) => !e.dead);
      this.updateCamera(dt);
    }
    updateCamera(dt) {
      const p = this.player;
      let tx, ty;
      if (this.camTarget) { tx = this.camTarget.x - G.W / 2; ty = this.camTarget.y - G.H / 2; }
      else if (p) {
        tx = p.x + p.w / 2 - G.W / 2 + p.facing * (this.def.runner ? 150 : 40);
        ty = p.y + p.h / 2 - G.H * 0.58;
      } else return;
      const maxX = this.w * TS - G.W, maxY = this.h * TS - G.H;
      tx = U.clamp(tx, 0, Math.max(0, maxX)); ty = U.clamp(ty, 0, Math.max(0, maxY));
      const k = this.camSnap ? 1 : 1 - Math.pow(0.0015, dt);
      this.camSnap = false;
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * (this.camTarget ? k * 0.6 : k * 0.8);
    }

    // ---------- 그리기 ----------
    draw(ctx) {
      const S = G.renderScale;
      const cx = Math.round((this.cam.x + G.fx.sx) * S) / S, cy = Math.round((this.cam.y + G.fx.sy) * S) / S;
      this.drawBackground(ctx, cx, cy);
      ctx.save();
      ctx.translate(-cx, -cy);
      this.drawFog(ctx, cx, cy, 0);
      ctx.imageSmoothingEnabled = false;
      for (const d of this.decoBack) this.drawDeco(ctx, d, cx);
      this.drawWater(ctx, cx, true);
      this.drawTiles(ctx, cx, cy);
      const sorted = this.ents.slice().sort((a, b) => (a.z || 0) - (b.z || 0));
      for (const e of sorted) if (e.draw && e.x + (e.w || 0) > cx - 200 && e.x < cx + G.W + 200) e.draw(ctx, this);
      this.drawWater(ctx, cx, false);
      for (const d of this.decoFront) this.drawDeco(ctx, d, cx);
      G.fx.draw(ctx);
      ctx.restore();
      this.drawWeather(ctx);
      if (this.tint) { ctx.globalAlpha = this.tint.alpha; ctx.fillStyle = this.tint.color; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1; }
      if (this.drawOverlay) this.drawOverlay(ctx);
    }
    drawDeco(ctx, d, cx) {
      if (d.x < cx - 260 || d.x > cx + G.W + 260) return;
      G.assets.drawProp(ctx, d.name, d.x, d.y, d.opt);
    }
    drawBackground(ctx, cx, cy) {
      ctx.imageSmoothingEnabled = true;
      ctx.fillStyle = this.def.sky || '#e9e1cf';
      ctx.fillRect(0, 0, G.W, G.H);
      const par = this.def.parallax || 0.18;
      const draw = (name, alpha) => {
        const im = G.assets.bg(name);
        if (!im) return;
        const h = G.H * 1.12, w = im.width * h / im.height;
        const vy = -(cy / Math.max(1, this.h * TS - G.H)) * (h - G.H) || 0;
        let x = -((cx * par) % w);
        if (x > 0) x -= w;
        ctx.globalAlpha = alpha;
        for (; x < G.W; x += w) ctx.drawImage(im, x, vy, w + 0.5, h);
        ctx.globalAlpha = 1;
      };
      const px = cx + G.W / 2;
      let cur = this.bgZones[0], nxt = null;
      for (const z of this.bgZones) { if (z.x <= px) cur = z; else { nxt = z; break; } }
      if (cur) draw(cur.bg, 1);
      if (nxt && nxt.x - px < 220) draw(nxt.bg, U.clamp(1 - (nxt.x - px) / 220, 0, 1));
      if (this.sun) this.sun.drawSky(ctx, this);
    }
    drawFog(ctx, cx, cy) {
      if (!this.fog) return;
      const t = this.time;
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const y = this.h * TS - 60 - i * 38;
        const x0 = cx - 200 + ((t * (8 + i * 5) + i * 300) % 400);
        const g = ctx.createRadialGradient(x0 + 300, y, 10, x0 + 300, y, 320);
        g.addColorStop(0, `rgba(245,240,228,${0.22 * this.fog})`);
        g.addColorStop(1, 'rgba(245,240,228,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - 50, y - 120, G.W + 100, 240);
      }
      ctx.restore();
    }
    drawTiles(ctx, cx, cy) {
      const x0 = Math.max(0, Math.floor(cx / TS) - 1), x1 = Math.min(this.w, Math.ceil((cx + G.W) / TS) + 1);
      const y0 = Math.max(0, Math.floor(cy / TS) - 1), y1 = Math.min(this.h, Math.ceil((cy + G.H) / TS) + 1);
      // 1) 속 채움
      for (let ty = y0; ty < y1; ty++) {
        for (let tx = x0; tx < x1; tx++) {
          const t = this.t[ty * this.w + tx];
          if (t !== SOLID) continue;
          const sk = SKINS[this.skin[ty * this.w + tx]];
          if (sk === 'none') continue;
          const depth = this.depthOf(tx, ty);
          ctx.drawImage(fillCanvas(sk), (tx * TS) % 128, 0, TS, TS, tx * TS, ty * TS, TS, TS);
          if (depth > 0) { ctx.fillStyle = `rgba(20,14,8,${Math.min(0.55, depth * 0.12)})`; ctx.fillRect(tx * TS, ty * TS, TS, TS); }
          // 옆면 테두리
          ctx.fillStyle = 'rgba(25,18,10,.55)';
          if (this.tileAt(tx - 1, ty) !== SOLID && tx > 0) ctx.fillRect(tx * TS, ty * TS, 2, TS);
          if (this.tileAt(tx + 1, ty) !== SOLID && tx < this.w - 1) ctx.fillRect(tx * TS + TS - 2, ty * TS, 2, TS);
        }
      }
      // 2) 윗면(풀·이끼·모래) — 채움 위로 살짝 겹친다
      for (let ty = y0; ty < y1; ty++) {
        for (let tx = x0; tx < x1; tx++) {
          const t = this.t[ty * this.w + tx];
          const sk = SKINS[this.skin[ty * this.w + tx]];
          if (sk === 'none') continue;
          if (t === SOLID && this.tileAt(tx, ty - 1) !== SOLID) {
            const im = G.assets.tile(sk === 'earth' ? 'grass' : sk);
            if (im) ctx.drawImage(im, (tx * TS) % im.width, 0, TS, Math.min(im.height, 30), tx * TS, ty * TS - 6, TS, Math.min(im.height, 30));
          } else if (t === ONEWAY) {
            const im = G.assets.tile(sk);
            if (im) {
              const hh = sk === 'plank' ? im.height : Math.min(im.height, 26);
              ctx.drawImage(im, (tx * TS) % im.width, 0, TS, hh, tx * TS, ty * TS - (sk === 'plank' ? 2 : 6), TS, hh);
            }
          }
        }
      }
    }
    depthOf(tx, ty) { let d = 0; while (d < 5 && this.tileAt(tx, ty - d - 1) === SOLID) d++; return d; }
    drawWater(ctx, cx, back) {
      for (const w of this.water) {
        const x0 = w.x0 * TS, x1 = w.x1 * TS;
        if (x1 < cx - 10 || x0 > cx + G.W + 10) continue;
        const top = this.wy(w.h) + 6;
        const bottom = this.h * TS;
        if (back) {
          ctx.fillStyle = this.def.waterColor || 'rgba(58,110,120,.85)';
          ctx.fillRect(x0, top, x1 - x0, bottom - top);
        } else {
          ctx.fillStyle = 'rgba(220,245,250,.75)';
          for (let x = x0; x < x1; x += 4) {
            const yy = top + Math.sin((x + this.time * 60) * 0.06) * 2;
            ctx.fillRect(x, Math.round(yy), 3, 2);
          }
          ctx.fillStyle = 'rgba(58,110,120,.25)';
          ctx.fillRect(x0, top + 4, x1 - x0, bottom - top);
        }
      }
    }
    drawWeather(ctx) {
      const wt = this.weather;
      if (!wt) return;
      const t = this.time;
      if (wt === 'rain' || wt === 'bigrain') {
        ctx.strokeStyle = 'rgba(200,220,235,.55)'; ctx.lineWidth = 1;
        const n = wt === 'bigrain' ? 140 : 60;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = (i * 97 + t * 260) % (G.W + 60) - 30, y = (i * 53 + t * 620) % (G.H + 40) - 20;
          ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 12);
        }
        ctx.stroke();
      } else if (wt === 'spray' || wt === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        for (let i = 0; i < 70; i++) {
          const x = (i * 131 + Math.sin(t + i) * 20 + t * 30) % G.W, y = (i * 71 + t * (40 + (i % 5) * 12)) % G.H;
          ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
        }
      } else if (wt === 'petals') {
        ctx.fillStyle = 'rgba(250,200,215,.9)';
        for (let i = 0; i < 26; i++) {
          const x = (i * 151 + Math.sin(t * 0.8 + i) * 30 + t * 20) % G.W, y = (i * 83 + t * 25) % G.H;
          ctx.fillRect(Math.round(x), Math.round(y), 3, 2);
        }
      } else if (wt === 'stars') {
        for (let i = 0; i < 50; i++) {
          ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 2 + i);
          ctx.fillStyle = '#fff';
          ctx.fillRect((i * 173) % G.W, (i * 59) % (G.H * 0.5), 1, 1);
        }
        ctx.globalAlpha = 1;
      }
    }
  }
  G.World = World;

  // 타일 속 채움 무늬: 윗면 이미지의 아래쪽을 뒤집어 이어 붙여 만든다
  const fillCache = {};
  function fillCanvas(sk) {
    if (fillCache[sk]) return fillCache[sk];
    const src = G.assets.tile(sk === 'earth' ? 'grass' : sk);
    const c = document.createElement('canvas');
    c.width = 128; c.height = TS;
    const x = c.getContext('2d');
    if (src) {
      const band = 14, y0 = src.height - band;
      for (let i = 0; i < 3; i++) {
        x.save();
        if (i % 2) { x.translate(0, (i + 1) * band); x.scale(1, -1); x.drawImage(src, 0, y0, 128, band, 0, 0, 128, band); }
        else x.drawImage(src, 0, y0, 128, band, 0, i * band, 128, band);
        x.restore();
      }
    } else { x.fillStyle = '#6b5236'; x.fillRect(0, 0, 128, TS); }
    fillCache[sk] = c;
    return c;
  }
  G.fillCanvas = fillCanvas;
})();
