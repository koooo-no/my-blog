import { getCollection } from 'astro:content';
import { plainText, clamp } from '../utils/text';
import { isoDate } from '../utils/date';

/**
 * 搜索索引
 *
 * 构建时生成静态 JSON，前端搜索时按需加载。
 *
 * 每篇文章的正文只截取前 1500 字，避免索引体积失控。
 * 对于个人博客规模（几百篇以内）完全够用；如果哪天内容量很大，
 * 再考虑换成 Pagefind 之类的专用方案。
 */
const TEXT_LIMIT = 1500;

export async function GET() {
  const isPublished = (entry) => (import.meta.env.PROD ? !entry.data.draft : true);

  const [posts, notes, projects] = await Promise.all([
    getCollection('posts'),
    getCollection('notes'),
    getCollection('projects'),
  ]);

  const docs = [
    ...posts.filter(isPublished).map((e) => ({
      kind: '博客',
      title: e.data.title,
      desc: e.data.description ?? '',
      tags: e.data.tags,
      /* 索引里存的是不带子路径前缀的地址，前端再补 base */
      url: `/blog/${e.id}/`,
      date: isoDate(e.data.pubDate),
      text: clamp(plainText(e.body), TEXT_LIMIT),
    })),

    ...notes.filter(isPublished).map((e) => ({
      kind: '知识库',
      title: e.data.title,
      desc: e.data.description ?? '',
      /* 分类也当作标签，去重后参与搜索 */
      tags: [...new Set([e.data.category, ...e.data.tags].filter(Boolean))],
      url: `/notes/${e.id}/`,
      date: isoDate(e.data.pubDate),
      text: clamp(plainText(e.body), TEXT_LIMIT),
    })),

    ...projects.filter(isPublished).map((e) => ({
      kind: '作品',
      title: e.data.title,
      desc: e.data.description ?? '',
      tags: e.data.tags,
      url: `/projects/${e.id}/`,
      date: isoDate(e.data.pubDate),
      text: clamp(plainText(e.body), TEXT_LIMIT),
    })),
  ];

  const payload = JSON.stringify({ count: docs.length, docs });
  const kb = (Buffer.byteLength(payload, 'utf8') / 1024).toFixed(1);
  console.log(`[search-index] ${docs.length} 条记录，${kb} KB`);

  return new Response(payload, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
