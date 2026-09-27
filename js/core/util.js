'use strict';
// 공용 유틸리티 · 옛한글 조합기
const G = window.G = window.G || {};
G.W = 640;          // 논리 해상도
G.H = 360;
G.TS = 32;          // PPU(타일 한 칸의 픽셀 수)

const U = G.util = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  approach: (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t)),
  rand: (a, b) => a + Math.random() * (b - a),
  randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  choice: (arr) => arr[Math.floor(Math.random() * arr.length)],
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  },
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  overlap: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
  dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
  esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  // 코루틴 도우미: 초 단위 대기
  sleep: (sec) => new Promise((r) => setTimeout(r, sec * 1000)),
};

// ---------------------------------------------------------------------------
// 옛한글 조합기
// 원문 데이터에서 [ㅎㆍ]처럼 대괄호 안에 호환 자모를 적으면 옛한글 음절로 조합한다.
// 현대 음절로 쓸 수 있으면 완성형으로, 아니면 첫가끝(조합형) 자모열로 만든다.
// ---------------------------------------------------------------------------
(function () {
  const L = { 'ㄱ': 0x1100, 'ㄲ': 0x1101, 'ㄴ': 0x1102, 'ㄷ': 0x1103, 'ㄸ': 0x1104, 'ㄹ': 0x1105, 'ㅁ': 0x1106, 'ㅂ': 0x1107, 'ㅃ': 0x1108, 'ㅅ': 0x1109, 'ㅆ': 0x110A, 'ㅇ': 0x110B, 'ㅈ': 0x110C, 'ㅉ': 0x110D, 'ㅊ': 0x110E, 'ㅋ': 0x110F, 'ㅌ': 0x1110, 'ㅍ': 0x1111, 'ㅎ': 0x1112,
    'ㅿ': 0x1140, 'ㆁ': 0x114C, 'ㆆ': 0x1159, 'ㅸ': 0x112B, 'ㅂㅇ': 0x112B,
    'ㄴㄱ': 0x1113, 'ㄴㄴ': 0x1114, 'ㄴㄷ': 0x1115, 'ㄴㅂ': 0x1116, 'ㄷㄱ': 0x1117, 'ㄹㄴ': 0x1118, 'ㄹㄹ': 0x1119, 'ㄹㅎ': 0x111A, 'ㅁㅂ': 0x111C, 'ㅁㅇ': 0x111D,
    'ㅂㄱ': 0x111E, 'ㅂㄴ': 0x111F, 'ㅂㄷ': 0x1120, 'ㅂㅅ': 0x1121, 'ㅂㅅㄱ': 0x1122, 'ㅂㅅㄷ': 0x1123, 'ㅂㅅㅂ': 0x1124, 'ㅂㅅㅅ': 0x1125, 'ㅂㅅㅈ': 0x1126, 'ㅂㅈ': 0x1127, 'ㅂㅊ': 0x1128, 'ㅂㅌ': 0x1129, 'ㅂㅍ': 0x112A,
    'ㅅㄱ': 0x112D, 'ㅅㄴ': 0x112E, 'ㅅㄷ': 0x112F, 'ㅅㄹ': 0x1130, 'ㅅㅁ': 0x1131, 'ㅅㅂ': 0x1132, 'ㅅㅂㄱ': 0x1133, 'ㅅㅅㅅ': 0x1134, 'ㅅㅇ': 0x1135, 'ㅅㅈ': 0x1136, 'ㅅㅊ': 0x1137, 'ㅅㅋ': 0x1138, 'ㅅㅌ': 0x1139, 'ㅅㅍ': 0x113A, 'ㅅㅎ': 0x113B,
    'ㅇㅇ': 0x1147 };
  const V = { 'ㅏ': 0x1161, 'ㅐ': 0x1162, 'ㅑ': 0x1163, 'ㅒ': 0x1164, 'ㅓ': 0x1165, 'ㅔ': 0x1166, 'ㅕ': 0x1167, 'ㅖ': 0x1168, 'ㅗ': 0x1169, 'ㅘ': 0x116A, 'ㅙ': 0x116B, 'ㅚ': 0x116C, 'ㅛ': 0x116D, 'ㅜ': 0x116E, 'ㅝ': 0x116F, 'ㅞ': 0x1170, 'ㅟ': 0x1171, 'ㅠ': 0x1172, 'ㅡ': 0x1173, 'ㅢ': 0x1174, 'ㅣ': 0x1175,
    'ㅗㅏ': 0x116A, 'ㅗㅐ': 0x116B, 'ㅗㅣ': 0x116C, 'ㅜㅓ': 0x116F, 'ㅜㅔ': 0x1170, 'ㅜㅣ': 0x1171, 'ㅡㅣ': 0x1174,
    'ㆍ': 0x119E, 'ㆍㅣ': 0x11A1, 'ㆎ': 0x11A1, 'ㆍㅓ': 0x119F, 'ㆍㅜ': 0x11A0, 'ㆍㆍ': 0x11A2, 'ㅑㅗ': 0x1184, 'ㅕㅣ': 0x1168 };
  const T = { 'ㄱ': 0x11A8, 'ㄲ': 0x11A9, 'ㄱㅅ': 0x11AA, 'ㄴ': 0x11AB, 'ㄴㅈ': 0x11AC, 'ㄴㅎ': 0x11AD, 'ㄷ': 0x11AE, 'ㄹ': 0x11AF, 'ㄹㄱ': 0x11B0, 'ㄹㅁ': 0x11B1, 'ㄹㅂ': 0x11B2, 'ㄹㅅ': 0x11B3, 'ㄹㅌ': 0x11B4, 'ㄹㅍ': 0x11B5, 'ㄹㅎ': 0x11B6, 'ㅁ': 0x11B7, 'ㅂ': 0x11B8, 'ㅂㅅ': 0x11B9, 'ㅅ': 0x11BA, 'ㅆ': 0x11BB, 'ㅇ': 0x11BC, 'ㅈ': 0x11BD, 'ㅊ': 0x11BE, 'ㅋ': 0x11BF, 'ㅌ': 0x11C0, 'ㅍ': 0x11C1, 'ㅎ': 0x11C2,
    'ㅿ': 0x11EB, 'ㆁ': 0x11F0, 'ㆆ': 0x11F9, 'ㄹㆆ': 0x11D9, 'ㅁㅿ': 0x11E0, 'ㄹㅿ': 0x11D7, 'ㅅㄱ': 0x11E7, 'ㅅㄷ': 0x11E8, 'ㅂㅇ': 0x11E6, 'ㅸ': 0x11E6 };
  // 호환 자모 겹글자 → 낱자 풀기
  const SPLIT = { 'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ',
    'ㅺ': 'ㅅㄱ', 'ㅻ': 'ㅅㄴ', 'ㅼ': 'ㅅㄷ', 'ㅽ': 'ㅅㅂ', 'ㅾ': 'ㅅㅈ', 'ㅲ': 'ㅂㄱ', 'ㅳ': 'ㅂㄷ', 'ㅴ': 'ㅂㅅㄱ', 'ㅵ': 'ㅂㅅㄷ', 'ㅶ': 'ㅂㅈ', 'ㅷ': 'ㅂㅌ' };
  const MOD_L = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const MOD_V = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
  const MOD_T = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const VOWELS = new Set('ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣㆍㆎ');
  const VCOMPOSE = { 'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ' };

  function syllable(group) {
    let s = '';
    for (const ch of group) s += SPLIT[ch] || ch;
    let i = 0, l = '', v = '', t = '';
    while (i < s.length && !VOWELS.has(s[i])) l += s[i++];
    while (i < s.length && VOWELS.has(s[i])) v += s[i++];
    t = s.slice(i);
    if (!l || !v) return null;
    const vm = VCOMPOSE[v] || v;
    const li = MOD_L.indexOf(l), vi = MOD_V.indexOf(vm), ti = MOD_T.indexOf(t);
    if (l.length === 1 && li >= 0 && vi >= 0 && ti >= 0) {
      return String.fromCharCode(0xAC00 + (li * 21 + vi) * 28 + ti);
    }
    const lc = L[l], vc = V[v] || V[vm], tc = t ? T[t] : 0;
    if (!lc || !vc || (t && !tc)) return null;
    return String.fromCharCode(lc, vc) + (tc ? String.fromCharCode(tc) : '');
  }

  // "[ㅎㆍ]다" → "ᄒᆞ다"
  G.yet = function (text) {
    if (!text || text.indexOf('[') < 0) return text || '';
    return text.replace(/\[([^\]\[]{1,8})\]/g, (m, g) => {
      const r = syllable(g);
      if (r === null) { console.warn('옛한글 조합 실패:', m); return g; }
      return r;
    });
  };
  // 한자 병기 제거: "강호(江湖)애" → "강호애"
  G.stripHanja = (text) => (text || '').replace(/\(([㐀-鿿豈-﫿·\s]+)\)/g, '');
  // 표시용 원문: 옛한글 조합 + (선택) 한자 제거
  G.origText = (text, hanja) => G.yet(hanja ? text : G.stripHanja(text));
})();

// 옛한글을 제대로 조합해 그리는 글꼴을 찾아 CSS 변수(--yet)에 넣는다.
G.pickYetFont = async function () {
  const candidates = ['Noto Serif KR', 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', 'Noto Serif CJK KR', 'Noto Sans CJK KR', 'Source Han Serif K', 'Noto Sans KR', 'HCR Batang', '함초롬바탕', 'NanumMyeongjo YetHangul'];
  const probe = G.yet('[ㅎㆍ][ㄷㆍ][ㅂㆍㄹ]');
  const c = document.createElement('canvas').getContext('2d');
  try { await document.fonts.load('32px "Noto Serif KR"', probe + '가'); } catch (e) { /* 오프라인 */ }
  for (const f of candidates) {
    c.font = `32px "${f}", monospace`;
    const w = c.measureText(probe).width;
    const ref = c.measureText('가가가').width;
    c.font = '32px monospace';
    const fallback = c.measureText(probe).width;
    // 조합되면 세 음절 폭(≈ '가가가')과 비슷하고, 대체 글꼴 결과와 달라야 한다.
    if (Math.abs(w - ref) < ref * 0.25 && Math.abs(w - fallback) > 1) {
      document.documentElement.style.setProperty('--yet', `"${f}", serif`);
      G.yetFont = f;
      return f;
    }
  }
  G.yetFont = null;
  return null;
};
