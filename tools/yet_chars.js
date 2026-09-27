// 게임 속 모든 글(원문·풀이·문제·편람·게임 설정)을 옛한글로 조합한 뒤 쓰인 글자만 뽑는다.
// 사용: node tools/yet_chars.js > chars.txt   (build_yet_font.py가 부른다)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let quiet = false;   // 코드 조각의 [i] 같은 대괄호는 옛한글이 아니므로 경고를 끈다
const ctx = { console: { log: console.log, warn: (...a) => { if (!quiet) console.warn(...a); } } };
ctx.window = ctx;
ctx.document = { documentElement: { style: { setProperty() {} } }, createElement: () => ({ getContext: () => null }) };
vm.createContext(ctx);
for (const f of ['js/core/util.js', 'js/data/text.js', 'js/data/game.js', 'js/game/levels.js']) {
  let src = fs.readFileSync(path.join(root, f), 'utf8');
  if (f.endsWith('levels.js')) src = '';   // 레벨 파일의 글은 아래에서 따로 읽는다
  vm.runInContext(src, ctx, { filename: f });
}
const G = ctx.G;
const chars = new Set();
const walk = (v) => {
  if (typeof v === 'string') { for (const s of [v, G.yet(v), G.yet(G.stripHanja(v))]) for (const c of s) chars.add(c); }
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object') Object.values(v).forEach(walk);
};
walk(ctx.KB);
walk(ctx.GD);
// 코드 속 한국어 문자열(대사·안내)도 함께
quiet = true;
for (const f of ['js/game/levels.js', 'js/game/ending.js', 'js/game/bosses.js', 'js/game/scenes.js', 'js/core/ui.js']) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  for (const m of src.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)) walk(m[1] || m[2] || m[3] || '');
}
process.stdout.write([...chars].filter((c) => c.codePointAt(0) > 0x20).join(''));
