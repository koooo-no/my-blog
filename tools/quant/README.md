# 把你的量化脚本放在这里

放两个文件，工作流每天就会自动运行你的脚本：

| 文件 | 必须 | 说明 |
| --- | --- | --- |
| `update.py` | ✅ | 你的脚本。跑完后要写出 `src/data/quant.json` |
| `requirements.txt` | 可选 | 你的脚本需要的额外 Python 包，一行一个 |

只要 `update.py` 存在，`tools/update-quant-data.py` 就会优先运行它，
不再使用内置的演示数据生成器。**不需要改任何配置。**

## update.py 要做的事

1. 算出/取到你的回测结果
2. 按下面的结构写出 `src/data/quant.json`

```python
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent   # 项目根目录
OUT = ROOT / "src" / "data" / "quant.json"

data = {
    # 带时区的时间戳。只写日期（"2026-10-14"）也能用，
    # 但页面就只显示到日；带时间必须带时区，否则会差 8 小时
    "updated": "2026-10-14T19:37:17+08:00",
    "benchmarkName": "沪深300",
    "currency": "CNY",
    "strategies": [
        {
            "id": "my-strategy",           # 决定网址 /quant/my-strategy/
            "name": "我的策略",
            "subtitle": "一句话副标题",
            "description": "策略说明",
            "status": "研究中",
            "frequency": "日频",
            "universe": "沪深300",
            "tags": ["动量"],

            # 下面三个数组长度必须一致，一一对应
            "dates":     ["2024-01-02", "2024-01-03"],   # YYYY-MM-DD，升序
            "equity":    [1.0, 1.008],                   # 你的策略净值，起点 1.0
            "benchmark": [1.0, 1.002],                   # 基准净值，起点 1.0

            "metrics": {
                "totalReturn": 0.53,           # 小数，0.53 = 53%
                "annualReturn": 0.16,
                "benchmarkTotalReturn": 0.14,
                "benchmarkAnnualReturn": 0.05,
                "excessAnnualReturn": 0.11,
                "volatility": 0.17,
                "maxDrawdown": -0.15,          # 负数
                "maxDrawdownDays": 120,
                "sharpe": 0.80,
                "calmar": 1.04,
                "winRate": 0.52,
                "profitFactor": 1.16,
                "tradeCount": 412,
                "turnover": 3.4,
            },

            "monthly": [{"y": 2024, "m": 1, "r": 0.023}],
            "trades": [
                {"date": "2024-03-05", "symbol": "600519", "name": "贵州茅台",
                 "side": "买入", "price": 1680.5, "qty": 100, "pnl": None}
            ],
        }
    ],
}

OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
```

## 指标怎么算

`tools/quant_demo.py` 里有完整的实现（年化、夏普、卡玛、最大回撤、最长回撤天数、
胜率、盈亏比），可以直接抄或 import。

## 校验

写完可以本地先验证一下格式对不对：

```bash
python3 tools/update-quant-data.py --dry-run
```

格式不对会明确告诉你哪一项有问题。**校验不通过时工作流会主动失败**，
线上继续用上一版数据，不会把坏数据发出去。

## 两个提醒

- **API 密钥不要写进这个文件。** 仓库是公开的，密钥等于公开。
  用环境变量或 GitHub Secrets（工作流里可以通过 `env:` 传进去）
- **数据版权**：Wind / 聚宽 / Tushare 等数据源通常禁止公开再分发，
  别把原始行情明细直接挂到公开网站上
