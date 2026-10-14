#!/usr/bin/env node
/**
 * 浏览器端测试
 *
 * 静态审计（tools/audit-site.py）只能查 HTML 结构。
 * 这个脚本用 Chrome DevTools Protocol 在真实浏览器里跑，检查：
 *
 *   1. 页面加载是否有 JS 报错
 *   2. CSS 是否真的生效（不是只有裸 HTML）
 *   3. 深色模式切换按钮是否工作、偏好是否被记住
 *   4. 系统偏好为深色时，首次访问是否自动深色
 *   5. 图片是否都加载成功
 *   6. 手机 / 桌面视口下有没有横向溢出
 *   7. 导航高亮是否正确
 *
 * 用法：
 *   node tools/browser-test.mjs --url http://127.0.0.1:4321
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------------- 参数 ----------------
const argv = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const BASE = getArg('url', 'http://127.0.0.1:4321').replace(/\/+$/, '');
const CHROME = getArg(
  'chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
);
const PORT = Number(getArg('port', '9333'));
const DEBUG = argv.includes('--verbose');

// ---------------- CDP 客户端 ----------------
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.handlers.get(msg.method) ?? []) fn(msg.params);
      }
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error('WebSocket 连接失败')), { once: true });
    });
    return new CDP(ws);
  }

  /**
   * 发送 CDP 命令。
   *
   * 必须带超时：页面导航会销毁执行上下文，此时挂起的 Runtime.evaluate
   * 可能永远收不到回应，整个脚本就会卡死。
   */
  send(method, params = {}, timeout = 30000) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} 超时（${timeout}ms）`));
      }, timeout);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }

  once(method, timeout = 20000) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`等待 ${method} 超时`)), timeout);
      const fn = (p) => {
        clearTimeout(t);
        this.handlers.set(method, (this.handlers.get(method) ?? []).filter((f) => f !== fn));
        resolve(p);
      };
      this.on(method, fn);
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

// ---------------- 启动 Chrome ----------------
const profile = mkdtempSync(join(tmpdir(), 'dsh-browser-test-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-crashpad',
    '--disable-breakpad',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: DEBUG ? 'inherit' : 'ignore' }
);

let client;
const cleanup = () => {
  client?.close();
  chrome.kill('SIGKILL');
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
};
process.on('exit', cleanup);

async function waitForDevTools() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await r.json();
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Chrome DevTools 端口没有就绪');
}

// ---------------- 测试框架 ----------------
const results = [];
let consoleErrors = [];

function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  const mark = passed ? '\x1b[32m通过\x1b[0m' : '\x1b[31m失败\x1b[0m';
  console.log(`  [${mark}] ${name}${detail ? `  →  ${detail}` : ''}`);
}

async function main() {
  const wsUrl = await waitForDevTools();
  client = await CDP.connect(wsUrl);

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Log.enable');

  client.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error') {
      consoleErrors.push(p.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
  });
  client.on('Runtime.exceptionThrown', (p) => {
    consoleErrors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? '异常');
  });
  client.on('Log.entryAdded', (p) => {
    if (p.entry.level === 'error') consoleErrors.push(p.entry.text);
  });

  const evaluate = async (expression, timeout = 15000) => {
    const r = await client.send(
      'Runtime.evaluate',
      {
        expression,
        returnByValue: true,
        awaitPromise: true,
      },
      timeout
    );
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    }
    return r.result.value;
  };

  const navigate = async (path) => {
    consoleErrors = [];
    // 万一 load 事件没等到，也不要让整个测试挂掉
    const loaded = client.once('Page.loadEventFired', 15000).catch(() => null);
    await client.send('Page.navigate', { url: BASE + path });
    await loaded;
    await new Promise((r) => setTimeout(r, 350));
  };

  console.log('='.repeat(64));
  console.log(`浏览器端测试: ${BASE}`);
  console.log('='.repeat(64));

  // ---------- 1. 首页加载 ----------
  console.log('\n【首页】');
  await navigate('/');
  const title = await evaluate('document.title');
  check('页面能打开且有标题', Boolean(title), title);

  check(
    '没有 JavaScript 报错',
    consoleErrors.length === 0,
    consoleErrors.slice(0, 2).join(' | ')
  );

  // ---------- 2. CSS 生效 ----------
  const styles = await evaluate(`(() => {
    const btn = document.querySelector('.btn-primary');
    const cs = getComputedStyle(document.documentElement);
    return {
      accent: cs.getPropertyValue('--accent').trim(),
      btnRadius: btn ? getComputedStyle(btn).borderRadius : null,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      fontFamily: getComputedStyle(document.body).fontFamily.slice(0, 40),
    };
  })()`);
  check('CSS 变量已生效', styles.accent === '#2f5d50', `--accent = ${styles.accent}`);
  check('组件样式已应用', styles.btnRadius === '999px', `.btn-primary 圆角 = ${styles.btnRadius}`);
  check('正文字体已应用', /-apple-system|PingFang/.test(styles.fontFamily), styles.fontFamily);

  // ---------- 3. 图片 ----------
  const brokenImgs = await evaluate(
    `[...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src)`
  );
  check('图片全部加载成功', brokenImgs.length === 0, brokenImgs.slice(0, 3).join(', '));

  // ---------- 4. 深色模式切换 ----------
  console.log('\n【深色模式】');
  await evaluate(`localStorage.setItem('theme','light')`);
  await navigate('/');
  const before = await evaluate(`document.documentElement.getAttribute('data-theme')`);
  check('初始为浅色', before === 'light', `data-theme = ${before}`);

  await evaluate(`document.getElementById('theme-toggle').click()`);
  await new Promise((r) => setTimeout(r, 200));
  const after = await evaluate(`document.documentElement.getAttribute('data-theme')`);
  const stored = await evaluate(`localStorage.getItem('theme')`);
  check('点击按钮切到深色', after === 'dark', `data-theme = ${after}`);
  check('偏好写入 localStorage', stored === 'dark', `localStorage.theme = ${stored}`);

  const darkBg = await evaluate(`getComputedStyle(document.body).backgroundColor`);
  check('深色背景生效', darkBg === 'rgb(14, 15, 18)', darkBg);

  await navigate('/');
  const persisted = await evaluate(`document.documentElement.getAttribute('data-theme')`);
  check('刷新后保持深色', persisted === 'dark', `data-theme = ${persisted}`);

  // ---------- 5. 跟随系统偏好 ----------
  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'dark' }],
  });
  await evaluate(`localStorage.removeItem('theme')`);
  await navigate('/');
  const sysDark = await evaluate(`document.documentElement.getAttribute('data-theme')`);
  check('系统深色时自动深色', sysDark === 'dark', `data-theme = ${sysDark}`);

  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'light' }],
  });
  await evaluate(`localStorage.removeItem('theme')`);
  await navigate('/');
  const sysLight = await evaluate(`document.documentElement.getAttribute('data-theme')`);
  check('系统浅色时自动浅色', sysLight === 'light', `data-theme = ${sysLight}`);

  // ---------- 6. 导航高亮 ----------
  console.log('\n【导航】');
  await navigate('/blog/');
  const active = await evaluate(
    `[...document.querySelectorAll('.nav-link.active')].map(a => a.textContent.trim()).join(',')`
  );
  check('博客页高亮"博客"', active === '博客', `高亮项 = ${active}`);

  await navigate('/notes/');
  const active2 = await evaluate(
    `[...document.querySelectorAll('.nav-link.active')].map(a => a.textContent.trim()).join(',')`
  );
  check('知识库页高亮"知识库"', active2 === '知识库', `高亮项 = ${active2}`);

  // ---------- 7. 响应式 ----------
  console.log('\n【响应式布局】');
  const viewports = [
    { label: '手机 390×844', width: 390, height: 844, mobile: true },
    { label: '平板 820×1180', width: 820, height: 1180, mobile: true },
    { label: '桌面 1440×900', width: 1440, height: 900, mobile: false },
  ];

  for (const vp of viewports) {
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.mobile,
    });
    await navigate('/');
    const overflow = await evaluate(
      `({ scroll: document.documentElement.scrollWidth, view: window.innerWidth })`
    );
    check(
      `${vp.label} 无横向溢出`,
      overflow.scroll <= overflow.view + 1,
      `scrollWidth=${overflow.scroll} innerWidth=${overflow.view}`
    );
  }

  await client.send('Emulation.clearDeviceMetricsOverride');

  // ---------- 8. 文章页内容 ----------
  console.log('\n【文章页】');
  await navigate('/blog/why-i-write/');
  const article = await evaluate(`(() => {
    const prose = document.querySelector('.prose');
    return {
      h1: document.querySelectorAll('h1').length,
      paragraphs: prose ? prose.querySelectorAll('p').length : 0,
      hasTable: prose ? !!prose.querySelector('table') : false,
      navNext: !!document.querySelector('.post-nav-item'),
      canonical: document.querySelector('link[rel=canonical]')?.href ?? '',
    };
  })()`);
  check('正文渲染出来', article.paragraphs >= 4, `${article.paragraphs} 个段落`);
  check('每页只有一个 h1', article.h1 === 1, `${article.h1} 个`);
  check('表格渲染正常', article.hasTable);
  check('上下篇导航存在', article.navNext);

  // canonical 的路径部分必须和当前部署路径一致（子路径部署时要带前缀）
  const basePath = new URL(BASE).pathname.replace(/\/+$/, '');
  const expectedPath = `${basePath}/blog/why-i-write/`;
  let canonicalPath = '';
  let canonicalHost = '';
  try {
    const u = new URL(article.canonical);
    canonicalPath = u.pathname;
    canonicalHost = u.hostname;
  } catch {}
  check(
    'canonical 路径正确',
    canonicalPath === expectedPath,
    `${article.canonical}（期望路径 ${expectedPath}）`
  );
  check(
    'canonical 域名正常（没被路径段顶替）',
    canonicalHost.includes('.'),
    `hostname = ${canonicalHost}`
  );

  // ---------- 9. 站内搜索 ----------
  console.log('\n【站内搜索】');

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** 在搜索页输入关键词，等结果出现 */
  const searchFor = async (q) => {
    await evaluate(`(() => {
      // 先清空上一轮结果。否则轮询可能在旧结果还没被替换时就返回，
      // 把上一次查询的结果当成这一次的 —— 这正是修好之前误报的原因。
      const res = document.getElementById('search-results');
      const st = document.getElementById('search-status');
      if (res) res.innerHTML = '';
      if (st) st.textContent = '';
      const i = document.getElementById('search-input');
      i.value = ${JSON.stringify(q)};
      i.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    for (let i = 0; i < 50; i++) {
      const state = await evaluate(`(() => ({
        count: document.querySelectorAll('.sr-item').length,
        empty: document.querySelector('.sr-empty')?.textContent ?? '',
        status: document.getElementById('search-status')?.textContent ?? '',
        titles: [...document.querySelectorAll('.sr-title')].map(e => e.textContent.trim()),
        hrefs: [...document.querySelectorAll('.sr-item')].map(a => a.getAttribute('href')),
        marks: document.querySelectorAll('.sr-item mark').length,
      }))()`);
      // 有结果，或者出现了"没找到"的空状态
      if (state.count > 0 || state.empty.includes('没有找到')) return state;
      await sleep(100);
    }
    return { count: 0, empty: '', status: '', titles: [], hrefs: [], marks: 0 };
  };

  await navigate('/search/');
  check('搜索页能打开', (await evaluate('document.title')).includes('搜索'));
  check('搜索页无 JS 报错', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
  check(
    '输入框自动聚焦',
    await evaluate(`document.activeElement?.id === 'search-input'`),
    await evaluate(`document.activeElement?.id ?? '（无）'`)
  );

  const r1 = await searchFor('Git');
  check('搜到结果', r1.count > 0, `"Git" → ${r1.count} 条`);
  check('最相关的结果排第一', r1.titles[0]?.includes('Git'), r1.titles.slice(0, 3).join(' / '));
  check('关键词被高亮', r1.marks > 0, `${r1.marks} 处 <mark>`);

  const r2 = await searchFor('速查');
  check('能按标签/标题搜索', r2.count >= 2, `"速查" → ${r2.count} 条`);

  const r3 = await searchFor('Git 速查');
  check('多关键词同时命中', r3.count > 0, `"Git 速查" → ${r3.count} 条`);

  const r4 = await searchFor('python 自动化');
  check('跨字段多词搜索', r4.count > 0, `"python 自动化" → ${r4.count} 条`);

  const r5 = await searchFor('zzz不存在的关键词zzz');
  check('无结果时给出提示', r5.count === 0 && r5.empty.includes('没有找到'), `"${r5.empty.slice(0, 20)}…"`);

  const r6 = await searchFor('--oneline');
  check(
    '代码块内容也能搜到',
    r6.count > 0,
    `"--oneline" → ${r6.count} 条（该字符串只出现在代码块里）`
  );

  // 结果链接必须带正确的部署前缀
  const r7 = await searchFor('博客');
  const badHref = r7.hrefs.find((h) => !h || !h.startsWith(basePath + '/'));
  check('结果链接路径正确', r7.count > 0 && !badHref, badHref ?? r7.hrefs[0]);

  // 结果链接真实可访问
  if (r7.hrefs[0]) {
    const target = r7.hrefs[0];
    const loaded = client.once('Page.loadEventFired');
    await client.send('Page.navigate', { url: new URL(target, BASE).href });
    await loaded;
    await sleep(250);
    const ok = await evaluate(`!document.body.textContent.includes('这里什么都没有')`);
    check('点击搜索结果能打开文章', ok, target);
  }

  // ?q= 深链
  await navigate('/search/?q=Markdown');
  await sleep(700);
  const deep = await evaluate(`document.querySelectorAll('.sr-item').length`);
  check('?q= 深链直接出结果', deep > 0, `/search/?q=Markdown → ${deep} 条`);

  // 全局 / 快捷键（会触发整页跳转，所以要先监听 load 再按键）
  await navigate('/');
  const jumped = client.once('Page.loadEventFired', 10000).catch(() => null);
  await evaluate(
    `document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))`
  );
  await jumped;
  await sleep(300);
  let path = '';
  try {
    path = await evaluate(`location.pathname`, 8000);
  } catch {
    path = '（导航后取不到，按跳转处理）';
  }
  check('按 / 跳到搜索页', path === '' || path.includes('/search'), path);

  // ---------- 10. 量化看板 ----------
  console.log('\n【量化看板】');

  await navigate('/quant/');
  check('看板页能打开', (await evaluate('document.title')).includes('量化'));
  check('看板无 JS 报错', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));

  const qIndex = await evaluate(`(() => {
    const rows = [...document.querySelectorAll('table tbody tr')];
    const polys = [...document.querySelectorAll('polyline')];
    return {
      rows: rows.length,
      strategies: rows.filter(r => !r.className.includes('bench-row')).length,
      polylines: polys.length,
      // 每条折线都得有真实的坐标点，不是空字符串
      pointsOk: polys.every(p => (p.getAttribute('points') || '').split(' ').filter(Boolean).length > 100),
      disclaimer: !!document.querySelector('.disclaimer'),
    };
  })()`);
  check('对比表包含策略和基准', qIndex.strategies === 2, `${qIndex.strategies} 个策略 + 基准`);
  check('净值曲线已渲染', qIndex.polylines >= 4 && qIndex.pointsOk, `${qIndex.polylines} 条折线`);
  check('有免责声明', qIndex.disclaimer);

  await navigate('/quant/momentum-rotation/');
  check('详情页无 JS 报错', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));

  const qDetail = await evaluate(`(() => {
    const svgs = [...document.querySelectorAll('svg')];
    const heat = document.querySelectorAll('rect').length;
    const metrics = document.querySelectorAll('.metric').length;
    const trades = document.querySelectorAll('table tbody tr').length;
    const circles = document.querySelectorAll('circle').length;
    return { charts: svgs.length, heat, metrics, trades, circles };
  })()`);
  check('三个图表都在（曲线/回撤/热力图）', qDetail.charts >= 6, `${qDetail.charts} 个 svg`);
  check('指标卡数量正确', qDetail.metrics >= 11, `${qDetail.metrics} 个指标`);
  check('月度热力图渲染', qDetail.heat >= 36, `${qDetail.heat} 个格子（3 年 × 12 月）`);
  check('交易记录表有数据', qDetail.trades > 0, `${qDetail.trades} 行`);

  // 图表在手机上不能溢出
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await navigate('/quant/momentum-rotation/');
  const qOverflow = await evaluate(
    `({ scroll: document.documentElement.scrollWidth, view: window.innerWidth })`
  );
  check(
    '手机上看板无横向溢出',
    qOverflow.scroll <= qOverflow.view + 1,
    `scrollWidth=${qOverflow.scroll} innerWidth=${qOverflow.view}`
  );
  await client.send('Emulation.clearDeviceMetricsOverride');

  // 导航高亮
  await navigate('/quant/');
  const qActive = await evaluate(
    `[...document.querySelectorAll('.nav-link.active')].map(a => a.textContent.trim()).join(',')`
  );
  check('导航高亮"量化"', qActive === '量化', `高亮项 = ${qActive}`);

  // ---------- 11. 404 页 ----------
  console.log('\n【404】');
  await navigate('/404.html');
  const nf = await evaluate(`document.body.textContent.includes('404')`);
  check('404 页面正常显示', nf);

  // ---------- 汇总 ----------
  const failed = results.filter((r) => !r.passed);
  console.log('\n' + '='.repeat(64));
  console.log(`共 ${results.length} 项检查，通过 ${results.length - failed.length}，失败 ${failed.length}`);
  if (failed.length) {
    console.log('\n失败项：');
    for (const f of failed) console.log(`  - ${f.name}  ${f.detail}`);
  } else {
    console.log('全部通过 ✅');
  }
  return failed.length === 0 ? 0 : 1;
}

try {
  const code = await main();
  cleanup();
  process.exit(code);
} catch (err) {
  console.error('测试运行失败:', err.message);
  cleanup();
  process.exit(2);
}
