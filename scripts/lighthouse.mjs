// Runs Lighthouse (mobile and desktop) on a few pages and prints a summary table.
//   node scripts/lighthouse.mjs <label> [baseUrl] [paths...]
// Reports are written to redesign/lighthouse/<label>/ (git-ignored).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [label = 'run', base = 'https://redesign.luistanafranca.pages.dev', ...rest] = process.argv.slice(2);
const paths = rest.length ? rest : ['/', '/projects/unify/', '/profile/'];
const outDir = path.join('redesign', 'lighthouse', label);
mkdirSync(outDir, { recursive: true });

const rows = [];
for (const page of paths) {
  for (const form of ['mobile', 'desktop']) {
    const file = path.join(outDir, `${page.replace(/\W+/g, '_') || '_'}${form}.json`);
    const args = [base + page, '--quiet', '--chrome-flags=--headless=new', '--output=json', `--output-path=${file}`];
    if (form === 'desktop') args.push('--preset=desktop');
    try {
      execFileSync('npx', ['lighthouse', ...args], { stdio: ['ignore', 'ignore', 'inherit'], timeout: 180_000 });
    } catch (error) {
      console.error(`lighthouse failed for ${page} (${form}): ${error.message}`);
      continue;
    }
    const lhr = JSON.parse(readFileSync(file, 'utf8'));
    const score = (id) => Math.round((lhr.categories[id]?.score ?? 0) * 100);
    const num = (id) => lhr.audits[id]?.numericValue ?? 0;
    const failed = Object.values(lhr.categories)
      .flatMap((c) => c.auditRefs.filter((r) => r.weight > 0 || c.id !== 'performance').map((r) => lhr.audits[r.id]))
      .filter((a) => a && a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable' && a.scoreDisplayMode !== 'manual')
      .map((a) => a.id);
    rows.push({
      page,
      form,
      perf: score('performance'),
      a11y: score('accessibility'),
      best: score('best-practices'),
      seo: score('seo'),
      lcp: `${(num('largest-contentful-paint') / 1000).toFixed(2)}s`,
      cls: num('cumulative-layout-shift').toFixed(3),
      tbt: `${Math.round(num('total-blocking-time'))}ms`,
      kb: Math.round(num('total-byte-weight') / 1024),
      requests: lhr.audits['network-requests']?.details?.items?.length ?? 0,
      lcpEl: lhr.audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.selector ?? lhr.audits['lcp-breakdown-insight']?.details?.items?.find((i) => i.type === 'node')?.selector ?? '',
      failed: [...new Set(failed)].join(', '),
    });
  }
}
writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(rows, null, 2));
console.table(rows, ['page', 'form', 'perf', 'a11y', 'best', 'seo', 'lcp', 'cls', 'tbt', 'kb', 'requests']);
for (const r of rows) console.log(`${r.page} ${r.form}\n  LCP element: ${r.lcpEl}\n  below 90: ${r.failed || 'none'}`);
