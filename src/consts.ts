// ============================================================
//  站点全局信息 —— 想改站名、简介、导航，都在这个文件里改
// ============================================================

export const SITE = {
  /** 网站标题，显示在浏览器标签和页头 */
  title: '知序 ZhiXu',

  /** 一句话标语，显示在首页大标题 */
  tagline: '以数据求真，以系统致知。',

  /** 站点介绍，显示在首页副标题 */
  intro: '知序是一个专注于 AI 量化研究、技术实践与个人知识管理的独立站。',

  /**
   * 给搜索引擎和分享卡片看的简介。
   * 比 tagline 长一些，因为搜索结果里显示的字数更多效果好。
   */
  description:
    '知序是一个专注于 AI 量化研究、技术实践与个人知识管理的独立站。以数据求真，以系统致知。',

  /** 三个关键词，显示在首页顶部小字 */
  motto: '独立研究 · 持续实验 · 长期积累',

  /** 你的名字 / 昵称，显示在页脚版权处 */
  author: 'koooo-no',

  /** 页脚版权显示的年份起算 */
  since: 2026,

  /** 语言，中文用 zh-CN */
  lang: 'zh-CN',
};

/**
 * 顶部主导航 —— 只放主要栏目，保持精简
 *
 * 搜索 / 标签 / 归档 / 关于 属于辅助功能，放在页脚的 FOOTER_NAV 里，
 * 不占导航栏位置。
 */
export const NAV = [
  { label: '首页', href: '/' },
  { label: '量化', href: '/quant' },
  { label: '博客', href: '/blog' },
  { label: '知识库', href: '/notes' },
  { label: '作品', href: '/projects' },
];

/**
 * 辅助导航 —— 显示在页脚
 *
 * 这些页面同样重要，只是不需要常驻顶部。
 */
export const FOOTER_NAV = [
  { label: '搜索', href: '/search' },
  { label: '标签', href: '/tags' },
  { label: '归档', href: '/archive' },
  { label: '关于', href: '/about' },
  { label: 'RSS', href: '/rss.xml' },
];

/** 社交 / 联系方式，显示在页脚 */
export const SOCIALS = [
  { label: 'GitHub', href: 'https://github.com/koooo-no' },
];

/** 首页各板块显示多少条 */
export const HOME_LIMITS = {
  posts: 5,
  notes: 4,
  projects: 3,
};
