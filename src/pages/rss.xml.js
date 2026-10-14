import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE } from '../consts';
import { sortByDate } from '../utils/date';
import { withBase } from '../utils/url';

export async function GET(context) {
  const posts = sortByDate(
    (await getCollection('posts')).filter((p) => !p.data.draft)
  );

  // 注意：context.site 只带域名，不含子路径前缀。
  // 直接用它的话，部署在 /仓库名/ 下时 channel 的 <link> 会指向
  // https://user.github.io/（自己的另一个地址），点"访问网站"会跑空。
  // 所以这里要把 base 也拼进去。
  const site = new URL(withBase('/'), context.site ?? 'https://example.com');

  return rss({
    title: SITE.title,
    description: SITE.description,
    site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description ?? '',
      pubDate: post.data.pubDate,
      // 绝对路径，解析时会替换 site 的路径部分，不会和上面的 base 叠加
      link: withBase(`/blog/${post.id}/`),
      categories: post.data.tags,
    })),
    customData: `<language>zh-cn</language>`,
  });
}
