/**
 * 量化看板数据
 *
 * 数据来自 src/data/quant.json，构建时读入并渲染成静态 SVG。
 * 换数据只需要替换那个 JSON 文件，页面代码不用动。
 *
 * 生成示例数据的脚本：tools/make-quant-demo.py
 */
import raw from '../data/quant.json';

export interface QuantMetrics {
  totalReturn: number;
  annualReturn: number;
  benchmarkTotalReturn: number;
  benchmarkAnnualReturn: number;
  excessAnnualReturn: number;
  volatility: number;
  maxDrawdown: number;
  maxDrawdownDays: number;
  sharpe: number;
  calmar: number;
  winRate: number;
  profitFactor: number;
  tradeCount: number;
  turnover: number;
}

export interface QuantTrade {
  date: string;
  symbol: string;
  name: string;
  side: string;
  price: number;
  qty: number;
  pnl: number | null;
}

export interface QuantMonth {
  y: number;
  m: number;
  r: number;
}

export interface QuantStrategy {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  status: string;
  frequency: string;
  universe: string;
  tags: string[];
  dates: string[];
  equity: number[];
  benchmark: number[];
  metrics: QuantMetrics;
  monthly: QuantMonth[];
  trades: QuantTrade[];
}

export interface QuantData {
  updated: string;
  benchmarkName: string;
  currency: string;
  strategies: QuantStrategy[];
}

export const quant = raw as unknown as QuantData;

/** 找单个策略，找不到返回 undefined */
export function strategyById(id: string): QuantStrategy | undefined {
  return quant.strategies.find((s) => s.id === id);
}

/** 指标展示配置：改这里就能调整看板上显示哪些指标 */
export const METRIC_VIEW: {
  key: keyof QuantMetrics;
  label: string;
  hint?: string;
  kind: 'pct' | 'num' | 'int' | 'pctAbs';
}[] = [
  { key: 'annualReturn', label: '年化收益', kind: 'pct' },
  { key: 'excessAnnualReturn', label: '超额收益', hint: '相对基准', kind: 'pct' },
  { key: 'maxDrawdown', label: '最大回撤', kind: 'pct' },
  { key: 'sharpe', label: '夏普比率', kind: 'num' },
  { key: 'calmar', label: '卡玛比率', hint: '年化 / 最大回撤', kind: 'num' },
  { key: 'volatility', label: '年化波动', kind: 'pct' },
  { key: 'winRate', label: '胜率', hint: '按日计算', kind: 'pct' },
  { key: 'profitFactor', label: '盈亏比', kind: 'num' },
  { key: 'tradeCount', label: '交易笔数', kind: 'int' },
];
