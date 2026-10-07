// Shared Playwright setup. Browsers live inside node_modules (PLAYWRIGHT_BROWSERS_PATH=0),
// so nothing is installed outside this repo:
//   PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium webkit firefox
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';
export const playwright = await import('playwright');
export const BASE = process.env.BASE_URL ?? 'http://localhost:4322';

/** Let the route draw, the worlds arrive and lazy images load. */
export async function settle(page, ms = 2600) {
  await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((img) => (img.loading = 'eager')));
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}
