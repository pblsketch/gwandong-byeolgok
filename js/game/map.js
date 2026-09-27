'use strict';
// 관동 지도 월드맵. 해안선과 장소는 실제 위도·경도를 대략 투영해 코드로 그린다(AI 그림의 지리를 믿지 않는다).
(function () {
  const U = G.util, A = G.assets, esc = U.esc;
  const K = 121, X0 = 352, Y0 = 12;
  const proj = (lat, lon) => ({ x: X0 + (lon - 126.8) * K * 0.788, y: Y0 + (39.3 - lat) * K });

  // 대략의 위치(위도, 경도)
  const PLACES = {
    '한양': [37.57, 126.98], '평구역': [37.6, 127.2], '흑수': [37.3, 127.63], '섬강': [37.34, 127.84], '치악': [37.37, 128.05],
    '소양강': [37.9, 127.73], '동주 북관정': [38.2, 127.2], '궁왕 대궐 터': [38.33, 127.28], '회양': [38.7, 127.6],
    '명사길': [38.74, 128.14], '총석정': [38.84, 128.0], '삼일포': [38.62, 128.33],
    '의상대': [38.12, 128.63], '경포': [37.8, 128.9], '강릉': [37.74, 128.84], '죽서루': [37.44, 129.16], '망양정': [36.79, 129.45],
  };
  // 금강산 안쪽(내금강)은 너무 촘촘해서 바다 쪽 빈 곳에 확대 상자로 따로 그린다
  const GEUMGANG = [38.63, 128.08];
  const INSET = { x: 510, y: 8, w: 124, h: 108 };
  const INNER = { '만폭동': [0.06, 0.86], '금강대': [0.1, 0.6], '진헐대': [0.2, 0.36], '망고대·혈망봉': [0.44, 0.14], '개심대': [0.56, 0.42], '비로봉': [0.9, 0.3], '화룡소': [0.78, 0.6], '불정대': [0.46, 0.8], '산영루': [0.92, 0.9] };
  const SIDE = { '의상대': 'r', '경포': 'r', '강릉': 'l', '죽서루': 'r', '망양정': 'r', '삼일포': 'b', '총석정': 'l', '명사길': 'b', '회양': 'l', '궁왕 대궐 터': 'l', '동주 북관정': 'l', '소양강': 'r', '한양': 'l', '평구역': 't', '흑수': 'b', '섬강': 'b', '치악': 'r' };
  const COAST = [[39.3, 127.4], [39.15, 127.47], [39.05, 127.6], [38.95, 127.75], [38.85, 127.95], [38.78, 128.07], [38.7, 128.2], [38.62, 128.35], [38.5, 128.42], [38.38, 128.47], [38.25, 128.55], [38.12, 128.64], [38.0, 128.72], [37.88, 128.82], [37.77, 128.93], [37.65, 129.03], [37.52, 129.12], [37.4, 129.2], [37.25, 129.3], [37.1, 129.38], [36.95, 129.42], [36.8, 129.46], [36.65, 129.45], [36.5, 129.43]];
  const LEVEL_PLACES = {
    P1: ['한양'], '1A': ['평구역', '흑수', '섬강', '치악'], '1B': ['소양강', '동주 북관정', '궁왕 대궐 터', '회양'],
    '2A': ['만폭동', '금강대'], '2B': ['진헐대', '망고대·혈망봉', '개심대', '비로봉'], '2C': ['화룡소', '불정대'],
    '3A': ['산영루', '명사길', '총석정', '삼일포'], '3B': ['의상대'], '3C': ['경포', '강릉', '죽서루'], '4': ['망양정'], E: ['망양정'],
  };
  G.LEVEL_PLACES = LEVEL_PLACES;
  function pos(name) {
    if (INNER[name]) return { x: INSET.x + 14 + INNER[name][0] * (INSET.w - 28), y: INSET.y + 18 + INNER[name][1] * (INSET.h - 28), inner: true };
    const p = PLACES[name]; return p ? proj(...p) : null;
  }
  G.mapPos = pos;

  // 지도 그리기(결과 화면에서도 쓴다)
  G.drawMap = function (ctx, t, opt = {}) {
    const d = G.save.data;
    const pap = A.ui('paper');
    ctx.imageSmoothingEnabled = true;
    if (pap) ctx.drawImage(pap, 0, 0, G.W, G.H); else { ctx.fillStyle = '#e9dcbd'; ctx.fillRect(0, 0, G.W, G.H); }
    ctx.save();
    ctx.translate(Math.max(0, G.W - 640), 0);
    // 바다
    const pts = COAST.map((c) => proj(...c));
    ctx.save();
    ctx.beginPath(); ctx.moveTo(pts[0].x, 0);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(G.W, G.H); ctx.lineTo(G.W, 0); ctx.closePath();
    const g = ctx.createLinearGradient(420, 0, G.W, 0);
    g.addColorStop(0, 'rgba(70,110,130,.45)'); g.addColorStop(1, 'rgba(40,80,110,.6)');
    ctx.fillStyle = g; ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(240,248,250,.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) { const y = 20 + i * 19, x = 520 + ((i * 37 + t * 8) % 60); ctx.beginPath(); ctx.arc(x, y, 6, Math.PI, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 14, y, 6, Math.PI, 0); ctx.stroke(); }
    ctx.restore();
    // 해안선(붓)
    ctx.strokeStyle = 'rgba(40,30,20,.8)'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    // 산줄기
    const icon = (n, lat, lon, s, a = 0.85) => { const im = A.ui('map_' + n); if (!im) return; const p = proj(lat, lon); ctx.globalAlpha = a; ctx.drawImage(im, p.x - im.width * s / 2, p.y - im.height * s / 2, im.width * s, im.height * s); ctx.globalAlpha = 1; };
    icon('range', 38.25, 128.35, 0.42); icon('range', 37.85, 128.55, 0.42); icon('range', 37.45, 128.8, 0.42); icon('range', 37.05, 129.05, 0.42);
    icon('mountain', 37.37, 128.05, 0.32); icon('mountain', 38.0, 127.9, 0.3, 0.6);
    icon('peaks', GEUMGANG[0], GEUMGANG[1], 0.5, 0.9);
    icon('village', 37.57, 126.98, 0.3);
    // 금강산 확대 상자
    const gc = proj(...GEUMGANG);
    ctx.save();
    ctx.strokeStyle = 'rgba(60,45,30,.55)'; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(gc.x, gc.y, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gc.x + 12, gc.y - 10); ctx.lineTo(INSET.x, INSET.y + INSET.h - 10); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(243,234,212,.93)'; ctx.fillRect(INSET.x, INSET.y, INSET.w, INSET.h);
    ctx.strokeStyle = 'rgba(60,45,30,.7)'; ctx.strokeRect(INSET.x + 0.5, INSET.y + 0.5, INSET.w - 1, INSET.h - 1);
    const pk = A.ui('map_peaks');
    if (pk) { ctx.globalAlpha = 0.35; const s2 = 0.9; ctx.drawImage(pk, INSET.x + INSET.w / 2 - pk.width * s2 / 2, INSET.y + INSET.h / 2 - pk.height * s2 / 2 + 6, pk.width * s2, pk.height * s2); ctx.globalAlpha = 1; }
    ctx.restore();
    lab(ctx, '금강산 확대 (내금강→동해)', INSET.x + INSET.w / 2, INSET.y + 10, 7, '#5c4b33');
    lab(ctx, '금강산', gc.x, gc.y + 26, 7.5, '#5c4b33');
    // 창평(지도 밖)
    const hy = proj(37.0, 126.98);
    ctx.fillStyle = 'rgba(60,45,30,.7)'; ctx.font = '8px "Gowun Batang", serif'; ctx.textAlign = 'center';
    ctx.fillText('↑ 창평(전남 담양)에서', hy.x + 6, G.H - 8);
    // 여정 선
    const order = G.scenes.order();
    const seq = [];
    for (const lv of order) for (const n of LEVEL_PLACES[lv] || []) if (!seq.length || seq[seq.length - 1].n !== n) seq.push({ n, lv });
    const anchor = (n, other) => (INNER[n] && !INNER[other] ? gc : pos(n));
    for (let i = 1; i < seq.length; i++) {
      const a = anchor(seq[i - 1].n, seq[i].n), b = anchor(seq[i].n, seq[i - 1].n);
      const done = d.cleared[seq[i].lv];
      ctx.strokeStyle = done ? 'rgba(179,38,30,.9)' : 'rgba(60,45,30,.35)';
      ctx.lineWidth = done ? 2 : 1;
      ctx.setLineDash(done ? [] : [3, 3]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    // 장소 점
    const hi = opt.highlight ? LEVEL_PLACES[opt.highlight] || [] : [];
    for (const s of seq) {
      const p = pos(s.n);
      const done = d.cleared[s.lv], on = hi.includes(s.n);
      ctx.fillStyle = done ? '#b3261e' : on ? '#e0a92a' : 'rgba(60,45,30,.6)';
      ctx.beginPath(); ctx.arc(p.x, p.y, on ? 3.6 + Math.sin(t * 6) : 2.6, 0, Math.PI * 2); ctx.fill();
      const sd = INNER[s.n] ? 't' : SIDE[s.n] || 't';
      const lx = sd === 'r' ? p.x + 6 : sd === 'l' ? p.x - 6 : p.x, ly = sd === 't' ? p.y - 6 : sd === 'b' ? p.y + 11 : p.y + 3;
      lab(ctx, s.n, lx, ly, INNER[s.n] ? 7 : on ? 8.5 : 7.5, on ? '#7f1a14' : '#2a2118', sd === 'r' ? 'left' : sd === 'l' ? 'right' : 'center');
    }
    // 말 탄 나그네
    if (opt.highlight && hi.length) {
      const p = pos(hi[0]);
      const im = A.ui('map_rider');
      if (im) { const s = 0.32; ctx.drawImage(im, p.x - im.width * s / 2, p.y - im.height * s - 4 + Math.sin(t * 4) * 1.5, im.width * s, im.height * s); }
    }
    ctx.restore();
  };
  function lab(ctx, s, x, y, size, color, align = 'center') {
    ctx.font = `700 ${size}px "Gowun Batang", serif`; ctx.textAlign = align;
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(243,234,212,.9)'; ctx.strokeText(s, x, y);
    ctx.fillStyle = color; ctx.fillText(s, x, y);
  }

  // ---------------------------------------------------------------- 월드맵 장면
  class MapScene {
    constructor(next) { this.next = next; this.t = 0; }
    enter() {
      G.audio.play('title');
      const d = G.save.data;
      const SC = G.scenes;
      const order = SC.order();
      this.sel = this.next || order.find((lv) => !d.cleared[lv]) || order[0];
      const lvName = (id) => G.levels[id].name;
      const chs = window.GD.chapters.map((c) => `
        <div style="margin-bottom:calc(var(--u)*6)">
          <div style="font-family:var(--serif);font-weight:700;font-size:calc(var(--u)*10.5)">${esc(c.name)} <span style="font-weight:400;font-size:calc(var(--u)*8.5);color:#6b5a40">${esc(c.title)}</span></div>
          <div style="display:flex;flex-wrap:wrap;gap:calc(var(--u)*4);margin-top:calc(var(--u)*3)">
            ${c.levels.map((lv) => `<button class="btn ${d.cleared[lv] ? 'ghost' : ''}" data-lv="${lv}" ${SC.isUnlocked(lv) ? '' : 'disabled style="opacity:.4"'}>${d.cleared[lv] ? '✓ ' : ''}${esc(lvName(lv))}${!d.cleared[lv] && !SC.isUnlocked(lv) ? ' · 잠김' : ''}</button>`).join('')}
          </div></div>`).join('');
      const el = G.ui.add(`
        <div class="panel hanji" style="position:absolute;left:calc(var(--u)*12);top:calc(var(--u)*12);width:calc(var(--u)*318);height:calc(var(--u)*336);padding:calc(var(--u)*12) calc(var(--u)*14);display:flex;flex-direction:column">
          <div style="font-family:var(--serif);font-weight:900;font-size:calc(var(--u)*15);margin-bottom:calc(var(--u)*6)"><b class="seal-s">路</b>관동 팔백 리 여정</div>
          <div class="scrollbox" style="flex:1">${chs}</div>
          <div style="display:flex;gap:calc(var(--u)*5);align-items:center;margin-top:calc(var(--u)*6)">
            <button class="btn red" data-a="go" style="flex:1">▶ 출발: <span class="gname"></span></button>
            <button class="btn ghost" data-a="book">편람</button>
            <button class="btn ghost" data-a="title">타이틀</button>
          </div>
          <label style="font-size:calc(var(--u)*8);color:#6b5a40;margin-top:calc(var(--u)*5);display:flex;gap:calc(var(--u)*4);align-items:center"><input type="checkbox" data-a="teacher" ${d.teacher ? 'checked' : ''}> 선생님용: 모든 장 열기</label>
        </div>`, 'menu');
      const gname = el.querySelector('.gname');
      const refresh = () => { gname.textContent = lvName(this.sel); el.querySelectorAll('[data-lv]').forEach((b) => b.classList.toggle('focus', b.dataset.lv === this.sel)); };
      refresh();
      el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-lv],[data-a]'); if (!b) return;
        if (b.dataset.lv) { this.sel = b.dataset.lv; G.audio.sfx('select'); refresh(); return; }
        const a = b.dataset.a;
        if (a === 'go') { G.screen.auto(); G.audio.sfx('confirm'); await SC.fade(0.4); SC.startLevel(this.sel); }
        if (a === 'book') await G.ui.book();
        if (a === 'title') SC.go(new G.TitleScene());
      });
      el.addEventListener('change', (e) => { if (e.target.dataset.a === 'teacher') { d.teacher = e.target.checked; G.save.write(); SC.go(new MapScene(this.sel)); } });
      this.key = (act) => {
        if (G.ui.blocking > 0) return false;
        const avail = order.filter((lv) => SC.isUnlocked(lv));
        const i = avail.indexOf(this.sel);
        if (act === 'right' || act === 'down') { this.sel = avail[Math.min(avail.length - 1, i + 1)]; refresh(); G.audio.sfx('select'); }
        else if (act === 'left' || act === 'up') { this.sel = avail[Math.max(0, i - 1)]; refresh(); G.audio.sfx('select'); }
        else if (act === 'ok' || act === 'jump') { el.querySelector('[data-a="go"]').click(); }
        else return false;
        return true;
      };
      G.input.listeners.push(this.key);
    }
    exit() { const i = G.input.listeners.indexOf(this.key); if (i >= 0) G.input.listeners.splice(i, 1); }
    update(dt) { this.t += dt; }
    draw(ctx) { G.drawMap(ctx, this.t, { highlight: this.sel }); }
  }
  G.MapScene = MapScene;
})();
