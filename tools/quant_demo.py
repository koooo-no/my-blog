#!/usr/bin/env python3
"""
量化看板的示例数据生成器

重要：曲线是在一个**固定的时间跨度**上生成的（2024-01-01 ~ 2030-12-31），
然后用当前日期切片。这样做的原因：

    如果直接按"从开始到今天"生成随机序列，运行日期一变，天数就变了，
    整条曲线的随机数序列也会跟着变 —— 结果就是每天跑一次，
    连去年的历史净值都被改写了。这显然不对。

固定跨度之后，历史数据永远不变，每天只是往后多接一天。

换成你自己的真实数据时，这个文件可以整个不用：
写一个自己的脚本，让它输出同样的 JSON 结构即可。

直接用命令行运行会生成 demo 数据：

    python3 tools/quant_demo.py
"""

from datetime import date, timedelta

import numpy as np

TRADING_DAYS_PER_YEAR = 252
RISK_FREE = 0.02

# 固定生成跨度 —— 不要改，改了历史数据就会变
HORIZON_START = date(2024, 1, 1)
HORIZON_END = date(2030, 12, 31)

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


def trading_days(start: date, end: date):
    """去掉周末的交易日（不处理节假日，示例数据够用了）"""
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

    vol = float(np.std(returns, ddof=1) * np.sqrt(TRADING_DAYS_PER_YEAR))
    sharpe = (annual_return - RISK_FREE) / vol if vol else 0.0

    peak = np.maximum.accumulate(equity)
    dd = equity / peak - 1
    max_dd = float(dd.min())

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
        "profitFactor": round(float(profit_factor), 3),
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
        out.append({"y": y, "m": m, "r": round(float(vals[-1] / prev_close - 1), 4)})
        prev_close = vals[-1]
    return out


def make_trades(all_dates, seed):
    """
    在整个跨度上一次性生成交易记录（所以历史记录不会变），
    调用方再按日期过滤。
    """
    rng = np.random.default_rng(seed)
    count = min(180, len(all_dates))
    picks = sorted(rng.choice(len(all_dates), size=count, replace=False))

    trades = []
    for i in picks:
        sym, name = SYMBOLS[rng.integers(0, len(SYMBOLS))]
        side = "买入" if rng.random() < 0.5 else "卖出"
        trades.append(
            {
                "date": all_dates[i].isoformat(),
                "symbol": sym,
                "name": name,
                "side": side,
                "price": round(float(rng.uniform(8, 180)), 2),
                "qty": int(rng.choice([100, 200, 500, 1000, 2000])),
                "pnl": None if side == "买入" else round(float(rng.normal(2400, 5200)), 2),
            }
        )
    return trades


def build(end_date: date | None = None):
    """生成完整的数据结构；end_date 默认取今天"""
    end = end_date or date.today()
    if end < HORIZON_START:
        end = HORIZON_START

    full_dates = trading_days(HORIZON_START, HORIZON_END)
    n_full = len(full_dates)

    # 一次性生成整条跨度上的序列（固定，与运行日期无关）
    bench_r = make_series(n_full, 0.00022, 0.0105, seed=7)

    r1 = make_series(
        n_full, 0.00088, 0.0125, seed=42,
        shocks=[
            (int(n_full * 0.42), int(n_full * 0.50), -0.0022),
            (int(n_full * 0.78), int(n_full * 0.81), -0.0016),
        ],
    )
    r2 = make_series(
        n_full, 0.00046, 0.0082, seed=99,
        shocks=[(int(n_full * 0.62), int(n_full * 0.66), -0.0012)],
    )

    # 按 end_date 切片 —— 历史部分完全不受影响
    keep = [i for i, d in enumerate(full_dates) if d <= end]
    if len(keep) < 30:
        keep = list(range(min(30, n_full)))

    dates = [full_dates[i] for i in keep]
    bench_eq = [to_equity(bench_r)[i] for i in keep]

    def series_slice(raw_returns):
        eq = to_equity(raw_returns)
        return [eq[i] for i in keep], np.array([raw_returns[i] for i in keep])

    eq1, ret1 = series_slice(r1)
    eq2, ret2 = series_slice(r2)

    end_iso = dates[-1].isoformat()

    def pack_trades(all_trades):
        return [t for t in all_trades if t["date"] <= end_iso]

    strategies = [
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
            "equity": [round(float(v), 6) for v in eq1],
            "benchmark": [round(float(v), 6) for v in bench_eq],
            "metrics": metrics_from(ret1, eq1, bench_eq, trades_count=412, turnover=3.4),
            "monthly": monthly_returns(dates, eq1),
            "trades": pack_trades(make_trades(full_dates, 11)),
        },
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
            "equity": [round(float(v), 6) for v in eq2],
            "benchmark": [round(float(v), 6) for v in bench_eq],
            "metrics": metrics_from(ret2, eq2, bench_eq, trades_count=96, turnover=0.7),
            "monthly": monthly_returns(dates, eq2),
            "trades": pack_trades(make_trades(full_dates, 22)),
        },
    ]

    return {
        "_说明": "这是演示数据，不是真实回测结果。换成自己的数据时保持结构不变即可。",
        "updated": end_iso,
        "benchmarkName": "沪深300",
        "currency": "CNY",
        "strategies": strategies,
    }


if __name__ == "__main__":
    import json
    from pathlib import Path

    out = Path(__file__).resolve().parent.parent / "src" / "data" / "quant.json"
    data = build()
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"已写入 {out}")
    print(f"  区间 {data['strategies'][0]['dates'][0]} ~ {data['updated']}")
    for s in data["strategies"]:
        m = s["metrics"]
        print(f"  · {s['name']}: 年化 {m['annualReturn']:.1%} / 最大回撤 {m['maxDrawdown']:.1%}")
