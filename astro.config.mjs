// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// ============================================================
//  部署配置
//
//  【不需要手动配置任何东西】
//
//  站点地址按下面的顺序自动推断：
//    1. 环境变量 SITE_URL（自己设了就用它，优先级最高）
//    2. 托管平台自动注入的地址：
//         Vercel           VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL
//         Cloudflare Pages CF_PAGES_URL
//         Netlify          DEPLOY_PRIME_URL
//         GitHub Pages     由 .github/workflows/deploy.yml 算好后注入 SITE_URL
//    3. 都取不到才退回 https://example.com（只在本地构建时会出现）
//
//  部署路径（base）同理：
//    默认 '/'；GitHub Pages 的项目仓库会由 workflow 注入 '/仓库名'
//
//  所以：**不买域名、直接用平台送的免费网址也能正确工作**，
//  不需要先部署一次拿到网址再回来改配置。
//
//  本地想模拟"部署在子目录"的效果：
//     SITE_URL=https://user.github.io BASE_PATH=/my-blog pnpm build
// ============================================================

function detectSiteUrl() {
  // 1. 手动指定优先
  if (process.env.SITE_URL) {
    return { url: process.env.SITE_URL, from: 'SITE_URL' };
  }

  // 2. Vercel —— 生产域名（形如 my-blog.vercel.app，不带协议）
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return {
      url: `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
      from: 'VERCEL_PROJECT_PRODUCTION_URL',
    };
  }
  // Vercel —— 本次部署地址（预览部署时用这个）
  if (process.env.VERCEL_URL) {
    return { url: `https://${process.env.VERCEL_URL}`, from: 'VERCEL_URL' };
  }

  // 3. Cloudflare Pages —— 已经带协议
  if (process.env.CF_PAGES_URL) {
    return { url: process.env.CF_PAGES_URL, from: 'CF_PAGES_URL' };
  }

  // 4. Netlify
  if (process.env.DEPLOY_PRIME_URL) {
    return { url: process.env.DEPLOY_PRIME_URL, from: 'DEPLOY_PRIME_URL' };
  }

  return { url: 'https://example.com', from: '默认值' };
}

const { url: DETECTED_SITE_URL, from: SITE_URL_SOURCE } = detectSiteUrl();
const BASE_PATH = process.env.BASE_PATH || '/';

// 构建日志里打出来，省得以后猜 "到底用的哪个地址"
console.log(`[astro] 站点地址: ${DETECTED_SITE_URL}  (来源: ${SITE_URL_SOURCE})`);
console.log(`[astro] 部署路径: ${BASE_PATH}`);

if (SITE_URL_SOURCE === '默认值' && process.env.CI) {
  console.warn(
    '[astro] ⚠️ 没能识别出站点地址，RSS / 站点地图 / 分享链接会指向 example.com。' +
      '请设置环境变量 SITE_URL。'
  );
}

export default defineConfig({
  site: DETECTED_SITE_URL,
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
