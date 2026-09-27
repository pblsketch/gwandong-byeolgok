'use strict';
// 시작: 화면 크기 맞추기 → 옛한글 글꼴 고르기 → 에셋 불러오기 → 게임 루프
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  G.ctx = ctx;

  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const fit = Math.min(vw / G.W, vh / G.H);
    let S = fit * dpr;
    // 정수 배율이면 픽셀이 고르게 보이지만, 화면이 많이 남으면(태블릿) 꽉 채우는 쪽을 택한다
    if (S >= 2 && Math.floor(S) / S >= 0.9) S = Math.floor(S);
    const cssW = (G.W * S) / dpr, cssH = (G.H * S) / dpr;
    canvas.width = Math.round(G.W * S); canvas.height = Math.round(G.H * S);
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    const x = (vw - cssW) / 2, y = (vh - cssH) / 2;
    canvas.style.left = x + 'px'; canvas.style.top = y + 'px';
    G.renderScale = S;
    G.screenRect = { x, y, w: cssW, h: cssH };
    G.ui.layout(G.screenRect);
    G.input.layoutTouch();
  }

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
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
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
