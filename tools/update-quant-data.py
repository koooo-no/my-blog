#!/usr/bin/env python3
"""
更新量化看板数据（src/data/quant.json）

这个脚本是「每日自动更新」的入口，被 .github/workflows/deploy.yml 调用。

它做三件事：

  1. 生成数据
     - 如果存在 tools/quant/update.py（你自己的脚本），就运行它；
       它负责写出 src/data/quant.json
     - 否则退回内置的演示数据生成器（tools/quant_demo.py）
  2. **校验**数据格式
     - 格式不对就直接报错退出，宁可让部署失败，也不要发布一份坏数据
  3. 只有内容真的变了才写文件
     - 没变就不动，避免产生空的提交

用法：
    python3 tools/update-quant-data.py            # 生成并写入
    python3 tools/update-quant-data.py --dry-run  # 只生成和校验，不写文件
    python3 tools/update-quant-data.py --demo     # 强制使用演示数据
"""

import argparse
import json
import math
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data" / "quant.json"
USER_SCRIPT = ROOT / "tools" / "quant" / "update.py"

REQUIRED_METRICS = [
    "totalReturn",
    "annualReturn",
    "benchmarkTotalReturn",
    "benchmarkAnnualReturn",
    "excessAnnualReturn",
    "volatility",
    "maxDrawdown",
    "maxDrawdownDays",
    "sharpe",
    "calmar",
    "winRate",
    "profitFactor",
    "tradeCount",
    "turnover",
]


class ValidationError(Exception):
    pass


def is_finite_number(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def validate(data) -> list[str]:
    """返回警告列表；遇到致命问题抛 ValidationError"""
    warnings: list[str] = []

    if not isinstance(data, dict):
        raise ValidationError("顶层必须是对象")

    for key in ("updated", "benchmarkName", "strategies"):
        if key not in data:
            raise ValidationError(f"缺少顶层字段: {key}")

    # updated 支持两种写法：纯日期，或**带时区**的时间戳
    #   "2026-10-14"
    #   "2026-10-14T19:36:05+08:00"
    #
    # 带时间就强制要求时区：没有时区的话，Node 会按运行环境的本地时区解析，
    # 而 GitHub Actions 是 UTC —— 页面显示出来会差 8 小时。
    if not isinstance(data["updated"], str) or not re.match(
        r"^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:?\d{2}))?$",
        data["updated"],
    ):
        raise ValidationError(
            f'updated 格式不对: {data["updated"]!r}；'
            "应为 YYYY-MM-DD 或 YYYY-MM-DDTHH:MM:SS+08:00（带时间时必须带时区）"
        )

    if not isinstance(data["strategies"], list) or not data["strategies"]:
        raise ValidationError("strategies 必须是非空数组")

    seen_ids = set()
    for i, s in enumerate(data["strategies"]):
        where = f"strategies[{i}]"
        if not isinstance(s, dict):
            raise ValidationError(f"{where} 必须是对象")

        for key in ("id", "name", "dates", "equity", "benchmark", "metrics"):
            if key not in s:
                raise ValidationError(f"{where} 缺少字段: {key}")

        sid = s["id"]
        if not isinstance(sid, str) or not sid:
            raise ValidationError(f"{where}.id 必须是非空字符串")
        if sid in seen_ids:
            raise ValidationError(f"策略 id 重复: {sid}")
        seen_ids.add(sid)

        n = len(s["dates"])
        if n < 2:
            raise ValidationError(f"{where} 至少需要 2 个数据点")

        if len(s["equity"]) != n:
            raise ValidationError(
                f"{where} 长度不一致: dates={n} equity={len(s['equity'])}"
            )
        if len(s["benchmark"]) != n:
            raise ValidationError(
                f"{where} 长度不一致: dates={n} benchmark={len(s['benchmark'])}"
            )

        # 日期必须升序
        dates = s["dates"]
        if any(not isinstance(d, str) or len(d) != 10 for d in dates):
            raise ValidationError(f"{where}.dates 必须是 YYYY-MM-DD 字符串")
        if any(dates[j] > dates[j + 1] for j in range(n - 1)):
            raise ValidationError(f"{where}.dates 必须按时间升序排列")

        # 净值必须都是有限正数
        for field in ("equity", "benchmark"):
            vals = s[field]
            if not all(is_finite_number(v) and v > 0 for v in vals):
                raise ValidationError(f"{where}.{field} 必须全部是有限正数")
            if abs(vals[0] - 1.0) > 0.05:
                warnings.append(
                    f"{where}.{field}[0] = {vals[0]}，起点通常应该是 1.0"
                )

        # 指标
        m = s["metrics"]
        if not isinstance(m, dict):
            raise ValidationError(f"{where}.metrics 必须是对象")
        for key in REQUIRED_METRICS:
            if key not in m:
                raise ValidationError(f"{where}.metrics 缺少指标: {key}")
            if not is_finite_number(m[key]):
                raise ValidationError(f"{where}.metrics.{key} 不是有效数字")
        if m["maxDrawdown"] > 0:
            warnings.append(f"{where}.metrics.maxDrawdown 是正数，最大回撤通常应为负数")

        # 月度
        for mo in s.get("monthly") or []:
            if not all(k in mo for k in ("y", "m", "r")):
                raise ValidationError(f"{where}.monthly 每条需要 y / m / r")
            if not is_finite_number(mo["r"]):
                raise ValidationError(f"{where}.monthly.r 不是有效数字")

        # 交易
        for t in s.get("trades") or []:
            for key in ("date", "symbol", "side"):
                if key not in t:
                    raise ValidationError(f"{where}.trades 每条至少需要 date / symbol / side")

    return warnings


def generate(force_demo: bool) -> dict:
    if USER_SCRIPT.exists() and not force_demo:
        print(f"→ 运行你自己的脚本: {USER_SCRIPT.relative_to(ROOT)}")
        result = subprocess.run([sys.executable, str(USER_SCRIPT)], cwd=ROOT)
        if result.returncode != 0:
            raise ValidationError(f"你的脚本退出码 {result.returncode}，数据未更新")
        if not DATA.exists():
            raise ValidationError("你的脚本没有生成 src/data/quant.json")
        return json.loads(DATA.read_text(encoding="utf-8"))

    print("→ 使用内置演示数据生成器（tools/quant_demo.py）")
    sys.path.insert(0, str(ROOT / "tools"))
    import quant_demo  # noqa: E402

    return quant_demo.build()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="只生成和校验，不写文件")
    ap.add_argument("--demo", action="store_true", help="强制使用演示数据")
    args = ap.parse_args()

    try:
        data = generate(args.demo)
    except ValidationError as e:
        print(f"✗ 生成失败: {e}", file=sys.stderr)
        return 1

    try:
        warnings = validate(data)
    except ValidationError as e:
        print(f"✗ 数据校验失败: {e}", file=sys.stderr)
        print("  文件未被修改，线上仍是上一版数据。", file=sys.stderr)
        return 1

    for w in warnings:
        print(f"  ⚠ {w}")

    if args.dry_run:
        print("✓ 校验通过（--dry-run，未写文件）")
        return 0

    # ---- 只在数据真的变了时才写文件 ----
    #
    # updated 字段带时分秒，每次运行都不一样。如果直接整体比对，
    # 每次跑都会判定为"有变化"，于是天天产生一条只有时间戳不同的提交。
    # 所以比对时把 updated 排除掉：**内容没变就什么都不做，包括不更新时间戳**。
    # 这样「数据更新于」表示的是数据最后一次真正变化的时刻，更有意义。
    old_data = None
    if DATA.exists():
        try:
            old_data = json.loads(DATA.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            old_data = None

    def without_updated(d):
        return {k: v for k, v in d.items() if k != "updated"}

    if isinstance(old_data, dict) and without_updated(old_data) == without_updated(data):
        print(f"✓ 校验通过；数据内容没有变化，保留原更新时间 {old_data.get('updated', '')}")
        return 0

    payload = json.dumps(data, ensure_ascii=False, indent=1)

    DATA.parent.mkdir(parents=True, exist_ok=True)
    DATA.write_text(payload, encoding="utf-8")

    kb = len(payload.encode("utf-8")) / 1024
    print(f"✓ 已更新 {DATA.relative_to(ROOT)}  ({kb:.0f} KB)")
    print(f"  更新时间: {data['updated']}")
    for s in data["strategies"]:
        m = s["metrics"]
        print(
            f"  · {s['name']}: 年化 {m['annualReturn']:+.1%} / "
            f"最大回撤 {m['maxDrawdown']:.1%} / 夏普 {m['sharpe']:.2f}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
