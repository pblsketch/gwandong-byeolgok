'use strict';
// 진행 저장: 이 브라우저에만 남는다(서버로 보내지 않음). 저장이 막힌 환경에서도 게임은 그대로 돌아간다.
(function () {
  const KEY = 'gwandong_byeolgok_save_v1';
  const blank = () => ({
    cleared: {},          // 레벨 id → true
    scrolls: {},          // 두루마리 id → true
    people: {},           // 인물 카드 id → true
    quiz: {},             // 문제 id → { ok: 처음 맞혔는지, tries }
    mind: {},             // 마음 읽기로 찍은 점: 두루마리 id → true
    seen: {},             // 한 번 본 게임 설정 카드
    settings: { difficulty: 'normal', hanja: true, modern: true, music: true },
    ink: 0,               // 먹 조각(점수)
    playTime: 0,
    ending: null,         // 'true' | 'whatif'
    unlock: { okjeol: false, feather: false },
    name: '',
  });
  const S = G.save = { data: blank() };
  S.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw), b = blank();
        S.data = Object.assign(b, d, { settings: Object.assign(b.settings, d.settings || {}), unlock: Object.assign(b.unlock, d.unlock || {}) });
      }
    } catch (e) { /* 저장 불가 환경 */ }
    return S.data;
  };
  S.write = function () { try { localStorage.setItem(KEY, JSON.stringify(S.data)); } catch (e) { /* 무시 */ } };
  S.reset = function () { const keep = S.data.settings; S.data = blank(); S.data.settings = keep; S.write(); };
  S.hasProgress = () => Object.keys(S.data.cleared).length > 0 || Object.keys(S.data.scrolls).length > 0;
  S.recordQuiz = function (id, ok) {
    const q = S.data.quiz[id] || { ok: null, tries: 0 };
    if (q.tries === 0) q.ok = ok;
    q.tries++;
    S.data.quiz[id] = q; S.write();
  };
})();
