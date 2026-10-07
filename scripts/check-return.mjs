// Checks that coming back to the map lands where it was left, on phones.
//   node scripts/check-return.mjs
// iPhone emulation (DPR 3, touch, mobile user agent) in WebKit and Chromium. For every world:
// scroll the map until the world is in the middle of the screen, tap it, and come back three
// ways. Each time the map must be within 10px of where it was, in its first frame, with the
// opened world in view:
// - the header's back control (it goes back in history when the map is the page before);
// - the browser's Back button;
// - the back control after stepping to the next project, when the page before is not the map
//   and the map is loaded afresh.
// One more pass hides the Navigation API, so the back control's fallback (a mark on the
// history entry) is checked too: older Safari on iPhones has no Navigation API.
//
// It also checks what keeps the map eligible for the back/forward cache: no unload or
// beforeunload handlers, no "Cache-Control: no-store" on the HTML, history.scrollRestoration
// left on "auto", and a page whose height does not change once its pictures have loaded.
import { BASE, playwright } from './browsers.mjs';

const PHONES = [
  [390, 844],
  [390, 664], // the same phone with Safari's toolbars showing
];
const WORLDS = ['unify', 'cubic', 'lens', 'turtle-trips', 'amenity-recommender', 'pipeline-simulator', 'nutrifit'];
const TOLERANCE = 10;
const iphone = playwright.devices['iPhone 14'];
const failures = [];
const rows = [];
const fail = (text) => failures.push(text);

// Runs in every page before its own scripts.
function probe(hideNavigationApi) {
  if (hideNavigationApi) {
    try {
      Object.defineProperty(window, 'navigation', { value: undefined, configurable: true });
    } catch {
      window.__navigationNotHidden = true;
    }
  }
  // handlers that would keep a page out of the back/forward cache
  window.__unloadHandlers = [];
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, ...rest) {
    if (type === 'unload' || type === 'beforeunload') window.__unloadHandlers.push(type);
    return add.call(this, type, ...rest);
  };
  // Where the page is scrolled in the first frame it paints. A resize observer reports in
  // the same frame, after every animation-frame callback and the layout, just before the paint.
  requestAnimationFrame(() =>
    new ResizeObserver((_, observer) => {
      window.__firstFrameY = scrollY;
      observer.disconnect();
    }).observe(document.documentElement),
  );
  addEventListener('pageshow', (event) => (window.__fromCache = event.persisted));
}

const state = (page, slug) =>
  page.evaluate((slug) => {
    const world = document.querySelector(`.world-${slug}, .mini:has([data-slug="${slug}"])`);
    const box = world?.getBoundingClientRect();
    return {
      y: Math.round(scrollY),
      firstFrameY: window.__fromCache ? Math.round(scrollY) : Math.round(window.__firstFrameY ?? -1),
      fromCache: Boolean(window.__fromCache),
      inView: Boolean(box && box.bottom > 0 && box.top < innerHeight),
      height: document.documentElement.scrollHeight,
    };
  }, slug);

// A map shown again from the back/forward cache fires no "load", so wait on the address alone.
const onMap = async (page) => {
  await page.waitForFunction(() => location.pathname === '/' && document.readyState === 'complete');
  await page.waitForTimeout(450);
};
const onProject = async (page, slug) => {
  await page.waitForURL(`**/projects/${slug}/`);
  await page.waitForLoadState('load');
  await page.waitForTimeout(450);
};

/** Scroll the map until the world is in the middle of the screen, then open it. */
async function open(page, slug) {
  const link = page.locator(`.world-${slug} .world-link, .mini-link[data-slug="${slug}"]`);
  await link.evaluate((el) => (el.closest('.world, .mini') ?? el).scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(150);
  const left = await page.evaluate(() => Math.round(scrollY));
  await link.tap();
  await onProject(page, slug);
  return left;
}

function judge(where, left, now) {
  const problems = [];
  if (Math.abs(now.y - left) > TOLERANCE) problems.push(`left at ${left}px, came back at ${now.y}px`);
  if (Math.abs(now.firstFrameY - left) > TOLERANCE) problems.push(`left at ${left}px, the first frame was painted at ${now.firstFrameY}px`);
  if (!now.inView) problems.push('the opened world is not in view');
  for (const p of problems) fail(`${where}: ${p}`);
  return problems.length ? 'FAIL' : `ok (${now.y - left >= 0 ? '+' : ''}${now.y - left}px${now.fromCache ? ', cached' : ''})`;
}

async function run(engine, [width, height], { hideNavigationApi = false, worlds = WORLDS } = {}) {
  // Chromium: the full browser (its cut-down headless shell skips page transitions at random),
  // with the back/forward cache left on. Playwright switches it off by default.
  const browser = await playwright[engine].launch(engine === 'chromium' ? { channel: 'chromium', ignoreDefaultArgs: ['--disable-back-forward-cache'] } : {});
  const context = await browser.newContext({ userAgent: iphone.userAgent, deviceScaleFactor: 3, isMobile: true, hasTouch: true, viewport: { width, height } });
  await context.addInitScript(probe, hideNavigationApi);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const label = `${engine} ${width}x${height}${hideNavigationApi ? ', no Navigation API' : ''}`;

  const response = await page.goto(`${BASE}/`);
  await page.waitForTimeout(700);
  if (/no-store/i.test(response?.headers()['cache-control'] ?? '')) fail(`${label}: the map's HTML is sent with Cache-Control: no-store`);
  const before = await page.evaluate(() => ({ restoration: history.scrollRestoration, height: document.documentElement.scrollHeight, hidden: window.__navigationNotHidden === true || (window.navigation === undefined) }));
  if (before.restoration !== 'auto') fail(`${label}: history.scrollRestoration is "${before.restoration}", not "auto"`);
  if (hideNavigationApi && !before.hidden) fail(`${label}: could not hide the Navigation API, so the fallback was not tested`);
  // every picture loaded: the page must be exactly as tall as it was before any had
  await page.evaluate(async () => {
    for (const img of document.images) img.loading = 'eager';
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  });
  const loaded = await page.evaluate(() => document.documentElement.scrollHeight);
  if (loaded !== before.height) fail(`${label}: the map was ${before.height}px tall and is ${loaded}px with its pictures loaded`);
  const missing = await page.evaluate(() => [...document.images].filter((img) => !img.getAttribute('width') || !img.getAttribute('height')).map((img) => img.className || img.src));
  if (missing.length) fail(`${label}: pictures without a fixed width and height: ${missing.join(', ')}`);

  for (const slug of worlds) {
    const where = `${label} ${slug}`;
    const row = { browser: engine, size: `${width}x${height}`, 'Navigation API': hideNavigationApi ? 'hidden' : 'as is', world: slug };

    let left = await open(page, slug);
    row['left at'] = left;
    await page.locator('[data-back]').tap();
    await onMap(page);
    row['back control'] = judge(`${where}, back control`, left, await state(page, slug));

    left = await open(page, slug);
    await page.goBack({ waitUntil: 'commit' });
    await onMap(page);
    row['browser Back'] = judge(`${where}, browser Back`, left, await state(page, slug));

    left = await open(page, slug);
    const next = await page.locator('.pager-foot [data-pager="next"]').getAttribute('href');
    await page.locator('.pager-foot [data-pager="next"]').tap();
    await page.waitForURL(`**${next}`);
    await page.waitForLoadState('load');
    await page.waitForTimeout(300);
    await page.locator('[data-back]').tap();
    await onMap(page);
    const fresh = await state(page, slug);
    if (fresh.fromCache) fail(`${where}, back control after Next: expected a fresh load of the map`);
    row['after Next (fresh load)'] = judge(`${where}, back control after Next`, left, fresh);
    rows.push(row);
  }

  // Back from the profile, and the first-visit intro must not play again on any return
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(400);
  const about = page.locator('.world-about .world-link');
  await about.tap();
  await page.waitForURL('**/profile/');
  await page.waitForLoadState('load');
  await page.locator('[data-back]').tap();
  await onMap(page);
  const settled = await page.evaluate(() => document.documentElement.classList.contains('map-settled') || window.__fromCache === true);
  if (!settled) fail(`${label}: the map played its first-visit intro again on return from the profile`);

  const handlers = await page.evaluate(() => window.__unloadHandlers);
  if (handlers.length) fail(`${label}: the map registers ${handlers.join(', ')} handlers, which keep it out of the back/forward cache`);
  for (const e of errors) fail(`${label}: page error ${e}`);
  await context.close();
  await browser.close();
}

for (const engine of ['webkit', 'chromium']) {
  for (const phone of PHONES) await run(engine, phone);
  // the back control's fallback, on the worlds lowest and highest on the page
  await run(engine, PHONES[0], { hideNavigationApi: true, worlds: ['cubic', 'nutrifit', 'unify'] });
}

console.table(rows);
for (const f of failures) console.log(`FAIL ${f}`);
const cached = rows.filter((r) => /cached/.test(`${r['back control']}${r['browser Back']}`)).length;
console.log(failures.length === 0 ? `ok   the map comes back within ${TOLERANCE}px of where it was left, in its first frame, on ${rows.length} world/size/browser combinations and three ways back (${cached} of them served from the back/forward cache at least once)` : `FAIL ${failures.length} problems`);
if (failures.length) process.exitCode = 1;
