// The screenshots for the Session 6 review.
//   node scripts/session6-shots.mjs
// Output in redesign/screenshots/session6/ (git-ignored):
//   iphone-map.png, iphone-unify-direct.png, iphone-unify-tapped.png   WebKit, iPhone emulation
//   1512x860-*.png and 1280x720-*.png   the map, Pipeline Simulator and each profile tab
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { BASE, playwright, settle } from './browsers.mjs';

const OUT = path.join('redesign', 'screenshots', 'session6');
mkdirSync(OUT, { recursive: true });
const out = (name) => path.join(OUT, `${name}.png`);

// ---- iPhone emulation (WebKit, 390x844, touch, mobile user agent) ----
{
  const browser = await playwright.webkit.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: playwright.devices['iPhone 14'].userAgent });
  const page = await context.newPage();
  await page.goto(`${BASE}/`);
  await settle(page, 1200);
  await page.screenshot({ path: out('iphone-map') });
  await page.goto(`${BASE}/projects/unify/`);
  await settle(page, 800);
  await page.screenshot({ path: out('iphone-unify-direct') });
  await page.goto(`${BASE}/`);
  await settle(page, 800);
  const ring = page.locator('.world-unify .ring'); // the picture, not the title
  await ring.evaluate((el) => el.scrollIntoView({ block: 'center' })); // it floats, so Playwright's own scroll never sees it hold still
  await page.waitForTimeout(300);
  const box = await ring.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForURL('**/projects/unify/');
  await settle(page, 1200);
  await page.screenshot({ path: out('iphone-unify-tapped') });
  await browser.close();
}

// ---- desktop, at the size of a 14-inch MacBook window and at 1280x720 ----
{
  const browser = await playwright.chromium.launch();
  for (const [width, height] of [
    [1512, 860],
    [1280, 720],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    for (const [name, url] of [
      ['map', '/'],
      ['pipeline', '/projects/pipeline-simulator/'],
      ['profile', '/profile/'],
      ['profile-experience', '/profile/#experience'],
      ['profile-skills', '/profile/#skills'],
      ['profile-education', '/profile/#education'],
    ]) {
      await page.goto(BASE + url);
      await settle(page, name === 'map' ? 2800 : 1900);
      await page.screenshot({ path: out(`${width}x${height}-${name}`) });
    }
    await page.close();
  }
  await browser.close();
}
console.log(`wrote ${OUT}`);
