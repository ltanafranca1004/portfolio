// Records the frames of every page transition and checks that none of them blinks dark.
//   node scripts/check-transition-frames.mjs
// Chromium and WebKit, on a desktop window (1512x860) and with iPhone emulation (390x844):
// next project, previous project, map to project and back, map to profile and back.
//
// A frame "blinks" when it is much darker, or shows much less of the page, than both the page
// it left and the page it arrived at: the sky gone to flat colour, or the content gone, as
// when a sliding snapshot uncovers the empty backdrop behind it.
// Chromium frames come from the browser's screencast (every painted frame). WebKit has no
// screencast, and a screenshot taken while one page hands over to the next comes back black
// whether or not anything black was shown, so there the session is recorded as video and the
// video's frames are read back (in Chromium, which can decode it), 25 a second.
// Contact sheets are written to redesign/screenshots/transition-frames-<browser>-<device>.png.
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { BASE, playwright } from './browsers.mjs';

const OUT = path.join('redesign', 'screenshots');
const iphone = playwright.devices['iPhone 14'];
const DEVICES = [
  { name: 'desktop', options: { viewport: { width: 1512, height: 860 } } },
  { name: 'iphone', options: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: iphone.userAgent } },
];
// each step starts where the one before it ended
const STEPS = [
  { name: 'map to project', from: '/', go: (p, phone) => press(p, phone, '.world-unify .world-link'), to: '/projects/unify/' },
  { name: 'next project', go: (p, phone) => (phone ? press(p, phone, '.pager-foot [data-pager="next"]') : p.keyboard.press('ArrowRight')), to: '/projects/cubic/' },
  { name: 'previous project', go: (p, phone) => (phone ? press(p, phone, '.pager-foot [data-pager="prev"]') : p.keyboard.press('ArrowLeft')), to: '/projects/unify/' },
  { name: 'project to map', go: (p, phone) => press(p, phone, '[data-back]'), to: '/' },
  { name: 'map to profile', go: (p, phone) => press(p, phone, '.world-about .world-link'), to: '/profile/' },
  { name: 'profile to map', go: (p, phone) => press(p, phone, '[data-back]'), to: '/' },
];

async function press(page, phone, selector) {
  const target = page.locator(selector);
  if (phone) await target.tap();
  else await target.click();
}

/** How bright a frame is, and how much of it is lit (content and stars, not empty sky). */
async function measure(image) {
  const { data } = await sharp(image).resize(160).greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  let lit = 0;
  for (const v of data) {
    sum += v;
    if (v > 60) lit++;
  }
  return { mean: sum / data.length, lit: lit / data.length };
}

/** The frames of a recorded video that fall inside each time range (seconds), as JPEGs. */
async function videoFrames(file, ranges) {
  const browser = await playwright.chromium.launch({ channel: 'chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  // served from one made-up origin, so the canvas the frames are copied through stays readable
  await page.route('http://frames.test/**', (route) =>
    route.request().url().endsWith('.webm') ? route.fulfill({ path: file, contentType: 'video/webm' }) : route.fulfill({ contentType: 'text/html', body: '<video muted playsinline preload="auto" src="/video.webm"></video>' }),
  );
  await page.goto('http://frames.test/');
  // play it through once and keep every frame the player presents inside a range
  const frames = await page.evaluate(
    (ranges) =>
      new Promise((done, fail) => {
        const video = document.querySelector('video');
        const canvas = document.createElement('canvas');
        const g = canvas.getContext('2d');
        const out = ranges.map(() => []);
        const last = Math.max(...ranges.map((r) => r[1]));
        const grab = (_now, meta) => {
          const t = meta.mediaTime;
          canvas.width ||= video.videoWidth;
          canvas.height ||= video.videoHeight;
          ranges.forEach(([from, to], i) => {
            if (t < from || t > to) return;
            g.drawImage(video, 0, 0);
            out[i].push(canvas.toDataURL('image/jpeg', 0.75).split(',')[1]);
          });
          if (t > last) done(out);
          else video.requestVideoFrameCallback(grab);
        };
        video.requestVideoFrameCallback(grab);
        video.addEventListener('ended', () => done(out));
        video.addEventListener('error', () => fail(new Error('the recorded video could not be played')));
        video.play().catch(fail);
      }),
    ranges,
  );
  await browser.close();
  return frames.map((list) => list.map((f) => Buffer.from(f, 'base64')));
}

const VIDEO_DIR = path.join('node_modules', '.cache', 'transition-frames-video');

let failed = false;
const report = (ok, text) => {
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`);
};

mkdirSync(OUT, { recursive: true });
for (const engine of ['chromium', 'webkit']) {
  // Chromium: the full browser. Its cut-down headless shell skips transitions at random.
  const browser = await playwright[engine].launch(engine === 'chromium' ? { channel: 'chromium' } : {});
  for (const device of DEVICES) {
    const phone = device.name === 'iphone';
    const filmed = engine === 'webkit';
    rmSync(VIDEO_DIR, { recursive: true, force: true });
    const context = await browser.newContext({ ...device.options, ...(filmed ? { recordVideo: { dir: VIDEO_DIR, size: device.options.viewport } } : {}) });
    const born = Date.now(); // the video starts with the page
    const page = await context.newPage();
    const shot = () => page.screenshot({ type: 'jpeg', quality: 70, scale: 'css' });

    // the frame source for this browser
    let frames = [];
    if (engine === 'chromium') {
      const cdp = await context.newCDPSession(page);
      cdp.on('Page.screencastFrame', (f) => {
        frames.push(Buffer.from(f.data, 'base64'));
        cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
      });
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1 });
    }

    const runs = [];
    for (const step of STEPS) {
      if (step.from) {
        await page.goto(BASE + step.from);
        await page.waitForTimeout(2800);
      }
      // previous and next are at the end of the page on a phone
      if (phone && step.name.endsWith('project') && step.name !== 'map to project') {
        await page.locator('.pager-foot').scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
      }
      if (phone && step.name.startsWith('map to')) {
        await page.locator(step.name === 'map to profile' ? '.world-about' : '.world-unify').scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
      }
      const before = await shot();
      await page.waitForTimeout(200);
      frames = [];
      const started = (Date.now() - born) / 1000;
      await step.go(page, phone);
      await page.waitForURL(`**${step.to}`);
      await page.waitForLoadState('load');
      await page.waitForTimeout(1100);
      const during = [...frames];
      const ended = (Date.now() - born) / 1000;
      const kind = await page.evaluate(() => document.documentElement.dataset.vt ?? 'none');
      runs.push({ step, before, after: await shot(), during, kind, window: [started - 0.1, ended - 0.2] });
    }
    await context.close();
    if (filmed) {
      const video = readdirSync(VIDEO_DIR).find((f) => f.endsWith('.webm'));
      const perStep = await videoFrames(path.join(VIDEO_DIR, video), runs.map((r) => r.window));
      // video is darker and softer than a screenshot: compare its frames with its own first
      // and last frame, which show the page before the click and the page once it has settled
      runs.forEach((run, i) => Object.assign(run, { during: perStep[i], before: perStep[i][0], after: perStep[i].at(-1) }));
    }

    const tiles = [];
    for (const [row, run] of runs.entries()) {
      const before = await measure(run.before);
      const after = await measure(run.after);
      const floor = { mean: Math.min(before.mean, after.mean) * 0.6, lit: Math.min(before.lit, after.lit) * 0.35 };
      let worst = Infinity;
      let dark = 0;
      for (const frame of run.during) {
        const m = await measure(frame);
        if (m.mean < floor.mean || m.lit < floor.lit) dark++;
        worst = Math.min(worst, m.mean);
      }
      // a blank or failed capture must not pass as "nothing dark"
      const real = before.lit > 0.002 && after.lit > 0.002;
      report(
        real && run.during.length >= 8 && dark === 0,
        `${engine} ${device.name}, ${run.step.name} (${run.kind}): ${run.during.length} frames, ${dark} dark; darkest frame is ${((worst / Math.min(before.mean, after.mean)) * 100).toFixed(0)}% as bright as the darker of the two pages${real ? '' : ' (THE CAPTURE IS BLANK)'}`,
      );

      // eight frames across the first 600ms of change for the contact sheet
      const cell = phone ? { w: 130, h: 282 } : { w: 300, h: 171 };
      const first = await measure(run.during[0] ?? run.before);
      let begin = 0;
      for (const [i, frame] of run.during.entries()) {
        const m = await measure(frame);
        if (Math.abs(m.mean - first.mean) > 0.4 || Math.abs(m.lit - first.lit) > 0.004) {
          begin = Math.max(0, i - 1);
          break;
        }
      }
      const span = run.during.slice(begin, begin + (filmed ? 16 : 40));
      for (let i = 0; i < 8 && span.length; i++) {
        const frame = span[Math.min(span.length - 1, Math.round((i / 7) * (span.length - 1)))];
        tiles.push({ input: await sharp(frame).resize(cell.w, cell.h, { fit: 'fill' }).toBuffer(), left: i * (cell.w + 4), top: row * (cell.h + 4) });
      }
    }
    const cell = phone ? { w: 130, h: 282 } : { w: 300, h: 171 };
    const file = path.join(OUT, `transition-frames-${engine}-${device.name}.png`);
    await sharp({ create: { width: 8 * (cell.w + 4) - 4, height: STEPS.length * (cell.h + 4) - 4, channels: 3, background: '#400' } })
      .composite(tiles)
      .png()
      .toFile(file);
    console.log(`     wrote ${file} (rows: ${STEPS.map((s) => s.name).join(', ')})`);
  }
  await browser.close();
}
if (failed) process.exitCode = 1;
