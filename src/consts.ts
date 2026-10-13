// ============================================================
//  站点全局信息 —— 想改站名、简介、导航，都在这个文件里改
// ============================================================

export const SITE = {
  /** 网站标题，显示在浏览器标签和页面顶部 */
  title: '我的小站',
  /** 一句话简介，用于首页和搜索引擎 */
  description: '记录思考、积累知识、展示作品。',
  /** 你的名字 / 昵称 */
  author: '你的名字',
  /** 页脚版权显示的年份起算 */
  since: 2026,
  /** 语言，中文用 zh-CN */
  lang: 'zh-CN',
};

/** 顶部导航栏，按顺序显示 */
export const NAV = [
  { label: '首页', href: '/' },
  { label: '博客', href: '/blog' },
  { label: '知识库', href: '/notes' },
  { label: '作品', href: '/projects' },
  { label: '关于', href: '/about' },
];

/** 社交 / 联系方式，显示在页脚。不需要的删掉即可 */
export const SOCIALS = [
  { label: 'GitHub', href: 'https://github.com/yourname' },
  { label: '邮箱', href: 'mailto:you@example.com' },
  { label: 'RSS', href: '/rss.xml' },
];

/** 首页各板块显示多少条 */
export const HOME_LIMITS = {
  posts: 5,
  notes: 4,
  projects: 3,
};
