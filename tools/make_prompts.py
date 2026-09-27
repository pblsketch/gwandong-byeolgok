# -*- coding: utf-8 -*-
"""에셋 생성 프롬프트와 manifest를 만든다. (python tools/make_prompts.py)"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDIR = os.path.join(ROOT, "tools", "prompts")
os.makedirs(PDIR, exist_ok=True)

REF = "design/ref/ref_jeongcheol.png"

BG = (
    "Wide landscape background painting for a 2D side-scrolling game. Korean ink-wash painting style "
    "(sumukhwa with soft, light watercolor tints, true-view landscape in the manner of Jeong Seon), visible hanji "
    "paper texture, soft brush strokes, atmospheric mist and depth. Absolutely no text, no letters, no calligraphy, "
    "no seals or stamps, no signboards, no people. Side view composition. Keep the bottom 22% of the image calm, "
    "low-detail mist or water (it will be covered by the game's ground). Main interest in the middle band. The left "
    "and right edges should have similar tone and horizon height so the image can be repeated horizontally.\n\nScene: "
)

PIX = (
    "Pixel art sprite sheet for a 2D side-scrolling game, 16-bit SNES style, crisp hard-edged pixels, no "
    "anti-aliasing, limited palette, dark 1-pixel outlines. Solid flat pure magenta background (#FF00FF) everywhere "
    "behind the sprites, no gradients, no floor, no cast shadows on the background. Frames are laid out in a strict "
    "invisible grid with wide empty magenta gaps so that no frame touches or overlaps another. Every frame is drawn "
    "at the same scale, and within a row the feet (bottom) of every frame rest on the same baseline (foot pivot fixed "
    "at bottom center). No text, no numbers, no grid lines, no labels.\n\n"
)

HERO = (
    "Character: the chibi Joseon-dynasty scholar-official Jeong Cheol exactly as in the attached reference image: "
    "black horsehair gat hat with a wide brim, pale jade-green dopo robe, red sash, big round black eyes, holding a "
    "large calligraphy brush with a wooden handle and white-and-black tip. About 2.5 heads tall. Always facing RIGHT.\n\n"
)

P = {}

# ---------- 배경 (수묵) ----------
P["bg_bamboo"] = BG + "a quiet bamboo grove at dawn in southern Korea (Changpyeong): tall bamboo stalks in layered depth, soft morning light, a small thatched scholar's hut half hidden among the bamboo, a stream."
P["bg_palace"] = BG + "the outer stone walls and a great wooden gate of a Joseon royal palace (Gyeongbokgung) with grey tiled roofs, a stone-paved court, Mt. Bugaksan behind in mist, spring morning. Every signboard on the buildings is completely blank."
P["bg_road"] = BG + "a spring countryside journey in central Korea: a wide river winding through fields, gentle hills, willow trees in fresh green, a distant mountain range on the horizon, a dirt road running from left to right."
P["bg_ruins"] = BG + "a vast plain at dusk with the overgrown stone foundations and broken pillars of an ancient ruined palace site, tall autumn grass, a lone small pavilion on a far hill, small distant flocks of crows and magpies circling in the orange sky."
P["bg_waterfall"] = BG + "Manpokdong valley of Mt. Geumgang: many silver waterfalls cascading down white granite cliffs, churning white spray and a faint rainbow in the mist, pine trees clinging to the rocks."
P["bg_peaks"] = BG + "the twelve thousand peaks of Mt. Geumgang seen from a high viewpoint: countless sharp white granite pinnacles rising like lotus buds and carved white jade, layered in mist, one tallest peak far in the center-right towering above the clouds."
P["bg_dragonpool"] = BG + "Hwaryongso pool in Mt. Geumgang: a deep emerald pool below a broad flat rock slab, the stream coiling like a dragon down the valley toward the distant sea, a dark shaded cliff on the left, heavy rain clouds gathering in the sky."
P["bg_cliff"] = BG + "the view from Buljeongdae: across a deep valley, a sheer cliff a thousand fathoms high with one very long white waterfall falling in many tiers like hanging silk cloth, clouds drifting at mid-height."
P["bg_coast"] = BG + "the East Sea coast of Tongcheon: groups of tall hexagonal basalt stone pillars standing in the sea close to the shore, a white sand beach with pink rugosa rose bushes, small white seagulls far away, blue-green sea under a clear sky."
P["bg_sunrise"] = BG + "the East Sea at the moment of sunrise seen from a high seaside cliff: a huge red sun just lifting from the horizon, auspicious glowing clouds, golden light on the waves, pine trees on the cliff at the left edge."
P["bg_lake"] = BG + "Gyeongpo lake at sunset: a mirror-calm lake like white silk, surrounded by tall pine forest, sandy shores, a small pavilion on a low hill, the open sea glimpsed beyond a sandbar, pink azaleas on a hill."
P["bg_river"] = BG + "a large two-story wooden pavilion with no signboard standing on a riverside cliff above a green river flowing toward the sea, the distant Taebaek mountains, late afternoon light."
P["bg_stormsea"] = BG + "a small pavilion on a seaside hill at the far left overlooking a vast rough sea, enormous crashing waves rising like silver mountains, white spray flying like snow under a bright early-summer sky."
P["bg_moonsea"] = BG + "a calm night sea with a huge full moon rising over the horizon, a silver path of moonlight on the water, faint stars, dark pine silhouettes on a rocky shore at the left."
P["bg_heaven"] = BG + "a dreamlike celestial realm above the clouds at night: soft glowing clouds, faint jade palaces on distant cloud islands, small cranes flying far away, stars and a soft moonlit glow."

# ---------- 타이틀·UI ----------
P["title_art"] = ("Title screen key art for a game about the Korean classical poem Gwandong Byeolgok. Korean ink-wash painting "
    "style with soft watercolor tints on hanji paper. A small Joseon scholar-official wearing a black gat hat and a pale "
    "jade-green dopo robe with a red sash rides a brown horse along a mountain path, seen from behind at a distance, "
    "overlooking the white granite peaks of Mt. Geumgang on the left and the East Sea with a rising sun on the right. "
    "Leave the upper-center third of the image as empty misty sky for a title. No text, no letters, no seals.")
P["logo"] = ("Brush calligraphy logo of the Korean title text, exactly these four Hangul syllables: 관동별곡 — written "
    "horizontally in bold, expressive black ink brush calligraphy (traditional Korean seoye style), perfectly legible. "
    "A small red square seal stamp at the lower right of the text containing only an abstract red pattern (no legible "
    "characters). Solid flat pure magenta background (#FF00FF), nothing else.")
P["paper"] = ("Aged hanji paper texture, pale warm beige with subtle mulberry fibers, very faint ink stains and slightly darker "
    "vignetted edges. Completely blank: no drawings, no text, no seals. Flat, evenly lit, top-down scan.")
P["map_icons"] = ("Sprite sheet of hand-painted Korean ink-wash map icons on a solid flat pure magenta (#FF00FF) background, arranged "
    "in a 4 by 3 grid with wide empty gaps, each icon isolated and not touching others: 1) a cluster of jagged white "
    "granite peaks, 2) a single tall mountain, 3) a range of rolling green mountains, 4) a small pavilion on a hill, "
    "5) a palace gate, 6) a waterfall, 7) a lake, 8) ocean waves, 9) a pine tree, 10) a rising red sun, 11) a small "
    "village of thatched houses, 12) a tiny traveler on horseback. Ink-wash with light color tints, simple, readable at "
    "small size. No text.")

# ---------- 초상화 ----------
P["portrait_hero"] = ("Character portrait sheet for a Korean visual novel: a 2 by 2 grid on a solid flat pure magenta (#FF00FF) "
    "background, each cell a bust portrait (head and shoulders, facing slightly right) of the SAME man, Jeong Cheol, a "
    "Joseon-dynasty scholar-official in his mid-40s: slim face, thin mustache and small goatee, black gat hat with a "
    "wide brim, pale jade-green dopo robe with a red sash. Style: Korean ink-wash illustration with watercolor color and "
    "clean line art. Expressions: top-left calm and dignified; top-right deeply moved with awe, looking up; bottom-left "
    "sorrowful and longing, looking into the distance; bottom-right resolute and determined. Each portrait separated by "
    "wide magenta gaps. No text.")
P["portrait_others"] = ("Character portrait sheet for a Korean visual novel: a 2 by 2 grid on a solid flat pure magenta (#FF00FF) "
    "background, each cell a bust portrait (head and shoulders, facing slightly left), Korean ink-wash illustration with "
    "watercolor color and clean line art, separated by wide magenta gaps. Top-left: a Taoist immortal from a dream, an "
    "ageless old man with a long white beard and white robes, holding a gourd of wine, serene smile. Top-right: the "
    "phantom of the Tang poet Li Bai, a semi-transparent ghostly pale-blue figure in flowing robes with a long beard, "
    "holding a wine cup, proud and playful. Bottom-left: a fictional villain, the Ghost of Forgetting, a shadowy figure "
    "made of swirling black ink with glowing yellow eyes, clutching a torn paper scroll. Bottom-right: a majestic white "
    "red-crowned crane, head and neck. No text.")

# ---------- 픽셀 스프라이트 ----------
P["hero_a"] = PIX + HERO + ("Layout: exactly 2 rows. Row 1: idle breathing animation, 4 frames (subtle shoulder and robe movement, "
    "brush held at his side). Row 2: walk cycle, 6 frames.")
P["hero_b"] = PIX + HERO + ("Layout: exactly 2 rows. Row 1: jump, 4 frames (crouch take-off, rising with robe fluttering, apex, "
    "falling). Row 2: brush attack, 6 frames (ready stance, raise brush, fast forward slash leaving a thick black ink arc, "
    "follow-through, recover, return to stance).")
P["hero_c"] = PIX + HERO + ("Layout: exactly 2 rows. Row 1: 2 frames of getting hurt (knocked back, recovering), then 4 frames "
    "of raising a small white jade tally plaque on a red cord high overhead while it glows with golden light. Row 2: "
    "gliding, 4 frames: arms spread wide, robe billowing like wings, a few white crane feathers trailing, floating gently "
    "downward.")
P["hero_horse"] = PIX + HERO + ("The character rides a small brown Joseon pony with a red saddle cloth, both facing RIGHT. "
    "Layout: exactly 2 rows. Row 1: gallop cycle, 6 frames. Row 2: 3 frames of the pony jumping (take-off, mid-air, landing).")
P["enemies"] = PIX + ("Fictional game creatures and birds, all facing LEFT. Layout: exactly 3 rows. Row 1: a round black ink blob "
    "spirit with glowing yellow eyes and dripping ink, hopping walk cycle 4 frames, then 1 hurt frame (squashed, eyes "
    "flashing white). Row 2: the same ink blob bursting into ink splashes, 3 frames; then a black crow flying, 3 frames. "
    "Row 3: a black-and-white magpie flying, 3 frames; then a small dark grey storm cloud creature with sly narrow eyes, "
    "2 frames drifting.")
P["boss_libai"] = PIX + ("Fictional boss for a game: the phantom of the Tang poet Li Bai, a semi-transparent ghostly pale-blue "
    "scholar floating in the air, flowing robes, long beard, holding a wine gourd and a cup, proud playful face, about "
    "twice as tall as a chibi hero, facing LEFT. Layout: exactly 2 rows. Row 1: floating idle, 4 frames. Row 2: attack, 3 "
    "frames (flinging a stream of wine that becomes a glowing arc of waterfall), then 1 hurt frame (flashing white).")
P["boss_whale"] = PIX + ("Fictional boss for a game: a huge angry whale made entirely of ocean waves and white foam (it stands for "
    "crashing waves), blue and white, side view, facing LEFT, very large. Layout: exactly 2 rows. Row 1: 3 frames of the "
    "whale surging up from the sea and blowing a tall water spout. Row 2: 2 frames of the whale diving back into the "
    "waves, then 1 frame of the whale dissolving into foam and spray.")
P["npcs"] = PIX + ("Layout: exactly 3 rows. Row 1: a white red-crowned crane flying, 4 frames, facing RIGHT. Row 2: a white "
    "seagull flying 3 frames and 1 frame standing, facing LEFT. Row 3: a Taoist immortal (ageless old man with a long "
    "white beard and white robes, holding a wine gourd) standing 2 frames facing LEFT, then riding on the back of a "
    "flying white crane 2 frames facing RIGHT.")
P["dragon"] = PIX + ("A single large sprite subject: an old benevolent Korean dragon, long serpentine blue-green body coiled "
    "inside a round pool of water, white whiskers and mane, wise calm face, side view, head facing RIGHT. Layout: exactly "
    "1 row of 2 frames: resting with eyes half closed; head raised, breathing out dark rain clouds.")
P["props_build"] = PIX + ("Korean traditional architecture for a side-view platformer, each object isolated with wide gaps, "
    "arranged in 2 rows. Row 1: a small hilltop pavilion (jeongja) with a tiled roof and red pillars; a large two-story "
    "wooden pavilion (nugak) with colorful dancheong eaves; a royal palace gate with a tiled roof and big red wooden doors. "
    "Row 2: ruins of an ancient palace (broken stone foundations and two toppled stone pillars); a wooden road signpost "
    "with a blank white board; a stone altar for rain rituals. Every signboard is blank, no text anywhere.")
P["props_items"] = PIX + ("Items and small props, arranged in a 4 by 4 grid, each isolated with wide gaps: 1) a rolled paper "
    "scroll with a red ribbon, 2) a white jade tally plaque on a red cord, 3) a white crane feather, 4) a black ink stick "
    "piece, 5) a red heart, 6) a blank grey upright stone tablet, 7) a tall hexagonal basalt stone pillar, 8) a large rock "
    "with faint red painted marks (no legible characters), 9) a withered brown grass clump, 10) a lush green grass clump "
    "with small white flowers, 11) a rugosa rose bush with pink flowers, 12) a cluster of bamboo stalks, 13) a Korean red "
    "pine tree, 14) a moss-covered boulder, 15) a white porcelain wine bottle with a cup, 16) a small wooden boat.")
P["tiles"] = ("Pixel art terrain for a 2D side-scrolling platformer, 16-bit SNES style, crisp hard-edged pixels, no anti-aliasing. "
    "On a solid flat pure magenta (#FF00FF) background, draw 6 separate wide rectangular terrain slabs arranged in 2 columns "
    "by 3 rows with wide magenta gaps. Each slab is seen from the side: a surface layer on top and solid fill below, and its "
    "left and right edges must tile seamlessly. Slab 1: green grass top over brown earth with small pebbles. Slab 2: moss "
    "over pale grey granite rock. Slab 3: pale sand over sandstone. Slab 4: a wooden plank bridge platform. Slab 5: grey "
    "clay roof tiles of a Korean hanok. Slab 6: a soft white cloud platform. Consistent top-left lighting. No text.")

ORDER = [
    # 스프라이트(참조 이미지 필요) 먼저 → 실패 조기 발견
    ("hero_a", "1536x1024", REF), ("hero_b", "1536x1024", REF), ("hero_c", "1536x1024", REF),
    ("hero_horse", "1536x1024", REF), ("enemies", "1536x1024", ""), ("tiles", "1536x1024", ""),
    ("props_items", "1024x1024", ""), ("props_build", "1536x1024", ""), ("npcs", "1536x1024", ""),
    ("boss_libai", "1536x1024", ""), ("boss_whale", "1536x1024", ""), ("dragon", "1536x1024", ""),
    ("portrait_hero", "1024x1024", ""), ("portrait_others", "1024x1024", ""),
    ("title_art", "1536x1024", ""), ("logo", "1536x1024", ""), ("paper", "1024x1024", ""), ("map_icons", "1536x1024", ""),
] + [(k, "1536x1024", "") for k in P if k.startswith("bg_")]

for k, v in P.items():
    with open(os.path.join(PDIR, k + ".txt"), "w", encoding="utf-8") as f:
        f.write(v)
with open(os.path.join(ROOT, "tools", "manifest.tsv"), "w", encoding="utf-8") as f:
    for n, s, r in ORDER:
        f.write(f"{n}\t{s}\t{r}\n")
print(len(P), "prompts,", len(ORDER), "in manifest")
