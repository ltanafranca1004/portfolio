// Checks what is on the first screen at real browser sizes.
//   node scripts/check-viewports.mjs
import { BASE, playwright, settle } from './browsers.mjs';

const SIZES = [
  [1280, 720],
  [1366, 768],
  [1440, 790],
  [1920, 960],
];
const PROJECTS = ['unify', 'cubic', 'lens', 'turtle-trips', 'amenity-recommender', 'pipeline-simulator', 'nutrifit'];

const browser = await playwright.chromium.launch();
const rows = [];
for (const [width, height] of SIZES) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${BASE}/`);
  await settle(page);
  const map = await page.evaluate(() => {
    const bottom = (sel) => Math.round(Math.max(...[...document.querySelectorAll(sel)].map((el) => el.getBoundingClientRect().bottom)));
    return { worlds: bottom('.world'), others: bottom('.others'), scroll: document.documentElement.scrollHeight, overflowX: document.documentElement.scrollWidth - innerWidth };
  });
  rows.push({ size: `${width}x${height}`, page: '/', 'worlds bottom': map.worlds, fits: map.worlds <= height, 'other projects bottom': map.others, 'page height': map.scroll, 'x overflow': map.overflowX });
  for (const slug of PROJECTS) {
    await page.goto(`${BASE}/projects/${slug}/`);
    await settle(page, 300);
    const p = await page.evaluate(() => {
      const bottom = (sel) => {
        const el = document.querySelector(sel);
        return el ? Math.round(el.getBoundingClientRect().bottom) : 0;
      };
      return { title: bottom('.title-row'), role: bottom('.facts'), awards: bottom('.awards'), primary: bottom('.primary'), scroll: document.documentElement.scrollHeight, overflowX: document.documentElement.scrollWidth - innerWidth };
    });
    const lowest = Math.max(p.title, p.role, p.awards);
    rows.push({ size: `${width}x${height}`, page: slug, 'worlds bottom': '', fits: lowest <= height, 'title/role/awards bottom': lowest, 'primary button bottom': p.primary, 'page height': p.scroll, 'x overflow': p.overflowX });
  }
  await page.close();
}
await browser.close();
console.table(rows);
if (rows.some((r) => !r.fits)) process.exitCode = 1;
