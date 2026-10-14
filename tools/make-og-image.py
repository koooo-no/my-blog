#!/usr/bin/env python3
"""
生成社交分享卡片图（public/og-default.png）

站名和标语直接从 src/consts.ts 里读，改完站名跑一次这个脚本就行 ——
图上的文字是烧进像素里的，不重新生成的话，别人分享你的链接时
卡片上还是旧站名。

用法：
    python3 tools/make-og-image.py
    python3 tools/make-og-image.py koooo-no.github.io/my-blog   # 指定显示的网址
"""

import os
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
CONSTS = ROOT / "src" / "consts.ts"
OUT = ROOT / "public" / "og-default.png"

W, H = 1200, 630
MARGIN = 90
BG = (251, 250, 248)
ACCENT = (47, 93, 80)
TEXT = (25, 26, 30)
MUTED = (110, 111, 121)


def read_site():
    """从 consts.ts 抠出 title / tagline / description，避免两处不一致"""
    src = CONSTS.read_text(encoding="utf-8")

    def grab(key):
        m = re.search(rf"{key}:\s*\n?\s*'([^']*)'", src)
        return m.group(1) if m else ""

    return grab("title"), grab("tagline"), grab("description")


def load_font(size):
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def wrap(draw, text, font, max_width):
    """按字符宽度折行（中文逐字折行正好合适）"""
    lines, cur = [], ""
    for ch in text:
        trial = cur + ch
        if not cur or draw.textlength(trial, font=font) <= max_width:
            cur = trial
        else:
            lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)
    return lines


def main():
    url = sys.argv[1] if len(sys.argv) > 1 else "koooo-no.github.io/my-blog"
    title, tagline, description = read_site()

    if not title:
        print("没能从 src/consts.ts 读出站名", file=sys.stderr)
        return 1

    subtitle = tagline or description or ""

    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # 左侧主色竖条
    d.rectangle([0, 0, 16, H], fill=ACCENT)

    f_title = load_font(76)
    f_sub = load_font(32)
    f_small = load_font(23)

    max_w = W - MARGIN * 2

    # 站名
    y = 160
    for line in wrap(d, title, f_title, max_w):
        d.text((MARGIN, y), line, font=f_title, fill=TEXT)
        y += 92

    # 标语
    y += 14
    for line in wrap(d, subtitle, f_sub, max_w):
        d.text((MARGIN + 2, y), line, font=f_sub, fill=MUTED)
        y += 46

    # 小色块装饰
    d.rectangle([MARGIN + 2, y + 18, MARGIN + 34, y + 50], fill=ACCENT)

    # 网址
    d.text((MARGIN, H - 78), url, font=f_small, fill=MUTED)

    img.save(OUT, "PNG", optimize=True)
    print(f"已生成 {OUT.relative_to(ROOT)}")
    print(f"  站名: {title}")
    print(f"  标语: {subtitle}")
    print(f"  网址: {url}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
