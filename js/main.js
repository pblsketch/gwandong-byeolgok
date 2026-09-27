'use strict';
// 시작: 화면 크기 맞추기 → 옛한글 글꼴 고르기 → 에셋 불러오기 → 게임 루프
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const safe = document.getElementById('safe');
  G.ctx = ctx;

  // 휴대폰처럼 긴 화면에서는 세로(360)는 두고 가로 시야를 넓혀(최대 800 = 20:9) 좌우 검은 띠를 줄인다
  const MIN_W = 640, MAX_W = 800;
  function resize() {
    const r = safe.getBoundingClientRect();           // 노치·둥근 모서리를 뺀 영역
    const vw = r.width || window.innerWidth, vh = r.height || window.innerHeight;
    G.W = Math.round(Math.min(MAX_W, Math.max(MIN_W, (G.H * vw) / vh)) / 2) * 2;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const fit = Math.min(vw / G.W, vh / G.H);
    let S = fit * dpr;
    // 정수 배율이면 픽셀이 고르게 보이지만, 화면이 많이 남으면 꽉 채우는 쪽을 택한다
    if (S >= 2 && Math.floor(S) / S >= 0.9) S = Math.floor(S);
    const cssW = (G.W * S) / dpr, cssH = (G.H * S) / dpr;
    canvas.width = Math.round(G.W * S); canvas.height = Math.round(G.H * S);
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    const x = r.left + (vw - cssW) / 2, y = r.top + (vh - cssH) / 2;
    canvas.style.left = x + 'px'; canvas.style.top = y + 'px';
    G.renderScale = S;
    G.screenRect = { x, y, w: cssW, h: cssH };
    G.ui.layout(G.screenRect);
    G.input.layoutTouch();
    G.screen.checkPortrait();
  }

  // ---------------------------------------------------------------- 전체 화면 · 가로 고정 · 세로 안내
  const SCR = G.screen = {};
  const root = document.documentElement;
  SCR.mobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  SCR.iphone = /iPhone|iPod/i.test(navigator.userAgent);
  SCR.inApp = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp/i.test(navigator.userAgent);
  SCR.canFull = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  SCR.installed = () => matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;
  SCR.isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement) || SCR.installed();
  SCR.enter = async function () {
    if (SCR.isFull()) return true;
    if (!SCR.canFull) { SCR.hint(); return false; }
    try {
      if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
      else root.webkitRequestFullscreen();
    } catch (e) { SCR.hint(); return false; }
    try { await screen.orientation.lock('landscape'); } catch (e) { /* 가로 고정을 지원하지 않는 기기 */ }
    return true;
  };
  SCR.exit = function () {
    try { if (document.exitFullscreen) document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); } catch (e) { /* 무시 */ }
  };
  SCR.toggle = () => (SCR.isFull() ? SCR.exit() : SCR.enter());
  // 휴대폰에서 메뉴를 처음 누를 때 자동으로 전체 화면(사용자 동작 안에서만 가능)
  SCR.auto = function () { if (SCR.mobile && !SCR.isFull() && !SCR.tried) { SCR.tried = true; SCR.enter(); } };
  SCR.hint = function () {
    if (SCR.hinted) return;
    SCR.hinted = true;
    const msg = SCR.iphone ? '아이폰은 공유 버튼 → 홈 화면에 추가로 설치하면 전체 화면으로 할 수 있어요'
      : SCR.inApp ? '앱 안의 브라우저에서는 전체 화면이 막혀요. ⋮ 메뉴 → 다른 브라우저로 열기를 눌러 주세요'
      : '이 브라우저는 전체 화면을 지원하지 않아요. 메뉴 → 홈 화면에 추가로 설치해 보세요';
    G.ui.toast(msg, 'game', 5);
  };
  const rot = document.getElementById('rotate');
  SCR.portrait = false;
  SCR.checkPortrait = function () {
    SCR.portrait = SCR.mobile && window.innerHeight > window.innerWidth * 1.05;
    rot.classList.toggle('on', SCR.portrait);
  };
  rot.querySelector('button').addEventListener('click', async () => {
    await SCR.enter();
    setTimeout(resize, 300);
  });
  document.addEventListener('fullscreenchange', () => setTimeout(resize, 100));
  document.addEventListener('webkitfullscreenchange', () => setTimeout(resize, 100));

  let last = 0, acc = 0;
  const STEP = 1 / 60;
  function frame(ts) {
    const t = ts / 1000;
    let dt = last ? t - last : STEP;
    last = t;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) {
      G.scenes.update(STEP);
      G.input.endFrame();
      acc -= STEP; n++;
    }
    if (n === 5) acc = 0;
    ctx.setTransform(G.renderScale, 0, 0, G.renderScale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    G.scenes.draw(ctx);
    requestAnimationFrame(frame);
  }

  async function boot() {
    G.save.load();
    G.ui.init();
    G.input.buildTouch();
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 250));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
    if (!G.save.data.settings.music) G.audio.setMusicVol(0);
    const bootEl = document.getElementById('boot');
    if (!window.KB || !window.KB.scrolls) bootEl.textContent = '원문 데이터(js/data/text.js)를 찾지 못했어요.';
    await G.assets.load((p) => { bootEl.textContent = `불러오는 중… ${Math.round(p * 100)}%`; });
    try { await document.fonts.ready; } catch (e) { /* 무시 */ }
    await G.pickYetFont();
    bootEl.classList.add('hide');
    // 첫 입력에서 소리 켜기(브라우저 정책)
    const unlock = () => { G.audio.unlock(); window.removeEventListener('pointerdown', unlock); };
    window.addEventListener('pointerdown', unlock);
    const q = new URLSearchParams(location.search);
    if (q.get('dev')) {
      // 점검용 도우미(주소에 ?dev=1을 붙였을 때만)
      Object.keys(window.GD.fiction).forEach((k) => (G.save.data.seen[k] = true));
      Object.assign(G.save.data.unlock, { okjeol: true, feather: true });
      window.__hold = async (code, ms) => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); await G.util.sleep(ms / 1000); window.dispatchEvent(new KeyboardEvent('keyup', { code })); };
      window.__tap = async (code) => { await window.__hold(code, 60); await G.util.sleep(0.25); };
      window.__go = async (lv, x, h) => {
        G.scenes.go(new G.LevelScene(lv)); await G.util.sleep(0.1);
        const w = G.scenes.cur.world, p = w.player;
        if (x !== undefined) { p.x = w.wx(x); p.y = w.wy(h) - p.h - 1; w.camSnap = true; }
        return lv;
      };
    }
    if (q.get('level') && G.levels[q.get('level')]) G.scenes.go(new G.LevelScene(q.get('level')));   // 개발·수업용 바로가기: ?level=2A
    else G.scenes.go(new G.TitleScene());
    requestAnimationFrame(frame);
  }
  boot();
})();
