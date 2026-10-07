// Checks the project pages on phones: iPhone emulation (DPR 3, touch, mobile user agent) in
// WebKit and Chromium, opening every project page two ways: loading its address directly, and
// tapping its world on the map.
//   node scripts/check-phone.mjs
// On the first screen the hero must be centred, at least 70% of the screen wide and fully
// visible, with the project title under it. Nothing may scroll sideways.
//
// Why this exists: the hero used to be scaled with tan(atan2(100cqw, 520px)). Safari 18 works
// that out wrongly (0.14 instead of 0.69 on a 430px-wide iPhone), which left the hero tiny in
// the top-left corner of its box. Playwright's current WebKit does not have that bug, so the
// check also fails if any stylesheet uses atan2() again.
//   node scripts/check-phone.mjs --selftest   puts Safari 18's scale back and expects failures
import { BASE, playwright } from './browsers.mjs';

const PHONES = [
  [390, 844],
  [390, 664], // the same phone with Safari's toolbars showing
  [430, 932],
];
const PROJECTS = ['unify', 'cubic', 'lens', 'turtle-trips', 'amenity-recommender', 'pipeline-simulator', 'nutrifit'];
const SELFTEST = process.argv.includes('--selftest');
if (SELFTEST) {
  PHONES.splice(0, 2);
  PROJECTS.splice(2);
}

const iphone = playwright.devices['iPhone 14'];
const failures = [];
const rows = [];

const measure = (page) =>
  page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
    };
    // .hero-stage carries the scale, so its box is what is actually drawn
    return { w: innerWidth, h: innerHeight, scrollY, overflowX: document.documentElement.scrollWidth - innerWidth, hero: box('.hero-stage'), title: box('.title-row h1') };
  });

function judge(where, m) {
  const problems = [];
  if (!m.hero || !m.title) problems.push('hero or title missing');
  else {
    const share = m.hero.width / m.w;
    const offCentre = Math.abs((m.hero.left + m.hero.right) / 2 - m.w / 2);
    if (share < 0.7) problems.push(`hero is ${(share * 100).toFixed(0)}% of the screen width (needs 70%)`);
    if (offCentre > 3) problems.push(`hero is ${offCentre.toFixed(0)}px off centre`);
    // the hero floats up and down by 10px
    if (m.hero.top < -12 || m.hero.bottom > m.h + 12) problems.push(`hero runs from ${m.hero.top.toFixed(0)} to ${m.hero.bottom.toFixed(0)}px on a ${m.h}px screen`);
    if (m.title.top < 0 || m.title.bottom > m.h) problems.push(`title ends at ${m.title.bottom.toFixed(0)}px on a ${m.h}px screen`);
  }
  if (m.scrollY !== 0) problems.push(`page opened scrolled to ${m.scrollY}`);
  if (m.overflowX > 0) problems.push(`scrolls sideways by ${m.overflowX}px`);
  for (const p of problems) failures.push(`${where}: ${p}`);
  return problems.length === 0;
}

for (const engine of ['webkit', 'chromium']) {
  // Chromium: the full browser. Its cut-down headless shell skips page transitions at random.
  const browser = await playwright[engine].launch(engine === 'chromium' ? { channel: 'chromium' } : {});
  for (const [width, height] of PHONES) {
    const context = await browser.newContext({ userAgent: iphone.userAgent, deviceScaleFactor: 3, isMobile: true, hasTouch: true, viewport: { width, height } });
    if (SELFTEST) {
      await context.addInitScript(() =>
        document.addEventListener('DOMContentLoaded', () => {
          const style = document.createElement('style');
          style.textContent = '.hero-stage { transform: scale(0.1385) !important; }';
          document.head.append(style);
        }),
      );
    }
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    for (const slug of PROJECTS) {
      const url = `/projects/${slug}/`;
      await page.goto(BASE + url);
      await page.waitForTimeout(500);
      const direct = judge(`${engine} ${width}x${height} ${slug}, direct load`, await measure(page));

      await page.goto(`${BASE}/`);
      await page.waitForTimeout(700);
      const link = page.locator(`.world-${slug} .world-link, .mini-link[data-slug="${slug}"]`);
      await link.scrollIntoViewIfNeeded();
      await link.tap();
      await page.waitForURL(`**${url}`);
      await page.waitForLoadState('load');
      await page.waitForTimeout(900); // the zoom transition
      const tapped = judge(`${engine} ${width}x${height} ${slug}, tapped on the map`, await measure(page));
      rows.push({ browser: engine, size: `${width}x${height}`, page: slug, 'direct load': direct ? 'ok' : 'FAIL', 'tapped on the map': tapped ? 'ok' : 'FAIL' });
    }

    const css = await page.evaluate(async () => {
      const sheets = await Promise.all([...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => fetch(l.href).then((r) => r.text())));
      return [...sheets, ...[...document.querySelectorAll('style')].map((s) => s.textContent)].join('\n');
    });
    if (/atan2\(/.test(css)) failures.push(`${engine} ${width}x${height}: a stylesheet uses atan2(), which Safari 18 works out wrongly with viewport or container units`);
    for (const e of errors) failures.push(`${engine} ${width}x${height}: page error ${e}`);
    await context.close();
  }
  await browser.close();
}

console.table(rows);
for (const f of failures) console.log(`FAIL ${f}`);
if (SELFTEST) {
  console.log(failures.length > 0 ? 'ok   selftest: with the broken scale back, the check fails as it should' : 'FAIL selftest: the check missed the broken hero');
  process.exitCode = failures.length > 0 ? 0 : 1;
} else {
  console.log(failures.length === 0 ? `ok   hero and title are on the first screen on ${rows.length} page/size/browser combinations, loaded directly and tapped` : `FAIL ${failures.length} problems`);
  if (failures.length) process.exitCode = 1;
}
