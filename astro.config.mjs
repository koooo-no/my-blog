// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// ============================================================
//  部署配置
//
//  正常情况：下面两个值都不用手动改，托管平台会自动注入。
//    Vercel / Cloudflare Pages / Netlify  → 自动读取，默认根目录
//    GitHub Pages                          → 由 .github/workflows/deploy.yml 自动计算
//
//  ⚠️ 只用一件事需要你手动做：
//     绑定自定义域名后，把 SITE_URL 改成你的域名（结尾不要带斜杠）
//     例如 SITE_URL = 'https://blog.example.com'
//
//  本地想模拟"部署在子目录"的效果：
//     SITE_URL=https://user.github.io BASE_PATH=/my-blog pnpm build
// ============================================================

/** 站点完整地址，影响 RSS、站点地图、分享卡片 */
const SITE_URL = process.env.SITE_URL || 'https://example.com';

/** 部署路径。'/' 表示根目录，'/my-blog' 表示子目录 */
const BASE_PATH = process.env.BASE_PATH || '/';

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'ignore',
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      wrap: true,
    },
  },
});
