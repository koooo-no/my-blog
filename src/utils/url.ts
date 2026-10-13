/**
 * 站内路径工具
 *
 * 静态站点可能被部署在两种位置：
 *
 *   1. 根目录 —— 自定义域名、Vercel / Cloudflare Pages、<用户名>.github.io
 *   2. 子目录 —— GitHub Pages 的项目站点：<用户名>.github.io/仓库名/
 *
 * Astro 的 `base` 配置决定 BASE_URL。**所有站内链接都必须经过 withBase()**，
 * 否则部署到子目录时，CSS、图片和导航会全部 404。
 *
 * ⚠️ 注意：BASE_URL 的格式并不统一 —— 可能是 '/my-blog'，也可能是 '/my-blog/'。
 *    所以这里先把它归一化，只保留一个"不带结尾斜杠"的前缀。
 */

const RAW_BASE = (import.meta.env.BASE_URL || '/').trim();

/** 归一化后的前缀：根目录为 ''，子目录为 '/my-blog'（不带结尾斜杠） */
const PREFIX = RAW_BASE === '/' ? '' : `/${RAW_BASE.replace(/^\/+/, '').replace(/\/+$/, '')}`;

/** 归一化后的 base：根目录为 '/'，子目录为 '/my-blog/' */
const BASE = PREFIX === '' ? '/' : `${PREFIX}/`;

/**
 * 把站内路径转换成带 base 前缀的可用路径。
 * 外部链接、锚点、mailto 等会原样返回。
 */
export function withBase(path: string): string {
  if (!path) return BASE;
  if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(path)) return path;

  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${PREFIX}${normalized}` || '/';
}

/**
 * 去掉路径中的 base 前缀，用来判断"当前在哪个页面"。
 * 无论 Astro.url.pathname 是否已包含 base，结果都一致。
 */
export function stripBase(pathname: string): string {
  if (PREFIX && (pathname === PREFIX || pathname.startsWith(BASE))) {
    const rest = pathname.slice(PREFIX.length);
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  return pathname;
}
