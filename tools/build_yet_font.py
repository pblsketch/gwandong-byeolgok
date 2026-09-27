"""옛한글 웹 글꼴 만들기: Noto Serif KR에서 게임에 쓰인 글자 + 옛한글 자모 전체만 남긴다.

휴대폰마다 기본 글꼴이 달라 옛한글(ᄒᆞ, ᄯᅥ …)이 풀어져 보이는 문제를 막으려고,
옛한글 조합 기능(ljmo·vjmo·tjmo)이 있는 Noto Serif KR을 게임에 직접 넣는다.
자모 블록은 통째로 남기므로 원문을 고쳐 새 옛한글 음절이 생겨도 조합은 된다.
(현대 한글·한자를 새로 넣었다면 이 스크립트를 다시 돌리면 된다. 없어도 다른 글꼴로 대신 보인다.)

준비: pip install fonttools brotli
원본: https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/KR/NotoSerifKR-Regular.otf
      → assets/raw/NotoSerifKR-Regular.otf 에 둔다(저장소에는 올리지 않는다)
실행: python tools/build_yet_font.py
결과: assets/fonts/yet-serif.woff2
"""
import subprocess
import sys
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'raw' / 'NotoSerifKR-Regular.otf'
OUT = ROOT / 'assets' / 'fonts' / 'yet-serif.woff2'

# 옛한글 자모(첫가끝), 확장 A·B, 호환 자모, 기본 라틴·문장 부호
RANGES = [(0x1100, 0x11FF), (0xA960, 0xA97F), (0xD7B0, 0xD7FF), (0x3130, 0x318F), (0x0020, 0x007E),
          (0x00B7, 0x00B7), (0x2010, 0x2027), (0x2190, 0x2193), (0x25B2, 0x25BC), (0x3000, 0x3011)]


def main():
    if not SRC.exists():
        sys.exit(f'원본 글꼴이 없어요: {SRC}\n(모듈 설명의 주소에서 받아 두세요)')
    chars = subprocess.run(['node', str(ROOT / 'tools' / 'yet_chars.js')], capture_output=True, check=True).stdout.decode('utf-8')
    cps = {ord(c) for c in chars}
    for a, b in RANGES:
        cps.update(range(a, b + 1))
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['ccmp', 'ljmo', 'vjmo', 'tjmo', 'locl', 'kern', 'palt']
    opts.name_IDs = ['*']
    opts.name_languages = ['*']
    opts.notdef_outline = True
    opts.hinting = False
    font = subset.load_font(str(SRC), opts)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=sorted(cps))
    sub.subset(font)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(OUT), opts)
    print(f'{OUT.relative_to(ROOT)}: 글자 {len(cps)}개, 글리프 {len(font.getGlyphOrder())}개, {OUT.stat().st_size / 1024:.0f} KB')


if __name__ == '__main__':
    main()
