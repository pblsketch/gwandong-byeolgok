'use strict';
// 종장(결사): 월출 → 꿈속 신선 → 선택(원문 / 만약에) → 술빛 나누기 비행 → 깨어남 → 결과
(function () {
  const U = G.util, E = G.E, FX = G.fx, A = G.assets, TS = G.TS, esc = U.esc;
  const KB = () => window.KB || {};
  const EN = G.ending = {};
  const endScrolls = () => (KB().scrolls || []).filter((s) => s.level === 'E');
  const byPlace = (key) => endScrolls().filter((s) => (s.place || '').replace(/\s/g, '').includes(key));
  async function readScroll(s, w) {
    if (!s) return;
    G.save.data.scrolls[s.id] = true; G.save.write();
    await G.ui.scroll(s);
    const q = (KB().quizzes || []).filter((x) => x.scroll === s.id);
    const qq = q.find((x) => x.type === 'mind') || q[0];
    if (qq) { const ok = await G.ui.quiz(qq, { sub: s.place }); if (qq.type === 'mind' && ok) { G.save.data.mind[s.id] = true; G.save.write(); } }
  }

  EN.build = function (w) {
    w.ground(0, 64, 3);
    w.deco('pine', 42, 3, { scale: 1.1 });
    w.deco('boulder', 44, 3);
    w.deco('pavilion', 8, 3, { scale: 0.8 });
    w.sign(3, 3, '망양정', { silent: true });
    w.setStart(2, 3);
    // 배경 그림에 이미 보름달이 있다. 달이 떠오르는 순간은 밤빛이 걷히는 연출로 보여 준다.
    w.tint = { color: '#050818', alpha: 0.62 };
    byPlace('월출').forEach((s, i) => w.add(new E.Scroll(w.wx(16 + i * 6) + 16, w.wy(3), s.id)));
    w.trigger(6, 8, async (ww) => {
      ww.lockInput = true;
      await ww.note('잠깐 사이에 밤이 되어 바람과 물결이 잦아들었어요. 화자는 해 뜨는 곳 가까이에서 달이 뜨기를 기다려요.');
      for (let i = 0; i <= 90; i++) { ww.tint = { color: '#050818', alpha: U.lerp(0.62, 0.22, U.easeOut(i / 90)) }; await U.sleep(1 / 60); }
      G.audio.sfx('bell');
      ww.lockInput = false;
    });
    w.onScroll('', async () => {});
    w.trigger(40, 43, async (ww) => {
      if (ww.dreaming) return;
      ww.dreaming = true;
      ww.lockInput = true;
      await ww.game('소나무 뿌리를 베고 누워 볼까요…', 'jc', 'calm');
      await ww.fadeTo(1.0);
      ww.bgZones = [{ x: 0, bg: 'bg_heaven' }];
      ww.sun = null; ww.tint = { color: '#2a1850', alpha: 0.18 }; ww.fog = 1;
      ww.decoBack = ww.decoBack.filter((d) => d.name !== 'pavilion');
      G.audio.play('dream');
      const sage = ww.add(new E.Sprite('npcs', 'sage', ww.wx(47), ww.wy(3) + 2, { z: 5, flip: false }));
      await U.sleep(0.8);
      await ww.game('(꿈속에서 한 사람이 다가와 말을 건다)', 'sys');
      for (const s of byPlace('꿈1')) await readScroll(s, ww);
      for (const s of byPlace('꿈2')) await readScroll(s, ww);
      await EN.choice(ww, sage);
    });
  };

  EN.choice = async function (w, sage) {
    while (true) {
      const i = await G.ui.choice('신선의 술을 마시니 겨드랑이에 날개가 돋는 듯해요. 화자라면 이제 어떻게 할까요?',
        ['이 술을 온 세상 사람들과 나눈 뒤에 다시 만나자고 한다', '신선을 따라 학을 타고 하늘나라로 떠난다'],
        { tag: '<span class="tag game">🎮 선택</span><span class="tag note">결사의 갈림목</span>' });
      if (i === 1) {
        // 만약에 엔딩(虛)
        G.save.data.sawWhatif = true; G.save.write();
        await w.fadeTo(0.8);
        w.player.dead = true;
        sage.anim = 'sagecrane'; sage.vx = 40; sage.vy = -30;
        const me = w.add(new E.Sprite('hero', 'glide', w.wx(44), w.wy(4), { z: 12, vx: 40, vy: -34 }));
        w.tint = { color: '#0a0a18', alpha: 0.35 };
        await U.sleep(2.2);
        await G.ui.fiction(window.GD.fiction.whatif);
        await w.fadeTo(0.8);
        me.dead = true; sage.anim = 'sage'; sage.vx = sage.vy = 0; sage.x = w.wx(47); sage.y = w.wy(3) + 2;
        w.player.dead = false; w.ents.includes(w.player) || w.ents.push(w.player);
        w.tint = { color: '#2a1850', alpha: 0.18 };
        await w.game('다시 결사의 갈림목으로 돌아왔어요. 원문의 화자는 어떤 선택을 했을까요?', 'sys');
        continue;
      }
      G.audio.sfx('correct'); FX.flash('#fff3c4', 0.3);
      for (const s of byPlace('꿈3')) await readScroll(s, w);
      await w.fictionOnce('flight');
      await G.scenes.fade(0.8);
      G.scenes.go(new G.LevelScene('EF'));
      return;
    }
  };

  // ---------------------------------------------------------------- 술빛 나누기 비행
  class Flyer {
    constructor(x, y) { this.x = x; this.y = y; this.w = 20; this.h = 30; this.vy = 0; this.facing = 1; this.t = 0; this.cd = 0; this.z = 12; this.hp = 3; this.maxHp = 3; this.mode = 'immortal'; }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get feet() { return this.y + this.h; }
    setMode() {}
    respawn() {}
    update(dt, w) {
      this.t += dt; this.cd -= dt;
      if (w.lockInput) return;
      this.x += 105 * dt;
      const up = G.input.down('jump') || G.input.down('up');
      const down = G.input.down('down');
      this.vy += (up ? -520 : down ? 380 : 140) * dt;
      this.vy = U.clamp(this.vy, -150, 150);
      this.y = U.clamp(this.y + this.vy * dt, 40, w.wy(5));
      if ((G.input.pressed('attack') || G.input.pressed('cast')) && this.cd <= 0) {
        this.cd = 0.3;
        w.add(new Drop(this.cx, this.y + this.h));
        G.audio.sfx('ink');
      }
      if (Math.random() < dt * 5) FX.burst(this.cx - 10, this.cy, 'feather', 1, { max: 30 });
      if (this.x > w.wx(142) && !w.ended) { w.ended = true; w.run(EN.afterFlight); }
    }
    draw(ctx) { A.frame(ctx, 'hero', 'glide', this.t, this.cx, this.feet + 6, false); }
  }
  class Drop {
    constructor(x, y) { this.x = x - 4; this.y = y; this.w = 8; this.h = 8; this.vy = 60; this.z = 11; this.t = 0; }
    update(dt, w) {
      this.t += dt; this.vy += 500 * dt; this.y += this.vy * dt; this.x += 60 * dt;
      for (const e of w.ents) if (e instanceof Village && !e.lit && U.overlap(this, e)) { e.light(w); this.dead = true; return; }
      if (this.y > w.wy(2)) { this.dead = true; FX.burst(this.x, this.y, 'gold', 6, { angle: -Math.PI / 2, spread: 1, max: 60, g: 200 }); }
    }
    draw(ctx) { ctx.fillStyle = '#ffe7a0'; ctx.fillRect(Math.round(this.x), Math.round(this.y), 6, 8); ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(this.x) + 1, Math.round(this.y) + 1, 2, 3); }
  }
  class Village {
    constructor(x, y, n) { this.x = x; this.y = y - 44; this.w = n * 30 + 10; this.h = 44; this.n = n; this.lit = false; this.t = 0; this.z = 4; }
    light(w) {
      this.lit = true; w.lit = (w.lit || 0) + 1;
      G.audio.sfx('correct'); FX.stop(0.05); FX.burst(this.x + this.w / 2, this.y, 'gold', 24, { max: 160, g: 60 });
      G.ui.toast(`마을에 술빛이 번졌다! (${w.lit} / ${w.villages})`);
    }
    update(dt) { this.t += dt; }
    draw(ctx) {
      for (let i = 0; i < this.n; i++) {
        const x = this.x + 6 + i * 30, y = this.y + 14 + (i % 2) * 4;
        ctx.fillStyle = this.lit ? '#2b2436' : '#141220';
        ctx.fillRect(x + 3, y + 8, 22, 18);
        ctx.beginPath(); ctx.moveTo(x - 3, y + 10); ctx.quadraticCurveTo(x + 14, y - 6, x + 31, y + 10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = this.lit ? `rgba(255,${200 + Math.sin(this.t * 3 + i) * 20},120,1)` : '#24202e';
        ctx.fillRect(x + 8, y + 14, 5, 6); ctx.fillRect(x + 16, y + 14, 5, 6);
      }
      if (this.lit) {
        ctx.save(); ctx.globalAlpha = 0.18 + 0.05 * Math.sin(this.t * 2); ctx.fillStyle = '#ffd98a';
        ctx.beginPath(); ctx.ellipse(this.x + this.w / 2, this.y + 30, this.w * 0.7, 34, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
  }

  EN.buildFlight = function (w) {
    w.ground(0, 150, 2);
    const xs = [16, 28, 40, 52, 64, 77, 90, 103, 116, 129];
    w.villages = xs.length;
    xs.forEach((x, i) => w.add(new Village(w.wx(x), w.wy(2), 2 + (i % 3))));
    const sage = w.add(new E.Sprite('npcs', 'sagecrane', w.wx(9), w.wy(8), { z: 13, vx: 105, flip: false }));
    sage.update = function (dt) { this.t += dt; this.x += this.vx * dt; this.y = w.wy(8) + Math.sin(this.t * 1.5) * 10; };
    const f = w.player = new Flyer(w.wx(4), w.wy(7));
    w.add(f);
    w.start = { x: f.x, y: f.y };
    w.trigger(0, 8, async (ww) => {
      ww.lockInput = true;
      await ww.game('위(Space)로 떠오르고, 붓(J)을 누르면 술빛이 떨어져요. 어두운 마을마다 불을 밝혀 주세요!', 'sys');
      ww.lockInput = false;
    });
  };
  // 비행 레벨은 일반 주인공 대신 Flyer를 쓴다
  const origEnter = G.LevelScene.prototype.enter;
  G.LevelScene.prototype.enter = function () {
    if (this.id !== 'EF') return origEnter.call(this);
    const def = G.levels.EF;
    const w = this.world = new G.World(def);
    def.build(w);
    w.camSnap = true; w.updateCamera(0);
    G.audio.play(def.bgm);
    G.touchWanted = true; G.input.setTouchVisible(true);
    G.input.setTouchButton('attack', true, '술빛'); G.input.setTouchButton('cast', false); G.input.setTouchButton('mind', false);
  };
  EN.afterFlight = async function (w) {
    w.lockInput = true;
    G.save.data.flightLit = w.lit || 0; G.save.write();
    await w.game(`밝힌 마을 ${w.lit || 0} / ${w.villages}. 신선은 학을 타고 높은 하늘로 올라갔어요.`, 'sys');
    await G.scenes.fade(1.0);
    G.scenes.go(new WakeScene());
  };

  // ---------------------------------------------------------------- 깨어남: 명월이 천산만락에
  class WakeScene {
    enter() {
      this.t = 0; this.lightK = 0;
      G.audio.play('night');
      this.run();
    }
    async run() {
      await U.sleep(1.2);
      const wake = byPlace('깬');
      for (const s of (wake.length ? wake : endScrolls().slice(-1))) await readScroll(s, null);
      this.bright = true;
      await U.sleep(2.2);
      await G.ui.say({ who: 'note', type: 'note', text: '꿈에서 깨어 바다를 굽어보니 깊이를 알 수 없고, 밝은 달이 온 산과 마을에 비치지 않는 곳이 없어요.\n선정의 빛을 온 세상에 고루 펴겠다는 화자의 뜻이 달빛에 담겨 있어요. 신선이 되고 싶은 마음과 관리의 책임 사이 갈등은 이렇게 풀려요.' });
      const d = G.save.data;
      d.cleared.E = true; d.ending = 'true'; G.save.write();
      const sc = await G.ui.sortGame(window.GD.sorts[5]);
      d.chapterEnd = d.chapterEnd || {}; d.chapterEnd[5] = { sort: sc, sortTotal: window.GD.sorts[5].length, routeMiss: 0 };
      G.save.write();
      await G.scenes.fade(0.8);
      G.scenes.go(new G.ResultScene());
    }
    update(dt) { this.t += dt; if (this.bright) this.lightK = Math.min(1, this.lightK + dt * 0.5); }
    draw(ctx) {
      const im = A.bg('bg_moonsea');
      ctx.imageSmoothingEnabled = true;
      if (im) { const h = G.H * 1.1, w = im.width * h / im.height; ctx.drawImage(im, (G.W - w) / 2, -10, w, h); }
      ctx.fillStyle = `rgba(8,12,30,${0.45 - this.lightK * 0.3})`; ctx.fillRect(0, 0, G.W, G.H);
      // 온 산과 마을을 비추는 달빛
      if (this.lightK > 0) {
        ctx.save(); ctx.globalAlpha = this.lightK * 0.35;
        const g = ctx.createRadialGradient(G.W / 2, 60, 10, G.W / 2, 60, 520);
        g.addColorStop(0, '#fff6d8'); g.addColorStop(1, 'rgba(255,246,216,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, G.W, G.H); ctx.restore();
        for (let i = 0; i < 12; i++) {
          const x = 30 + i * 52, y = G.H - 40 - (i % 3) * 8;
          ctx.fillStyle = '#16131d'; ctx.fillRect(x, y, 24, 16);
          ctx.beginPath(); ctx.moveTo(x - 5, y + 2); ctx.quadraticCurveTo(x + 12, y - 12, x + 29, y + 2); ctx.fill();
          ctx.fillStyle = `rgba(255,214,140,${this.lightK})`; ctx.fillRect(x + 5, y + 6, 4, 5); ctx.fillRect(x + 14, y + 6, 4, 5);
        }
      }
      G.fx.drawScreen(ctx);
    }
  }
  G.WakeScene = WakeScene;

  // ---------------------------------------------------------------- 결과
  class ResultScene {
    enter() {
      this.t = 0;
      G.audio.play('title');
      const d = G.save.data, K = KB();
      const scrolls = K.scrolls || [];
      const gotS = scrolls.filter((s) => d.scrolls[s.id]).length;
      const qs = Object.entries(d.quiz);
      const first = qs.filter(([, v]) => v.ok).length;
      const qRatio = qs.length ? first / qs.length : 0;
      const sRatio = scrolls.length ? gotS / scrolls.length : 0;
      const score = sRatio * 0.4 + qRatio * 0.6;
      const grade = window.GD.grades.find((g) => score >= g.min);
      const people = (K.people || []);
      const gotP = people.filter((p) => d.people[p.id]).length;
      const sortSum = Object.values(d.chapterEnd || {}).reduce((a, c) => [a[0] + (c.sort || 0), a[1] + (c.sortTotal || 0)], [0, 0]);
      const mins = Math.round(d.playTime / 60);
      const wrong = qs.filter(([, v]) => !v.ok).map(([id]) => [...(K.quizzes || []), ...Object.values(K.bossQuiz || {}).flat(), ...(K.finalTest || [])].find((q) => q.id === id)).filter(Boolean);
      const today = new Date();
      const el = G.ui.add(`
        <div class="panel hanji result">
          <div style="display:flex;flex-direction:column;gap:calc(var(--u)*1.5);min-height:0;overflow-y:auto">
            <h2>여정을 마쳤어요</h2>
            <div class="stat"><span>📜 되찾은 두루마리</span><b>${gotS} / ${scrolls.length}</b></div>
            <div class="stat"><span>✍️ 문제 첫 시도 정답</span><b>${first} / ${qs.length} (${Math.round(qRatio * 100)}%)</b></div>
            <div class="stat"><span>🧑‍🏫 고사·인물 카드</span><b>${gotP} / ${people.length}</b></div>
            <div class="stat"><span>⚖️ 實/虛 분류</span><b>${sortSum[0]} / ${sortSum[1]}</b></div>
            <div class="stat"><span>🍶 밝힌 마을 · 먹 조각</span><b>${d.flightLit || 0}곳 · ${d.ink}개</b></div>
            <div class="stat"><span>⏱ 플레이 시간</span><b>${mins}분</b></div>
            <div style="font-family:var(--serif);font-weight:700;font-size:calc(var(--u)*10);margin-top:calc(var(--u)*4)">화자의 마음 여정</div>
            <div class="graph"></div>
            <div style="display:flex;gap:calc(var(--u)*5);flex-wrap:wrap;margin-top:auto">
              <button class="btn" data-a="wrong">오답 노트 (${wrong.length})</button>
              <button class="btn ghost" data-a="book">편람</button>
              <button class="btn ghost" data-a="map">월드맵</button>
              <button class="btn ghost" data-a="title">타이틀</button>
            </div>
          </div>
          <div class="cert">
            <div class="seal" style="position:absolute;right:calc(var(--u)*12);top:calc(var(--u)*12);width:calc(var(--u)*34);height:calc(var(--u)*34);font-size:calc(var(--u)*11);line-height:1.1">關東<br>別曲</div>
            <div class="t">완 주 증</div>
            <div style="font-size:calc(var(--u)*9);margin-top:calc(var(--u)*8);color:#6b5a40">이름을 적고 화면을 캡처해 제출하세요</div>
            <input maxlength="20" placeholder="이름" value="${esc(d.name || '')}">
            <div style="font-family:var(--serif);font-size:calc(var(--u)*10.5);line-height:1.8;margin-top:calc(var(--u)*6)">
              위 사람은 송강 정철과 함께 관동 팔백 리를 걸으며<br>「관동별곡」의 시구를 되찾았기에 이 증서를 드립니다.</div>
            <div style="margin-top:calc(var(--u)*12);font-family:var(--serif);font-size:calc(var(--u)*9)">등급</div>
            <div style="font-family:var(--serif);font-weight:900;font-size:calc(var(--u)*17);color:var(--seal-dark)">${esc(grade.name)}</div>
            <div style="font-size:calc(var(--u)*9);margin-top:calc(var(--u)*4);line-height:1.5">${esc(grade.desc)}</div>
            <div style="font-size:calc(var(--u)*8.5);margin-top:calc(var(--u)*10);color:#6b5a40">${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}. · 두루마리 ${gotS}/${scrolls.length} · 정답률 ${Math.round(qRatio * 100)}%${d.sawWhatif ? ' · 만약에 엔딩도 봄' : ''}</div>
          </div>
        </div>`, 'overlay');
      el.querySelector('.graph').innerHTML = EN.mindGraph();
      el.querySelector('input').addEventListener('input', (e) => { d.name = e.target.value; G.save.write(); });
      el.addEventListener('click', async (e) => {
        const a = e.target.dataset.a; if (!a) return;
        G.audio.sfx('confirm');
        if (a === 'wrong') await EN.wrongNote(wrong);
        if (a === 'book') await G.ui.book();
        if (a === 'map') G.scenes.go(new G.MapScene());
        if (a === 'title') G.scenes.go(new G.TitleScene());
      });
    }
    update(dt) { this.t += dt; }
    draw(ctx) { G.drawMap(ctx, this.t, {}); ctx.fillStyle = 'rgba(10,8,6,.35)'; ctx.fillRect(0, 0, G.W, G.H); }
  }
  G.ResultScene = ResultScene;

  // 화자의 마음 그래프(SVG): 위 = 신선의 마음, 아래 = 관리의 마음
  EN.mindGraph = function () {
    const d = G.save.data;
    const pts = (KB().scrolls || []).filter((s) => typeof s.mindValue === 'number');
    if (!pts.length) return '';
    const W = 300, H = 74, pad = 16;
    const x = (i) => pad + (i * (W - pad * 2)) / Math.max(1, pts.length - 1);
    const y = (v) => H / 2 - (v * (H / 2 - 12)) / 2;
    const path = pts.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.mindValue).toFixed(1)}`).join(' ');
    const dots = pts.map((s, i) => {
      const got = d.mind[s.id];
      const c = s.mind === 'conflict' ? '#b3261e' : s.mindValue > 0 ? '#2a86b5' : s.mindValue < 0 ? '#b8860b' : '#6b5a40';
      return `<circle cx="${x(i).toFixed(1)}" cy="${y(s.mindValue).toFixed(1)}" r="${s.mind === 'conflict' ? 3.4 : 2.4}" fill="${got ? c : '#f3ead4'}" stroke="${c}" stroke-width="1.2"><title>${esc(s.place)}: ${s.mind === 'official' ? '관리의 마음' : s.mind === 'immortal' ? '신선의 마음' : s.mind === 'conflict' ? '두 마음의 갈등' : '여정·풍경'}</title></circle>`;
    }).join('');
    const conflictIdx = pts.findIndex((s) => s.mind === 'conflict' && (s.place || '').includes('죽서'));
    const lastIdx = pts.length - 1;
    return `<svg viewBox="0 0 ${W} ${H + 14}" style="width:100%;height:auto;display:block">
      <rect x="0" y="0" width="${W}" height="${H}" fill="rgba(60,45,30,.06)" rx="4"/>
      <line x1="${pad}" x2="${W - pad}" y1="${H / 2}" y2="${H / 2}" stroke="rgba(60,45,30,.3)" stroke-dasharray="2 3"/>
      <text x="4" y="10" font-size="7.5" fill="#2a86b5">▲ 신선의 마음(풍류·탈속)</text>
      <text x="4" y="${H - 3}" font-size="7.5" fill="#b8860b">▼ 관리의 마음(연군·애민·우국)</text>
      <path d="${path}" fill="none" stroke="rgba(40,30,20,.65)" stroke-width="1.2"/>
      ${dots}
      ${conflictIdx >= 0 ? `<text x="${x(conflictIdx) - 4}" y="${y(pts[conflictIdx].mindValue) - 6}" font-size="7" text-anchor="end" fill="#b3261e">죽서루: 갈등 절정 ▸</text>` : ''}
      <text x="${W - 2}" y="${H + 10}" font-size="7" text-anchor="end" fill="#3b3328">결사: 선정 의지로 해소 ▸</text>
    </svg><div style="font-size:calc(var(--u)*7.5);color:#6b5a40">색이 찬 점 = '마음 읽기'를 맞힌 곳 · 값은 교과서 해석을 따른 대략의 위치예요</div>`;
  };

  EN.wrongNote = function (list) {
    return new Promise((resolve) => {
      const items = list.length ? list.map((q) => `<div class="entry"><h4><span class="tag orig">${esc(q.type || '문제')}</span>${esc(G.ui.yet(q.q))}</h4>
        <div>정답: <b class="yet">${esc(G.ui.yet(q.choices[q.answer]))}</b></div><div class="mut">${esc(G.ui.yet(q.explain || ''))}</div></div>`).join('') : '<div class="entry">틀린 문제가 없어요! 🎉</div>';
      const el = G.ui.add(`<div class="panel hanji book"><div class="tabs"><button class="on">오답 노트</button><button class="x btn" data-x="1">닫기 ✕</button></div><div class="content">${items}</div></div>`, 'overlay');
      const done = () => { close(); resolve(); };
      el.querySelector('[data-x]').addEventListener('click', done);
      const close = G.ui.modal(el, (a) => { if (a === 'pause' || a === 'ok') done(); return true; });
    });
  };
})();
