'use strict';
// 화면 위에 겹치는 HTML UI.
// 표시 규칙(실제와 상상의 구분):
//   orig = 원문(한지 + 붉은 낙관)  note = 풀이·해설(한지)  game = 게임 설정(청록 + 虛 인장)
(function () {
  const U = G.util, esc = U.esc;
  const ui = G.ui = { blocking: 0 };
  let root;

  const WHO = {
    jc: { name: '정철', pt: 'pt_calm' },
    sage: { name: '꿈속의 신선', pt: 'pt_sage' },
    libai: { name: '이백의 환영', pt: 'pt_libai' },
    ghost: { name: '망각귀', pt: 'pt_ghost' },
    crane: { name: '선학', pt: 'pt_crane' },
    note: { name: '해설' },
    sys: { name: '안내' },
  };
  const MOOD = { calm: 'pt_calm', awe: 'pt_awe', sad: 'pt_sad', resolve: 'pt_resolve' };
  const TAG = {
    orig: '<span class="tag orig">原文 원문</span>',
    note: '<span class="tag note">풀이·해설</span>',
    game: '<span class="tag game"><b class="mk">虛</b>게임 설정</span>',
  };
  ui.TAG = TAG;

  ui.init = function () { root = document.getElementById('ui'); };
  ui.layout = function (r) {
    if (!root) return;
    Object.assign(root.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    document.documentElement.style.setProperty('--u', (r.w / G.W) + 'px');
  };
  function add(html, cls) {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.innerHTML = html;
    root.appendChild(d);
    return d;
  }
  // 모달: 키 입력을 가로채고, 닫힐 때까지 게임 세계를 멈춘다
  function modal(el, onKey) {
    ui.blocking++;
    const h = (a, e) => onKey(a, e) !== false;
    G.input.listeners.push(h);
    G.input.setTouchVisible(false);
    return function close() {
      const i = G.input.listeners.indexOf(h);
      if (i >= 0) G.input.listeners.splice(i, 1);
      el.remove();
      ui.blocking = Math.max(0, ui.blocking - 1);
      if (ui.blocking === 0) G.input.setTouchVisible(G.touchWanted);
    };
  }
  ui.hanja = () => G.save.data.settings.hanja;
  ui.yet = (s) => G.origText(s, ui.hanja());

  // 포커스 이동 도우미(키보드로 버튼 고르기)
  function focusNav(buttons, start = 0) {
    let i = start;
    const set = (k) => { buttons.forEach((b) => b.classList.remove('focus')); i = (k + buttons.length) % buttons.length; buttons[i] && buttons[i].classList.add('focus'); };
    set(i);
    return {
      move: (d) => { set(i + d); G.audio.sfx('select'); },
      press: () => buttons[i] && !buttons[i].disabled && buttons[i].click(),
      get i() { return i; },
    };
  }

  // ---------------------------------------------------------------- 대화
  ui.say = function (o) {
    return new Promise((resolve) => {
      const w = WHO[o.who] || WHO.sys;
      const type = o.type || (o.who === 'note' ? 'note' : 'game');
      const pt = o.who === 'jc' ? (MOOD[o.mood] || 'pt_calm') : w.pt;
      const ptSrc = pt ? G.assets.uiSrc(pt) : '';
      const isHanji = type !== 'game';
      const el = add(`
        ${ptSrc ? `<img class="portrait" src="${ptSrc}" alt="">` : ''}
        <div class="who">${esc(o.name || w.name)} ${TAG[type]}</div>
        <div class="text"></div><div class="more">▼</div>`,
        `dlg t-${type} ${isHanji ? 'hanji' : ''} ${ptSrc ? 'has-portrait' : ''}`);
      const tx = el.querySelector('.text');
      const full = type === 'orig' ? ui.yet(o.text) : G.input.keys(o.text);
      const chars = Array.from(full);
      let n = 0, done = false, timer;
      const tick = () => {
        n += 2;
        tx.textContent = chars.slice(0, n).join('');
        if (n % 4 === 0) G.audio.sfx('blip');
        if (n >= chars.length) { done = true; clearInterval(timer); }
      };
      timer = setInterval(tick, 28);
      const next = () => {
        if (!done) { done = true; clearInterval(timer); tx.textContent = full; return; }
        close(); resolve();
      };
      el.addEventListener('click', next);
      const close = modal(el, (a) => { if (a === 'ok' || a === 'jump' || a === 'attack') { next(); return true; } return a !== 'pause'; });
      if (o.auto) setTimeout(() => { if (el.isConnected) { done = true; next(); } }, o.auto * 1000);
    });
  };
  ui.lines = async function (arr) { for (const l of arr) await ui.say(l); };

  // ---------------------------------------------------------------- 원문 두루마리
  ui.scroll = function (s, opt = {}) {
    return new Promise((resolve) => {
      const st = G.save.data.settings;
      const origs = (s.orig || '').split(' / ');
      const mods = (s.modern || '').split(' / ');
      const lines = origs.map((l, i) => `<span class="ln">${esc(ui.yet(l))}${mods[i] ? `<span class="m">${esc(mods[i])}</span>` : ''}</span>`).join('');
      const chips = (s.points || []).map((p) => `<span class="chip"><b>${esc(p.tag)}</b>${esc(G.yet(p.text))}</span>`).join('');
      const words = (s.words || []).map((w) => `<span><b>${esc(ui.yet(w.w))}</b> ${esc(G.yet(w.m))}</span>`).join('');
      const found = opt.review ? '다시 읽기' : '두루마리를 찾았다!';
      const el = add(`
        <div class="scroll hanji ${st.modern ? '' : 'hide-modern'}">
          <div class="head"><span class="seal">原<br>文</span>
            <div><div class="ttl">${esc(s.place)} · ${esc(G.yet(s.title || ''))}</div>
            <div class="sub">${esc(s.section)} · ${esc(found)} ${s.placeNow ? '· 오늘날 ' + esc(s.placeNow) : ''}</div></div></div>
          <div class="body"><div class="orig">${lines}</div>
            ${chips ? `<div class="chips">${chips}</div>` : ''}
            ${words ? `<div class="words">${words}</div>` : ''}</div>
          <div class="foot">
            <button class="btn ghost" data-k="modern">${st.modern ? '풀이 숨기기' : '풀이 보기'}</button>
            <button class="btn ghost" data-k="hanja">${st.hanja ? '한자 숨기기' : '한자 보기'}</button>
            <button class="btn red" data-k="ok">계속 ▶</button>
          </div></div>`, 'overlay');
      G.audio.sfx('scroll');
      const card = el.querySelector('.scroll');
      const redraw = () => {
        const o2 = el.querySelectorAll('.orig .ln');
        o2.forEach((ln, i) => { ln.firstChild.textContent = ui.yet(origs[i]); });
        el.querySelectorAll('.words b').forEach((b, i) => { b.textContent = ui.yet(s.words[i].w); });
      };
      el.addEventListener('click', (e) => {
        const k = e.target.dataset && e.target.dataset.k;
        if (k === 'modern') { st.modern = !st.modern; card.classList.toggle('hide-modern', !st.modern); e.target.textContent = st.modern ? '풀이 숨기기' : '풀이 보기'; G.save.write(); }
        if (k === 'hanja') { st.hanja = !st.hanja; redraw(); e.target.textContent = st.hanja ? '한자 숨기기' : '한자 보기'; G.save.write(); }
        if (k === 'ok') { close(); resolve(); }
      });
      const body = el.querySelector('.body');
      const close = modal(el, (a) => {
        if (a === 'ok' || a === 'jump') { close(); resolve(); }
        if (a === 'down') body.scrollTop += 40;
        if (a === 'up') body.scrollTop -= 40;
        return true;
      });
    });
  };

  // ---------------------------------------------------------------- 게임 설정(虛) 카드
  ui.fiction = function (f) {
    return new Promise((resolve) => {
      const el = add(`
        <div class="fiction">
          <div class="top"><span class="tag game"><b class="mk">虛</b>게임 설정</span><span class="big">${esc(f.title || '잠깐! 이건 게임 설정이에요')}</span></div>
          <div class="body">${esc(G.input.keys(f.body))}</div>
          ${f.real ? `<div class="real hanji"><span class="lab"><b class="mk red">實</b>원문에서는</span>${esc(f.real)}</div>` : ''}
          <div class="foot"><button class="btn game">알겠어요 ▶</button></div>
        </div>`, 'overlay');
      G.audio.sfx('whoosh');
      const done = () => { close(); resolve(); };
      el.querySelector('button').addEventListener('click', done);
      const close = modal(el, (a) => { if (a === 'ok' || a === 'jump') done(); return true; });
    });
  };

  // ---------------------------------------------------------------- 퀴즈
  const KIND = ui.KIND = { mind: '마음 읽기', expression: '표현법', symbol: '시어·상징', allusion: '고사·인물', meaning: '뜻풀이', place: '여정', boss: '시구 대결' };
  ui.quiz = function (q, opt = {}) {
    return new Promise((resolve) => {
      const kind = opt.kind || KIND[q.type] || '문제';
      const choices = q.choices.map((c, i) => `<button class="choice" data-i="${i}"><span class="n">${i + 1}</span><span>${esc(ui.yet(c))}</span></button>`).join('');
      const el = add(`
        <div class="quiz hanji">
          <div class="kind"><span class="tag orig">${esc(kind)}</span>${opt.sub ? `<span class="tag note">${esc(opt.sub)}</span>` : ''}</div>
          <div class="q">${esc(ui.yet(q.q))}</div>
          <div class="choices">${choices}</div>
          <div class="after"></div>
        </div>`, 'overlay');
      const card = el.querySelector('.quiz');
      const btns = Array.from(el.querySelectorAll('.choice'));
      const nav = focusNav(btns, 0);
      let answered = false, ok = false;
      const pick = (i) => {
        if (answered) return;
        answered = true;
        ok = i === q.answer;
        btns.forEach((b) => (b.disabled = true));
        btns[q.answer].classList.add('right');
        if (!ok) btns[i].classList.add('wrong');
        const st = document.createElement('div');
        st.className = 'stamp' + (ok ? '' : ' no');
        st.textContent = ok ? '正' : '誤';
        card.appendChild(st);
        G.audio.sfx('stamp');
        if (ok) { G.audio.sfx('correct'); G.fx.flash('#fff3c4', 0.18); } else { G.audio.sfx('wrong'); }
        if (q.id && !opt.noRecord) G.save.recordQuiz(q.id, ok);
        el.querySelector('.after').innerHTML = `
          ${q.explain ? `<div class="explain">${ok ? '정답이에요. ' : `정답은 ${q.answer + 1}번이에요. `}${esc(ui.yet(q.explain))}</div>` : ''}
          <div class="foot"><button class="btn red">계속 ▶</button></div>`;
        el.querySelector('.after button').addEventListener('click', finish);
      };
      const finish = () => { close(); resolve(ok); };
      btns.forEach((b) => b.addEventListener('click', () => pick(+b.dataset.i)));
      const close = modal(el, (a) => {
        if (!answered) {
          const m = { n1: 0, n2: 1, n3: 2, n4: 3, n5: 4 };
          if (a in m && m[a] < btns.length) pick(m[a]);
          else if (a === 'down' || a === 'right') nav.move(1);
          else if (a === 'up' || a === 'left') nav.move(-1);
          else if (a === 'ok' || a === 'jump') pick(nav.i);
        } else if (a === 'ok' || a === 'jump') finish();
        return true;
      });
    });
  };

  // ---------------------------------------------------------------- 선택지
  ui.choice = function (title, options, opt = {}) {
    return new Promise((resolve) => {
      const btn = options.map((o, i) => `<button class="choice" data-i="${i}"><span class="n">${i + 1}</span><span>${esc(o)}</span></button>`).join('');
      const el = add(`<div class="quiz hanji"><div class="kind">${opt.tag || '<span class="tag game">선택</span>'}</div><div class="q">${esc(title)}</div><div class="choices">${btn}</div></div>`, 'overlay');
      const btns = Array.from(el.querySelectorAll('.choice'));
      const nav = focusNav(btns, 0);
      const pick = (i) => { close(); G.audio.sfx('confirm'); resolve(i); };
      btns.forEach((b) => b.addEventListener('click', () => pick(+b.dataset.i)));
      const close = modal(el, (a) => {
        const m = { n1: 0, n2: 1, n3: 2, n4: 3 };
        if (a in m && m[a] < btns.length) pick(m[a]);
        else if (a === 'down' || a === 'right') nav.move(1);
        else if (a === 'up' || a === 'left') nav.move(-1);
        else if (a === 'ok' || a === 'jump') pick(nav.i);
        return true;
      });
    });
  };

  // ---------------------------------------------------------------- 배너·토스트
  ui.banner = function (name, hanja, now) {
    root.querySelectorAll('.banner').forEach((b) => b.remove());
    const el = add(`<div class="hj">${esc(hanja || '')}</div><div class="nm">${esc(name)}</div>${now ? `<div class="now">오늘날 ${esc(now)}</div>` : ''}`, 'banner');
    G.audio.sfx('bell');
    setTimeout(() => el.remove(), 3700);
  };
  ui.toast = function (text, type, sec = 2.2) {
    const el = add(esc(G.input.keys(text)), 'toast' + (type ? ' ' + type : ''));
    el.style.animationDuration = sec + 's';
    if (sec > 3) el.style.whiteSpace = 'normal';
    setTimeout(() => el.remove(), sec * 1000 + 100);
  };

  // ---------------------------------------------------------------- 일시정지·설정
  ui.pause = function (opts = {}) {
    return new Promise((resolve) => {
      const st = G.save.data.settings;
      const seg = (k, vals) => `<span class="seg" data-k="${k}">${vals.map(([v, l]) => `<button data-v="${v}" class="${String(st[k]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</span>`;
      const el = add(`
        <div class="panel hanji pause">
          <h2>잠시 멈춤</h2>
          <div class="pcols">
            <div class="pcol">
              <button class="btn" data-a="resume">계속하기</button>
              <button class="btn ghost" data-a="book">관동 편람 (원문·인물·상징)</button>
              ${opts.inLevel ? '<button class="btn ghost" data-a="restart">체크포인트에서 다시</button>' : ''}
              ${opts.inLevel ? '<button class="btn ghost" data-a="map">월드맵으로</button>' : ''}
              <button class="btn ghost" data-a="title">타이틀로</button>
              <button class="btn ghost" data-full="1">전체 화면 켜기·끄기</button>
            </div>
            <div class="pcol">
              <div class="row">목숨 ${seg('difficulty', [['lives', '3개'], ['normal', '무한'], ['easy', '쉬움(무적)']])}</div>
              <div class="row">한자 병기 ${seg('hanja', [[true, '켜기'], [false, '끄기']])}</div>
              <div class="row">현대어 풀이 ${seg('modern', [[true, '보이기'], [false, '숨기기']])}</div>
              <div class="row">음악 ${seg('music', [[true, '켜기'], [false, '끄기']])}</div>
              <div class="keys">3개: 모두 잃으면 이어 하기·구간 다시 중에서 골라요 · 무한: 쓰러져도 이정표에서 바로 다시</div>
            </div>
          </div>
          <div class="keys">조작: ←→ 이동 · ↑/Space 점프 · A 붓 · S 옥절 · D 마음 전환 · Enter 대화 · Esc 멈춤</div>
        </div>`, 'overlay');
      const done = (a) => { close(); resolve(a); };
      el.addEventListener('click', (e) => {
        if (e.target.dataset.full) { G.screen.toggle(); return; }
        const a = e.target.dataset.a;
        if (a) { G.audio.sfx('confirm'); done(a); return; }
        const segEl = e.target.closest('.seg');
        if (segEl && e.target.dataset.v !== undefined) {
          const k = segEl.dataset.k; let v = e.target.dataset.v;
          if (v === 'true') v = true; else if (v === 'false') v = false;
          st[k] = v; G.save.write();
          segEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.target));
          if (k === 'music') { G.audio.setMusicVol(v ? 0.55 : 0); }
          G.audio.sfx('select');
        }
      });
      const btns = Array.from(el.querySelectorAll('.btn'));
      const nav = focusNav(btns, 0);
      const close = modal(el, (a) => {
        if (a === 'pause') done('resume');
        else if (a === 'down') nav.move(1);
        else if (a === 'up') nav.move(-1);
        else if (a === 'ok' || a === 'jump') nav.press();
        return true;
      });
    });
  };

  // ---------------------------------------------------------------- 관동 편람
  ui.book = function (tab = 'scrolls') {
    return new Promise((resolve) => {
      const KB = window.KB || {};
      const d = G.save.data;
      const el = add(`
        <div class="panel hanji book">
          <div class="tabs">
            <button data-t="scrolls">원문 두루마리</button><button data-t="people">고사·인물</button>
            <button data-t="symbols">시어·상징</button><button data-t="fiction">실제와 상상</button><button data-t="info">작품 정보</button>
            <button class="x btn" data-t="close">닫기 ✕</button>
          </div>
          <div class="content"></div>
        </div>`, 'overlay');
      const content = el.querySelector('.content');
      const show = (t) => {
        el.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
        let h = '';
        if (t === 'scrolls') {
          const got = (KB.scrolls || []).filter((s) => d.scrolls[s.id]).length;
          h += `<div class="mut">모은 두루마리 ${got} / ${(KB.scrolls || []).length} · 아직 못 찾은 두루마리도 '펼쳐 보기'로 읽을 수 있어요.</div>`;
          for (const s of KB.scrolls || []) {
            const has = d.scrolls[s.id];
            h += `<div class="entry ${has ? '' : 'locked'}"><h4><span class="tag orig">${esc(s.section)}</span>${esc(s.place)} <button class="btn ghost" data-open="${s.id}">펼쳐 보기</button></h4>
              <div class="yet">${esc(ui.yet((s.orig || '').split(' / ')[0]))} …</div></div>`;
          }
        } else if (t === 'people') {
          for (const p of KB.people || []) {
            h += `<div class="entry ${d.people[p.id] ? '' : 'locked'}"><h4><span class="tag orig">實</span>${esc(p.name)} <span class="mut">${esc(p.place || '')}</span></h4><div class="yet">${esc(G.yet(p.who || ''))}</div><div class="mut yet">${esc(G.yet(p.why || ''))}</div></div>`;
          }
        } else if (t === 'symbols') {
          for (const y of KB.symbols || []) {
            h += `<div class="entry"><h4><span class="tag orig">實</span><span class="yet">${esc(ui.yet(y.word))}</span></h4><div class="yet">${esc(G.yet(y.meaning || ''))}</div>${y.note ? `<div class="mut yet">${esc(G.yet(y.note))}</div>` : ''}</div>`;
          }
        } else if (t === 'fiction') {
          h += `<div class="mut">게임을 재미있게 만들려고 지어낸 것들이에요. 청록색 상자와 虛 인장은 모두 '상상'이에요.</div>`;
          for (const k in window.GD.fiction) {
            const f = window.GD.fiction[k];
            h += `<div class="entry"><h4><span class="tag game">虛</span>${esc(f.name || f.title)}</h4><div>${esc(G.input.keys(f.body))}</div>${f.real ? `<div class="mut"><b class="mk red">實</b>원문에서는 ${esc(f.real)}</div>` : ''}</div>`;
          }
        } else if (t === 'info') {
          const I = KB.info || {};
          const rows = [['작가', I.author], ['창작 시기', I.year], ['갈래', I.genre], ['형식', I.form], ['수록', I.collection], ['창작 배경', I.background], ['구성', I.structure], ['평가', I.evaluation]];
          for (const [k, v] of rows) if (v) h += `<div class="entry"><h4>${esc(k)}</h4><div class="yet">${esc(G.yet(v))}</div></div>`;
          h += `<div class="entry"><h4>만든 사람</h4><div>박준일 (온양여자고등학교 국어 교사)</div><div class="mut">그림은 Codex CLI(gpt-image-2)로 생성, 배경음악은 웹 오디오로 합성한 창작 국악이에요.</div></div>`;
          h += `<div class="entry"><h4>표시 규칙</h4><div>${TAG.orig} 원문 그대로 · ${TAG.note} 현대어 풀이와 해설 · ${TAG.game} 게임을 위해 지어낸 상상</div></div>`;
        }
        content.innerHTML = h;
        content.scrollTop = 0;
      };
      el.addEventListener('click', async (e) => {
        const t = e.target.dataset.t;
        if (t === 'close') { close(); resolve(); return; }
        if (t) { show(t); G.audio.sfx('select'); return; }
        const id = e.target.dataset.open;
        if (id) { const s = (KB.scrolls || []).find((x) => x.id === id); if (s) await ui.scroll(s, { review: true }); }
      });
      show(tab);
      const close = modal(el, (a) => {
        if (a === 'pause' || a === 'ok') { close(); resolve(); }
        if (a === 'down') content.scrollTop += 60;
        if (a === 'up') content.scrollTop -= 60;
        return true;
      });
    });
  };

  // ---------------------------------------------------------------- 장 마무리: 여정 퍼즐
  ui.routePuzzle = function (title, places) {
    return new Promise((resolve) => {
      const shuffled = U.shuffle(places.map((p, i) => ({ p, i })));
      const el = add(`
        <div class="panel hanji mini">
          <h3><b class="seal-s">路</b>${esc(title)}</h3>
          <div class="desc">화자가 지나간 순서대로 장소를 눌러 여정을 이어 보세요.</div>
          <div class="route"><span class="slot">${esc(places[0])}</span></div>
          <div class="cards">${shuffled.filter((x) => x.i > 0).map((x) => `<button data-i="${x.i}">${esc(x.p)}</button>`).join('')}</div>
          <div class="foot" style="display:flex;justify-content:flex-end;margin-top:calc(var(--u)*10)"></div>
        </div>`, 'overlay');
      const route = el.querySelector('.route');
      let next = 1, miss = 0;
      el.querySelectorAll('.cards button').forEach((b) => b.addEventListener('click', () => {
        const i = +b.dataset.i;
        if (i === next) {
          b.classList.add('used');
          route.insertAdjacentHTML('beforeend', `<span class="arrow">→</span><span class="slot">${esc(places[i])}</span>`);
          next++; G.audio.sfx('pickup');
          if (next >= places.length) {
            G.audio.sfx('correct'); G.fx.flash('#fff3c4', 0.2);
            el.querySelector('.foot').innerHTML = `<span style="margin-right:auto;font-size:calc(var(--u)*10)">${miss === 0 ? '한 번도 틀리지 않았어요!' : `틀린 횟수 ${miss}번`}</span><button class="btn red">계속 ▶</button>`;
            el.querySelector('.foot button').addEventListener('click', () => { close(); resolve(miss); });
          }
        } else {
          miss++; b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong'); G.audio.sfx('wrong');
        }
      }));
      const close = modal(el, (a) => { if ((a === 'ok' || a === 'jump') && next >= places.length) { close(); resolve(miss); } return true; });
    });
  };

  // ---------------------------------------------------------------- 장 마무리: 實/虛 분류
  ui.sortGame = function (items) {
    return new Promise((resolve) => {
      const list = U.shuffle(items);
      let k = 0, score = 0;
      const el = add(`
        <div class="panel hanji mini">
          <h3><b class="seal-s">實虛</b>진짜 관동별곡일까, 게임 속 상상일까?</h3>
          <div class="desc">이번 장에서 본 장면이에요. 원문에 있는 내용이면 <b>實</b>, 게임을 위해 지어낸 내용이면 <b>虛</b>를 고르세요.</div>
          <div class="sortcard"></div>
          <div class="sortbtns"><button class="real">實 · 원문 속 사실</button><button class="fake">虛 · 게임 속 상상</button></div>
          <div class="explain" style="min-height:calc(var(--u)*30);margin-top:calc(var(--u)*8);font-size:calc(var(--u)*9.5);line-height:1.5"></div>
          <div class="progress">${list.map(() => '<i></i>').join('')}</div>
        </div>`, 'overlay');
      const card = el.querySelector('.sortcard'), ex = el.querySelector('.explain'), dots = el.querySelectorAll('.progress i');
      let lock = false;
      // 새 카드가 나오면 앞 카드의 해설은 지운다(앞 문항의 답이 이번 문항의 답처럼 보이지 않게)
      const show = () => { card.textContent = list[k].t; ex.innerHTML = ''; card.style.animation = 'none'; void card.offsetWidth; card.style.animation = ''; };
      const answer = (real) => {
        if (lock) return;
        const it = list[k];
        const ok = it.real === real;
        if (ok) { score++; G.audio.sfx('correct'); G.fx.stop(0.05); } else { G.audio.sfx('wrong'); card.style.animation = 'shake .35s'; }
        dots[k].className = ok ? 'ok' : 'no';
        ex.innerHTML = `<b>${it.real ? '實 원문 속 사실' : '虛 게임 속 상상'}</b> — ${esc(it.why)}`;
        lock = true;
        setTimeout(() => {
          lock = false; k++;
          if (k >= list.length) { close(); resolve(score); } else { show(); }
        }, ok ? 1300 : 2600);
      };
      el.querySelector('.real').addEventListener('click', () => answer(true));
      el.querySelector('.fake').addEventListener('click', () => answer(false));
      show();
      const close = modal(el, (a) => {
        if (a === 'left' || a === 'n1') answer(true);
        if (a === 'right' || a === 'n2') answer(false);
        return true;
      });
    });
  };

  ui.clear = function () { if (root) root.innerHTML = ''; ui.blocking = 0; G.input.listeners.length = 0; };
  ui.add = add;
  ui.modal = modal;
  ui.focusNav = focusNav;
})();
