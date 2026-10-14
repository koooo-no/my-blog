#!/usr/bin/env python3
"""
生成量化看板的示例数据（src/data/quant.json）

这只是**演示数据**，用来把看板的形状定下来。
换成你自己的数据时，保持同样的 JSON 结构即可，看板不用改。

你自己的量化脚本要做的事情就是：跑完回测 → 按这个结构写出 JSON → 提交。

用法：
    python3 tools/make-quant-demo.py
"""

import json
import math
from datetime import date, timedelta
from pathlib import Path

import numpy as np

OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "quant.json"

START = date(2024, 1, 1)
END = date(2026, 10, 9)
TRADING_DAYS_PER_YEAR = 252
RISK_FREE = 0.02


def trading_days(start: date, end: date):
    """去掉周末的交易日（不处理节假日，演示用够了）"""
    days = []
    d = start
    while d <= end:
        if d.weekday() < 5:
            days.append(d)
        d += timedelta(days=1)
    return days


def make_series(n, mu, sigma, seed, shocks=None):
    """
    生成日收益序列。

    先造零均值噪声再做 AR(1) 平滑，然后把样本均值归一掉、换成目标漂移 mu，
    最后叠加 shocks 制造回撤。这样演示数据的形态是可控的，
    不会因为某次随机抽样就变成负收益。
    """
    rng = np.random.default_rng(seed)
    r = rng.normal(0.0, sigma, n)
    for i in range(1, n):
        r[i] = 0.12 * r[i - 1] + 0.88 * r[i]
    r = r - r.mean() + mu
    if shocks:
        for a, b, drift in shocks:
            r[a:b] += drift
    return r


def to_equity(returns, start_value=1.0):
    return list(start_value * np.cumprod(1.0 + returns))


def metrics_from(returns, equity, benchmark_equity, trades_count, turnover):
    n = len(returns)
    years = n / TRADING_DAYS_PER_YEAR

    total_return = equity[-1] / equity[0] - 1
    annual_return = (1 + total_return) ** (1 / years) - 1

    bench_total = benchmark_equity[-1] / benchmark_equity[0] - 1
    bench_annual = (1 + bench_total) ** (1 / years) - 1

    vol = float(np.std(returns, ddof=1) * math.sqrt(TRADING_DAYS_PER_YEAR))
    excess = annual_return - RISK_FREE
    sharpe = excess / vol if vol else 0.0

    peak = np.maximum.accumulate(equity)
    dd = equity / peak - 1
    max_dd = float(dd.min())

    # 最长回撤持续天数
    longest = cur = 0
    for x in dd:
        cur = cur + 1 if x < -1e-9 else 0
        longest = max(longest, cur)

    calmar = annual_return / abs(max_dd) if max_dd else 0.0

    wins = returns[returns > 0]
    losses = returns[returns < 0]
    win_rate = float(len(wins) / len(returns)) if n else 0.0
    profit_factor = (
        float(wins.sum() / abs(losses.sum())) if len(losses) and losses.sum() != 0 else 0.0
    )

    return {
        "totalReturn": round(float(total_return), 4),
        "annualReturn": round(float(annual_return), 4),
        "benchmarkTotalReturn": round(float(bench_total), 4),
        "benchmarkAnnualReturn": round(float(bench_annual), 4),
        "excessAnnualReturn": round(float(annual_return - bench_annual), 4),
        "volatility": round(vol, 4),
        "maxDrawdown": round(max_dd, 4),
        "maxDrawdownDays": int(longest),
        "sharpe": round(float(sharpe), 3),
        "calmar": round(float(calmar), 3),
        "winRate": round(win_rate, 4),
        "profitFactor": round(profit_factor, 3),
        "tradeCount": int(trades_count),
        "turnover": round(float(turnover), 2),
    }


def monthly_returns(dates, equity):
    """按自然月聚合收益"""
    by_month = {}
    for d, v in zip(dates, equity):
        by_month.setdefault((d.year, d.month), []).append(v)

    out = []
    prev_close = equity[0]
    for (y, m) in sorted(by_month):
        vals = by_month[(y, m)]
        r = vals[-1] / prev_close - 1
        out.append({"y": y, "m": m, "r": round(float(r), 4)})
        prev_close = vals[-1]
    return out


def make_trades(dates, equity, seed, symbols):
    rng = np.random.default_rng(seed)
    picks = sorted(rng.choice(len(dates), size=min(24, len(dates)), replace=False))
    trades = []
    for i in picks:
        sym, name = symbols[rng.integers(0, len(symbols))]
        side = "买入" if rng.random() < 0.5 else "卖出"
        ret = float(rng.normal(0.012, 0.05))
        if side == "买入":
            pnl = None
        else:
            pnl = round(float(rng.normal(2400, 5200)), 2)
        trades.append(
            {
                "date": dates[i].isoformat(),
                "symbol": sym,
                "name": name,
                "side": side,
                "price": round(float(rng.uniform(8, 180)), 2),
                "qty": int(rng.choice([100, 200, 500, 1000, 2000])),
                "pnl": pnl,
            }
        )
    return trades


SYMBOLS = [
    ("600519", "贵州茅台"),
    ("000858", "五粮液"),
    ("300750", "宁德时代"),
    ("601318", "中国平安"),
    ("000333", "美的集团"),
    ("600036", "招商银行"),
    ("002415", "海康威视"),
    ("601899", "紫金矿业"),
    ("600900", "长江电力"),
    ("000001", "平安银行"),
]


def build():
    dates = trading_days(START, END)
    n = len(dates)

    bench_r = make_series(n, 0.00022, 0.0105, seed=7)
    bench_eq = to_equity(bench_r)

    strategies = []

    # 策略一：动量轮动，收益不错但中途有较大回撤
    r1 = make_series(
        n, 0.00088, 0.0125, seed=42,
        shocks=[(int(n * 0.42), int(n * 0.50), -0.0022), (int(n * 0.78), int(n * 0.81), -0.0016)],
    )
    eq1 = to_equity(r1)
    strategies.append(
        {
            "id": "momentum-rotation",
            "name": "动量轮动",
            "subtitle": "行业 ETF 动量 + 波动率过滤",
            "description": "按 20 日动量排序选取前 3 个行业 ETF，用 60 日波动率做仓位调节。回撤超过阈值时降仓。",
            "status": "研究中",
            "frequency": "日频",
            "universe": "行业 ETF（18 只）",
            "tags": ["动量", "轮动", "ETF"],
            "dates": [d.isoformat() for d in dates],
            "equity": [round(v, 6) for v in eq1],
            "benchmark": [round(v, 6) for v in bench_eq],
            "metrics": metrics_from(r1, eq1, bench_eq, trades_count=412, turnover=3.4),
            "monthly": monthly_returns(dates, eq1),
            "trades": make_trades(dates, eq1, 11, SYMBOLS),
        }
    )

    # 策略二：低波红利，稳但收益平
    r2 = make_series(
        n, 0.00046, 0.0082, seed=99,
        shocks=[(int(n * 0.62), int(n * 0.66), -0.0012)],
    )
    eq2 = to_equity(r2)
    strategies.append(
        {
            "id": "low-vol-dividend",
            "name": "低波红利",
            "subtitle": "高股息 + 低波动筛选",
            "description": "在股息率前 30% 的股票里，选波动率最低的 15 只等权持有，每季度调仓。",
            "status": "观察中",
            "frequency": "日频（季度调仓）",
            "universe": "中证红利成分股",
            "tags": ["红利", "低波", "价值"],
            "dates": [d.isoformat() for d in dates],
            "equity": [round(v, 6) for v in eq2],
            "benchmark": [round(v, 6) for v in bench_eq],
            "metrics": metrics_from(r2, eq2, bench_eq, trades_count=96, turnover=0.7),
            "monthly": monthly_returns(dates, eq2),
            "trades": make_trades(dates, eq2, 22, SYMBOLS),
        }
    )

    payload = {
        "_说明": "这是演示数据。换成自己的数据时保持结构不变，看板无需修改。",
        "updated": END.isoformat(),
        "benchmarkName": "沪深300",
        "currency": "CNY",
        "strategies": strategies,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    kb = OUT.stat().st_size / 1024
    print(f"已写入 {OUT}")
    print(f"  交易日 {n} 天，策略 {len(strategies)} 个，文件 {kb:.0f} KB")
    for s in strategies:
        m = s["metrics"]
        print(
            f"  · {s['name']}: 年化 {m['annualReturn']:.1%} / "
            f"最大回撤 {m['maxDrawdown']:.1%} / 夏普 {m['sharpe']}"
        )


if __name__ == "__main__":
    build()
