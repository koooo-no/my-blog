/**
 * 文本处理工具
 */

/**
 * 把 Markdown 正文转成纯文本，用于搜索索引。
 * 只求"能搜到"，不需要保留任何格式。
 */
export function plainText(markdown: string | undefined | null): string {
  if (!markdown) return '';

  return markdown
    // 代码块只去掉围栏那几行，内容保留 —— 技术笔记里代码是要能被搜到的
    .replace(/^\s*(```|~~~).*$/gm, ' ')
    .replace(/`([^`]*)`/g, '$1') // 行内代码保留内容
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片丢弃
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接保留文字
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // 标题符号
    .replace(/^\s{0,3}>\s?/gm, '') // 引用符号
    .replace(/^\s*[-*+]\s+/gm, '') // 无序列表符号
    .replace(/^\s*\d+\.\s+/gm, '') // 有序列表符号
    .replace(/^\s*[-:| ]{3,}\s*$/gm, ' ') // 表格分隔行
    .replace(/[|]/g, ' ') // 表格竖线
    .replace(/<\/?[^>]+>/g, ' ') // 残留 HTML
    .replace(/[*_~]/g, '') // 强调符号
    .replace(/\s+/g, ' ')
    .trim();
}

/** 截断到指定长度，避免搜索索引过大 */
export function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max);
}

/** 把搜索关键词切成词条（支持中英文混排） */
export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,，、。；;：:!！?？/|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}
