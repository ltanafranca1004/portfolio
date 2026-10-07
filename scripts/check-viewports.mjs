// Checks the one-screen rule on wide windows: every page is a single composition that fits
// the window, with nothing cut off and nothing to scroll.
//   node scripts/check-viewports.mjs
// At each size, on the map, all seven project pages and every tab of the profile:
// - the page does not scroll, down or sideways;
// - every piece of text, image, link and button is fully inside the window;
// - the stage is centred and scaled by min(width / 1440, height / 900), kept within 0.75 to 1.25.
// Below 675px of height the scale stops at 0.75 and the page may scroll down (checked last).
import { BASE, playwright, settle } from './browsers.mjs';

const SIZES = [
  [1280, 720],
  [1366, 768],
  [1440, 790],
  [1512, 860],
  [1728, 1000],
  [1920, 960],
];
const PAGES = ['/', '/projects/unify/', '/projects/cubic/', '/projects/lens/', '/projects/turtle-trips/', '/projects/amenity-recommender/', '/projects/pipeline-simulator/', '/projects/nutrifit/', '/profile/', '/profile/#experience', '/profile/#skills', '/profile/#education'];

const inspect = (page) =>
  page.evaluate(() => {
    const W = innerWidth;
    const H = innerHeight;
    const out = [];
    const outside = (r) => r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1;
    const shown = (el) => el.checkVisibility({ visibilityProperty: true, opacityProperty: true });
    const say = (what, r) => out.push(`${what} at ${Math.round(r.left)},${Math.round(r.top)} to ${Math.round(r.right)},${Math.round(r.bottom)}`);
    // decoration that is meant to run past the window: the sky, the orbit lines, the route
    const DECOR = '.sky, .orbits, .routewrap, svg[data-keepout], dialog, .sr-only, script, style';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const el = node.parentElement;
      if (!node.data.trim() || !el || el.closest(DECOR) || !shown(el)) continue;
      range.selectNodeContents(node);
      const rects = el instanceof SVGElement ? [el.getBoundingClientRect()] : [...range.getClientRects()];
      for (const r of rects) if (r.width > 0 && outside(r)) say(`text "${node.data.trim().slice(0, 24)}"`, r);
    }
    for (const el of document.querySelectorAll('img, canvas, a[href], button, svg[role="img"], .ring, .hero')) {
      if (el.closest(DECOR) || !shown(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && outside(r)) say(`<${el.tagName.toLowerCase()} class="${el.getAttribute('class') ?? ''}">`, r);
    }
    const stage = document.querySelector('.stage')?.getBoundingClientRect();
    return {
      scrollY: document.documentElement.scrollHeight - H,
      scrollX: document.documentElement.scrollWidth - W,
      scale: stage ? stage.width / 1440 : null,
      offCentre: stage ? Math.abs((stage.left + stage.right) / 2 - W / 2) : null,
      clipped: [...new Set(out)],
    };
  });

const browser = await playwright.chromium.launch();
const rows = [];
const problems = [];
for (const [width, height] of SIZES) {
  const page = await browser.newPage({ viewport: { width, height } });
  const want = Math.min(1.25, Math.max(0.75, Math.min(width / 1440, height / 900)));
  for (const url of PAGES) {
    await page.goto(BASE + url);
    await settle(page, url === '/' ? 2600 : 500);
    const r = await inspect(page);
    const where = `${width}x${height} ${url}`;
    if (r.scrollY > 0) problems.push(`${where}: scrolls down by ${r.scrollY}px`);
    if (r.scrollX > 0) problems.push(`${where}: scrolls sideways by ${r.scrollX}px`);
    if (r.scale === null) problems.push(`${where}: no stage`);
    else {
      if (Math.abs(r.scale - want) > 0.004) problems.push(`${where}: stage is scaled ${r.scale.toFixed(3)}, expected ${want.toFixed(3)}`);
      if (r.offCentre > 1) problems.push(`${where}: stage is ${r.offCentre.toFixed(0)}px off centre`);
    }
    for (const c of r.clipped.slice(0, 5)) problems.push(`${where}: cut off: ${c}`);
    rows.push({ size: `${width}x${height}`, page: url, scale: r.scale?.toFixed(3), scrolls: r.scrollY > 0 || r.scrollX > 0 ? 'YES' : 'no', 'cut off': r.clipped.length });
  }
  await page.close();
}

// a window too short for 0.75x: the stage stays at 0.75 and the page scrolls down, never sideways
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 600 } });
  for (const url of ['/', '/projects/unify/', '/profile/']) {
    await page.goto(BASE + url);
    await settle(page, 500);
    const r = await inspect(page);
    const ok = r.scale !== null && Math.abs(r.scale - 0.75) < 0.004 && r.scrollY > 0 && r.scrollX <= 0;
    if (!ok) problems.push(`1280x600 ${url}: expected 0.75x and a page that scrolls down only (scale ${r.scale?.toFixed(3)}, down ${r.scrollY}, sideways ${r.scrollX})`);
    rows.push({ size: '1280x600', page: url, scale: r.scale?.toFixed(3), scrolls: r.scrollY > 0 ? 'down (expected)' : 'no', 'cut off': '' });
  }
  await page.close();
}
await browser.close();

console.table(rows);
for (const p of problems) console.log(`FAIL ${p}`);
console.log(problems.length === 0 ? `ok   ${rows.length} page/size combinations fit one screen with nothing cut off` : `FAIL ${problems.length} problems`);
if (problems.length) process.exitCode = 1;
