# 我的小站

一个静态博客 / 知识库 / 作品集网站，用 [Astro](https://astro.build) 搭建。

写完 Markdown 文件，网站自动重新生成 —— 不需要数据库，不需要服务器维护。

---

## 一、怎么写一篇文章

1. 打开 `src/content/posts/` 文件夹
2. 复制一份 `templates/post.md`（在项目根目录的 `templates/` 里）放进去
3. 改成你想要的文件名，比如 `my-first-post.md`
   - **文件名就是网址**，用英文和短横线，别用中文和空格
   - 这个例子会生成 `你的域名/blog/my-first-post/`
4. 编辑文件内容
5. 存盘，完成

文件开头两行 `---` 之间的部分叫 frontmatter，用来填标题、日期、标签：

```yaml
---
title: 文章标题
description: 一句话摘要
pubDate: 2026-10-13
tags: ['随想']
---
```

**三个内容板块分别对应三个文件夹：**

| 板块 | 文件夹 | 网址 |
| --- | --- | --- |
| 博客（随笔、文章） | `src/content/posts/` | `/blog/文件名` |
| 知识库（整理过的笔记） | `src/content/notes/` | `/notes/文件名` |
| 作品（做过的东西） | `src/content/projects/` | `/projects/文件名` |

「关于我」页面在 `src/content/pages/about.md`。

> **草稿**：frontmatter 里写 `draft: true`，网站构建时就不会包含这篇。
> 本地预览时草稿仍然可见，方便边写边看。

---

## 二、本地预览（在自己电脑上看效果）

需要先装 [Node.js](https://nodejs.org)（22 或更新版本）。然后在这个文件夹里打开终端：

```bash
pnpm install     # 第一次才需要，装依赖
pnpm dev         # 启动预览
```

终端会显示一个地址，一般是 <http://localhost:4321>，用浏览器打开就能看到。

改文件保存后，浏览器会自动刷新。按 `Ctrl + C` 停止。

**检查构建是否正常**（发布前跑一下）：

```bash
pnpm build       # 生成 dist/ 文件夹
pnpm preview     # 预览构建结果
```

---

## 三、改站名、导航、联系方式

全部集中在 **`src/consts.ts`** 这一个文件里：

```ts
export const SITE = {
  title: '我的小站',        // 网站标题
  description: '记录思考、积累知识、展示作品。',  // 一句话简介
  author: '你的名字',       // 你的名字
  since: 2026,             // 页脚年份起点
};

export const NAV = [ ... ];      // 顶部导航
export const SOCIALS = [ ... ];  // 页脚的联系方式
```

---

## 四、换配色

打开 `src/styles/global.css`，最上面的 `:root` 里改主题色：

```css
:root {
  --accent: #2f5d50;        /* 主色，浅色模式 */
}
[data-theme='dark'] {
  --accent: #72c2a7;        /* 主色，深色模式 */
}
```

其他颜色变量（背景、正文、边框）也都在这一块，改完存盘即可。

---

## 五、部署上线（让别人能访问）

网站是纯静态的，任何静态托管都能放。推荐两种：

### 方案 A：Vercel 或 Cloudflare Pages（最省事，推荐）

1. 把项目传到 GitHub（一个仓库）
2. 注册 [Vercel](https://vercel.com) 或 [Cloudflare Pages](https://pages.cloudflare.com)，选「导入 Git 仓库」
3. 选中刚才的仓库，平台会自动识别是 Astro 项目
4. 点部署，几十秒后拿到一个公开网址

之后每次 `git push`，网站自动更新。

### 方案 B：GitHub Pages（全部在 GitHub 里完成，免费）

仓库里已经放好了 `.github/workflows/deploy.yml`。只需要：

1. 把项目推到 GitHub 的 `main` 分支
2. 仓库 → **Settings → Pages** → Source 选 **GitHub Actions**
3. 推一次代码，Actions 会自动构建并发布

**部署地址会自动处理，你不用改任何配置。**

- **Vercel / Cloudflare Pages / Netlify** → 部署在根目录，平台自动识别
- **GitHub Pages** → `.github/workflows/deploy.yml` 会自动判断：
  - 仓库名是 `<你的用户名>.github.io` → 部署在根目录
  - 其他仓库名 → 自动带上子路径 `/仓库名/`

  > 这一点很重要。GitHub Pages 的项目站点地址是 `用户名.github.io/仓库名/`，
  > 如果构建时不加子路径前缀，CSS、图片和导航会全部 404。工作流已经处理好了。

### 绑定自己的域名

**第一步，告诉站点你的域名。**

GitHub Pages：仓库 → **Settings → Secrets and variables → Actions → Variables → New repository variable**

| Name | Value |
| --- | --- |
| `SITE_URL` | `https://blog.你的域名.com` |

Vercel / Cloudflare Pages：在平台后台的环境变量里加同名的 `SITE_URL`。

加了之后，构建会自动切换到「根目录 + 你的域名」。这个值决定 RSS、站点地图和社交分享卡片里的地址，
不设置的话分享出去的链接会指向 `example.com`。

**第二步，配 DNS。**

在托管平台里添加域名，然后到域名商（阿里云、腾讯云、Cloudflare 等）添加记录：

| 类型 | 名称 | 值 |
| --- | --- | --- |
| CNAME | `blog`（或 `@` 表示根域名） | 托管平台给你的地址 |

GitHub Pages 还需要在仓库 → Settings → Pages → Custom domain 里填一次域名，
平台会自动签发 HTTPS 证书。等几分钟到几小时生效。

**第三步，本地想验证子路径效果**（可选）：

```bash
SITE_URL=https://用户名.github.io BASE_PATH=/仓库名 pnpm build
```

---

## 六、目录结构

```text
my-blog/
├── astro.config.mjs        ← 站点配置（部署地址自动注入，一般不用动）
├── .github/workflows/       ← GitHub Pages 自动部署
├── src/
│   ├── consts.ts           ← 站名、导航、联系方式
│   ├── content.config.ts   ← 内容字段定义
│   ├── content/
│   │   ├── posts/          ← 博客文章
│   │   ├── notes/          ← 知识库笔记
│   │   ├── projects/       ← 作品
│   │   └── pages/          ← 关于我等单页
│   ├── components/         ← 页面组件
│   ├── layouts/            ← 页面骨架
│   ├── pages/              ← 路由（一般不用动）
│   ├── styles/global.css   ← 全局样式、配色
│   └── utils/              ← 小工具函数
├── templates/              ← 写作模板（不会被发布）
├── public/                 ← 图片等静态文件
└── dist/                   ← 构建产物（自动生成）
```

> `src/utils/url.ts` 负责给站内链接加子路径前缀。文章里写链接时用普通的 `/blog/xxx` 就行，
> 页面组件会自动补全。但**直接写在 Markdown 正文里的站内链接**不会自动加前缀 ——
> 如果你打算部署在子目录（github.io/仓库名），正文里尽量用完整网址，或者干脆绑定自己的域名。

**放图片**：把图片丢进 `public/images/`，文章里这样引用：

```markdown
![图片说明](/images/照片.jpg)
```

---

## 七、已经做好的功能

- 博文 / 知识库 / 作品集 三种内容
- 知识库按分类分组
- 标签系统（自动生成标签页）
- 深色模式（跟随系统，可手动切换）
- 响应式布局，手机端可用
- RSS 订阅（`/rss.xml`）
- 站点地图（自动生成，利于搜索引擎收录）
- 社交分享卡片（Open Graph）
- 阅读时间估算
- 代码高亮（浅色 / 深色两套主题）
- 上下篇导航

## 还可以加

- 站内搜索（Pagefind）
- 评论（Giscus，基于 GitHub Discussions）
- 访问统计（Umami / Google Analytics）
- 图片自动压缩优化

---

## 八、遇到问题怎么办

### 报错 `ERR_PNPM_IGNORED_BUILDS`

```text
Ignored build scripts: esbuild@..., sharp@...
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

pnpm 10 之后默认不允许依赖包运行安装脚本，而 `esbuild` 和 `sharp` 必须运行，
否则 `pnpm build` 会直接失败。

根目录的 `pnpm-workspace.yaml` 已经处理好了，**正常情况下你不会遇到这个错误**。
如果换了环境又碰到，确认这个文件里有这两段：

```yaml
onlyBuiltDependencies:   # pnpm 10 读这个
  - esbuild
  - sharp

allowBuilds:             # pnpm 11+ 读这个
  esbuild: true
  sharp: true
```

### 构建出来的页面没有样式 / 链接 404

说明部署路径不对。GitHub Pages 的项目站点地址是 `用户名.github.io/仓库名/`，
需要带上子路径。工作流会自动处理；如果你是手动构建，用：

```bash
SITE_URL=https://用户名.github.io BASE_PATH=/仓库名 pnpm build
```

### 分享出去的链接指向 example.com

没有设置 `SITE_URL`。参考第五节的「绑定自己的域名」，
在托管平台里加一个 `SITE_URL` 环境变量或仓库变量。

### 本地命令报 `Cannot find module @rollup/rollup-darwin-arm64`

Node 版本和 `rollup` 原生模块不匹配。删掉 `node_modules` 重装：

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

## 九、给 AI 助手的说明

如果你把这个项目交给 AI 助手继续开发，告诉它：

- 内容全部在 `src/content/` 下，用 Markdown + frontmatter
- 所有站内链接必须经过 `src/utils/url.ts` 的 `withBase()`，否则子路径部署会 404
- 部署地址通过环境变量 `SITE_URL` / `BASE_PATH` 注入，不要写死
- 改完必须跑 `pnpm build`，并确认 GitHub Pages 子路径场景（`BASE_PATH=/仓库名`）下链接正确
