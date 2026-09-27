# -*- coding: utf-8 -*-
"""Codex로 만든 원본(assets/raw)을 게임용 에셋으로 가공한다.

영상에서 배운 규칙을 코드로 옮겼다.
  1) 배경 제거: 마젠타 단색 배경이면 색으로 빼고, 이미 투명하면 알파를 정리한다.
  2) 프레임 자동 검출: 연결 영역을 찾아 행/열 순서로 정렬한다(격자가 어긋나도 괜찮다).
  3) 발밑 피벗: 발 부분의 가운데를 기준점으로 모든 프레임을 같은 칸에 정렬한다(프레임이 바뀔 때 튀지 않게).
  4) PPU 기준 축소: 주인공 키를 기준으로 같은 배율을 적용해 크기 비율을 맞춘다.
실행: python tools/process_assets.py [이름...]
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "assets", "raw")
OUT_S = os.path.join(ROOT, "assets", "sprites")
OUT_B = os.path.join(ROOT, "assets", "bg")
OUT_U = os.path.join(ROOT, "assets", "ui")
for d in (OUT_S, OUT_B, OUT_U):
    os.makedirs(d, exist_ok=True)
META_PATH = os.path.join(ROOT, "assets", "sprites.json")


# ---------------------------------------------------------------- 공통
def load_rgba(name):
    im = Image.open(os.path.join(RAW, name + ".png")).convert("RGBA")
    a = np.array(im).astype(np.int16)
    rgb, alpha = a[..., :3], a[..., 3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    magenta = (r > 170) & (b > 170) & (g < 110) & (np.abs(r - b) < 70)
    if alpha.min() == 255 or magenta.mean() > 0.3:
        alpha = np.where(magenta, 0, alpha)
        # 가장자리 마젠타 번짐 제거(despill)
        spill = (alpha > 0) & (r > g + 40) & (b > g + 40)
        m = np.minimum(r, b)
        rgb[..., 0] = np.where(spill, np.minimum(r, g + (m - g) // 3 + 20), r)
        rgb[..., 2] = np.where(spill, np.minimum(b, g + (m - g) // 3 + 20), b)
        near = ndimage.binary_dilation(alpha == 0, iterations=1) & (alpha > 0)
        weak = near & (r > 150) & (b > 150) & (g < 140)
        alpha = np.where(weak, 0, alpha)
    out = np.dstack([rgb, alpha]).clip(0, 255).astype(np.uint8)
    return out


def components(arr, merge=14, min_area=400):
    """알파 영역을 덩어리로 나눈다. merge 픽셀 안의 조각(먹물 방울, 깃털)은 한 프레임으로 합친다."""
    mask = arr[..., 3] > 40
    big = ndimage.binary_dilation(mask, iterations=merge)
    lab, n = ndimage.label(big)
    boxes = []
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        if sl is None:
            continue
        sub = (lab[sl] == i) & mask[sl]
        if sub.sum() < min_area:
            continue
        ys, xs = np.nonzero(sub)
        y0, x0 = sl[0].start + ys.min(), sl[1].start + xs.min()
        y1, x1 = sl[0].start + ys.max() + 1, sl[1].start + xs.max() + 1
        boxes.append([x0, y0, x1, y1, i])
    return boxes, lab, mask


def rows_of(boxes, tol=0.45):
    """박스를 행으로 묶고 각 행을 x순으로 정렬한다."""
    boxes = sorted(boxes, key=lambda b: (b[1] + b[3]) / 2)
    rows = []
    for b in boxes:
        cy, h = (b[1] + b[3]) / 2, b[3] - b[1]
        if rows:
            r = rows[-1]
            rcy = np.mean([(x[1] + x[3]) / 2 for x in r])
            rh = np.mean([x[3] - x[1] for x in r])
            if abs(cy - rcy) < max(h, rh) * tol:
                r.append(b)
                continue
        rows.append([b])
    return [sorted(r, key=lambda b: b[0]) for r in rows]


def crop(arr, lab, mask, b):
    x0, y0, x1, y1, i = b
    sub = arr[y0:y1, x0:x1].copy()
    if lab is None:
        keep = mask[y0:y1, x0:x1]
    else:
        keep = (lab[y0:y1, x0:x1] == i) & mask[y0:y1, x0:x1]
    sub[..., 3] = np.where(keep, sub[..., 3], 0)
    # 여백 잘라 내기
    ys, xs = np.nonzero(sub[..., 3] > 40)
    if len(ys):
        sub = sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return sub


def split_1d(proj, n, min_gap=2):
    """1차원 투영에서 내용 구간을 n개로 나눈다. 빈 틈 중 넓은 것부터 고르되, 너무 치우치면 균등 분할점에 가까운 틈을 쓴다."""
    idx = np.nonzero(proj > 0)[0]
    if len(idx) == 0:
        return []
    lo, hi = idx.min(), idx.max() + 1
    gaps, run = [], None
    for x in range(lo, hi):
        if proj[x] == 0:
            run = x if run is None else run
        elif run is not None:
            if x - run >= min_gap:
                gaps.append((run, x))
            run = None
    if n <= 1:
        return [(lo, hi)]

    def segs(cuts):
        pts = [lo] + [c for c in cuts] + [hi]
        return [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]

    def ok(sg):
        ws = [b - a for a, b in sg]
        return min(ws) > 0.45 * np.median(ws)

    by_width = sorted(gaps, key=lambda g: -(g[1] - g[0]))[: n - 1]
    cuts = sorted((a + b) // 2 for a, b in by_width)
    if len(cuts) == n - 1 and ok(segs(cuts)):
        return segs(cuts)
    # 균등 분할점 근처의 틈(없으면 투영이 가장 얇은 곳)을 쓴다
    cuts = []
    W = hi - lo
    for i in range(1, n):
        target = lo + W * i / n
        cand = [((a + b) // 2) for a, b in gaps if abs((a + b) / 2 - target) < W / n * 0.45]
        if cand:
            cuts.append(min(cand, key=lambda c: abs(c - target)))
        else:
            w0, w1 = int(target - W / n * 0.3), int(target + W / n * 0.3)
            cuts.append(w0 + int(np.argmin(proj[w0:w1])))
    return segs(sorted(cuts))


def grid_boxes(arr, counts):
    """행별 기대 개수(counts)에 맞춰 프레임 상자를 찾는다."""
    mask = arr[..., 3] > 40
    # 아주 작은 먼지는 투영에서 뺀다
    lab, n = ndimage.label(mask)
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    clean = np.isin(lab, np.nonzero(sizes >= 30)[0] + 1)
    rows = split_1d(clean.sum(axis=1), len(counts), min_gap=3)
    out = []
    for (y0, y1), c in zip(rows, counts):
        band = clean[y0:y1]
        cols = split_1d(band.sum(axis=0), c, min_gap=2)
        out.append([[x0, y0, x1, y1, 0] for x0, x1 in cols])
    return out, clean


def foot_x(sub):
    """아래쪽 12% 줄의 불투명 픽셀 가운데 = 발밑 피벗 x"""
    a = sub[..., 3] > 100
    h = a.shape[0]
    band = a[int(h * 0.88):]
    xs = np.nonzero(band)[1]
    if len(xs) == 0:
        xs = np.nonzero(a)[1]
    return float(np.median(xs))


def shrink(sub, s, palette=48, pixel=True):
    im = Image.fromarray(sub, "RGBA")
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    if pixel:
        # 알파를 곱한 뒤 BOX로 줄이면 가장자리 색이 번지지 않는다
        arr = np.array(im).astype(np.float32)
        arr[..., :3] *= arr[..., 3:4] / 255.0
        pm = Image.fromarray(arr.clip(0, 255).astype(np.uint8), "RGBA").resize((w, h), Image.BOX)
        p = np.array(pm).astype(np.float32)
        al = p[..., 3:4]
        p[..., :3] = np.where(al > 0, p[..., :3] * 255.0 / np.maximum(al, 1), 0)
        p[..., 3] = np.where(p[..., 3] > 110, 255, 0)
        out = Image.fromarray(p.clip(0, 255).astype(np.uint8), "RGBA")
        rgb = out.convert("RGB").quantize(colors=palette, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
        out = Image.merge("RGBA", (*rgb.split(), out.getchannel("A")))
        return out
    return im.resize((w, h), Image.LANCZOS)


def paste_clip(dst, src, x, y):
    sx0, sy0 = max(0, -x), max(0, -y)
    sx1, sy1 = min(src.width, dst.width - x), min(src.height, dst.height - y)
    if sx1 <= sx0 or sy1 <= sy0:
        return
    dst.alpha_composite(src.crop((sx0, sy0, sx1, sy1)), (x + sx0, y + sy0))


# ---------------------------------------------------------------- 스프라이트 시트
META =json.load(open(META_PATH, encoding="utf-8")) if os.path.exists(META_PATH) else {}


def sheet(key, sources, scale, cell, pivot=None, foot=True, pad=1, fps=None, palette=48):
    """sources: [(원본이름, [행별 [(애니이름, 프레임수), ...]])]"""
    fw, fh = cell
    px, py = pivot or (fw // 2, fh - pad)
    anims, frames = {}, []
    for src in sources:
        name, layout = src[0], src[1]
        norm = src[2] if len(src) > 2 else None   # 행별 크기 보정: {행: 목표 높이 또는 ('row', 기준행)}
        arr = load_rgba(name)
        want = [sum(n for _, n in row) for row in layout]
        rows, clean = grid_boxes(arr, want)
        lab, mask = None, clean
        row_scale = {}
        if norm:
            for ri, t in norm.items():
                if not isinstance(t, tuple):
                    hs = [crop(arr, None, clean, b).shape[0] for b in rows[ri]]
                    row_scale[ri] = t / float(np.median(hs))
            for ri, t in norm.items():
                if isinstance(t, tuple):
                    row_scale[ri] = row_scale[t[1]] * (t[2] if len(t) > 2 else 1.0)
        for ri, row in enumerate(layout):
            rs = row_scale.get(ri, scale)
            items = rows[ri] if ri < len(rows) else []
            k = 0
            for an, n in row:
                fl = []
                for j in range(n):
                    if k >= len(items):
                        break
                    b = items[k]
                    k += 1
                    sub = crop(arr, lab, mask, b)
                    cx = foot_x(sub) if foot else sub.shape[1] / 2
                    im = shrink(sub, rs, palette)
                    cxs = cx * rs
                    fl.append((im, cxs))
                anims[an] = {"start": len(frames), "n": len(fl), "fps": (fps or {}).get(an, 8)}
                frames.extend(fl)
    cols = 8
    rows_n = (len(frames) + cols - 1) // cols
    atlas = Image.new("RGBA", (cols * fw, rows_n * fh), (0, 0, 0, 0))
    for i, (im, cx) in enumerate(frames):
        x = round(px - cx)
        y = (py - im.height) if foot else (fh - im.height) // 2
        cell_img = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
        paste_clip(cell_img, im, x, y)
        atlas.alpha_composite(cell_img, ((i % cols) * fw, (i // cols) * fh))
        if x < 0 or y < 0 or x + im.width > fw or y + im.height > fh:
            print(f"  ! {key} frame {i} {im.size} at ({x},{y}) 칸 {cell} 밖으로 잘림")
    atlas.save(os.path.join(OUT_S, key + ".png"))
    META[key] = {"img": f"assets/sprites/{key}.png", "fw": fw, "fh": fh, "px": px, "py": py, "cols": cols, "anims": anims}
    print(f"{key}: {len(frames)} frames", {a: v['n'] for a, v in anims.items()})


def hero_scale(target=46):
    arr = load_rgba("hero_a")
    rows, clean = grid_boxes(arr, [4, 6])
    hs = [crop(arr, None, clean, b).shape[0] for b in rows[0]]
    s = target / float(np.median(hs))
    print(f"hero scale {s:.4f} (idle h {np.median(hs):.0f}px → {target}px)")
    return s


def single_scale(name, counts, row, idx, target, axis="h"):
    arr = load_rgba(name)
    rows, clean = grid_boxes(arr, counts)
    sub = crop(arr, None, clean, rows[row][idx])
    size = sub.shape[0] if axis == "h" else sub.shape[1]
    return target / float(size)


# ---------------------------------------------------------------- 소품(개별 이미지)
def props(name, names, targets, counts, pixel=True):
    arr = load_rgba(name)
    if name == "props_items":  # 뒤쪽 은은한 빛 번짐 제거
        arr[..., 3] = np.where(arr[..., 3] < 200, 0, 255)
    rows, clean = grid_boxes(arr, counts)
    flat = [b for r in rows for b in r]
    for b, nm in zip(flat, names):
        sub = crop(arr, None, clean, b)
        t = targets.get(nm, 32)
        axis, val = (t if isinstance(t, tuple) else ("h", t))
        s = val / (sub.shape[0] if axis == "h" else sub.shape[1])
        im = shrink(sub, s, palette=40, pixel=pixel)
        im.save(os.path.join(OUT_S, nm + ".png"))
        META.setdefault("_props", {})[nm] = {"img": f"assets/sprites/{nm}.png", "w": im.width, "h": im.height}
    print(f"{name}: {min(len(flat), len(names))} props")


# ---------------------------------------------------------------- 타일
def tiles():
    arr = load_rgba("tiles")
    boxes, lab, mask = components(arr, merge=4)
    rows = rows_of(boxes)
    flat = [b for r in rows for b in r]
    names = ["grass", "granite", "sand", "plank", "roof", "cloud"]
    out = {}
    for b, nm in zip(flat, names):
        sub = crop(arr, lab, mask, b)
        h = sub.shape[0]
        s = 40.0 / h if nm in ("plank",) else 44.0 / h
        im = shrink(sub, s, palette=32)
        # 좌우 이음매: 가운데 구간을 32의 배수 폭으로 잘라 반복 무늬로 쓴다
        w = (im.width - 8) // 32 * 32
        x0 = (im.width - w) // 2
        strip = im.crop((x0, 0, x0 + w, im.height))
        strip = seamless_x(strip, 6)
        strip.save(os.path.join(OUT_S, f"tile_{nm}.png"))
        out[nm] = {"img": f"assets/sprites/tile_{nm}.png", "w": strip.width, "h": strip.height}
    META["_tiles"] = out
    print("tiles:", {k: (v['w'], v['h']) for k, v in out.items()})


def seamless_x(im, k):
    """오른쪽 끝 k픽셀을 왼쪽 시작과 섞어 좌우가 이어지게 한다(픽셀 느낌 유지를 위해 디더링처럼 섞는다)."""
    a = np.array(im)
    w = a.shape[1]
    for i in range(k):
        t = (i + 1) / (k + 1)
        col = w - k + i
        src = i
        rnd = (np.random.RandomState(i).rand(a.shape[0]) < t)
        a[rnd, col] = a[rnd, src]
    return Image.fromarray(a, "RGBA")


# ---------------------------------------------------------------- 배경·UI
def background(name, max_h=1024, blend=0.12):
    im = Image.open(os.path.join(RAW, name + ".png")).convert("RGB")
    if im.height > max_h:
        im = im.resize((round(im.width * max_h / im.height), max_h), Image.LANCZOS)
    a = np.array(im).astype(np.float32)
    w = a.shape[1]
    k = int(w * blend)
    # 좌우 반복 이음매: 오른쪽 끝 k 구간을 왼쪽 시작과 교차 페이드한 뒤 잘라 낸다
    # 결과 폭은 w-k. 왼쪽 k칸을 '원래 오른쪽 끝(w-k..w)'에서 '원래 왼쪽(0..k)'으로 서서히 바꿔,
    # 잘린 오른쪽 끝(w-k-1) 다음에 왼쪽 시작이 자연스럽게 이어지게 한다.
    t = np.linspace(0, 1, k)[None, :, None]
    left = a[:, w - k:] * (1 - t) + a[:, :k] * t
    a = a[:, : w - k].copy()
    a[:, :k] = left
    Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(os.path.join(OUT_B, name + ".jpg"), quality=86, optimize=True)
    META.setdefault("_bg", {})[name] = {"img": f"assets/bg/{name}.jpg", "w": w - k, "h": a.shape[0]}
    print(f"{name}: {w - k}x{a.shape[0]}")


def portraits(name, names):
    arr = load_rgba(name)
    rows, clean = grid_boxes(arr, [2, 2])
    flat = [b for r in rows for b in r]
    for b, nm in zip(flat, names):
        sub = crop(arr, None, clean, b).astype(np.int32)
        # 반투명한 갓 테두리로 비친 마젠타를 회색 쪽으로 되돌린다
        r, g, bl = sub[..., 0], sub[..., 1], sub[..., 2]
        m = np.minimum(r, bl)
        purple = np.clip(m - g, 0, None)
        sub[..., 0] = r - (purple * 0.85).astype(np.int32)
        sub[..., 2] = bl - (purple * 0.85).astype(np.int32)
        sub = sub.clip(0, 255).astype(np.uint8)
        im = Image.fromarray(sub, "RGBA")
        s = 300 / im.height
        im = im.resize((round(im.width * s), 300), Image.LANCZOS)
        im.save(os.path.join(OUT_U, nm + ".png"))
        META.setdefault("_ui", {})[nm] = {"img": f"assets/ui/{nm}.png", "w": im.width, "h": im.height}
    print(f"{name}: {len(flat)} portraits")


def logo():
    arr = load_rgba("logo")
    ys, xs = np.nonzero(arr[..., 3] > 40)
    im = Image.fromarray(arr[ys.min():ys.max() + 1, xs.min():xs.max() + 1], "RGBA")
    s = 820 / im.width
    im = im.resize((820, round(im.height * s)), Image.LANCZOS)
    im.save(os.path.join(OUT_U, "logo.png"))
    META.setdefault("_ui", {})["logo"] = {"img": "assets/ui/logo.png", "w": im.width, "h": im.height}
    print("logo", im.size)


def plain(name, max_w, key=None, quality=86):
    im = Image.open(os.path.join(RAW, name + ".png")).convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT_U, name + ".jpg"), quality=quality, optimize=True)
    META.setdefault("_ui", {})[key or name] = {"img": f"assets/ui/{name}.jpg", "w": im.width, "h": im.height}
    print(name, im.size)


def map_icons():
    arr = load_rgba("map_icons")
    boxes, lab, mask = components(arr, merge=10)
    rows = rows_of(boxes)
    flat = [b for r in rows for b in r]
    names = ["peaks", "mountain", "range", "pavilion", "gate", "waterfall", "lake", "waves", "pine", "sun", "village", "rider"]
    if len(flat) != len(names):
        print(f"  ! map_icons: 검출 {len(flat)} / 기대 {len(names)}")
    for b, nm in zip(flat, names):
        sub = crop(arr, lab, mask, b)
        im = Image.fromarray(sub, "RGBA")
        s = 96 / max(im.width, im.height)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        im.save(os.path.join(OUT_U, "map_" + nm + ".png"))
        META.setdefault("_ui", {})["map_" + nm] = {"img": f"assets/ui/map_{nm}.png", "w": im.width, "h": im.height}
    print("map icons", len(flat))


# ---------------------------------------------------------------- 실행 목록
def run(which):
    def want(k):
        return not which or k in which

    if want("hero"):
        s = hero_scale(46)
        sheet("hero", [
            ("hero_a", [[("idle", 4)], [("walk", 6)]], {0: 46, 1: 45}),
            ("hero_b", [[("jump", 4)], [("attack", 6)]], {1: 45, 0: ("row", 1, 0.86)}),
            ("hero_c", [[("hurt", 2), ("cast", 4)], [("glide", 4)]]),
        ], s, (96, 64), pivot=(40, 62), fps={"idle": 5, "walk": 10, "jump": 8, "attack": 18, "hurt": 8, "cast": 10, "glide": 8})
        sheet("horse", [("hero_horse", [[("gallop", 6)], [("hjump", 3)]])], s, (112, 80), pivot=(56, 78), fps={"gallop": 12, "hjump": 8})
    if want("enemies"):
        s = single_scale("enemies", [5, 6, 5], 0, 0, 26)
        sheet("enemies", [("enemies", [[("blob", 4), ("blobhurt", 1)], [("blobpop", 3), ("crow", 3)], [("magpie", 3), ("cloud", 2)]])],
              s, (64, 48), pivot=(32, 46), foot=False, fps={"blob": 8, "blobpop": 12, "crow": 10, "magpie": 10, "cloud": 3})
    if want("npcs"):
        s = single_scale("npcs", [4, 4, 4], 2, 0, 50)
        sheet("npcs", [("npcs", [[("crane", 4)], [("gull", 3), ("gullstand", 1)], [("sage", 2), ("sagecrane", 2)]])],
              s, (112, 80), pivot=(56, 78), foot=False, fps={"crane": 7, "gull": 8, "sage": 2, "sagecrane": 6})
    if want("libai"):
        s = single_scale("boss_libai", [4, 4], 0, 0, 96)
        sheet("libai", [("boss_libai", [[("idle", 4)], [("attack", 3), ("hurt", 1)]])], s, (150, 116), pivot=(75, 114), foot=False, fps={"idle": 6, "attack": 8})
    if want("whale"):
        s = single_scale("boss_whale", [3, 3], 0, 0, 320, axis="w")
        sheet("whale", [("boss_whale", [[("rise", 3)], [("dive", 2), ("foam", 1)]])], s, (380, 270), pivot=(190, 268), foot=False, fps={"rise": 4, "dive": 4})
    if want("dragon"):
        s = single_scale("dragon", [2], 0, 0, 240, axis="w")
        sheet("dragon", [("dragon", [[("rest", 1), ("rain", 1)]])], s, (340, 200), pivot=(170, 198), foot=False)
    if want("props"):
        props("props_items",
              ["scroll", "okjeol", "feather", "inkstick", "heart", "tablet", "pillar", "danseo", "grass_dead", "grass_live", "rose", "bamboo", "pine", "boulder", "wine", "boat"],
              {"scroll": ("w", 26), "okjeol": 26, "feather": 26, "inkstick": ("w", 20), "heart": 14, "tablet": 44, "pillar": 72, "danseo": ("w", 72),
               "grass_dead": 28, "grass_live": 30, "rose": 34, "bamboo": 88, "pine": 110, "boulder": 44, "wine": 26, "boat": ("w", 84)},
              [4, 4, 4, 4])
        props("props_build", ["pavilion", "nugak", "gate", "ruins", "signpost", "altar"],
              {"pavilion": ("w", 150), "nugak": ("w", 210), "gate": ("w", 200), "ruins": ("w", 190), "signpost": 52, "altar": ("w", 56)},
              [3, 3])
    if want("tiles"):
        tiles()
    if want("bg"):
        for f in sorted(os.listdir(RAW)):
            if f.startswith("bg_"):
                background(f[:-4])
    if want("ui"):
        if os.path.exists(os.path.join(RAW, "portrait_hero.png")):
            portraits("portrait_hero", ["pt_calm", "pt_awe", "pt_sad", "pt_resolve"])
        if os.path.exists(os.path.join(RAW, "portrait_others.png")):
            portraits("portrait_others", ["pt_sage", "pt_libai", "pt_ghost", "pt_crane"])
        if os.path.exists(os.path.join(RAW, "logo.png")):
            logo()
        if os.path.exists(os.path.join(RAW, "title_art.png")):
            plain("title_art", 1600)
        if os.path.exists(os.path.join(RAW, "paper.png")):
            plain("paper", 1024, quality=82)
        if os.path.exists(os.path.join(RAW, "map_icons.png")):
            map_icons()

    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(META, f, ensure_ascii=False, indent=1)
    # file:// 로 열어도 되도록 JS로도 내보낸다
    with open(os.path.join(ROOT, "js", "data", "sprites.js"), "w", encoding="utf-8") as f:
        f.write("// 자동 생성: tools/process_assets.py\nwindow.SPRITES = " + json.dumps(META, ensure_ascii=False) + ";\n")


if __name__ == "__main__":
    run(set(sys.argv[1:]))
