// Checks that every world on the map is one link, and that its picture is part of it.
//   node scripts/check-worlds.mjs
// On each layout (desktop, tablet, phone), in Chromium and WebKit:
// - clicking or tapping the middle and the edges of a world's ring (the planet, the
//   screenshot, the cube, the photo in About me) opens the same page as its title;
// - each world holds exactly one link, and the link's name is the title;
// - the cube keeps animating under the link.
import { BASE, playwright } from './browsers.mjs';

const SIZES = [
  [1440, 900],
  [768, 1024],
  [390, 844],
];
const WORLDS = [
  { id: 'about', url: '/profile/', name: 'About me' },
  { id: 'unify', url: '/projects/unify/', name: 'Unify Social' },
  { id: 'cubic', url: '/projects/cubic/', name: 'Cubic' },
  { id: 'lens', url: '/projects/lens/', name: 'Lens' },
];
const MINIS = ['turtle-trips', 'amenity-recommender', 'pipeline-simulator', 'nutrifit'];
// the middle of the ring, and just inside its edge on each side
const SPOTS = [
  [0.5, 0.5],
  [0.5, 0.06],
  [0.5, 0.94],
  [0.06, 0.5],
  [0.94, 0.5],
];

let failed = false;
const report = (ok, text) => {
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`);
};

for (const engine of ['chromium', 'webkit']) {
  const browser = await playwright[engine].launch();
  for (const [width, height] of SIZES) {
    const touch = width < 1200;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch && engine !== 'firefox', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const where = `${engine} ${width}x${height}`;
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(600);

    // one link per world, named by its title
    const links = await page.evaluate(() =>
      [...document.querySelectorAll('.world, .mini')].map((el) => ({
        links: el.querySelectorAll('a[href]').length,
        name: el.querySelector('a[href]')?.innerText.replace(/\s+/g, ' ').trim(),
        heading: el.querySelector('h2, h3')?.innerText.replace(/\s+/g, ' ').trim(),
      })),
    );
    report(links.length === 8 && links.every((l) => l.links === 1 && l.name === l.heading), `${where}: ${links.length} worlds, each one link named by its title (${links.map((l) => l.name).join(', ')})`);

    // what a click or tap at each spot of each ring would hit
    const targets = [...WORLDS.map((w) => ({ ...w, ring: `.world-${w.id} .ring` })), ...MINIS.map((slug) => ({ id: slug, url: `/projects/${slug}/`, ring: `.mini:has(.mini-link[data-slug="${slug}"]) .ring` }))];
    const missed = [];
    let rings = 0;
    for (const target of targets) {
      const ring = page.locator(target.ring);
      if (!(await ring.isVisible())) continue; // phones show the other projects as a list, with no rings
      rings++;
      await ring.scrollIntoViewIfNeeded();
      for (const [fx, fy] of SPOTS) {
        const hit = await ring.evaluate(
          (el, [fx, fy]) => {
            const r = el.getBoundingClientRect();
            const at = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
            return at?.closest('a[href]')?.getAttribute('href') ?? `<${at?.tagName.toLowerCase()} class="${at?.className}">`;
          },
          [fx, fy],
        );
        if (hit !== target.url) missed.push(`${target.id} at ${fx},${fy} hits ${hit}`);
      }
    }
    report(missed.length === 0, `${where}: every part of ${rings} rings belongs to its link${missed.length ? ` (${missed.slice(0, 4).join('; ')})` : ''}`);

    // and really follow two of them: the photo in About me and the cube
    for (const id of ['about', 'cubic']) {
      const target = targets.find((t) => t.id === id);
      await page.goto(`${BASE}/`);
      await page.waitForTimeout(400);
      const ring = page.locator(target.ring);
      await ring.scrollIntoViewIfNeeded();
      const box = await ring.boundingBox();
      if (touch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      const arrived = await page.waitForURL(`**${target.url}`, { timeout: 4000 }).then(
        () => true,
        () => false,
      );
      report(arrived, `${where}: ${touch ? 'tapping' : 'clicking'} the ${id === 'about' ? 'photo' : 'cube'} opens ${target.url}`);
    }
    await context.close();
  }

  // the cube still animates under the link (motion allowed this time)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2500);
  const moving = await page.evaluate(async () => {
    const canvas = document.querySelector('.world-cubic canvas[data-cube]');
    const before = canvas.toDataURL();
    await new Promise((done) => setTimeout(done, 500));
    return before !== canvas.toDataURL();
  });
  report(moving, `${engine}: the cube on the map is still animating`);
  await browser.close();
}
if (failed) process.exitCode = 1;
