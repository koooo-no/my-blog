/**
 * 数字格式化工具（量化看板用）
 */

/** 0.1234 → "12.3%"；signed=true 时带正负号 */
export function pct(value: number, digits = 1, signed = false): string {
  const v = value * 100;
  const sign = signed && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}

/** 1.234 → "1.23" */
export function num(value: number, digits = 2): string {
  return value.toFixed(digits);
}

/** 带正负号的数字 */
export function signedNum(value: number, digits = 2): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

/** "2024-01-02" → "2024-01" */
export function shortMonth(iso: string): string {
  return iso.slice(0, 7);
}

/** "2024-01-02" → "24/01" */
export function tinyDate(iso: string): string {
  return `${iso.slice(2, 4)}/${iso.slice(5, 7)}`;
}

/** 把数值数组映射到 [0,1]；值相同时返回 0.5 */
export function normalize(values: number[]): { min: number; max: number; scale: (v: number) => number } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  return {
    min,
    max,
    scale: (v: number) => (span === 0 ? 0.5 : (v - min) / span),
  };
}

/**
 * 生成"整齐"的坐标轴刻度（1 / 2 / 2.5 / 5 / 10 的倍数）。
 *
 * 两个容易踩的坑，这里都处理了：
 *   1. 起点必须向下取整、终点向上取整，否则刻度范围覆盖不住数据，
 *      曲线会画到坐标轴外面去（比如刻度只到 +50%，数据却有 +90%）。
 *   2. 用整数下标累加，再做一次小数截断，避免浮点误差产生
 *      0.30000000000000004 这种刻度。
 */
export function niceTicks(lo: number, hi: number, target = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return [lo];

  const rawStep = (hi - lo) / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;

  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const count = Math.round((end - start) / step);

  // 防御：步长算出异常值时不要生成一大堆刻度
  if (!Number.isFinite(count) || count < 1 || count > 40) return [lo, hi];

  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(Math.round((start + i * step) * 1e6) / 1e6);
  }
  return ticks;
}

/**
 * 给定数据范围，返回"扩到整齐刻度"后的 y 轴范围与刻度。
 * 曲线不会贴边，刻度是整齐数字，且范围一定覆盖全部数据。
 */
export function axisRange(values: number[], target = 5): { lo: number; hi: number; ticks: number[] } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min || 1) * 0.06;
  const ticks = niceTicks(min - pad, max + pad, target);
  return { lo: ticks[0], hi: ticks[ticks.length - 1], ticks };
}
