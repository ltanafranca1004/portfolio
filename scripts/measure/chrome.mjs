// Drives the installed Google Chrome (not Playwright's Chromium) through the journey.
//   node scripts/measure/chrome.mjs --build=dist --label=after [--latency=40 --kbps=20000]
//   node scripts/measure/chrome.mjs --url=https://redesign.luistanafranca.pages.dev --label=live
// Three passes, each in a fresh profile:
//   numbers  the probe in full: first paint, images, and everything that changes after it
//   frames   the probe's frame clock only, plus a Chrome trace: when each frame was presented
//   screen   the real screen, recorded at 60 frames a second (record.mjs), written
//            as <out>/<label>-chrome.mov (needs Screen Recording permission)
//   video    every frame Chrome paints (its screencast), as <out>/<label>-chrome-screencast.mov:
//            for when the screen cannot be recorded
// Results go to <out>/<label>-chrome.json. --passes=numbers,frames,video picks passes.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { playwright } from '../browsers.mjs';
import { STEPS, frameStats, summarise } from './journey.mjs';
import { record } from './record.mjs';
import { serve } from './serve.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const label = args.label ?? 'run';
const out = args.out ?? path.join('redesign', 'recordings');
const passes = (args.passes ?? 'loads,numbers,frames,screen').split(',');
const PORT = Number(args.port ?? 4410);
const PAUSE = Number(args.pause ?? 1500);
const HOVER = Number(args.hover ?? 350);
const WINDOW = (args.window ?? '1512,900').split(',').map(Number);
mkdirSync(out, { recursive: true });

async function open(probe) {
  const server = args.url ? null : await serve({ root: path.resolve(args.build ?? 'dist'), port: PORT, latency: Number(args.latency ?? 0), kbps: Number(args.kbps ?? 0), probe });
  const base = args.url ?? server.url;
  const browser = await playwright.chromium.launch({ channel: 'chrome', headless: false, args: [`--window-size=${WINDOW[0]},${WINDOW[1]}`, '--window-position=0,0'] });
  const context = await browser.newContext({ viewport: null });
  // a site that is not served from here gets the probe from the browser instead
  if (args.url && probe) await context.addInitScript({ content: `window.__probeMode=${JSON.stringify(probe)};${readFileSync(new URL('./probe.js', import.meta.url), 'utf8')}` });
  const page = await context.newPage();
  // let Chrome finish starting (GPU process, first window) before anything is timed
  await page.goto('about:blank');
  await page.bringToFront();
  await page.waitForTimeout(1500);
  return { server, base, browser, context, page, close: async () => (await browser.close(), await server?.close()) };
}

/** Walk the journey. `each` is told when a step starts and ends (ms since the walk began). */
async function walk(page, base, each = () => {}) {
  const began = Date.now();
  for (const step of STEPS) {
    const from = Date.now() - began;
    if (step.back) await page.goBack({ waitUntil: 'commit' });
    else if (step.click) {
      // a person's pointer rests on a link for a moment before the click
      const target = page.locator(step.click).locator('visible=true').first();
      await target.hover();
      await page.waitForTimeout(HOVER);
      await target.click({ noWaitAfter: true });
    }
    else await page.goto(base + step.to, { waitUntil: 'commit' });
    await page.waitForURL((url) => url.pathname === step.to, { waitUntil: 'commit' });
    await page.waitForTimeout(step.click || step.back ? PAUSE : 3200); // the first load draws the route in
    each(step, from, Date.now() - began);
  }
}

const readProbe = (page) =>
  page.evaluate(() => {
    const log = JSON.parse(sessionStorage.getItem('probe-log') || '[]');
    const cur = window.__probe?.();
    return cur ? [...log.filter((n) => n.id !== cur.id), cur] : log;
  });

const file = path.join(out, `${label}-chrome.json`);
const result = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { label, browser: null, window: null, passes: {} };

if (passes.includes('numbers')) {
  const s = await open('full');
  result.browser = s.browser.version();
  await walk(s.page, s.base);
  result.window = await s.page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }));
  const navs = await readProbe(s.page);
  writeFileSync(path.join(out, `${label}-chrome-raw.json`), JSON.stringify(navs));
  result.passes.numbers = navs.map(summarise).map((row, i) => ({ step: STEPS[i]?.name ?? '?', ...row }));
  result.requests = s.server?.requests.map((r) => ({ ...r, at: undefined })).filter((r) => r.purpose) ?? [];
  await s.close();
}

// Cold loads: each page opened directly, five times, each in a profile with an empty cache.
if (passes.includes('loads')) {
  const s = await open('full');
  result.browser = s.browser.version();
  result.passes.loads = {};
  for (const url of ['/', '/projects/unify/', '/profile/']) {
    const rows = [];
    for (let i = 0; i < Number(args.loads ?? 5); i++) {
      const context = await s.browser.newContext({ viewport: null });
      if (args.url) await context.addInitScript({ content: `window.__probeMode="full";${readFileSync(new URL('./probe.js', import.meta.url), 'utf8')}` });
      const page = await context.newPage();
      await page.goto(s.base + url, { waitUntil: 'load' });
      await page.waitForTimeout(3200);
      const nav = (await readProbe(page))[0];
      rows.push(summarise(nav));
      await context.close();
    }
    result.passes.loads[url] = rows;
  }
  await s.close();
}

if (passes.includes('frames')) {
  const s = await open('light');
  const cdp = await s.browser.newBrowserCDPSession();
  const chunks = [];
  cdp.on('Tracing.dataCollected', (e) => chunks.push(...e.value));
  await cdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['disabled-by-default-devtools.timeline.frame', 'devtools.timeline.frame', 'blink.user_timing'] } });
  const windows = [];
  await walk(s.page, s.base, (step, from, to) => windows.push({ step: step.name, from, to }));
  const navs = await readProbe(s.page);
  const done = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.end');
  await done;
  // every frame Chrome's compositor drew, per renderer; a transition's frames are the ones
  // between its page's reveal and the end of its animation (the probe has both, on the page clock)
  const ms = (e) => e.ts / 1000;
  const marks = chunks.filter((e) => typeof e.name === 'string' && e.name.startsWith('probe:')).sort((x, y) => x.ts - y.ts);
  const pids = new Set(marks.map((e) => e.pid));
  const draws = chunks.filter((e) => e.name === 'DrawFrame' && pids.has(e.pid)).map(ms).sort((x, y) => x - y);
  const between = (from, to) => {
    const inside = draws.filter((t) => t >= from && t <= to);
    return inside.slice(1).map((t, i) => Math.round((t - inside[i]) * 10) / 10);
  };
  // one row per transition: the click, the new page's reveal, the end of its animation
  const presented = [];
  marks.forEach((mark, i) => {
    if (mark.name !== 'probe:reveal') return;
    const end = marks.slice(i + 1).find((e) => e.name !== 'probe:click');
    const click = marks.slice(0, i).reverse().find((e) => e.name === 'probe:click');
    if (!end || end.name !== 'probe:end') return;
    const during = between(ms(mark), ms(end));
    presented.push({
      clickToReveal: click ? Math.round(ms(mark) - ms(click)) : null,
      length: Math.round(ms(end) - ms(mark)),
      during: frameStats(during),
      duringGaps: during,
      before: click ? frameStats(between(ms(click), ms(mark))) : null,
      // from the click to the end of the animation: includes any frame held while one page hands over to the next
      whole: click ? frameStats(between(ms(click), ms(end))) : null,
      after: frameStats(between(ms(end), ms(end) + 600)),
    });
  });
  let next = 0;
  result.passes.frames = navs.map((nav, i) => {
    const row = summarise(nav);
    const drawn = row.transition !== 'none' && row.transition !== 'skipped' ? presented[next++] ?? null : null;
    return { step: STEPS[i]?.name ?? '?', url: row.url, restored: row.restored, clickToFirstFrame: row.clickToFirstFrame, transition: row.transition, mainThread: row.transitionFrames, mainThreadGaps: row.transitionGaps, mainThreadAfter: row.afterFrames, presented: drawn };
  });
  result.trace = { draws: draws.length, marks: marks.length, events: chunks.length };
  await s.close();
}

if (passes.includes('video')) {
  const s = await open(false);
  const dir = path.join(out, `.${label}-chrome-frames`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await s.context.newCDPSession(s.page);
  const frames = [];
  cdp.on('Page.screencastFrame', (frame) => {
    const file = path.join(dir, `${String(frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(frame.data, 'base64'));
    frames.push({ file, t: frame.metadata.timestamp * 1000 });
    cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1 });
  const windows = [];
  const began = Date.now();
  await walk(s.page, s.base, (step, from, to) => windows.push({ step: step.name, from: began + from, to: began + to }));
  await cdp.send('Page.stopScreencast').catch(() => {});
  await s.close();
  // the frames, each held for as long as Chrome showed it
  const list = frames.map((f, i) => `file '${path.resolve(f.file)}'\nduration ${(((frames[i + 1]?.t ?? f.t + 500) - f.t) / 1000).toFixed(4)}`).join('\n');
  writeFileSync(path.join(dir, 'list.txt'), `${list}\nfile '${path.resolve(frames.at(-1).file)}'\n`);
  const video = path.join(out, `${label}-chrome-screencast.mov`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-fps_mode', 'cfr', '-r', '60', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', video]);
  const gapsAll = frames.slice(1).map((f, i) => f.t - frames[i].t);
  result.passes.video = {
    file: video,
    frames: frames.length,
    steps: windows.map((w) => {
      const inside = frames.filter((f) => f.t >= w.from && f.t <= w.to);
      return { step: w.step, first: frames.indexOf(inside[0]), last: frames.indexOf(inside.at(-1)), painted: inside.length };
    }),
    paintGaps: frameStats(gapsAll),
  };
  writeFileSync(path.join(dir, 'frames.json'), JSON.stringify({ frames, windows }));
}

if (passes.includes('screen')) {
  const s = await open(false);
  const video = path.join(out, `${label}-chrome.mov`);
  const stop = record(video);
  await s.page.waitForTimeout(1500);
  const windows = [];
  await walk(s.page, s.base, (step, from, to) => windows.push({ step: step.name, from, to }));
  await stop();
  result.passes.screen = { file: video, leadIn: 1500, windows };
  await s.close();
}

writeFileSync(file, JSON.stringify(result, null, 2));
console.log(`wrote ${file}`);
