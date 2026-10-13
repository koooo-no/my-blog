// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// ⚠️ 部署上线前，把下面的 site 改成你自己的域名（结尾不要带斜杠）
// 例如：'https://blog.example.com'
// 没有自定义域名时，填托管平台给的地址，例如 'https://你的用户名.github.io'
export const SITE_URL = 'https://example.com';

export default defineConfig({
  site: SITE_URL,
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
