// Prints the numbers of one or more measurement files side by side.
//   node scripts/measure/report.mjs redesign/recordings/s5-chrome.json redesign/recordings/before-chrome.json
import { readFileSync } from 'node:fs';
import path from 'node:path';

const median = (list) => {
  const s = list.filter((v) => v !== null && v !== undefined).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const detail = process.argv.includes('--detail');
const runs = files.map((f) => ({ name: path.basename(f, '.json'), ...JSON.parse(readFileSync(f, 'utf8')) }));
const pad = (v, n = 9) => String(v ?? '-').padStart(n);

for (const run of runs) console.log(`${run.name}: ${run.browser ?? ''} ${run.window ? `${run.window.width}x${run.window.height} @${run.window.dpr}x` : ''}`);

if (runs.some((r) => r.passes.loads)) {
  console.log('\nCold loads (median of the runs, ms)');
  console.log(`${'page'.padEnd(20)}${'run'.padEnd(22)}${pad('1st paint')}${pad('FCP')}${pad('LCP')}${pad('imgs done', 11)}${pad('late imgs', 11)}${pad('changes', 9)}${pad('CLS', 8)}`);
  for (const url of Object.keys(runs.find((r) => r.passes.loads).passes.loads)) {
    for (const run of runs) {
      const rows = run.passes.loads?.[url];
      if (!rows) continue;
      const m = (key) => median(rows.map((r) => r[key]));
      console.log(`${url.padEnd(20)}${run.name.padEnd(22)}${pad(m('firstPaint') ?? m('firstContentfulPaint'))}${pad(m('firstContentfulPaint'))}${pad(m('lcp'))}${pad(m('firstScreenImagesDone'), 11)}${pad(median(rows.map((r) => r.imagesAfterFirstFrame.length)), 11)}${pad(median(rows.map((r) => r.unstable.length)), 9)}${pad(m('layoutShift'), 8)}`);
    }
  }
}

console.log('\nJourney (ms). "drawn" = frames the browser presented during the transition, "from click" = the longest frame between the click and its end; "main" = the page\'s own frame clock');
console.log(`${'step'.padEnd(26)}${'run'.padEnd(22)}${pad('click→1st', 10)}${pad('length', 8)}${pad('drawn', 7)}${pad('worst', 7)}${pad('>33ms', 7)}${pad('from click', 11)}${pad('main worst', 11)}${pad('>33', 5)}${pad('after worst', 12)}`);
const steps = runs.find((r) => r.passes.frames)?.passes.frames.map((f) => f.step) ?? [];
for (const [i, step] of steps.entries()) {
  for (const run of runs) {
    const f = run.passes.frames?.[i];
    if (!f) continue;
    const p = f.presented;
    console.log(`${step.padEnd(26)}${run.name.padEnd(22)}${pad(f.clickToFirstFrame, 10)}${pad(f.transition, 8)}${pad(p?.during.frames, 7)}${pad(p?.during.worst, 7)}${pad(p?.during.over33, 7)}${pad(p?.whole?.worst, 11)}${pad(f.mainThread?.worst, 11)}${pad(f.mainThread?.over33, 5)}${pad(p ? p.after.worst : f.mainThreadAfter?.worst, 12)}`);
    if (detail && (p?.duringGaps ?? f.mainThreadGaps)) console.log(`${''.padEnd(48)}gaps: ${(p?.duringGaps ?? f.mainThreadGaps).join(' ')}`);
  }
}

if (detail) {
  for (const run of runs) {
    console.log(`\n${run.name}: what changed after the first frame of each page (first screen only)`);
    for (const n of run.passes.numbers ?? []) {
      console.log(`  ${n.step} (${n.url}${n.restored ? ', from the back-forward cache' : ''}): first paint ${n.firstPaint ?? n.firstContentfulPaint ?? '-'}, images done ${n.firstScreenImagesDone ?? '-'}`);
      const groups = {};
      for (const u of n.unstable) (groups[`${u.prop}: ${u.first} → ${u.last}`] ||= []).push(`${u.el.replace(/^.* /, '')}@${u.from}${u.to !== u.from ? `-${u.to}` : ''}`);
      for (const [what, list] of Object.entries(groups)) console.log(`      ${what}  ×${list.length}  ${list.slice(0, 4).join(', ')}${list.length > 4 ? ', …' : ''}`);
    }
  }
}
