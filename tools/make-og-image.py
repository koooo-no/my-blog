#!/usr/bin/env python3
"""
生成社交分享卡片图（public/og-default.png）

站名、简介直接从 src/consts.ts 里读，改完站名跑一次这个脚本就行。

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
BG = (251, 250, 248)
ACCENT = (47, 93, 80)
TEXT = (25, 26, 30)
MUTED = (110, 111, 121)


def read_site():
    """从 consts.ts 里抠出 title / description，避免两处不一致"""
    src = CONSTS.read_text(encoding="utf-8")

    def grab(key):
        m = re.search(rf"{key}:\s*'([^']*)'", src)
        return m.group(1) if m else ""

    return grab("title"), grab("description")


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


def main():
    url = sys.argv[1] if len(sys.argv) > 1 else "koooo-no.github.io/my-blog"
    title, description = read_site()

    if not title:
        print("没能从 src/consts.ts 读出站名", file=sys.stderr)
        return 1

    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # 左侧主色竖条
    d.rectangle([0, 0, 16, H], fill=ACCENT)

    f_title = load_font(78)
    f_sub = load_font(32)
    f_small = load_font(24)

    d.text((90, 165), title, font=f_title, fill=TEXT)
    d.text((92, 280), description, font=f_sub, fill=MUTED)

    d.rectangle([92, 380, 124, 412], fill=ACCENT)

    d.text((90, 520), url, font=f_small, fill=MUTED)

    img.save(OUT, "PNG", optimize=True)
    print(f"已生成 {OUT.relative_to(ROOT)}")
    print(f"  标题: {title}")
    print(f"  简介: {description}")
    print(f"  网址: {url}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
