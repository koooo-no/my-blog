# 我的小站

一个静态博客 / 知识库 / 作品集网站，用 [Astro](https://astro.build) 搭建。

写完 Markdown 文件，网站自动重新生成 —— 不需要数据库，不需要服务器维护。

---

> ### 🚀 想让别人能访问？
>
> 看 **[部署指南.md](部署指南.md)** —— 从注册账号到网站上线，一步步照着做，
> 大约 20 分钟，全程免费。
>
> 这份 README 是完整的项目说明；只想知道怎么发文章和上线，看部署指南就够了。

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
├── .github/workflows/      ← GitHub Pages 自动部署
├── src/
│   ├── consts.ts           ← 站名、导航、联系方式
│   ├── content.config.ts   ← 内容字段定义
│   ├── content/
│   │   ├── posts/          ← 博客文章
│   │   ├── notes/          ← 知识库笔记
│   │   ├── projects/       ← 作品
│   │   └── pages/          ← 关于我等单页
│   ├── data/
│   │   └── quant.json      ← ★ 量化看板数据（换数据只改这个）
│   ├── components/
│   │   └── charts/         ← 手写 SVG 图表组件
│   ├── layouts/            ← 页面骨架
│   ├── pages/              ← 路由（一般不用动）
│   ├── styles/global.css   ← 全局样式、配色
│   └── utils/              ← 小工具函数
├── templates/              ← 写作模板（不会被发布）
├── tools/                  ← 自检工具和数据生成脚本
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
- **站内搜索**（见下一节）
- 深色模式（跟随系统，可手动切换）
- 响应式布局，手机端可用
- RSS 订阅（`/rss.xml`）
- 站点地图（自动生成，利于搜索引擎收录）
- 社交分享卡片（Open Graph）
- 阅读时间估算
- 代码高亮（浅色 / 深色两套主题）
- 上下篇导航

### 站内搜索怎么用

页头有个放大镜按钮，点它进入搜索页；在**任何页面**按 `/` 键也能直接过去。

搜索规则：

- 同时搜标题、摘要、标签和**正文**（正文里的代码块内容也包含在内）
- 空格分隔多个关键词，**全部命中才显示**（AND 语义）
- 支持中文，不用分词
- 结果按相关度排序，命中的词会高亮
- 网址带 `?q=关键词`，可以直接分享搜索链接

搜索索引在**构建时自动生成**（`/search-index.json`），不需要额外服务，也不需要额外依赖。

每篇正文最多收录前 1500 字，控制索引体积。个人博客规模（几百篇以内）完全够用；
如果哪天内容特别多，再考虑换成 Pagefind 之类的专用方案。

想调整正文收录长度，改 `src/pages/search-index.json.js` 里的 `TEXT_LIMIT`。
想调整相关度权重，改 `src/pages/search.astro` 里的 `score()` 函数。

## 还可以加

- 评论（Giscus，基于 GitHub Discussions）
- 访问统计（Umami / Google Analytics）
- 图片自动压缩优化

---

## 八、发布前自检

项目里带了两个检查工具。改完内容、上线之前跑一下，能提前发现问题。

### 1. 结构审计（查断链、标题、图片）

```bash
pnpm verify          # = 构建 + 审计
```

会检查：站内断链、`#锚点` 是否存在、每页是否只有一个 `h1`、
图片有没有 `alt`、`title` / `description` / `canonical` 是否齐全、有没有重复 id。

单独跑审计（不重新构建）：

```bash
pnpm audit
```

### 2. 浏览器端测试（查交互和样式）

先启动预览，然后在另一个终端跑：

```bash
pnpm dev             # 终端 1
pnpm test:browser    # 终端 2
```

用真实的 Chrome 跑，检查：有没有 JS 报错、CSS 是否生效、
深色模式切换和记忆是否正常、图片是否都加载出来、
手机 / 平板 / 桌面三种宽度下有没有横向溢出、导航高亮是否正确、
canonical 地址是否正确（含子路径部署的情况）。

默认测试 `http://127.0.0.1:4321`，想测别的地址：

```bash
node tools/browser-test.mjs --url http://127.0.0.1:4322/my-blog
```

> 这两个工具都用来自检，不是网站运行必需的。以后觉得用不上，直接删掉 `tools/` 目录即可。

---

## 九、量化看板

`/quant` 是一个数据驱动的看板，用来展示回测结果。**它同样没有后端** ——
所有图表在构建时算好并渲染成静态 SVG，页面上没有一个字节的图表库。

### 有什么

- **对比表**：多个策略放在一起比年化、超额、回撤、夏普
- **净值曲线**：策略 vs 基准，纵轴是相对起点的累计收益
- **回撤图**：从历史高点回落的幅度，自动标出最大回撤的位置
- **月度收益热力图**：行是年份，列是 1–12 月，颜色深浅表示收益高低
- **指标卡**：年化、超额、最大回撤、夏普、卡玛、波动率、胜率、盈亏比、交易笔数、最长回撤天数、累计收益
- **交易记录表**
- 每页顶部有**免责声明**（见下方「重要提醒」）

### 怎么换成你自己的数据

**只需要改一个文件：`src/data/quant.json`**，页面代码完全不用动。

```jsonc
{
  "updated": "2026-10-09",          // 数据更新日期
  "benchmarkName": "沪深300",
  "currency": "CNY",
  "strategies": [
    {
      "id": "momentum-rotation",     // 决定网址：/quant/momentum-rotation/
      "name": "动量轮动",
      "subtitle": "行业 ETF 动量 + 波动率过滤",
      "description": "策略说明……",
      "status": "研究中",
      "frequency": "日频",
      "universe": "行业 ETF（18 只）",
      "tags": ["动量", "轮动"],

      // 下面三个数组长度必须一致，一一对应
      "dates":      ["2024-01-02", "..."],
      "equity":     [1.0, 1.008, "..."],   // 策略净值，起点 1.0
      "benchmark":  [1.0, 1.002, "..."],   // 基准净值，起点 1.0

      "metrics": {
        "totalReturn": 0.532,            // 小数，0.532 = 53.2%
        "annualReturn": 0.160,
        "benchmarkTotalReturn": 0.138,
        "benchmarkAnnualReturn": 0.046,
        "excessAnnualReturn": 0.113,
        "volatility": 0.174,
        "maxDrawdown": -0.153,           // 负数
        "maxDrawdownDays": 195,
        "sharpe": 0.804,
        "calmar": 1.044,
        "winRate": 0.52,
        "profitFactor": 1.163,
        "tradeCount": 412,
        "turnover": 3.4
      },

      "monthly": [ { "y": 2024, "m": 1, "r": 0.023 } ],
      "trades":  [ { "date": "2024-03-05", "symbol": "600519", "name": "贵州茅台",
                     "side": "买入", "price": 1680.5, "qty": 100, "pnl": null } ]
    }
  ]
}
```

**你的量化脚本要做的事情**：跑完回测 → 按这个结构写出 `src/data/quant.json` → 提交。

仓库里有一个示例生成脚本 `tools/make-quant-demo.py`，可以看它是怎么算这些指标的
（年化、夏普、卡玛、最大回撤、最长回撤天数……），改成读你自己的回测输出即可。

### 想调整显示

- **显示哪些指标**：改 `src/utils/quant.ts` 里的 `METRIC_VIEW`
- **颜色、布局**：改 `src/pages/quant/index.astro` 和 `[id].astro` 的 `<style>`
- **要不要在导航里**：改 `src/consts.ts` 的 `NAV`

### 图表的实现

三个图表组件都是手写的 SVG，在 `src/components/charts/` 下：

| 组件 | 作用 |
| --- | --- |
| `EquityChart.astro` | 净值曲线（多条线 + 基准虚线） |
| `DrawdownChart.astro` | 回撤面积图 |
| `MonthlyHeatmap.astro` | 月度收益热力图 |

不引入 ECharts / Chart.js 的原因：这个项目目前**一个 JS 文件都不产出**，
所有脚本都内联在 HTML 里。为了保证加载速度和零维护成本，图表就自己画了。

坐标轴刻度用的是"整齐数字"算法（`src/utils/format.ts` 的 `niceTicks`），
会向下/向上取整把范围撑到能覆盖全部数据 —— 这一步不做的话曲线会画出界。

> 审计工具里有一条专门检查这个：`pnpm audit` 会校验所有 `<polyline>` 和 `<circle>`
> 的坐标是否在 SVG 画布内。这个检查真实抓到过一次曲线出界的 bug。

### ⚠️ 重要提醒

**如果这个看板要公开，请先把这几件事想清楚：**

1. **免责声明不要删。** 两处都写了，保留它。
   公开提供投资建议、展示收益招揽客户，在国内可能涉及证券投资咨询牌照，
   具体请自行确认。本站的声明是"个人研究记录、不构成投资建议"。
2. **API 密钥绝对不能进这个仓库。** 静态站的前端代码人人可见，
   `git push` 到公开仓库就等于公开密钥。密钥只放本地环境变量或 GitHub Secrets。
3. **策略泄露。** 公开仓库 = 公开策略，alpha 会衰减。
   如果只想自己或特定的人看，参考 [部署指南.md](部署指南.md) 里的「只给特定的人看」。
4. **数据版权。** Wind / 聚宽 / Tushare 等数据源的授权条款通常禁止公开再分发，
   把行情明细挂到公开网站上可能违反协议。指标和曲线一般没问题。

---

## 十、遇到问题怎么办

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

## 十一、给 AI 助手的说明

如果你把这个项目交给 AI 助手继续开发，告诉它：

- 内容全部在 `src/content/` 下，用 Markdown + frontmatter
- 所有站内链接必须经过 `src/utils/url.ts` 的 `withBase()`，否则子路径部署会 404
- 部署地址通过环境变量 `SITE_URL` / `BASE_PATH` 注入，不要写死
- 改完必须跑 `pnpm build`，并确认 GitHub Pages 子路径场景（`BASE_PATH=/仓库名`）下链接正确
