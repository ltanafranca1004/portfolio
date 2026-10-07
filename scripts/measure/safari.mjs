// Drives the real Safari through the journey with safaridriver (WebDriver).
//   node scripts/measure/safari.mjs --build=dist --label=after [--latency=40 --kbps=20000]
//   node scripts/measure/safari.mjs --url=https://redesign.luistanafranca.pages.dev --label=live --passes=video
// Needs Safari > Settings > Developer > "Allow remote automation" (or `sudo safaridriver --enable`).
// It takes over the screen: run it when nobody is using the Mac, plugged in, with Low Power
// Mode off (Safari draws 30 frames a second in Low Power Mode). The video pass records the
// whole screen (record.mjs), which needs Screen Recording permission for the app
// this runs in.
// Passes (each in a fresh automation window, which starts with an empty cache):
//   loads    each page opened directly, five times
//   numbers  the journey with the probe in full
//   frames   the journey with the probe's frame clock only
//   video    the journey recorded from the screen, written as <out>/<label>-safari.mov
// The probe only exists on builds served from here, so a --url run can only do the video pass.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { STEPS, summarise } from './journey.mjs';
import { record } from './record.mjs';
import { serve } from './serve.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const label = args.label ?? 'run';
const out = args.out ?? path.join('redesign', 'recordings');
const passes = (args.passes ?? (args.url ? 'video' : 'loads,numbers,frames,video')).split(',');
const PORT = Number(args.port ?? 4420);
const DRIVER = Number(args.driver ?? 4725);
const PAUSE = Number(args.pause ?? 1500);
const ELEMENT = 'element-6066-11e4-a52e-4f735466cecf';
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
mkdirSync(out, { recursive: true });

const driver = spawn('safaridriver', ['-p', String(DRIVER)], { stdio: 'ignore' });
process.on('exit', () => driver.kill());
await sleep(1200);

async function wd(method, url, body) {
  const res = await fetch(`http://localhost:${DRIVER}${url}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (json.value?.error) throw new Error(`${json.value.error}: ${json.value.message}`);
  return json.value;
}

async function open(probe) {
  const server = args.url ? null : await serve({ root: path.resolve(args.build ?? 'dist'), port: PORT, latency: Number(args.latency ?? 0), kbps: Number(args.kbps ?? 0), probe });
  // pairing with Safari sometimes fails on the first try
  let session;
  for (let attempt = 1; !session; attempt++) {
    try {
      session = (await wd('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } })).sessionId;
    } catch (error) {
      if (attempt === 4) throw error;
      await sleep(2000);
    }
  }
  const s = `/session/${session}`;
  await wd('POST', `${s}/window/maximize`, {}).catch(() => {});
  const run = (script, ...a) => wd('POST', `${s}/execute/sync`, { script, args: a });
  return {
    server,
    base: args.url ?? server.url,
    run,
    go: (url) => wd('POST', `${s}/url`, { url }),
    back: () => wd('POST', `${s}/back`, {}),
    // the first match that is actually showing (phones and wide screens each have their own pager)
    click: async (selector) => {
      let el = null;
      for (let i = 0; i < 40 && !el; i++) {
        el = await run('return [...document.querySelectorAll(arguments[0])].find((el) => el.getClientRects().length > 0) || null', selector).catch(() => null);
        if (!el) await sleep(100);
      }
      if (!el) throw new Error(`nothing showing matches ${selector} on ${await run('return location.pathname + " " + innerWidth + "x" + innerHeight')}`);
      // Safari refuses a click on a link it cannot hit in the middle (a world's link is its
      // title, stretched over the ring by a pseudo-element): click it from the page then.
      await wd('POST', `${s}/element/${el[ELEMENT]}/click`, {}).catch(() => run('arguments[0].click()', el));
    },
    path: () => run('return location.pathname'),
    close: async () => {
      await wd('DELETE', s).catch(() => {});
      await server?.close();
    },
  };
}

async function walk(s, each = () => {}) {
  const began = Date.now();
  for (const step of STEPS) {
    const from = Date.now() - began;
    if (step.back) await s.back();
    else if (step.click) await s.click(step.click);
    else await s.go(s.base + step.to);
    for (let i = 0; i < 60 && (await s.path()) !== step.to; i++) await sleep(50);
    if ((await s.path()) !== step.to && step.click) {
      // the click did not take (seen in Safari right after a Back): follow the link from the page
      console.error(`${step.name}: the click did not navigate, following the link directly`);
      await s.run('const el = [...document.querySelectorAll(arguments[0])].find((el) => el.getClientRects().length > 0); if (el) el.click();', step.click);
      for (let i = 0; i < 60 && (await s.path()) !== step.to; i++) await sleep(50);
    }
    await sleep(step.click || step.back ? PAUSE : 3200);
    each(step, from, Date.now() - began);
  }
}

const readProbe = (s) =>
  s.run(`
    const log = JSON.parse(sessionStorage.getItem('probe-log') || '[]');
    const cur = window.__probe && window.__probe();
    return cur ? [...log.filter((n) => n.id !== cur.id), cur] : log;`);

// keep the passes of earlier runs under this label: a later video-only run must not drop the numbers
const file = path.join(out, `${label}-safari.json`);
const result = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { label, browser: null, window: null, passes: {} };

if (passes.includes('loads')) {
  result.passes.loads = {};
  for (const url of ['/', '/projects/unify/', '/profile/']) {
    const rows = [];
    for (let i = 0; i < Number(args.loads ?? 5); i++) {
      const s = await open('full'); // a new automation window: nothing cached
      await s.go(s.base + url);
      await sleep(3200);
      rows.push(summarise((await readProbe(s))[0]));
      await s.close();
    }
    result.passes.loads[url] = rows;
  }
}

if (passes.includes('numbers')) {
  const s = await open('full');
  await walk(s);
  result.browser = await s.run('return navigator.userAgent');
  result.window = await s.run('return { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }');
  const navs = await readProbe(s);
  writeFileSync(path.join(out, `${label}-safari-raw.json`), JSON.stringify(navs));
  result.passes.numbers = navs.map(summarise).map((row, i) => ({ step: STEPS[i]?.name ?? '?', ...row }));
  await s.close();
}

if (passes.includes('frames')) {
  const s = await open('light');
  await walk(s);
  const navs = await readProbe(s);
  // Safari has no trace to read presented frames from: the page's own frame clock is the
  // measure here, and the screen recording is the check on it.
  result.passes.frames = navs.map((nav, i) => {
    const row = summarise(nav);
    return { step: STEPS[i]?.name ?? '?', url: row.url, restored: row.restored, clickToFirstFrame: row.clickToFirstFrame, transition: row.transition, mainThread: row.transitionFrames, mainThreadGaps: row.transitionGaps, mainThreadAfter: row.afterFrames, presented: null };
  });
  await s.close();
}

if (passes.includes('video')) {
  const s = await open(false);
  const video = path.join(out, `${label}-safari.mov`);
  const stop = record(video);
  await sleep(1500);
  const began = Date.now();
  const windows = [];
  try {
    await walk(s, (step, from, to) => windows.push({ step: step.name, from, to }));
  } finally {
    await stop();
  }
  result.passes.video = { file: video, began, windows, leadIn: 1500 };
  await s.close();
}

writeFileSync(file, JSON.stringify(result, null, 2));
console.log(`wrote ${file}`);
driver.kill();
