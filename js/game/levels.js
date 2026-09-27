'use strict';
// 레벨 설계: 원문의 장소 순서 그대로. 좌표는 타일(32px) 단위, 높이는 '바닥에서 몇 칸'.
// 두루마리는 js/data/text.js의 scroll.level·place를 보고 자동으로 놓는다(원문 쪼개기가 바뀌어도 레벨은 그대로).
(function () {
  const U = G.util, E = G.E, TS = G.TS, FX = G.fx;
  const KB = () => window.KB || {};
  const GD = () => window.GD;
  const W = G.World.prototype;

  // ---------------------------------------------------------------- 레벨 공용 도구
  W.scrollsAt = function (key) {
    return (KB().scrolls || []).filter((s) => s.level === this.id && (!key || (s.place || '').includes(key)));
  };
  // key에 해당하는 두루마리를 spots 위치에 차례로 놓는다. 자리가 모자라면 마지막 자리 오른쪽으로 이어 놓는다.
  W.putScrolls = function (key, spots) {
    this.placed = this.placed || new Set();
    const list = this.scrollsAt(key).filter((s) => !this.placed.has(s.id));
    list.forEach((s, i) => {
      const k = Math.min(i, spots.length - 1), extra = i - k;
      const [x, h] = spots[k];
      this.add(new E.Scroll(this.wx(x + extra * 2.5) + 16, this.wy(h), s.id));
      this.placed.add(s.id);
    });
    return list;
  };
  // 어느 자리에도 배정되지 않은 이 레벨의 두루마리는 출구 앞에 모아 둔다(원문 누락 방지)
  W.putLeftovers = function (x, h) {
    const rest = this.scrollsAt().filter((s) => !(this.placed && this.placed.has(s.id)));
    rest.forEach((s, i) => this.add(new E.Scroll(this.wx(x - rest.length * 2 + i * 2) + 16, this.wy(h), s.id)));
  };
  W.onScroll = function (key, fn) { (this.scrollHooks = this.scrollHooks || []).push({ key, fn }); };
  W.say = function (who, text, type, mood) { return G.ui.say({ who, text, type, mood }); };
  W.note = function (text) { return G.ui.say({ who: 'note', text, type: 'note' }); };
  W.game = function (text, who = 'sys', mood) { return G.ui.say({ who, text, type: 'game', mood }); };
  W.fictionOnce = async function (key) {
    const f = GD().fiction[key];
    if (!f) return;
    const seen = G.save.data.seen;
    if (seen[key]) { G.ui.toast('게임 설정 · ' + (f.name || f.title), 'game'); return; }
    seen[key] = true; G.save.write();
    await G.ui.fiction(f);
  };
  W.unlock = function (k) { G.save.data.unlock[k] = true; G.save.write(); G.hud && G.hud.pulse(); };
  W.blob = function (x, h, opt) { return this.add(new E.Blob(this.wx(x) + 16, this.wy(h), opt)); };
  W.ink = function (x, h, n = 1, dx = 1) { for (let i = 0; i < n; i++) this.add(new E.Ink(this.wx(x + i * dx) + 16, this.wy(h) - 6)); };
  W.sign = function (x, h, place, opt) { return this.add(new E.Sign(this.wx(x) + 16, this.wy(h), place, opt)); };
  W.lbl = function (x, h, text, opt) { return this.add(new E.Label(this.wx(x), this.wy(h), text, opt)); };
  W.start = null;
  W.setStart = function (x, h) { this.start = { x: this.wx(x) + 16, y: this.wy(h) }; this.checkpoint = { ...this.start }; };
  // 이정표 없이 되살아날 자리만 바꾼다(어려운 구간 바로 앞)
  W.savePoint = function (x, h) { this.trigger(x, x + 2, (ww) => { ww.checkpoint = { x: ww.wx(x) + 16, y: ww.wy(h) }; }, { cond: (ww) => Math.abs(ww.player.feet - ww.wy(h)) < TS * 2 }); };
  W.finish = function () { if (!this.done) { this.done = true; G.audio.sfx('bell'); } };
  W.fadeTo = function (sec = 0.6) { return G.scenes.fade(sec); };
  W.panTo = async function (x, y, sec) { this.camTarget = { x, y }; await U.sleep(sec); };
  W.panBack = function () { this.camTarget = null; };
  W.onFirst = function (kind) {
    if (kind === 'enemy' && !this.firstEnemy) { this.firstEnemy = true; }
  };

  // 두루마리를 주웠을 때: 원문 카드 → 인물 카드 → 문제 1개(마음 읽기 우선)
  W.collectScroll = async function (id) {
    const s = (KB().scrolls || []).find((x) => x.id === id);
    if (!s) return;
    this.lockInput = true;
    const d = G.save.data;
    d.scrolls[id] = true; G.save.write();
    FX.stop(0.08); FX.burst(this.player.cx, this.player.cy - 10, 'spark', 22, { max: 160 });
    await G.ui.scroll(s);
    for (const p of KB().people || []) {
      if (p.scroll === id && !d.people[p.id]) { d.people[p.id] = true; G.save.write(); G.ui.toast('인물 카드를 얻었다: ' + p.name); }
    }
    const qs = (KB().quizzes || []).filter((q) => q.scroll === id);
    const q = qs.find((x) => x.type === 'mind') || qs[0];
    if (q) {
      const ok = await G.ui.quiz(q, { sub: s.place });
      if (q.type === 'mind' && ok) { d.mind[id] = true; G.save.write(); }
    }
    for (const h of this.scrollHooks || []) if ((s.place || '').includes(h.key)) await h.fn(this, s);
    this.lockInput = false;
  };

  const L = G.levels = {};
  const def = (id, o) => { L[id] = Object.assign({ id }, o); };

  // ================================================================ 서장: 죽림에서 궁궐로
  def('P1', {
    name: '죽림에서 궁궐로', chapter: 0, w: 124, h: 12, bg: 'bg_bamboo', bgm: 'title', skin: 'grass', sky: '#e8e4d6',
    build(w) {
      w.ground(0, 124, 3);
      w.clear(21, 23, 0, 3).hazard(21, 23, 2);
      w.block(27, 4, 4, 1); w.block(31, 5, 3, 2);
      w.clear(36, 39, 0, 3).hazard(36, 39, 2); w.plat(37, 5, 1);
      w.block(44, 4, 5, 1);
      w.clear(52, 54, 0, 3).hazard(52, 54, 2);
      for (let x = 2; x < 60; x += 5 + (x % 3)) w.deco('bamboo', x + 0.5, 3, { scale: 0.9 + (x % 4) * 0.08 });
      w.deco('boulder', 25, 3); w.deco('pine', 58, 3);
      w.bgAt(64, 'bg_palace');
      w.deco('gate', 76, 3);
      w.lbl(76, 9.2, '연추문(延秋門) · 경복궁 서문', { size: 9 });
      w.setStart(3, 3);
      w.sign(6, 3, '창평', { now: '전라남도 담양군 창평면' });
      w.putScrolls('창평', [[12, 3]]);
      w.putScrolls('연추문', [[84, 3]]);
      w.putScrolls('경회', [[86, 3]]);
      w.sign(64, 3, '한양');
      w.ink(28, 4, 3); w.ink(45, 4, 4); w.ink(58, 3, 3);
      w.trigger(0, 4, async (ww) => {
        ww.lockInput = true;
        await ww.fictionOnce('premise');
        await ww.game(G.input.isTouch ? '창평의 대숲이에요. ◀ ▶ 버튼으로 걷고 점프 버튼으로 뛰어요.\n반짝이는 두루마리를 주우면 원문을 읽을 수 있어요.' : '창평의 대숲이에요. ←→ 로 걷고 ↑(또는 Space)로 뛰어요.\n반짝이는 두루마리를 주우면 원문을 읽을 수 있어요.');
        ww.lockInput = false;
      });
      w.onScroll('창평', async (ww) => { await ww.note('자연을 사랑하는 병이 깊어 대숲에 묻혀 지내던 화자에게, 임금이 관동 팔백 리를 맡겼어요. 서울로 올라가 임금께 인사를 드려야 해요.'); });
      w.onScroll('연추문', async (ww) => {
        if (G.save.data.unlock.okjeol && G.save.data.seen.okjeol) return;   // 장 고르기로 먼저 열렸어도 안내는 한 번 본다
        ww.unlock('okjeol');
        G.audio.sfx('cast'); FX.flash('#fff3c4', 0.3);
        await ww.fictionOnce('okjeol');
        await ww.game('이제 붓{attack}으로 싸울 수 있어요. 앞에 수상한 먹물이 보여요!', 'jc', 'resolve');
      });
      w.trigger(92, 94, async (ww) => { await ww.fictionOnce('blob'); });
      // 옥절을 얻기 전(연추문 앞)까지 내려오지 않도록 제자리 근처만 오간다
      w.blob(98, 3, { range: 3 }); w.blob(104, 3, { dir: 1, range: 3 }); w.blob(110, 3, { range: 3 });
      w.putLeftovers(114, 3);
      w.add(new E.Exit(w.wx(119), w.wy(3)));
    },
  });

  // ================================================================ 1장-A: 말 달리기
  def('1A', {
    name: '부임길 (말 달리기)', chapter: 1, w: 210, h: 12, bg: 'bg_road', bgm: 'journey', skin: 'grass', runner: true, runSpeed: 235, parallax: 0.3,
    build(w) {
      w.ground(0, 210, 3);
      const rocks = [18, 30, 44, 71, 83, 112, 126, 150, 163, 178];
      for (const x of rocks) { w.block(x, 4, 1, 1, 'granite'); }
      for (const [a, b] of [[36, 38], [60, 63], [95, 97], [118, 121], [140, 142], [170, 173]]) w.clear(a, b, 0, 3).hazard(a, b, 2);
      for (let x = 10; x < 200; x += 7) w.ink(x, 4 + (x % 3), 1);
      w.setStart(3, 3);
      w.sign(8, 3, '평구역'); w.sign(55, 3, '흑수'); w.sign(100, 3, '섬강'); w.sign(146, 3, '치악');
      w.trigger(0, 5, async (ww) => { ww.lockInput = true; await ww.fictionOnce('horse'); ww.lockInput = false; });   // 시작 자리(3칸)를 덮어야 켜진다
      w.putScrolls('평구', [[66, 3]]);
      w.putScrolls('섬강', [[156, 3]]);
      w.putLeftovers(192, 3);
      w.add(new E.Exit(w.wx(203), w.wy(3)));
    },
    setup(w) { w.player.horse = true; },
  });

  // ================================================================ 1장-B: 소양강~회양
  def('1B', {
    name: '소양강에서 회양까지', chapter: 1, w: 166, h: 14, bg: 'bg_road', bgm: 'journey', skin: 'grass',
    build(w) {
      w.ground(0, 12, 3);
      w.hazard(12, 40, 2);
      for (const [x, h] of [[14, 3], [18, 4], [22, 3], [26, 4], [30, 5], [34, 4], [37, 3]]) w.block(x, h, 2, h);
      w.ground(40, 166, 3);
      w.sign(4, 3, '소양강');
      w.putScrolls('소양', [[8, 3]]);
      w.blob(46, 3); w.blob(52, 3, { dir: 1 });
      // 북관정 언덕
      w.block(58, 4, 3, 1); w.block(61, 5, 3, 2); w.block(64, 6, 3, 3); w.block(67, 7, 8, 4); w.block(75, 5, 3, 2); w.block(78, 4, 2, 1);
      w.deco('pavilion', 71, 7);
      w.sign(57, 3, '동주 북관정');
      w.putScrolls('북관', [[70, 7]]);
      w.putScrolls('동주', [[72, 7]]);
      // 궁왕 대궐 터
      w.bgAt(88, 'bg_ruins');
      w.sign(89, 3, '궁왕 대궐 터');
      w.deco('ruins', 98, 3); w.deco('ruins', 112, 3, { flip: true });
      w.plat(104, 5, 4, 'plank'); w.plat(109, 7, 4, 'plank');
      w.putScrolls('궁', [[111, 7]]);
      w.trigger(92, 94, async (ww) => {
        ww.lockInput = true;
        for (let i = 0; i < 4; i++) ww.add(new E.Bird(ww.wx(106 + i * 3), ww.wy(7 + (i % 2) * 2), i % 2 ? 'magpie' : 'crow', { dir: -1, speed: 70 }));
        await ww.fictionOnce('crows');
        ww.lockInput = false;
      });
      w.sign(128, 3, '회양');
      w.putScrolls('회양', [[138, 3]]);
      w.ink(44, 4, 4); w.ink(120, 4, 5);
      w.add(new E.Heart(w.wx(84) + 16, w.wy(3)));
      w.putLeftovers(150, 3);
      w.setStart(2, 3);
      w.add(new E.Exit(w.wx(160), w.wy(3)));
    },
  });

  // ================================================================ 2장-A: 만폭동·금강대 (위로 오르는 레벨)
  def('2A', {
    name: '만폭동과 금강대', chapter: 2, w: 44, h: 46, bg: 'bg_waterfall', bgm: 'mountain', skin: 'granite', weather: 'spray', parallax: 0.1, fog: 0.8,
    build(w) {
      w.ground(0, 26, 2);
      w.hazard(26, 44, 1);
      w.block(26, 2, 1, 2);
      // 폭포 물줄기(아래로 떠밀린다)
      w.add(new E.Current(w.wx(21), 0, 60, w.h * TS));
      w.add(new E.Current(w.wx(29), 0, 90, w.h * TS));
      // 지그재그 발판: 학의 깃(2단 점프)은 꼭대기 금강대에서 얻으므로 한 번 점프(최대 약 2.6칸)로 오르도록
      // 층마다 2칸씩 높이고, 옆 발판과는 붙이거나 1칸만 띄운다. 금강대 바위(x 0~13, 높이 40~42) 밑은 피한다.
      const plats = [[3, 4], [8, 6], [13, 8], [8, 10], [3, 12], [8, 14], [14, 16], [9, 18], [4, 20], [9, 22], [15, 24], [10, 26], [4, 28], [9, 30], [14, 32], [9, 34], [14, 36], [15, 38], [14, 40]];
      for (const [x, h] of plats) w.plat(x, h, 5, 'plank');
      // 금강대(꼭대기 바위 마당)
      w.block(0, 42, 14, 2);
      w.deco('pine', 2, 42, { scale: 0.8 });
      w.sign(2, 2, '만폭동');
      w.sign(4, 42, '금강대');
      w.putScrolls('만폭', [[6, 2], [11, 22]]);
      w.putScrolls('금강대', [[10, 42]]);
      w.blob(5, 12, { range: 1.5 }); w.blob(12, 26, { range: 1.5 });
      w.ink(14, 8, 3); w.ink(5, 20, 3); w.ink(10, 30, 3);
      // 오른쪽 벼랑 너머 출구(활공해야 닿는다)
      w.block(36, 33, 8, 33);
      w.setStart(3, 2);
      w.add(new E.Exit(w.wx(41), w.wy(33)));
      // 폭포 소리: 가끔 우레처럼
      w.thunderT = 3;
      w.tick = (ww, dt) => { ww.thunderT -= dt; if (ww.thunderT <= 0) { ww.thunderT = U.rand(5, 9); G.audio.sfx('thunder'); FX.shake(1.5, 0.4); } };
      w.onScroll('만폭', async (ww, s) => {
        if (ww.saidRoar) return;
        ww.saidRoar = true;
        await ww.note('귀로 들을 때는 우레 소리 같더니, 눈으로 보니 쏟아지는 눈 같다고 했어요. 소리(청각)를 먼저, 모습(시각)을 나중에 그려 폭포의 기세를 살렸어요.');
      });
      w.onScroll('금강대', async (ww) => {
        if (G.save.data.unlock.feather && G.save.data.seen.feather) return;
        ww.lockInput = true;
        const crane = ww.add(new E.Sprite('npcs', 'crane', ww.wx(30), ww.wy(46), { z: 12, vx: -70, vy: 40 }));
        await U.sleep(1.6);
        crane.vx = 0; crane.vy = 0; crane.flip = false;
        FX.burst(ww.player.cx, ww.player.cy, 'feather', 30, { max: 160 });
        ww.unlock('feather');
        ww.helpFrom = ww.time;
        ww.player.setMode('immortal', true);
        await ww.fictionOnce('feather');
        await ww.game('오른쪽 벼랑 너머로 가야 해요. 신선의 마음{mind}으로 두 번 뛰고, 점프를 꾹 누르면 활공해요!', 'crane');
        crane.vx = 90; crane.vy = -50;
        ww.lockInput = false;
      });
    },
  });

  // ================================================================ 2장-B: 진헐대~비로봉
  def('2B', {
    name: '진헐대에서 비로봉까지', chapter: 2, w: 184, h: 24, bg: 'bg_peaks', bgm: 'mountain', skin: 'granite', fog: 0.9,
    build(w) {
      w.ground(0, 42, 3);
      w.block(10, 6, 6, 3);
      w.sign(3, 3, '진헐대');
      w.putScrolls('진헐', [[13, 6], [30, 3]]);
      w.trigger(6, 9, (ww) => { if (ww.player.mode !== 'immortal') G.ui.toast('높은 바위는 신선의 마음{mind}으로 바꿔 2단 점프!', 'game', 3.2); });
      w.blob(22, 3); w.blob(36, 3, { dir: 1 });
      // 음보 석판 + 낭떠러지
      w.hazard(42, 52, 1);
      w.ground(52, 184, 3);
      w.trigger(34, 36, async (ww) => { await ww.fictionOnce('tablet'); });
      const parts = G.meterLine('셧거든') || G.meterLine('날거든') || ['날거든', '뛰디 마나', '셧거든', '솟디 마나'];
      w.add(new E.Tablets(w.wx(33), w.wy(3) - 4, parts, async (ww) => {
        for (let x = 42; x < 52; x++) { ww.set(x, ww.h - 3, G.TILE.ONEWAY, 'plank'); FX.burst(ww.wx(x) + 16, ww.wy(3), 'dust', 3, { max: 60 }); await U.sleep(0.05); }
        G.ui.toast('4음보가 이어져 다리가 놓였다!');
      }));
      // 망고대·혈망봉: 하늘로 치솟은 봉우리
      w.sign(56, 3, '망고대·혈망봉');
      w.block(62, 5, 3, 2); w.block(66, 8, 2, 5); w.block(70, 15, 3, 12); w.block(75, 10, 2, 7);
      w.plat(63, 11, 2); w.plat(67, 13, 2);
      w.putScrolls('망고', [[71, 15]]);
      w.putScrolls('혈망', [[71.5, 15]]);
      w.blob(80, 3); w.blob(88, 3);
      // 개심대
      w.sign(98, 3, '개심대');
      w.block(104, 5, 10, 2);
      w.putScrolls('개심', [[108, 5], [120, 3]]);
      w.ink(100, 4, 5);
      // 비로봉: 계단으로 오르다 막힌다
      w.sign(130, 3, '비로봉');
      let hh = 4;
      for (let x = 136; x < 154; x += 3) { w.block(x, hh, 3, hh - 3); hh += 2; }
      w.block(154, 24, 16, 21);
      w.putScrolls('비로', [[149, 12]]);
      w.trigger(151, 154, async (ww) => {
        ww.lockInput = true;
        FX.shake(2, 0.3);
        await ww.fictionOnce('birobong');
        await ww.note('화자는 끝내 비로봉에 오르지 않고 발길을 돌려요. 이제 산을 내려가요.');
        await ww.fadeTo(0.6);
        ww.player.x = ww.wx(174); ww.player.y = ww.wy(3) - ww.player.h; ww.player.vx = 0; ww.camSnap = true;
        ww.checkpoint = { x: ww.wx(174), y: ww.wy(3) };
        ww.lockInput = false;
      }, { cond: (ww) => ww.player.feet <= ww.wy(14) + 2 });
      w.putLeftovers(178, 3);
      w.setStart(2, 3);
      w.add(new E.Exit(w.wx(180), w.wy(3)));
    },
  });

  // ================================================================ 2장-C: 화룡소·불정대 (보스: 이백의 환영)
  def('2C', {
    name: '화룡소와 불정대', chapter: 2, w: 136, h: 16, bg: 'bg_dragonpool', bgm: 'mountain', skin: 'granite',
    build(w) {
      w.ground(0, 62, 3);
      w.sign(3, 3, '화룡소');
      const dragon = w.add(new E.Sprite('dragon', 'rest', w.wx(15), w.wy(3) + 34, { z: 1, scale: 0.8 }));
      w.water.push({ x0: 10, x1: 21, h: 3.3, deco: true });
      w.add(new E.Altar(w.wx(7) + 16, w.wy(3), async (ww) => {
        ww.lockInput = true;
        dragon.anim = 'rain';
        G.audio.sfx('thunder'); FX.shake(3, 0.5); FX.flash('#ffffff', 0.2);
        await U.sleep(0.6);
        ww.weather = 'bigrain'; G.audio.sfx('rain');
        await U.sleep(1.2);
        for (const g of ww.deadGrass) { g.name = 'grass_live'; FX.burst(g.x, g.y - 10, 'leaf', 8, { max: 90, g: 200 }); }
        for (const [x, h, n] of ww.vines) for (let i = 0; i < n; i++) ww.set(x + i, ww.h - h, G.TILE.ONEWAY, 'none');
        G.audio.sfx('pickup');
        await U.sleep(0.8);
        await ww.fictionOnce('rain');
        ww.weather = 'rain';
        await ww.game('시든 풀이 살아났어요! 풀잎을 밟고 벼랑을 올라가요.', 'jc', 'awe');
        ww.lockInput = false;
      }));
      // 그늘진 벼랑(음애)과 시든 풀
      w.block(24, 14, 8, 11);
      w.vines = [[21, 5, 3], [21, 7, 3], [21, 9, 3], [21, 11, 3], [22, 13, 2]];   // 2칸 간격: 관리의 마음으로도 오른다
      w.deadGrass = [];
      for (const [x, h, n] of w.vines) for (let i = 0; i < n; i++) w.deadGrass.push(w.add(new E.Prop('grass_dead', w.wx(x + i) + 16, w.wy(h) + 6, { z: 2 })));
      w.trigger(9, 11, async (ww) => {
        if (G.save.data.unlock.okjeol && !ww.deadGrass[0].name.includes('live')) {
          await ww.game('못 속에 늙은 용이 서려 있어요. 제단 앞에서 관리의 마음으로 옥절{cast}을 들어 볼까요?', 'jc', 'awe');
        }
      });
      w.putScrolls('화룡', [[28, 14]]);
      w.blob(40, 3); w.blob(48, 3, { dir: 1 });
      // 외나무다리
      w.bgAt(66, 'bg_cliff');
      w.hazard(62, 98, 1);
      w.savePoint(58, 3);
      w.plat(62, 4, 36, 'plank');
      w.add(new E.Bird(w.wx(80), w.wy(7), 'crow', { dir: -1, speed: 60 }));
      w.blob(74, 4, { range: 3 }); w.blob(88, 4, { range: 3 });
      w.ground(98, 136, 3);
      w.sign(99, 3, '불정대');
      w.putScrolls('불정', [[104, 3]]);
      // 보스 경기장
      w.arena = { x0: w.wx(106), x1: w.wx(126), top: w.wy(12), floor: w.wy(3) };
      w.plat(110, 6, 3); w.plat(117, 8, 3); w.plat(122, 6, 3);
      w.trigger(106, 108, async (ww) => {
        if (ww.bossDone) return;
        ww.lockInput = true;
        for (let r = 3; r < 16; r++) { ww.set(105, ww.h - 1 - r, G.TILE.SOLID, 'none'); ww.set(126, ww.h - 1 - r, G.TILE.SOLID, 'none'); }
        ww.camTarget = { x: (ww.arena.x0 + ww.arena.x1) / 2, y: ww.wy(3) - 130 };
        const boss = ww.boss = ww.add(new E.LiBai(ww.arena, {
          onWin: async (w2) => {
            w2.lockInput = true;
            await U.sleep(1.2);
            await w2.game('허허… 내가 졌소. 이 열두 굽이 폭포라면, 여산 폭포가 더 낫다는 말은 못 하겠구려.', 'libai');
            await w2.note('원문에서는 이백이 실제로 나타나지 않아요. "이백이 지금 있어 다시 따진다면"이라는 가정을 써서, 십이폭포가 여산 폭포보다 낫다고 예찬한 거예요.');
            boss.dead = true; w2.boss = null; w2.bossDone = true;
            for (let r = 3; r < 16; r++) w2.set(126, w2.h - 1 - r, G.TILE.EMPTY);
            w2.camTarget = null; G.audio.play('mountain');
            w2.lockInput = false;
          },
        }));
        G.audio.play('boss');
        await ww.fictionOnce('libai');
        await ww.game('여산 폭포를 노래한 이 이백 앞에서 폭포 자랑이라니! 시구로 겨뤄 봅시다.', 'libai');
        await ww.game('빈틈이 생기면(빛날 때) 붓{attack}으로 치세요. 시구 대결에서 이기면 반격해요!', 'sys');
        boss.phase = 'rain'; boss.pt = 0;
        ww.checkpoint = { x: ww.arena.x0 + 60, y: ww.wy(3) };
        ww.lockInput = false;
      });
      w.putLeftovers(128, 3);
      w.setStart(2, 3);
      w.add(new E.Exit(w.wx(131), w.wy(3), async (ww) => { if (ww.bossDone || !ww.boss) ww.finish(); }));
    },
  });

  // ================================================================ 3장-A: 산영루~삼일포
  def('3A', {
    name: '산영루에서 삼일포까지', chapter: 3, w: 204, h: 14, bg: 'bg_coast', bgm: 'sea', skin: 'sand', waterColor: 'rgba(46,112,140,.85)',
    build(w) {
      w.ground(0, 26, 3, 'grass');
      w.deco('nugak', 13, 3);
      w.sign(3, 3, '산영루');
      w.putScrolls('산영', [[20, 3]]);
      // 명사길·해당화, 백구
      w.ground(26, 84, 3, 'sand');
      w.sign(28, 3, '명사길');
      for (let x = 30; x < 82; x += 6) w.deco('rose', x + 1, 3, { scale: 0.9 });
      for (const x of [40, 47, 54, 61, 68, 75]) w.add(new E.Gull(w.wx(x) + 16, w.wy(3)));
      w.trigger(31, 33, async (ww) => { ww.lockInput = true; await ww.fictionOnce('gulls'); ww.lockInput = false; });
      w.putScrolls('명사', [[80, 3]]);
      w.putScrolls('해당', [[80.5, 3]]);
      // 총석정: 바다 위 돌기둥
      w.hazard(84, 132, 1);
      w.savePoint(81, 3);
      w.trigger(80, 83, (ww) => { if (ww.player.mode !== 'immortal') G.ui.toast('돌기둥 사이가 멀어요 · 신선의 마음{mind}으로 바꿔 2단 점프!', 'game', 3.2); });
      const pil = [[86, 5], [91, 7], [96, 6], [101, 8], [106, 6], [111, 5], [116, 7], [121, 6], [126, 5]];
      for (const [x, h] of pil) w.block(x, h, 2, h, 'granite');
      for (const [x, h] of pil) w.deco('pillar', x + 1, h, { scale: 0.55, dy: 2 });
      w.ground(132, 204, 3, 'grass');
      w.block(132, 6, 8, 3, 'granite');
      w.deco('pavilion', 136, 6, { scale: 0.8 });
      w.sign(133, 6, '총석정');
      w.putScrolls('총석', [[137, 6]]);
      w.putScrolls('금란', [[134, 6]]);
      w.add(new E.Bird(w.wx(100), w.wy(10), 'crow', { dir: -1, speed: 50 }));
      // 삼일포
      w.sign(146, 3, '삼일포');
      w.deco('danseo', 166, 3);
      w.water.push({ x0: 172, x1: 190, h: 3.4, deco: true });
      w.putScrolls('삼일', [[164, 3]]);
      w.putScrolls('고성', [[160, 3]]);
      w.blob(152, 3); w.blob(180, 3, { dir: 1 });
      w.ink(90, 9, 1); w.ink(101, 10, 1); w.ink(116, 9, 1); w.ink(150, 4, 4);
      w.putLeftovers(194, 3);
      w.setStart(2, 3);
      w.add(new E.Exit(w.wx(199), w.wy(3)));
    },
  });

  // ================================================================ 3장-B: 의상대 해돋이 (녈구름)
  def('3B', {
    name: '의상대 해돋이', chapter: 3, w: 40, h: 14, bg: 'bg_sunrise', bgm: 'night', skin: 'granite', tint: { color: '#0b1430', alpha: 0.72 }, weather: 'stars', parallax: 0.05, fog: 0.4,
    build(w) {
      w.ground(0, 40, 4);
      w.deco('pavilion', 7, 4, { scale: 0.8 });
      w.deco('pine', 36, 4, { scale: 0.9 });
      w.plat(12, 7, 3); w.plat(22, 8, 3); w.plat(30, 7, 3); w.plat(17, 10, 2); w.plat(26, 11, 2);
      w.sign(3, 4, '의상대');
      w.setStart(2, 4);
      const sun = w.sun = {
        get x() { return G.W / 2 + 40; }, y: w.wy(4) - 58, y0: w.wy(4) - 58, y1: w.wy(4) - 215, t: 0, dim: 0,
        drawSky(ctx, ww) {
          const sx = this.x - ww.cam.x * 0.05, sy = this.y - ww.cam.y;
          ctx.save();
          const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90);
          g.addColorStop(0, `rgba(255,120,60,${0.9 - this.dim * 0.5})`); g.addColorStop(1, 'rgba(255,120,60,0)');
          ctx.fillStyle = g; ctx.fillRect(sx - 90, sy - 90, 180, 180);
          ctx.fillStyle = `rgba(226,58,32,${1 - this.dim * 0.6})`;
          ctx.beginPath(); ctx.arc(sx, sy, 26, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        },
      };
      w.trigger(4, 6, async (ww) => {
        ww.lockInput = true;
        await ww.note('배꽃은 벌써 지고 접동새가 슬피 우는 늦봄, 화자는 해돋이를 보려고 한밤중에 의상대에 올라 앉았어요.');
        await ww.fictionOnce('clouds');
        ww.player.setMode('official', true); ww.forceMode = true;
        ww.lockInput = false;
        ww.sunEvent = { t: 0, spawned: 0, reached: 0 };
        G.audio.play('sea');
      });
      // 구름(E.Cloud)이 해에 닿으면 불린다. 인자는 구름이므로 세계는 바깥의 w를 쓴다.
      w.onCloudReach = () => { if (!w.sunEvent) return; w.sunEvent.reached++; w.sun.dim = Math.min(1, w.sun.dim + 0.25); G.audio.sfx('wrong'); G.ui.toast('녈구름이 해를 가렸다!', 'game'); };
      w.tick = (ww, dt) => {
        const ev = ww.sunEvent;
        if (!ev || ev.done) return;
        ev.t += dt;
        const k = Math.min(1, ev.t / 32);
        ww.sun.y = U.lerp(ww.sun.y0, ww.sun.y1, U.easeOut(k));
        ww.sun.dim = Math.max(0, ww.sun.dim - dt * 0.05);
        ww.tint = { color: '#0b1430', alpha: 0.72 * (1 - Math.min(1, k * 1.4)) };
        if (k > 0.3) ww.weather = null;
        if (ev.t > 2 && ev.spawned < 16 && ev.t > ev.spawned * 1.8 + 2) {
          ev.spawned++;
          const left = ev.spawned % 2;
          const cx = left ? ww.cam.x - 40 : ww.cam.x + G.W + 10;
          ww.add(new E.Cloud(cx, ww.wy(U.rand(6, 11)), { get x() { return ww.sun.x + ww.cam.x * 0.95; }, get y() { return ww.sun.y; } }, U.rand(30, 46)));
        }
        if (ev.t > 36 && !ww.ents.some((e) => e instanceof E.Cloud)) {
          ev.done = true;
          ww.forceMode = false;
          ww.run(async (w2) => {
            w2.lockInput = true;
            FX.flash('#ffe7c0', 0.4);
            G.ui.toast(ev.reached === 0 ? '해가 한 번도 가려지지 않았다!' : `해가 ${ev.reached}번 가려졌다`);
            await U.sleep(1);
            await w2.note('해가 바다에서 떠오를 때는 온 세상이 일렁이더니, 하늘 한가운데 솟으니 터럭도 셀 만큼 밝다고 했어요. 화자는 그 해 곁에 녈구름이 머물까 걱정해요.');
            w2.lockInput = false;
            w2.putScrolls('의상', [[20, 4]]);
            w2.putScrolls('낙산', [[21, 4]]);
            w2.putLeftovers(24, 4);
            w2.add(new E.Exit(w2.wx(37), w2.wy(4)));
          });
        }
      };
    },
  });

  // ================================================================ 3장-C: 경포~죽서루 (갈림길)
  def('3C', {
    name: '경포에서 죽서루까지', chapter: 3, w: 196, h: 16, bg: 'bg_lake', bgm: 'sea', skin: 'sand',
    build(w) {
      w.ground(0, 14, 3);
      w.sign(3, 3, '경포');
      w.hazard(14, 60, 2);
      w.add(new E.Boat(w.wx(14.5), w.wx(57), w.wy(2) + 8));
      w.ground(60, 102, 3, 'grass');
      w.block(62, 5, 8, 2, 'grass');
      w.deco('pavilion', 66, 5, { scale: 0.75 });
      w.putScrolls('경포', [[10, 3], [67, 5]]);
      w.trigger(12, 14, async (ww) => { await ww.game('거울 같은 호수예요. 배에 올라타면 건너편 정자로 가요.', 'jc', 'awe'); });
      // 강릉
      w.sign(78, 3, '강릉');
      w.deco('gate', 88, 3, { scale: 0.55 });
      w.lbl(88, 7.4, '정문(旌門)', { size: 9 });
      w.putScrolls('강릉', [[94, 3]]);
      // 죽서루
      w.bgAt(104, 'bg_river');
      w.ground(102, 196, 3, 'grass');
      w.sign(106, 3, '죽서루');
      w.block(112, 7, 12, 4, 'granite');
      w.plat(109, 5, 3);   // 누각(높이 7)으로 오르는 디딤판: 관리의 마음으로도 오른다
      w.deco('nugak', 118, 7, { scale: 0.9 });
      w.putScrolls('죽서', [[117, 7]]);
      w.putScrolls('진주', [[114, 7]]);
      // 갈림길: 위는 구름길(신선), 아래는 물길(연군)
      for (const [x, h] of [[126, 9], [131, 11], [136, 12], [142, 11], [147, 9]]) w.plat(x, h, 4, 'cloud');
      // 아래 물길: 땅을 파내 물을 채우고, 2칸 간격 징검돌을 놓는다(관리의 마음으로도 건넌다)
      w.clear(128, 149, 0, 3).hazard(128, 149, 2);
      for (const x of [129, 133, 137, 141, 145]) w.block(x, 3, 2, 3, 'granite');
      w.lbl(137, 14.2, '두우(斗牛)로 가는 신선의 길', { size: 9, bg: 'rgba(6,36,40,.9)', color: '#bff7f0', edge: '#22c3b5' });
      w.lbl(137, 4.6, '한강 목멱으로 흐르는 물길', { size: 9, bg: 'rgba(6,36,40,.9)', color: '#bff7f0', edge: '#22c3b5' });
      w.trigger(123, 125, async (ww) => { ww.lockInput = true; await ww.fictionOnce('crossroads'); ww.lockInput = false; });
      w.trigger(135, 139, async (ww) => { await ww.note('신선의 배를 띄워 두우(견우성과 북두성 쪽)로 향해 볼까, 선인을 찾아 단혈에 머물러 볼까… 신선 세계를 향한 마음이에요.'); }, { cond: (ww) => ww.player.feet < ww.wy(8) });
      w.trigger(135, 139, async (ww) => { await ww.note('오십천 물이 태백산 그림자를 동해로 담아 가니, 차라리 한강의 목멱(남산)에 닿게 하고 싶다… 임금 계신 서울을 그리는 마음(연군)이에요.'); }, { cond: (ww) => ww.player.feet >= ww.wy(8) });
      w.trigger(152, 154, async (ww) => { await ww.note('두 길은 다시 만나요. 죽서루는 연군(관리의 마음)과 신선 지향이 가장 뚜렷하게 부딪치는 곳이에요. 이 갈등은 결사의 꿈에서 풀려요.'); });
      w.blob(160, 3); w.blob(170, 3, { dir: 1 });
      w.ink(66, 6, 3); w.ink(158, 4, 6);
      w.putLeftovers(186, 3);
      w.setStart(2, 3);
      w.add(new E.Exit(w.wx(191), w.wy(3)));
    },
  });

  // ================================================================ 4장: 망양정 (보스: 노한 고래)
  def('4', {
    name: '망양정', chapter: 4, w: 64, h: 14, bg: 'bg_stormsea', bgm: 'sea', skin: 'grass', weather: 'spray', waterColor: 'rgba(40,96,140,.9)',
    build(w) {
      w.ground(0, 40, 3);
      w.block(6, 6, 12, 3);
      w.plat(4, 5, 2);   // 망양정 언덕(높이 6)으로 오르는 디딤판
      w.deco('pavilion', 12, 6, { scale: 0.8 });
      w.sign(3, 3, '망양정');
      w.putScrolls('망양', [[11, 6]]);
      w.hazard(40, 64, 2);
      // 경기장: 땅 14칸 + 바다 6칸이 한 화면에 들어온다
      w.arena = { x0: w.wx(26), x1: w.wx(40), sea: w.wx(40), top: w.wy(12), floor: w.wy(3) };
      w.setStart(2, 3);
      w.trigger(27, 29, async (ww) => {
        if (ww.bossDone || ww.boss) return;
        ww.lockInput = true;
        for (let r = 3; r < 14; r++) ww.set(25, ww.h - 1 - r, G.TILE.SOLID, 'none');
        ww.camTarget = { x: ww.wx(36), y: ww.wy(3) - 130 };
        const boss = ww.boss = ww.add(new E.Whale(ww.arena, {
          onWin: async (w2) => {
            w2.lockInput = true;
            await U.sleep(1.5);
            await w2.game('부르르르… (고래가 물거품으로 흩어졌다)', 'sys');
            await w2.note('고래의 정체는 파도였어요! 원문은 성난 고래, 은산, 오월 하늘의 백설 같은 비유로 망양정 앞바다의 거센 파도를 그렸어요.');
            boss.dead = true; w2.boss = null; w2.bossDone = true; w2.weather = null;
            for (let r = 3; r < 14; r++) w2.set(25, w2.h - 1 - r, G.TILE.EMPTY);
            w2.camTarget = null; G.audio.play('night');
            w2.add(new E.Exit(w2.wx(31), w2.wy(3), (w3) => w3.finish()));
            w2.lockInput = false;
          },
        }));
        G.audio.play('boss');
        await ww.fictionOnce('whale');
        await ww.game('파도를 뛰어넘고 물기둥을 피하다가, 고래가 물가로 머리를 내밀면 붓{attack}으로 치세요!', 'sys');
        boss.phase = 'waves'; boss.pt = 0; boss.n = 0;
        ww.checkpoint = { x: ww.wx(29), y: ww.wy(3) };
        ww.lockInput = false;
      });
      w.putLeftovers(20, 3);
    },
  });

  // ================================================================ 종장 E: 월출과 꿈 (ending.js가 흐름을 맡는다)
  def('E', {
    name: '월출과 꿈', chapter: 5, w: 64, h: 14, bg: 'bg_moonsea', bgm: 'night', skin: 'grass', tint: { color: '#0a1028', alpha: 0.35 }, weather: 'stars', parallax: 0.05, fog: 0.3,
    build(w) { G.ending.build(w); },
  });

  // 비행 미니게임(억만 창생에게 술을)
  def('EF', {
    name: '술빛 나누기', chapter: 5, w: 150, h: 12, bg: 'bg_moonsea', bgm: 'dream', skin: 'grass', tint: { color: '#0a1028', alpha: 0.3 }, weather: 'stars', parallax: 0.2, fog: 0.2,
    build(w) { G.ending.buildFlight(w); },
  });

  // 원문에서 key가 들어 있는 4음보 행을 찾아 네 마디로 나눈다(음보 석판용)
  G.meterLine = function (key) {
    for (const s of KB().scrolls || []) {
      for (const line of (s.orig || '').split(' / ')) {
        const plain = G.stripHanja(line);
        if (!plain.includes(key)) continue;
        const toks = plain.split(/\s+/).filter(Boolean);
        // '듯', '말고' 같은 한 글자·짧은 말은 앞말에 붙인다
        const merged = [];
        for (const t of toks) {
          const bare = t.replace(/\[[^\]]*\]/g, 'X');
          if (merged.length && (bare.length <= 1 || /^(듯|[ㄷ]|마나|말고|말며)$/.test(bare))) merged[merged.length - 1] += ' ' + t;
          else merged.push(t);
        }
        while (merged.length > 4) {
          let bi = 0, bl = Infinity;
          for (let i = 0; i < merged.length - 1; i++) { const l = (merged[i] + merged[i + 1]).length; if (l < bl) { bl = l; bi = i; } }
          merged.splice(bi, 2, merged[bi] + ' ' + merged[bi + 1]);
        }
        if (merged.length === 4) return merged;
      }
    }
    return null;
  };
})();
