import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE } from '../consts';
import { sortByDate } from '../utils/date';
import { withBase } from '../utils/url';

export async function GET(context) {
  const posts = sortByDate(
    (await getCollection('posts')).filter((p) => !p.data.draft)
  );

  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site ?? 'https://example.com',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description ?? '',
      pubDate: post.data.pubDate,
      link: withBase(`/blog/${post.id}/`),
      categories: post.data.tags,
    })),
    customData: `<language>zh-cn</language>`,
  });
}
