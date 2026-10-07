// Measures how the site runs on a phone: frame rate, long tasks and the cube's own frame rate
// while scrolling the map, opening a project by tapping its world, and scrolling that page.
//   node scripts/perf-phone.mjs [label]
// - Chromium at 390x844 with the CPU slowed 4x, scrolled with real touch gestures. Long tasks
//   come from the browser's own longtask entries; paint and raster time from a trace.
// - WebKit with iPhone emulation. It has no CPU throttle and no longtask entries, so there the
//   numbers are frame rate and the longest gap between frames.
// Writes redesign/screenshots/perf-phone-<label>.json so runs can be compared.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { BASE, playwright } from './browsers.mjs';

const LABEL = process.argv[2] ?? 'run';
const OUT = path.join('redesign', 'screenshots');
const SIZE = { width: 390, height: 844 };
const iphone = playwright.devices['iPhone 14'];
const SLUG = 'cubic';

// Runs in every page before its own scripts: counts frames, long tasks and cube redraws.
const probe = () => {
  const perf = (window.__perf = { frames: [], long: [], cube: [] });
  const loop = (t) => {
    perf.frames.push(t);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) perf.long.push({ at: e.startTime, ms: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  } else perf.long = null; // WebKit has no longtask entries
  const put = CanvasRenderingContext2D.prototype.putImageData;
  CanvasRenderingContext2D.prototype.putImageData = function (...args) {
    perf.cube.push(performance.now());
    return put.apply(this, args);
  };
};

/** Frame and task numbers for the stretch of time between two performance.now() marks. */
const summarise = (page, from, to) =>
  page.evaluate(
    ([from, to]) => {
      const perf = window.__perf;
      const within = (list) => list.filter((t) => t >= from && t <= to);
      const gaps = (list) => list.slice(1).map((t, i) => t - list[i]);
      const frames = within(perf.frames);
      const frameGaps = gaps(frames);
      const cube = within(perf.cube);
      const cubeGaps = gaps(cube);
      const long = perf.long ? perf.long.filter((l) => l.at + l.ms >= from && l.at <= to) : null;
      const seconds = (to - from) / 1000;
      // a late frame took over one and a half times the usual gap (60 a second in Chromium,
      // 30 in Playwright's WebKit)
      const usual = [...frameGaps].sort((a, b) => a - b)[Math.floor(frameGaps.length / 2)] ?? 0;
      return {
        seconds: +seconds.toFixed(1),
        fps: +(frames.length / seconds).toFixed(1),
        'late frames': frameGaps.filter((g) => g > usual * 1.6).length,
        'worst frame ms': Math.round(Math.max(0, ...frameGaps)),
        'long tasks': long ? long.length : 'n/a',
        'longest task ms': long ? Math.round(Math.max(0, ...long.map((l) => l.ms))) : 'n/a',
        'cube fps': cube.length > 1 ? +(cube.length / seconds).toFixed(1) : 0,
        'worst cube gap ms': Math.round(Math.max(0, ...cubeGaps)),
      };
    },
    [from, to],
  );

const now = (page) => page.evaluate(() => performance.now());
// the cube scrolls off screen (and pauses) during a full-page scroll, so its numbers are left out there
const OFFSCREEN_CUBE = { 'cube fps': '', 'worst cube gap ms': '' };

/** Animations that are running, and how many of those are on elements off the screen. */
const animations = (page) =>
  page.evaluate(() => {
    const running = document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target);
    const off = running.filter((a) => {
      const r = a.effect.target.getBoundingClientRect();
      return r.bottom < 0 || r.top > innerHeight;
    });
    return { 'animations running': running.length, 'of those off screen': off.length };
  });

/** A short scroll up and down around the cube, so it stays on screen the whole time. */
const NEAR_CUBE = () =>
  new Promise((done) => {
    const start = scrollY;
    const t0 = performance.now();
    const step = (t) => {
      window.scrollTo(0, start + Math.sin((t - t0) / 300) * 110);
      if (t - t0 < 3000) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  });

/** Safari's toolbar hiding and showing changes the window height, which fires "resize". */
async function toolbar(page) {
  const from = await now(page);
  for (const height of [664, 844, 664, 844]) {
    await page.setViewportSize({ width: SIZE.width, height });
    await page.waitForTimeout(450);
  }
  return [from, await now(page)];
}
const pageHeight = (page) => page.evaluate(() => document.documentElement.scrollHeight - innerHeight);

/** Main-thread and raster time from a Chromium trace, in ms per second of the trace. */
function traceCost(file) {
  const { traceEvents } = JSON.parse(readFileSync(file, 'utf8'));
  const sum = (names) => traceEvents.filter((e) => e.ph === 'X' && names.includes(e.name)).reduce((n, e) => n + (e.dur ?? 0), 0) / 1000;
  const times = traceEvents.filter((e) => e.ts > 0).map((e) => e.ts);
  const seconds = (Math.max(...times) - Math.min(...times)) / 1e6;
  const per = (ms) => +(ms / seconds).toFixed(1);
  return {
    'script ms/s': per(sum(['FunctionCall', 'EvaluateScript', 'FireAnimationFrame', 'TimerFire', 'EventDispatch'])),
    'style+layout ms/s': per(sum(['UpdateLayoutTree', 'Layout'])),
    'paint ms/s': per(sum(['Paint', 'PrePaint', 'Layerize', 'Commit'])),
    'raster ms/s': per(sum(['RasterTask'])),
  };
}

const rows = [];
const extras = [];

// ---- Chromium, CPU slowed 4x ----
{
  const browser = await playwright.chromium.launch({ channel: 'chromium' });
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: iphone.userAgent });
  await context.addInitScript(probe);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const swipe = async (distance) => cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 420, yDistance: distance, speed: 1100, gestureSourceType: 'touch', repeatCount: 1 });
  const scrolled = async (name) => {
    const traceFile = path.join('node_modules', '.cache', `perf-trace-${Date.now()}.json`);
    mkdirSync(path.dirname(traceFile), { recursive: true });
    const distance = await pageHeight(page);
    await browser.startTracing(page, { path: traceFile, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'cc'] });
    const from = await now(page);
    await swipe(-distance);
    await swipe(distance);
    const to = await now(page);
    await browser.stopTracing();
    rows.push({ browser: 'chromium, 4x slower CPU', what: name, ...(await summarise(page, from, to)), ...OFFSCREEN_CUBE, ...traceCost(traceFile) });
    rmSync(traceFile, { force: true });
  };

  const B = 'chromium, 4x slower CPU';
  // how many layers the compositor keeps, and roughly how much memory they take
  const layers = async () => {
    await cdp.send('LayerTree.enable');
    const { layers: list } = await new Promise((done) => cdp.once('LayerTree.layerTreeDidChange', done));
    await cdp.send('LayerTree.disable');
    const drawn = (list ?? []).filter((l) => l.drawsContent);
    return { layers: drawn.length, 'layer MB': +(drawn.reduce((n, l) => n + l.width * l.height * 9 * 4, 0) / 1e6).toFixed(0) };
  };

  await page.goto(`${BASE}/`);
  await page.waitForTimeout(3000);
  extras.push({ browser: B, page: 'map', ...(await animations(page)), ...(await layers()) });
  await scrolled('scroll the map down and back');

  // the cube on screen: at rest, then with the page moving under it
  await page.evaluate(() => window.scrollTo(0, document.querySelector('.world-cubic').offsetTop - 200));
  await page.waitForTimeout(500);
  const idleFrom = await now(page);
  await page.waitForTimeout(3000);
  rows.push({ browser: B, what: 'map at rest, cube on screen', ...(await summarise(page, idleFrom, await now(page))) });
  const nearFrom = await now(page);
  await page.evaluate(NEAR_CUBE);
  rows.push({ browser: B, what: 'map scrolling, cube on screen', ...(await summarise(page, nearFrom, await now(page))) });
  rows.push({ browser: B, what: 'map: toolbar hides and shows, 4 times', ...(await summarise(page, ...(await toolbar(page)))) });

  const link = page.locator(`.world-${SLUG} .world-link`);
  await link.scrollIntoViewIfNeeded();
  await link.tap();
  await page.waitForURL(`**/projects/${SLUG}/`);
  await page.waitForTimeout(2500);
  rows.push({ browser: B, what: `open ${SLUG} (first 2.5s)`, ...(await summarise(page, 0, await now(page))) });
  extras.push({ browser: B, page: SLUG, ...(await animations(page)), ...(await layers()) });
  await scrolled(`scroll ${SLUG} down and back`);
  rows.push({ browser: B, what: `${SLUG}: toolbar hides and shows, 4 times`, ...(await summarise(page, ...(await toolbar(page)))) });
  await browser.close();
}

// ---- WebKit, iPhone emulation ----
{
  const browser = await playwright.webkit.launch();
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: iphone.userAgent });
  await context.addInitScript(probe);
  const page = await context.newPage();
  // no touch gestures here: step the scroll position once a frame, 18px at a time
  const scrolled = async (name) => {
    const from = await now(page);
    await page.evaluate(
      () =>
        new Promise((done) => {
          const end = document.documentElement.scrollHeight - innerHeight;
          let y = 0;
          let dir = 1;
          const step = () => {
            y += 18 * dir;
            if (y >= end) dir = -1;
            window.scrollTo(0, Math.max(0, Math.min(end, y)));
            if (dir === -1 && y <= 0) done();
            else requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }),
    );
    rows.push({ browser: 'webkit, iPhone emulation', what: name, ...(await summarise(page, from, await now(page))), ...OFFSCREEN_CUBE });
  };

  const B = 'webkit, iPhone emulation';
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(3000);
  extras.push({ browser: B, page: 'map', ...(await animations(page)) });
  await scrolled('scroll the map down and back');
  await page.evaluate(() => window.scrollTo(0, document.querySelector('.world-cubic').offsetTop - 200));
  await page.waitForTimeout(500);
  const idleFrom = await now(page);
  await page.waitForTimeout(3000);
  rows.push({ browser: B, what: 'map at rest, cube on screen', ...(await summarise(page, idleFrom, await now(page))) });
  const nearFrom = await now(page);
  await page.evaluate(NEAR_CUBE);
  rows.push({ browser: B, what: 'map scrolling, cube on screen', ...(await summarise(page, nearFrom, await now(page))) });
  rows.push({ browser: B, what: 'map: toolbar hides and shows, 4 times', ...(await summarise(page, ...(await toolbar(page)))) });
  const link = page.locator(`.world-${SLUG} .world-link`);
  await link.scrollIntoViewIfNeeded();
  await link.tap();
  await page.waitForURL(`**/projects/${SLUG}/`);
  await page.waitForTimeout(2500);
  rows.push({ browser: B, what: `open ${SLUG} (first 2.5s)`, ...(await summarise(page, 0, await now(page))) });
  extras.push({ browser: B, page: SLUG, ...(await animations(page)) });
  await scrolled(`scroll ${SLUG} down and back`);
  rows.push({ browser: B, what: `${SLUG}: toolbar hides and shows, 4 times`, ...(await summarise(page, ...(await toolbar(page)))) });
  await browser.close();
}

console.table(rows);
console.table(extras);
mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, `perf-phone-${LABEL}.json`), JSON.stringify({ rows, extras }, null, 2));
console.log(`wrote ${path.join(OUT, `perf-phone-${LABEL}.json`)}`);
