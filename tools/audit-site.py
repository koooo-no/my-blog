#!/usr/bin/env python3
"""
站点审计工具

对构建产物（dist/）做一次静态检查，找出上线后会被人看见的问题：

  1. 断链 —— 站内链接指向不存在的页面或文件
  2. 锚点 —— #xxx 指向的 id 不存在
  3. 标题层级 —— 每页应当有且只有一个 h1
  4. 图片 —— 缺少 alt、或引用的图片文件不存在
  5. 页面基本元素 —— title、description、lang、canonical
  6. 重复 id

用法：
    python3 tools/audit-site.py <构建目录> [--base /子路径]

例子：
    python3 tools/audit-site.py dist
    python3 tools/audit-site.py dist --base /my-blog
"""

import argparse
import html
import os
import re
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import unquote, urlsplit

# 图表几何校验用的正则
SVGSVG_RE = re.compile(r'<svg[^>]*viewBox="([^"]+)"[^>]*>(.*?)</svg>', re.S)
POLYLINE_RE = re.compile(r'<polyline[^>]*points="([^"]*)"')
CIRCLE_RE = re.compile(r'<circle[^>]*\bcx="([-\d.]+)"[^>]*\bcy="([-\d.]+)"')


def load_pages(root: Path):
    return sorted(root.rglob("*.html"))


def resolve(target: str, base: str, root: Path):
    """把站内链接解析成 dist 下的文件路径；返回 (类型, 路径或原因)"""
    if base != "/" and target.startswith(base):
        target = target[len(base):] or "/"
    elif base != "/" and not target.startswith("/"):
        pass

    if not target.startswith("/"):
        return ("relative", None)

    clean = unquote(urlsplit(target).path)

    candidates = []
    if clean.endswith("/"):
        candidates.append(root / (clean.lstrip("/") + "index.html"))
    else:
        candidates.append(root / (clean.lstrip("/") + "/index.html"))
        candidates.append(root / clean.lstrip("/"))
        if "." not in Path(clean).name:
            candidates.append(root / (clean.lstrip("/") + ".html"))

    for c in candidates:
        if c.is_file():
            return ("ok", c)
    return ("missing", clean)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dist", nargs="?", default="dist")
    ap.add_argument("--base", default="/")
    args = ap.parse_args()

    root = Path(args.dist).resolve()
    if not root.is_dir():
        print(f"找不到构建目录: {root}", file=sys.stderr)
        return 2

    base = args.base if args.base.endswith("/") or args.base == "/" else args.base + "/"
    pages = load_pages(root)

    problems = defaultdict(list)
    ids_by_page = {}

    # ---- 先收集所有页面的 id，供锚点校验 ----
    for p in pages:
        text = p.read_text(encoding="utf-8", errors="replace")
        ids = set(re.findall(r'\bid="([^"]+)"', text))
        dupes = [i for i in ids if text.count(f'id="{i}"') > 1]
        ids_by_page[p] = ids
        if dupes:
            problems["重复 id"].append((p, ", ".join(sorted(dupes))))

    titles = defaultdict(list)

    for p in pages:
        text = p.read_text(encoding="utf-8", errors="replace")
        rel = p.relative_to(root)

        # ---- title / description / lang / canonical ----
        m = re.search(r"<title>(.*?)</title>", text, re.S)
        if not m or not m.group(1).strip():
            problems["缺少 title"].append((rel, ""))
        else:
            titles[html.unescape(m.group(1).strip())].append(str(rel))

        if not re.search(r'<meta name="description" content="[^"]+"', text):
            problems["缺少 description"].append((rel, ""))

        if not re.search(r'<html[^>]*\blang="[^"]+"', text):
            problems["html 缺少 lang"].append((rel, ""))

        # 404 页是 noindex，且 canonical 指向 404 自身，跳过
        if rel.name != "404.html":
            if not re.search(r'<link rel="canonical" href="https?://[^"]+"', text):
                problems["缺少 canonical"].append((rel, ""))

        # ---- h1 ----
        h1s = re.findall(r"<h1\b", text)
        if len(h1s) != 1:
            problems["h1 数量异常"].append((rel, f"找到 {len(h1s)} 个"))

        # ---- 图片 alt ----
        for tag in re.findall(r"<img\b[^>]*>", text):
            if 'alt="' not in tag:
                problems["图片缺少 alt"].append((rel, tag[:70]))

        # ---- 图表几何是否超出画布 ----
        # 坐标轴刻度算错时，曲线会被画到 SVG 画布外面，页面看着像是"对的"，
        # 只有量坐标才发现。所以这里逐个点校验。
        for vb, inner in SVGSVG_RE.findall(text):
            dims = [n for n in re.split(r"[\s,]+", vb.strip()) if n]
            if len(dims) != 4:
                continue
            try:
                vw, vh = float(dims[2]), float(dims[3])
            except ValueError:
                continue

            over = None
            for pts in POLYLINE_RE.findall(inner):
                for pair in pts.split():
                    if "," not in pair:
                        continue
                    try:
                        px, py = (float(x) for x in pair.split(",")[:2])
                    except ValueError:
                        continue
                    if not (-0.5 <= px <= vw + 0.5 and -0.5 <= py <= vh + 0.5):
                        over = f"<polyline> 点 ({px:g},{py:g}) 超出 {vw:g}×{vh:g}"
                        break
                if over:
                    break

            if not over:
                for cx, cy in CIRCLE_RE.findall(inner):
                    try:
                        x, y = float(cx), float(cy)
                    except ValueError:
                        continue
                    if not (-0.5 <= x <= vw + 0.5 and -0.5 <= y <= vh + 0.5):
                        over = f"<circle> 圆心 ({x:g},{y:g}) 超出 {vw:g}×{vh:g}"
                        break

            if over:
                problems["图表超出画布"].append((rel, over))

        # ---- 链接 ----
        for attr, target in re.findall(r'\b(href|src)="([^"]*)"', text):
            if not target:
                continue
            if re.match(r"^(https?:)?//", target) or target.startswith(
                ("mailto:", "tel:", "data:", "javascript:")
            ):
                continue

            if target.startswith("#"):
                if target[1:] and target[1:] not in ids_by_page[p]:
                    problems["锚点不存在"].append((rel, target))
                continue

            kind, info = resolve(target, base, root)
            if kind == "missing":
                problems["断链"].append((rel, target))
            elif kind == "ok" and info and info.suffix == ".html" and "#" in target:
                frag = unquote(urlsplit(target).fragment)
                if frag and frag not in ids_by_page.get(info, set()):
                    problems["锚点不存在"].append((rel, target))

    # ---- 重复标题 ----
    for t, where in titles.items():
        if len(where) > 1:
            problems["重复 title"].append((t, ", ".join(where)))

    # ---- 输出 ----
    total = sum(len(v) for v in problems.values())
    print(f"审计目录: {root}")
    print(f"页面数量: {len(pages)}")
    print(f"base 路径: {base}")
    print("=" * 62)

    if total == 0:
        print("没有发现问题 ✅")
        return 0

    order = [
        "断链",
        "锚点不存在",
        "图片不存在",
        "图片缺少 alt",
        "图表超出画布",
        "重复 id",
        "h1 数量异常",
        "缺少 title",
        "重复 title",
        "缺少 description",
        "缺少 canonical",
        "html 缺少 lang",
    ]
    for key in order:
        items = problems.get(key)
        if not items:
            continue
        print(f"\n【{key}】{len(items)} 处")
        for where, detail in items[:12]:
            print(f"  - {where}  →  {detail}")
        if len(items) > 12:
            print(f"  ... 还有 {len(items) - 12} 处")

    print("\n" + "=" * 62)
    print(f"共 {total} 处问题")
    return 1


if __name__ == "__main__":
    sys.exit(main())
