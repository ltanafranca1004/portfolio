// Reads a 60 frames-a-second screen recording and reports, for each page transition in it:
// how long the picture was changing, the longest time the screen stood still inside that
// stretch (a dropped or held frame), and whether the page blinked (a frame much darker, or
// with much less on it, than the frames around the transition).
//   node scripts/measure/screen-frames.mjs <video.mov> [--crop=w:h:x:y] [--sheets=<dir>]
// Anything else that moves on screen (the pointer, another window) counts as a change too, so
// read the sheets, not only the table.
// The crop should cover the page only (no menu bar clock, no Dock). Default: 2940:1420:0:270.
import { mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { explode, sheet } from './sheet.mjs';

const [video, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(rest.map((a) => a.replace(/^--/, '').split('=')));
const dir = path.join(os.tmpdir(), `screen-frames-${path.basename(video, '.mov')}`);
const frames = explode(video, dir, { crop: args.crop ?? '2940:1420:0:270' });

const look = async (file) => {
  const { data } = await sharp(file).resize(240, 116, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  let lit = 0;
  for (const v of data) {
    sum += v;
    if (v > 110) lit++;
  }
  return { data, mean: sum / data.length, lit: lit / data.length };
};
const seen = [];
for (const f of frames) seen.push(await look(f.file));
const change = seen.map((s, i) => {
  if (!i) return 0;
  let d = 0;
  for (let k = 0; k < s.data.length; k++) d += Math.abs(s.data[k] - seen[i - 1].data[k]);
  return d / s.data.length;
});

// a transition: a run of frames that change a lot, allowing short stalls inside it
const bursts = [];
let run = null;
for (let i = 1; i < frames.length; i++) {
  if (change[i] > 0.8) {
    run ??= { from: i };
    run.to = i;
  } else if (run && frames[i].t - frames[run.to].t > 250) {
    bursts.push(run);
    run = null;
  }
}
if (run) bursts.push(run);

const rows = [];
for (const [n, b] of bursts.entries()) {
  // the longest stretch inside the transition where nothing on screen changed
  let held = 0;
  let start = b.from;
  for (let i = b.from + 1; i <= b.to; i++) {
    if (change[i] > 0.02) {
      held = Math.max(held, frames[i].t - frames[start].t);
      start = i;
    }
  }
  const before = seen[Math.max(0, b.from - 3)];
  const after = seen[Math.min(seen.length - 1, b.to + 12)];
  const inside = seen.slice(b.from, b.to + 1);
  const floor = { mean: Math.min(before.mean, after.mean), lit: Math.min(before.lit, after.lit) };
  const dark = inside.filter((s) => s.mean < floor.mean * 0.7 || s.lit < floor.lit * 0.4).length;
  rows.push({
    transition: n + 1,
    'at (s)': (frames[b.from].t / 1000).toFixed(1),
    'changing for (ms)': Math.round(frames[b.to].t - frames[b.from].t),
    frames: b.to - b.from + 1,
    'longest still (ms)': Math.round(held),
    'frames blinked dark or empty': dark,
    'dimmest frame vs pages': `${Math.round((Math.min(...inside.map((s) => s.mean)) / floor.mean) * 100)}%`,
  });
  if (args.sheets) {
    mkdirSync(args.sheets, { recursive: true });
    const picked = frames.slice(Math.max(0, b.from - 3), b.to + 6).map((f, k, all) => ({ ...f, index: frames.indexOf(f), held: all[k + 1] ? all[k + 1].t - f.t : 0 }));
    await sheet(picked, path.join(args.sheets, `${path.basename(video, '.mov')}-${String(n + 1).padStart(2, '0')}.png`), `${path.basename(video)} transition ${n + 1}`);
  }
}
console.log(`${path.basename(video)}: ${frames.length} frames, ${(frames.at(-1).t / 1000).toFixed(1)}s`);
console.table(rows);
rmSync(dir, { recursive: true, force: true });
