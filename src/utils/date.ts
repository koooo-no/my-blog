/**
 * 日期格式化工具
 */

/** 2026年10月13日 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Shanghai',
  }).format(date);
}

/** 2026-10-13，用于 <time datetime="..."> */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 2026.10.13，紧凑格式，用于列表 */
export function shortDate(date: Date): string {
  const d = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(date);
  return d.replace(/\//g, '.');
}

/** 按发布时间倒序排列 */
export function sortByDate<T extends { data: { pubDate: Date } }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** 粗略估算中文阅读时间（分钟） */
export function readingTime(body: string | undefined): number {
  if (!body) return 1;
  const cjk = (body.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const words = (body.match(/[A-Za-z0-9]+/g) ?? []).length;
  return Math.max(1, Math.round(cjk / 350 + words / 200));
}
