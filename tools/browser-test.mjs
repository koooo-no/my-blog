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

  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
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

  const evaluate = async (expression) => {
    const r = await client.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    }
    return r.result.value;
  };

  const navigate = async (path) => {
    consoleErrors = [];
    const loaded = client.once('Page.loadEventFired');
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

  // ---------- 9. 404 页 ----------
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
