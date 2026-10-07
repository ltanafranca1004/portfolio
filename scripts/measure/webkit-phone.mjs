// iPhone emulation in Playwright's WebKit, through the same journey, with taps.
//   node scripts/measure/webkit-phone.mjs --build=dist --label=after [--playwright=/path/to/an/older/playwright-core]
// This is WebKit on a Mac drawing a phone-sized page, not Mobile Safari on a phone: it shows
// layout, script and main-thread behaviour, not what the phone's graphics chip does. An older
// playwright-core (installed outside the repo) brings the WebKit build of an older Safari.
// Passes: loads, numbers, frames, video (Playwright's recording, 25 frames a second).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { STEPS, summarise } from './journey.mjs';
import { serve } from './serve.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const label = args.label ?? 'run';
const out = args.out ?? path.join('redesign', 'recordings');
const passes = (args.passes ?? 'loads,numbers,frames,video').split(',');
const PORT = Number(args.port ?? 4430);
const PAUSE = Number(args.pause ?? 1500);
mkdirSync(out, { recursive: true });

if (!args.playwright) process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';
const playwright = args.playwright ? (await import(pathToFileURL(path.join(args.playwright, 'index.js')).href)).default : await import('playwright');
const iphone = playwright.devices['iPhone 14'];
// --desktop: the same engine at a laptop's window size instead (a stand-in for desktop Safari
// when the real one cannot be driven)
const DESKTOP = Boolean(args.desktop);
const PHONE = DESKTOP
  ? { viewport: { width: 1470, height: 751 }, deviceScaleFactor: 2 }
  : { viewport: { width: 390, height: 664 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: iphone.userAgent };

async function open(probe, extra = {}) {
  const server = await serve({ root: path.resolve(args.build ?? 'dist'), port: PORT, latency: Number(args.latency ?? 0), kbps: Number(args.kbps ?? 0), probe });
  const browser = await playwright.webkit.launch();
  const context = await browser.newContext({ ...PHONE, ...extra });
  const page = await context.newPage();
  return { server, base: server.url, browser, context, page, close: async () => (await context.close(), await browser.close(), await server.close()) };
}

async function walk(page, base, each = () => {}) {
  const began = Date.now();
  for (const step of STEPS) {
    const from = Date.now() - began;
    if (step.back) await page.goBack({ waitUntil: 'commit' });
    else if (step.click) {
      const target = page.locator(step.click).locator('visible=true').first();
      await target.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      if (DESKTOP) await target.click({ noWaitAfter: true });
      else await target.tap({ noWaitAfter: true });
    } else await page.goto(base + step.to, { waitUntil: 'commit' });
    await page.waitForURL((url) => url.pathname === step.to, { waitUntil: 'commit' });
    await page.waitForTimeout(step.click || step.back ? PAUSE : 3200);
    each(step, from, Date.now() - began);
  }
}

const readProbe = (page) =>
  page.evaluate(() => {
    const log = JSON.parse(sessionStorage.getItem('probe-log') || '[]');
    const cur = window.__probe?.();
    return cur ? [...log.filter((n) => n.id !== cur.id), cur] : log;
  });

const result = { label, browser: null, window: PHONE.viewport, passes: {} };

if (passes.includes('loads')) {
  const s = await open('full');
  result.browser = `WebKit ${s.browser.version()}`;
  result.passes.loads = {};
  for (const url of ['/', '/projects/unify/', '/profile/']) {
    const rows = [];
    for (let i = 0; i < Number(args.loads ?? 5); i++) {
      const context = await s.browser.newContext(PHONE);
      const page = await context.newPage();
      await page.goto(s.base + url, { waitUntil: 'load' });
      await page.waitForTimeout(2500);
      rows.push(summarise((await readProbe(page))[0]));
      await context.close();
    }
    result.passes.loads[url] = rows;
  }
  await s.close();
}

for (const pass of ['numbers', 'frames']) {
  if (!passes.includes(pass)) continue;
  const s = await open(pass === 'numbers' ? 'full' : 'light');
  result.browser = `WebKit ${s.browser.version()}`;
  await walk(s.page, s.base);
  const navs = await readProbe(s.page);
  result.passes[pass] =
    pass === 'numbers'
      ? navs.map(summarise).map((row, i) => ({ step: STEPS[i]?.name ?? '?', ...row }))
      : navs.map((nav, i) => {
          const row = summarise(nav);
          return { step: STEPS[i]?.name ?? '?', url: row.url, restored: row.restored, clickToFirstFrame: row.clickToFirstFrame, transition: row.transition, mainThread: row.transitionFrames, mainThreadGaps: row.transitionGaps, mainThreadAfter: row.afterFrames, presented: null };
        });
  await s.close();
}

if (passes.includes('video')) {
  const dir = path.join(out, `.${label}-iphone-video`);
  rmSync(dir, { recursive: true, force: true });
  const s = await open(false, { recordVideo: { dir, size: PHONE.viewport } });
  const began = Date.now();
  const windows = [];
  await walk(s.page, s.base, (step, from, to) => windows.push({ step: step.name, from, to }));
  await s.close();
  const webm = readdirSync(dir).find((f) => f.endsWith('.webm'));
  const video = path.join(out, `${label}-${DESKTOP ? 'webkit-desktop' : 'iphone'}.mov`);
  if (webm) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dir, webm), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', video]);
  result.passes.video = { file: video, windows, began };
}

const suffix = args.suffix ?? 'iphone';
writeFileSync(path.join(out, `${label}-${suffix}.json`), JSON.stringify(result, null, 2));
console.log(`wrote ${path.join(out, `${label}-${suffix}.json`)}`);
