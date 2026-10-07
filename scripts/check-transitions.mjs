// Checks the page transitions and records them.
//   node scripts/check-transitions.mjs
// - Chromium and WebKit: map to project zooms in, back zooms out, previous/next slide.
// - Firefox (no cross-document view transitions yet): plain navigation, no errors.
// - Reduced motion: plain navigation everywhere.
// Output in redesign/screenshots/: transition-chromium.webm, transition-webkit.webm, and
// transition-frames.png (frames of map to Unify and back, from Chromium).
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { BASE, playwright } from './browsers.mjs';

const OUT = path.join('redesign', 'screenshots');
const TMP = path.join('node_modules', '.cache', 'transition-video');
const SIZE = { width: 1280, height: 720 };
let failed = false;
const report = (ok, text) => {
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`);
};
const kind = (page) => page.evaluate(() => document.documentElement.dataset.vt ?? 'none');
const landed = async (page, url) => {
  await page.waitForURL(`**${url}`);
  await page.waitForLoadState('load');
  await page.waitForTimeout(900);
};

async function run(engine, { reducedMotion = 'no-preference', video = false, frames = null } = {}) {
  // Chromium: the full browser. Its cut-down headless shell skips transitions at random.
  const browser = await playwright[engine].launch(engine === 'chromium' ? { channel: 'chromium' } : {});
  rmSync(TMP, { recursive: true, force: true });
  const context = await browser.newContext({ viewport: SIZE, reducedMotion, ...(video ? { recordVideo: { dir: TMP, size: SIZE } } : {}) });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2600); // first visit: the route draws in

  let stop = async () => {};
  if (frames) {
    // every frame Chromium paints, with its time
    const cdp = await context.newCDPSession(page);
    cdp.on('Page.screencastFrame', (f) => {
      frames.push({ at: Date.now(), data: Buffer.from(f.data, 'base64') });
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 82, everyNthFrame: 1 });
    stop = () => cdp.send('Page.stopScreencast').catch(() => {});
  }

  const seen = {};
  const mark = (name) => frames?.push({ at: Date.now(), mark: name });

  mark('in');
  await page.click('.world-unify .world-link');
  await landed(page, '/projects/unify/');
  seen.in = await kind(page);

  mark('out');
  await page.click('.site-header .brand'); // the name in the header also goes back to the map
  await landed(page, '/');
  seen.out = await kind(page);
  seen.settled = await page.evaluate(() => document.documentElement.classList.contains('map-settled'));
  await stop();

  await page.click('.world-unify .world-link');
  await landed(page, '/projects/unify/');
  await page.keyboard.press('ArrowRight');
  await landed(page, '/projects/cubic/');
  seen.next = await kind(page);
  await page.keyboard.press('ArrowLeft');
  await landed(page, '/projects/unify/');
  seen.prev = await kind(page);
  await page.click('[data-pager="prev"]'); // wraps round to the last project
  await landed(page, '/projects/nutrifit/');
  seen.wrap = await kind(page);

  await context.close();
  await browser.close();
  if (video) {
    const file = readdirSync(TMP).find((f) => f.endsWith('.webm'));
    if (file) renameSync(path.join(TMP, file), path.join(OUT, `transition-${engine}.webm`));
  }
  return { seen, errors };
}

mkdirSync(OUT, { recursive: true });
const frames = [];
for (const engine of ['chromium', 'webkit']) {
  const { seen, errors } = await run(engine, { video: true, frames: engine === 'chromium' ? frames : null });
  report(seen.in === 'zoom-in', `${engine}: map to project is "${seen.in}"`);
  report(seen.out === 'zoom-out', `${engine}: project to map is "${seen.out}"`);
  report(seen.settled, `${engine}: the map is shown settled on return (no second draw-in)`);
  report(seen.next === 'slide-next' && seen.prev === 'slide-prev', `${engine}: Right arrow is "${seen.next}", Left arrow is "${seen.prev}"`);
  report(seen.wrap === 'slide-prev', `${engine}: previous from the first project wraps to the last ("${seen.wrap}")`);
  report(errors.length === 0, `${engine}: ${errors.length} errors ${errors.slice(0, 2).join(' | ')}`);
}
{
  const { seen, errors } = await run('firefox');
  report(Object.values(seen).filter((v) => typeof v === 'string').every((v) => v === 'none'), `firefox: plain navigation everywhere (${[...new Set(Object.values(seen).filter((v) => typeof v === 'string'))]})`);
  report(errors.length === 0, `firefox: ${errors.length} errors ${errors.slice(0, 2).join(' | ')}`);
}
for (const engine of ['chromium', 'webkit']) {
  const { seen, errors } = await run(engine, { reducedMotion: 'reduce' });
  report(Object.values(seen).filter((v) => typeof v === 'string').every((v) => v === 'none'), `${engine}, reduced motion: plain navigation everywhere`);
  report(errors.length === 0, `${engine}, reduced motion: ${errors.length} errors`);
}

// a strip of frames for each direction: from just before the picture starts to change, 70ms apart
const tiny = (data) => sharp(data).resize(48, 27, { fit: 'fill' }).greyscale().raw().toBuffer();
const strip = async (name, top) => {
  const start = frames.find((f) => f.mark === name)?.at ?? 0;
  const shots = frames.filter((f) => f.data && f.at >= start - 40 && f.at <= start + 1500);
  if (shots.length < 2) return [];
  const first = await tiny(shots[0].data);
  let begin = shots[0].at;
  for (const shot of shots) {
    const now = await tiny(shot.data);
    let change = 0;
    for (let i = 0; i < now.length; i++) change += Math.abs(now[i] - first[i]);
    if (change / now.length > 1.5) {
      begin = shot.at;
      break;
    }
  }
  const picked = [];
  for (let t = -70; picked.length < 8; t += 70) {
    const frame = shots.reduce((best, f) => (Math.abs(f.at - begin - t) < Math.abs(best.at - begin - t) ? f : best));
    picked.push({ input: await sharp(frame.data).resize(320).toBuffer(), left: picked.length * 324, top });
  }
  console.log(`     ${name}: ${shots.length} frames captured, picture starts changing ${begin - start}ms after the click`);
  return picked;
};
const tiles = [...(await strip('in', 0)), ...(await strip('out', 184))];
if (tiles.length) {
  await sharp({ create: { width: 8 * 324 - 4, height: 364, channels: 3, background: '#111' } }).composite(tiles).png().toFile(path.join(OUT, 'transition-frames.png'));
  console.log('     wrote transition-frames.png (top row: map to Unify, bottom row: back to the map, 70ms apart)');
}
if (failed) process.exitCode = 1;
