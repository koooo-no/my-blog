/**
 * 量化研究的固定框架
 *
 * 每一篇研究报告都必须包含下面 7 个小节。构建时会检查，
 * 缺哪一节直接报错 —— 这样发布出来的研究格式是统一的，
 * 长期下来就形成了自己的研究标准。
 *
 * 想调整框架：改这个数组即可，页面和校验都会跟着变。
 */

export interface ResearchSection {
  /** 二级标题的文字，必须一模一样 */
  key: string;
  /** 这一节该写什么 */
  hint: string;
}

export const RESEARCH_SECTIONS: ResearchSection[] = [
  {
    key: '研究假设',
    hint: '你想验证什么？一句话说清楚，最好能证伪。',
  },
  {
    key: '数据来源',
    hint: '数据从哪来、什么频率、覆盖什么区间，有没有幸存者偏差或前视偏差。',
  },
  {
    key: '方法与参数',
    hint: '具体怎么做的，参数是多少。要让别人能照着复现。',
  },
  {
    key: '回测结果',
    hint: '净值、回撤、分年度表现。别只放表现最好的那一段。',
  },
  {
    key: '成本与风险',
    hint: '手续费、滑点、冲击成本、容量上限、极端行情下的表现。',
  },
  {
    key: '局限性',
    hint: '这份研究不能证明什么。诚实一点，这一节最有价值。',
  },
  {
    key: '后续计划',
    hint: '接下来做什么，或者为什么停掉。',
  },
];

export interface SectionCheck {
  index: number;
  key: string;
  hint: string;
  found: boolean;
}

/** 取出 Markdown 正文里所有二级标题的文字 */
export function headings(body: string | undefined): string[] {
  if (!body) return [];
  return [...body.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)].map((m) => m[1].trim());
}

/**
 * 逐个检查必需小节是否存在。
 * 要求标题文字完全一致（不允许多加编号），否则页面里的锚点会失效。
 */
export function checkSections(body: string | undefined): SectionCheck[] {
  const found = headings(body);
  return RESEARCH_SECTIONS.map((s, i) => ({
    index: i + 1,
    key: s.key,
    hint: s.hint,
    found: found.includes(s.key),
  }));
}

/** 返回缺失的小节描述；全部齐了返回空数组 */
export function missingSections(body: string | undefined): string[] {
  return checkSections(body)
    .filter((s) => !s.found)
    .map((s) => `${String(s.index).padStart(2, '0')} ${s.key}`);
}

/** 按框架顺序返回已存在的小节，用于生成导航 */
export function presentSections(body: string | undefined): SectionCheck[] {
  return checkSections(body).filter((s) => s.found);
}
