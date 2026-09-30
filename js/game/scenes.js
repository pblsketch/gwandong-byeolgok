'use strict';
// 장면 흐름: 타이틀 → (장 소개 → 레벨들 → 장 마무리 → 월드맵) 반복 → 종장 → 결과
(function () {
  const U = G.util, FX = G.fx, A = G.assets, I = G.input;
  const esc = U.esc;
  const SC = G.scenes = { cur: null, fadeA: 0, fadeDir: 0 };

  SC.go = function (s) {
    if (SC.cur && SC.cur.exit) SC.cur.exit();
    G.ui.clear(); FX.clear();
    SC.cur = s;
    s.enter && s.enter();
  };
  // 까맣게 덮였다가 걷힌다. 덮인 순간에 resolve.
  SC.fade = function (sec = 0.5) {
    return new Promise((res) => { SC.fadeDir = 1; SC.fadeSpeed = 1 / sec; SC.fadeRes = res; });
  };
  SC.update = function (dt) {
    if (SC.fadeDir === 1) { SC.fadeA += dt * SC.fadeSpeed; if (SC.fadeA >= 1) { SC.fadeA = 1; SC.fadeDir = -1; const r = SC.fadeRes; SC.fadeRes = null; r && r(); } }
    else if (SC.fadeDir === -1) { SC.fadeA -= dt * SC.fadeSpeed; if (SC.fadeA <= 0) { SC.fadeA = 0; SC.fadeDir = 0; } }
    SC.cur && SC.cur.update && SC.cur.update(dt);
  };
  SC.draw = function (ctx) {
    SC.cur && SC.cur.draw && SC.cur.draw(ctx);
    if (SC.fadeA > 0) { ctx.fillStyle = `rgba(8,6,4,${SC.fadeA})`; ctx.fillRect(0, 0, G.W, G.H); }
  };

  // 진행 순서
  SC.order = () => window.GD.chapters.flatMap((c) => c.levels);
  SC.chapterOf = (lv) => window.GD.chapters.find((c) => c.levels.includes(lv));
  SC.nextLevel = (lv) => { const o = SC.order(); return o[o.indexOf(lv) + 1]; };
  SC.isUnlocked = (lv) => {
    const d = G.save.data;
    if (d.teacher) return true;
    const o = SC.order(); const i = o.indexOf(lv);
    return i <= 0 || !!d.cleared[o[i - 1]];
  };

  // ---------------------------------------------------------------- HUD
  const HUD = G.hud = { pulseT: 0 };
  HUD.pulse = () => { HUD.pulseT = 0.5; };
  HUD.draw = function (ctx, w) {
    const p = w.player; if (!p) return;
    if (HUD.pulseT > 0) HUD.pulseT -= 1 / 60;
    ctx.save();
    // 하트
    for (let i = 0; i < p.maxHp; i++) {
      ctx.globalAlpha = i < p.hp ? 1 : 0.25;
      A.drawProp(ctx, 'heart', 16 + i * 17, 16, { center: true });
    }
    ctx.globalAlpha = 1;
    // 목숨 3개 모드: 하트 옆에 남은 목숨(구간마다 3개)
    if (G.save.data.settings.difficulty === 'lives' && w.lives !== undefined) chip(ctx, 80, 16, `목숨 ×${w.lives}`, '#9c2a20');
    // 마음
    const d = G.save.data;
    if (d.unlock.okjeol && !p.horse && w.id !== 'EF') {
      const imm = p.mode === 'immortal';
      const s = 1 + HUD.pulseT;
      ctx.save(); ctx.translate(18, 40); ctx.scale(s, s);
      ctx.fillStyle = imm ? 'rgba(134,205,234,.9)' : 'rgba(224,169,42,.9)';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      A.drawProp(ctx, imm ? 'feather' : 'okjeol', 0, 0, { center: true, scale: 0.6 });
      ctx.restore();
      txt(ctx, imm ? '신선의 마음' : '관리의 마음', 34, 44, 10, '#fff', 'left');
      if (d.unlock.feather && !I.isTouch) txt(ctx, '(D 전환)', 92, 44, 8, 'rgba(255,255,255,.7)', 'left');
    }
    if (w.id === 'EF') {
      A.drawProp(ctx, 'wine', G.W - 118, 16, { center: true, scale: 0.7 });
      txt(ctx, `밝힌 마을 ${w.lit || 0} / ${w.villages}`, G.W - 12, 20, 11, '#ffe7a0', 'right');
      ctx.restore();
      return;
    }
    // 두루마리·먹
    const lvScrolls = w.scrollsAt();
    const got = lvScrolls.filter((s) => d.scrolls[s.id]).length;
    A.drawProp(ctx, 'scroll', G.W - 96, 16, { center: true, scale: 0.8 });
    txt(ctx, `${got} / ${lvScrolls.length}`, G.W - 80, 20, 11, '#fff', 'left');
    A.drawProp(ctx, 'inkstick', G.W - 36, 16, { center: true, scale: 0.7 });
    txt(ctx, String(d.ink), G.W - 24, 20, 11, '#fff', 'left');
    // 장 이름
    const ch = SC.chapterOf(w.id);
    if (ch && !(w.boss && !w.boss.dead)) txt(ctx, `${ch.name} · ${w.def.name}`, G.W / 2, 14, 9, 'rgba(255,255,255,.85)', 'center');
    // 조작 도움말(앞부분만)
    // 2A의 마음 전환 도움말은 학의 깃을 얻은 뒤부터 보여 준다
    const helpOn = w.id === '2A' ? d.unlock.feather && w.time - (w.helpFrom || 0) < 40 : w.time < 40;
    if (!I.isTouch && ['P1', '1B', '2A'].includes(w.id) && helpOn) {
      const help = w.id === '2A' ? 'D 마음 전환 · 신선: 2단 점프 / 점프 꾹 = 활공' : w.id === '1B' ? 'A 붓 · S 옥절(관리의 마음) · Esc 멈춤·편람' : '←→ 이동 · ↑/Space 점프 · A 붓 · Enter 대화 넘기기';
      txt(ctx, help, 10, G.H - 10, 9, 'rgba(255,255,255,.8)', 'left');
    }
    if (w.boss && !w.boss.dead) w.boss.drawBar(ctx);
    ctx.restore();
  };
  function txt(ctx, s, x, y, size, color, align) {
    ctx.font = `700 ${size}px "Noto Sans KR", sans-serif`;
    ctx.textAlign = align; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.65)';
    ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
  }
  function chip(ctx, x, y, s, bg) {
    ctx.font = '700 8px "Noto Sans KR", sans-serif';
    const w = ctx.measureText(s).width + 8;
    ctx.fillStyle = bg; ctx.fillRect(x - w / 2, y - 6, w, 12);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(s, x, y + 3);
  }
  G.hudText = txt;

  // ---------------------------------------------------------------- 레벨 장면
  class LevelScene {
    constructor(id) { this.id = id; }
    enter() {
      const def = G.levels[this.id];
      // 장 고르기·선생님용으로 중간 장부터 시작해도 앞 장에서 얻는 능력(옥절·학의 깃)은 갖고 시작한다
      const o = SC.order(), k = o.indexOf(this.id), un = G.save.data.unlock;
      if (k > o.indexOf('P1') && !un.okjeol) { un.okjeol = true; G.save.write(); }
      if (k > o.indexOf('2A') && !un.feather) { un.feather = true; G.save.write(); }
      const w = this.world = new G.World(def);
      w.lives = 3;   // 목숨 3개 모드: 구간마다 3개로 시작
      def.build(w);
      if (!w.start) w.setStart(2, 3);
      const p = w.player = new G.Player(w.start.x, w.start.y);
      w.ents.unshift(p); p.world = w;
      p.setMode('official', true);
      if (def.setup) def.setup(w);
      w.camSnap = true; w.updateCamera(0);
      G.audio.play(def.bgm);
      G.touchWanted = true; I.setTouchVisible(true);
      I.setTouchButton('attack', !!G.save.data.unlock.okjeol || def.runner, def.runner ? null : '붓');
      I.setTouchButton('cast', !!G.save.data.unlock.okjeol && !def.runner);
      I.setTouchButton('mind', !!G.save.data.unlock.feather && !def.runner);
      this.t = 0;
    }
    exit() { G.touchWanted = false; I.setTouchVisible(false); }
    update(dt) {
      const w = this.world;
      this.t += dt;
      G.save.data.playTime += dt;
      if (G.ui.blocking > 0) { FX.update(dt * 0.5); return; }
      if (this.over) { FX.update(dt); return; }   // 목숨 3개 모드: 목숨을 다 잃으면 세계를 멈춘다
      if (G.screen.portrait) return;          // 세로로 들고 있으면 잠시 멈춤
      if (I.pressed('pause') && !this.pausing) { this.pause(); return; }
      if (FX.hitstop > 0) { FX.hitstop -= dt; FX.update(0); FX.shakeT > 0 && FX.update(0.0001); return; }
      w.update(dt);
      FX.update(dt);
      this.watchStuck(dt);
      // 터치 버튼 갱신
      I.setTouchButton('attack', !!G.save.data.unlock.okjeol || w.def.runner);
      I.setTouchButton('cast', !!G.save.data.unlock.okjeol && !w.def.runner);
      I.setTouchButton('mind', !!G.save.data.unlock.feather && !w.def.runner);
      if (w.done && !this.leaving) { this.leaving = true; this.complete(); }
    }
    async pause() {
      this.pausing = true;
      const a = await G.ui.pause({ inLevel: true });
      this.pausing = false;
      if (a === 'book') { await G.ui.book(); }
      else if (a === 'stuck') { await this.escape(false); }
      else if (a === 'map') { SC.go(new G.MapScene()); }
      else if (a === 'title') { SC.go(new TitleScene()); }
    }
    // 막힘 살피기: 구덩이 따위에 갇혀 한 자리(가로 4칸·세로 3칸 안)에서 25초 넘게 점프만 되풀이하면 빠져나갈 길을 묻는다
    watchStuck(dt) {
      const w = this.world, p = w.player, TS = G.TS;
      if (this.stuckCd > 0) this.stuckCd -= dt;
      if (w.lockInput || w.cutscene || w.boss || w.def.runner || p.out || this.pausing) { this.stuck = null; return; }
      const s = this.stuck || (this.stuck = { x: p.cx, y: p.feet, t: 0, jumps: 0 });
      if (p.onGround && (Math.abs(p.cx - s.x) > TS * 4 || Math.abs(p.feet - s.y) > TS * 3)) { this.stuck = null; return; }
      s.t += dt;
      if (I.pressed('jump')) s.jumps++;
      if (s.t > 25 && s.jumps >= 6 && !(this.stuckCd > 0)) { this.stuck = null; this.escape(true); }
    }
    // 빠져나가기: 지나온 시구 문제를 맞히면 학의 깃이 높이 띄워 올리고, 아니면 가까운 이정표로 돌아간다
    async escape(auto) {
      const w = this.world, p = w.player;
      this.pausing = true;
      let first = true;
      for (;;) {
        const i = await G.ui.choice(first
          ? (auto ? '빠져나갈 길이 안 보이나요? 이렇게 빠져나갈 수 있어요.' : '길이 막혔나요? 이렇게 빠져나갈 수 있어요.')
          : '다시 골라 볼까요?', [
          '지나온 시구 문제를 풀고 학의 깃으로 높이 날아오르기',
          '가까운 이정표로 돌아가기',
          auto ? '조금 더 해 볼게요' : '그대로 계속하기',
        ], { tag: '<span class="tag game">길 찾기</span><span class="tag note">막혔을 때</span>' });
        first = false;
        if (i === 0) {
          const q = this.escapeQuiz();
          if (!q) { G.ui.toast('아직 푼 시구가 없어요. 이정표로 돌아갈게요', 'game'); p.respawn(w, null); break; }
          const ok = await G.ui.quiz(q, { kind: '길 찾기 문제', sub: '맞히면 학의 깃이 높이 띄워 줘요', noRecord: true });
          if (ok) { this.liftUp(); break; }
          continue;
        }
        if (i === 1) p.respawn(w, '가까운 이정표로 돌아왔어요 (목숨은 그대로예요)');
        break;
      }
      this.stuck = null; this.stuckCd = auto ? 45 : 10;
      this.pausing = false;
    }
    // 이미 주운 두루마리의 문제 가운데 하나(이 구간 것을 먼저). 하나도 없으면 이 구간 문제에서.
    escapeQuiz() {
      const KB = window.KB || {}, d = G.save.data;
      const quizzes = KB.quizzes || [], scrolls = KB.scrolls || [];
      const levelOf = (q) => (scrolls.find((x) => x.id === q.scroll) || {}).level;
      const got = quizzes.filter((q) => d.scrolls[q.scroll]);
      const here = got.filter((q) => levelOf(q) === this.id);
      const pool = here.length ? here : got.length ? got : quizzes.filter((q) => levelOf(q) === this.id);
      if (!pool.length) return null;
      let q = pool[Math.floor(Math.random() * pool.length)];
      if (pool.length > 1 && q === this.lastEscapeQ) q = pool[(pool.indexOf(q) + 1) % pool.length];
      this.lastEscapeQ = q;
      return q;
    }
    liftUp() {
      const w = this.world, p = w.player;
      p.vy = -1080; p.vx = 0; p.jumps = 0; p.invT = Math.max(p.invT, 1.5); p.sq = 1.3;
      G.audio.sfx('jump2');
      FX.burst(p.cx, p.feet, 'feather', 24, { angle: Math.PI / 2, spread: 1.6, max: 160 });
      G.ui.toast('학의 깃이 높이 띄워 올렸어요! ←→로 안전한 곳에 내려앉아요', 'game', 3);
    }
    async gameOver() {
      if (this.over) return;
      this.over = true;
      G.audio.sfx('wrong'); FX.flash('#2a0c08', 0.35); FX.shake(4, 0.3);
      await U.sleep(0.9);
      const name = G.levels[this.id].name;
      const i = await G.ui.choice(`목숨 3개를 모두 잃었어요. ‘${name}’ 구간을 첫머리부터 다시 걸어요.`, [
        `‘${name}’ 첫머리에서 다시 (목숨 3개로)`,
        '월드맵으로',
      ], { tag: '<span class="tag game">목숨 3개</span><span class="tag note">다시 도전</span>' });
      await SC.fade(0.5);
      if (i === 0) SC.go(new LevelScene(this.id)); else SC.go(new G.MapScene(this.id));
    }
    async complete() {
      const d = G.save.data;
      d.cleared[this.id] = true; G.save.write();
      await SC.fade(0.6);
      const nxt = SC.nextLevel(this.id);
      const ch = SC.chapterOf(this.id);
      const lastOfChapter = ch.levels[ch.levels.length - 1] === this.id;
      if (lastOfChapter && ch.id >= 1 && ch.id <= 3) SC.go(new ChapterEnd(ch.id, nxt));
      else if (lastOfChapter && ch.id === 0) SC.go(new G.MapScene(nxt));
      else if (nxt) SC.startLevel(nxt);
      else SC.go(new G.ResultScene());
    }
    draw(ctx) {
      this.world.draw(ctx);
      HUD.draw(ctx, this.world);
      FX.drawScreen(ctx);
    }
  }
  G.LevelScene = LevelScene;

  // 장 시작 안내(짧은 제목 카드) 후 레벨로
  SC.startLevel = async function (id) {
    const ch = SC.chapterOf(id);
    if (ch && ch.levels[0] === id) {
      SC.go(new CardScene(ch.name, ch.title, () => SC.go(new LevelScene(id))));
    } else SC.go(new LevelScene(id));
  };

  class CardScene { // 장 제목 카드
    constructor(a, b, next) { this.a = a; this.b = b; this.next = next; this.t = 0; }
    enter() { G.audio.sfx('bell'); }
    update(dt) { this.t += dt; if ((this.t > 2.6 || (this.t > 0.5 && (I.pressed('ok') || I.pressed('jump')))) && !this.gone) { this.gone = true; SC.fade(0.4).then(this.next); } }
    draw(ctx) {
      ctx.fillStyle = '#12100d'; ctx.fillRect(0, 0, G.W, G.H);
      const pap = A.ui('paper');
      if (pap) { ctx.globalAlpha = 0.12; ctx.drawImage(pap, 0, 0, G.W, G.H); ctx.globalAlpha = 1; }
      const k = Math.min(1, this.t / 0.6);
      ctx.globalAlpha = k;
      ctx.textAlign = 'center'; ctx.fillStyle = '#e9dcbd';
      ctx.font = '700 14px "Gowun Batang", serif'; ctx.fillText(this.a, G.W / 2, G.H / 2 - 18);
      ctx.font = '900 24px "Gowun Batang", serif'; ctx.fillText(this.b, G.W / 2, G.H / 2 + 16);
      ctx.fillStyle = '#b3261e'; ctx.fillRect(G.W / 2 - 40, G.H / 2 + 30, 80, 2);
      ctx.globalAlpha = 1;
    }
  }
  G.CardScene = CardScene;

  // ---------------------------------------------------------------- 장 마무리: 여정 퍼즐 + 實/虛 분류
  class ChapterEnd {
    constructor(ch, next) { this.ch = ch; this.next = next; }
    async enter() {
      G.audio.play('title');
      const GD = window.GD;
      const route = GD.routes[this.ch];
      const miss = route ? await G.ui.routePuzzle(`${GD.chapters[this.ch].name} 여정 잇기`, route) : 0;
      const sorts = GD.sorts[this.ch];
      const sc = sorts ? await G.ui.sortGame(sorts) : 0;
      const d = G.save.data;
      d.chapterEnd = d.chapterEnd || {};
      d.chapterEnd[this.ch] = { routeMiss: miss, sort: sc, sortTotal: sorts ? sorts.length : 0 };
      G.save.write();
      SC.go(new G.MapScene(this.next));
    }
    draw(ctx) {
      const im = A.ui('paper');
      ctx.fillStyle = '#2a241c'; ctx.fillRect(0, 0, G.W, G.H);
      if (im) { ctx.globalAlpha = 0.5; ctx.drawImage(im, 0, 0, G.W, G.H); ctx.globalAlpha = 1; }
    }
  }
  G.ChapterEnd = ChapterEnd;

  // ---------------------------------------------------------------- 타이틀
  class TitleScene {
    enter() {
      this.t = 0;
      G.audio.play('title');
      const d = G.save.data;
      const has = G.save.hasProgress();
      const el = G.ui.add(`
        <div class="col" style="left:calc(var(--u)*26);bottom:calc(var(--u)*24)">
          <button class="mbtn" data-a="new">새로 시작<small>서장부터 여정을 떠나요</small></button>
          <button class="mbtn" data-a="cont" ${has ? '' : 'disabled'}>이어 하기<small>${has ? '저장된 곳에서 계속' : '저장된 여정이 없어요'}</small></button>
          <button class="mbtn" data-a="chap">장 고르기<small>월드맵에서 원하는 장으로</small></button>
          <button class="mbtn" data-a="book">관동 편람<small>원문·인물·상징·실제와 상상</small></button>
          <button class="mbtn" data-a="opt">설정</button>
        </div>
        <button class="btn ghost fullbtn" data-a="full" style="position:absolute;right:calc(var(--u)*12);top:calc(var(--u)*10);background:rgba(243,234,212,.85)">전체 화면</button>
        <div style="position:absolute;right:calc(var(--u)*14);bottom:calc(var(--u)*10);font-size:calc(var(--u)*7.5);color:#3b3328;text-align:right;line-height:1.5;background:rgba(243,234,212,.7);padding:calc(var(--u)*4) calc(var(--u)*8);border-radius:calc(var(--u)*3)">
          <b style="font-family:var(--serif);font-size:calc(var(--u)*8.5)">만든이 박준일</b> (온양여자고등학교 국어 교사)<br><b class="mk red">實</b>붉은 두루마리 = 원문 · <b class="mk tealmk">虛</b>청록 상자 = 게임 속 상상<br>그림: Codex CLI(gpt-image-2) 생성 · 배경음: 국립국악원 「디지털 이음」 국악기 악구(공공누리 제1유형)
        </div>`, 'menu');
      const btns = Array.from(el.querySelectorAll('.mbtn'));
      const nav = G.ui.focusNav(btns, has ? 1 : 0);
      el.addEventListener('click', async (e) => {
        const b = e.target.closest('.mbtn,.fullbtn'); if (!b || b.disabled) return;
        G.audio.unlock(); G.audio.sfx('confirm');
        const a = b.dataset.a;
        if (a === 'full') { G.screen.toggle(); return; }
        G.screen.auto();
        if (a === 'new') {
          if (has) { const i = await G.ui.choice('저장된 여정을 지우고 처음부터 시작할까요?', ['네, 처음부터', '아니요'], { tag: '<span class="tag note">확인</span>' }); if (i !== 0) return; }
          const mode = await G.ui.choice('어떤 방식으로 떠날까요? (멈춤 메뉴에서 바꿀 수 있어요)', [
            '목숨 3개 · 쓰러지면 목숨이 하나 줄고 가까운 이정표에서 이어 가요. 다 잃으면 그 구간 첫머리로',
            '무한 목숨 · 몇 번 쓰러져도 가까운 이정표에서 이어 가요',
          ], { tag: '<span class="tag note">플레이 방식</span>' });
          G.save.reset();
          G.save.data.settings.difficulty = mode === 1 ? 'normal' : 'lives'; G.save.write();
          SC.startLevel('P1');
        } else if (a === 'cont') {
          const o = SC.order(); const next = o.find((lv) => !d.cleared[lv]);
          if (!next) SC.go(new G.ResultScene()); else SC.go(new G.MapScene(next));
        } else if (a === 'chap') SC.go(new G.MapScene());
        else if (a === 'book') await G.ui.book();
        else if (a === 'opt') await G.ui.pause({});
      });
      this.unkey = (act) => {
        if (G.ui.blocking > 0) return false;
        if (act === 'down') nav.move(1); else if (act === 'up') nav.move(-1);
        else if (act === 'ok' || act === 'jump') nav.press(); else return false;
        return true;
      };
      I.listeners.push(this.unkey);
    }
    exit() { const i = I.listeners.indexOf(this.unkey); if (i >= 0) I.listeners.splice(i, 1); }
    update(dt) { this.t += dt; }
    draw(ctx) {
      const im = A.ui('title_art');
      ctx.imageSmoothingEnabled = true;
      if (im) {
        const s = Math.max(G.W / im.width, G.H / im.height);
        const w = im.width * s, h = im.height * s;
        const drift = Math.sin(this.t * 0.1) * 6;
        ctx.drawImage(im, (G.W - w) / 2 + drift, (G.H - h) / 2, w, h);
      }
      const logo = A.ui('logo');
      if (logo) {
        const lw = 300, lh = logo.height * lw / logo.width;
        ctx.globalAlpha = Math.min(1, this.t / 1.2);
        ctx.drawImage(logo, G.W / 2 - lw / 2 + 60, 26, lw, lh);
        ctx.font = '700 13px "Gowun Batang", serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#3b2f22';
        ctx.fillText('잃어버린 시구 — 송강 정철의 관동 팔백 리', G.W / 2 + 60, 26 + lh + 18);
        ctx.globalAlpha = 1;
      }
    }
  }
  G.TitleScene = TitleScene;
})();
