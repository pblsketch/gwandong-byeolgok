'use strict';
// 에셋 불러오기와 스프라이트 그리기
(function () {
  const S = window.SPRITES || {};
  const img = {};
  const A = G.assets = { img, meta: S };

  A.load = function (onProgress) {
    const list = [];
    for (const k in S) {
      if (k.startsWith('_')) { for (const n in S[k]) list.push([k + ':' + n, S[k][n].img]); }
      else list.push([k, S[k].img]);
    }
    let done = 0;
    return Promise.all(list.map(([key, src]) => new Promise((res) => {
      const im = new Image();
      im.onload = () => { img[key] = im; done++; onProgress && onProgress(done / list.length); res(); };
      im.onerror = () => { console.warn('이미지 없음', src); done++; res(); };
      im.src = src;
    })));
  };

  A.prop = (n) => img['_props:' + n];
  A.ui = (n) => img['_ui:' + n];
  A.bg = (n) => img['_bg:' + n];
  A.tile = (n) => img['_tiles:' + n];
  A.uiSrc = (n) => (S._ui && S._ui[n] ? S._ui[n].img : '');

  // 애니메이션 프레임 그리기. (x, y)는 발밑 피벗 위치(월드 좌표가 아닌 화면 논리 좌표)
  A.frame = function (ctx, sheet, anim, t, x, y, flip, opt) {
    const m = S[sheet], im = img[sheet];
    if (!m || !im) return;
    const a = m.anims[anim];
    if (!a || a.n === 0) return;
    const loop = !(opt && opt.once);
    let f = Math.floor(t * a.fps);
    f = loop ? f % a.n : Math.min(f, a.n - 1);
    const i = a.start + f;
    const sx = (i % m.cols) * m.fw, sy = Math.floor(i / m.cols) * m.fh;
    const sc = (opt && opt.scale) || 1;
    ctx.save();
    if (opt && opt.alpha !== undefined) ctx.globalAlpha *= opt.alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (flip) ctx.scale(-1, 1);
    if (opt && (opt.sx || opt.sy)) ctx.scale(opt.sx || 1, opt.sy || 1);
    if (sc !== 1) ctx.scale(sc, sc);
    ctx.drawImage(im, sx, sy, m.fw, m.fh, -m.px, -m.py, m.fw, m.fh);
    if (opt && opt.flash) {
      // 흰색 번쩍임: 같은 프레임을 밝게 덧칠
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= opt.flash;
      ctx.drawImage(im, sx, sy, m.fw, m.fh, -m.px, -m.py, m.fw, m.fh);
      ctx.drawImage(im, sx, sy, m.fw, m.fh, -m.px, -m.py, m.fw, m.fh);
    }
    ctx.restore();
  };
  A.animLen = (sheet, anim) => { const a = S[sheet] && S[sheet].anims[anim]; return a ? a.n / a.fps : 0; };

  // 소품: anchor 'bottom'이면 (x,y)가 바닥 가운데
  A.drawProp = function (ctx, name, x, y, opt) {
    const im = A.prop(name);
    if (!im) return;
    const o = opt || {};
    const s = o.scale || 1;
    const w = im.width * s, h = im.height * s;
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (o.flip) ctx.scale(-1, 1);
    if (o.center) ctx.drawImage(im, -w / 2, -h / 2, w, h);
    else ctx.drawImage(im, -w / 2, -h, w, h);
    ctx.restore();
  };
})();
