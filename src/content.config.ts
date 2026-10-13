import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * 博文 / 随笔
 * 文件放在 src/content/posts/ 下，一个 .md 文件就是一篇
 */
const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    /** true = 草稿，不会出现在网站和 RSS 里 */
    draft: z.boolean().default(false),
    /** 置顶到首页 */
    featured: z.boolean().default(false),
  }),
});

/**
 * 知识库 / 笔记
 * 文件放在 src/content/notes/ 下，支持 category 分类
 */
const notes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    /** 分类，用于知识库目录页分组 */
    category: z.string().default('未分类'),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    /** 排序权重，数字越小越靠前 */
    order: z.number().default(999),
  }),
});

/**
 * 作品集
 * 文件放在 src/content/projects/ 下
 */
const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    /** 项目链接，比如线上地址或仓库地址 */
    link: z.string().optional(),
    repo: z.string().optional(),
    status: z.enum(['进行中', '已完成', '长期维护', '已归档']).default('已完成'),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

/**
 * 单页内容（关于我 等）
 * 文件放在 src/content/pages/ 下，比如 about.md
 */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    updatedDate: z.coerce.date().optional(),
  }),
});

export const collections = { posts, notes, projects, pages };
