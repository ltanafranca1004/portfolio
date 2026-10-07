// Contact sheets of recorded frames, to see exactly what a transition showed.
//   node scripts/measure/sheet.mjs --frames=<dir with frames.json> --out=<dir> [--width=360 --cols=8]
// frames.json is { frames: [{ file, t }], windows: [{ step, from, to }] } (t in ms). One sheet
// per step: every frame from just before the picture starts to change until it stops, each
// labelled with its number and how long the frame before it stayed on screen. Frames that
// stayed longer than 33ms are labelled in red.
// A screen recording is turned into frames.json first with --video=<file.mov> (ffmpeg).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const WIDTH = Number(args.width ?? 360);
const COLS = Number(args.cols ?? 8);
const MAX = Number(args.max ?? 64);

/** Split a video into frames.json (every frame, with its time). `crop` is ffmpeg's w:h:x:y. */
export function explode(video, dir, { crop, fps } = {}) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const filters = [crop ? `crop=${crop}` : null, 'scale=1280:-2'].filter(Boolean).join(',');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-vf', filters, ...(fps ? ['-r', String(fps)] : ['-fps_mode', 'passthrough']), '-q:v', '3', path.join(dir, '%05d.jpg')]);
  const times = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'csv=p=0', video], { maxBuffer: 1 << 28 })
    .toString()
    .trim()
    .split('\n')
    .map((t) => Number(t.replace(',', '')) * 1000);
  const files = readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort();
  const frames = files.map((f, i) => ({ file: path.join(dir, f), t: fps ? (i * 1000) / fps : times[i] ?? i * 16.667 }));
  writeFileSync(path.join(dir, 'frames.json'), JSON.stringify({ frames, windows: [] }));
  return frames;
}

const tiny = (file) => sharp(file).resize(96, 54, { fit: 'fill' }).greyscale().raw().toBuffer();
export async function difference(a, b) {
  const [x, y] = await Promise.all([tiny(a), tiny(b)]);
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += Math.abs(x[i] - y[i]);
  return sum / x.length;
}

export async function sheet(frames, file, title) {
  const picked = frames.slice(0, MAX);
  const first = await sharp(picked[0].file).metadata();
  const h = Math.round((WIDTH * first.height) / first.width);
  const rows = Math.ceil(picked.length / COLS);
  const tiles = [];
  for (const [i, f] of picked.entries()) {
    const held = f.held ?? 0;
    const label = `<svg width="${WIDTH}" height="22"><rect width="100%" height="100%" fill="#000"/><text x="6" y="16" font-family="Menlo" font-size="13" fill="${held > 34 ? '#ff5a5a' : '#ddd'}">#${f.index} +${Math.round(f.t - picked[0].t)}ms${held ? ` (held ${Math.round(held)}ms)` : ''}</text></svg>`;
    const left = (i % COLS) * (WIDTH + 4);
    const top = 26 + Math.floor(i / COLS) * (h + 26);
    tiles.push({ input: await sharp(f.file).resize(WIDTH, h, { fit: 'fill' }).toBuffer(), left, top: top + 22 }, { input: Buffer.from(label), left, top });
  }
  const head = `<svg width="${COLS * (WIDTH + 4)}" height="24"><text x="6" y="17" font-family="Menlo" font-size="14" fill="#fff">${title}</text></svg>`;
  await sharp({ create: { width: COLS * (WIDTH + 4), height: 26 + rows * (h + 26), channels: 3, background: '#181818' } })
    .composite([{ input: Buffer.from(head), left: 0, top: 0 }, ...tiles])
    .png()
    .toFile(file);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const dir = args.frames;
  if (args.video) explode(args.video, dir, { crop: args.crop, fps: args.fps ? Number(args.fps) : undefined });
  const { frames, windows } = JSON.parse(readFileSync(path.join(dir, 'frames.json'), 'utf8'));
  frames.forEach((f, i) => {
    f.index = i;
    f.held = frames[i + 1] ? frames[i + 1].t - f.t : 0;
  });
  const out = args.out ?? dir;
  mkdirSync(out, { recursive: true });
  const ranges = args.range ? [{ step: args.name ?? 'range', i0: Number(args.range.split('-')[0]), i1: Number(args.range.split('-')[1]) }] : windows.map((w) => ({ step: w.step, i0: frames.findIndex((f) => f.t >= w.from), i1: frames.findLastIndex((f) => f.t <= w.to) }));
  for (const r of ranges) {
    if (r.i0 < 0 || r.i1 <= r.i0) continue;
    if (!args.range && !args.whole) {
      // start three frames before the picture first changes
      let start = r.i0;
      for (let i = r.i0 + 1; i <= r.i1; i++) {
        if ((await difference(frames[r.i0].file, frames[i].file)) > 0.6) {
          start = Math.max(r.i0, i - 3);
          break;
        }
      }
      r.i0 = start;
    }
    const file = path.join(out, `${args.prefix ?? 'sheet'}-${r.step.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`);
    await sheet(frames.slice(r.i0, r.i1 + 1), file, `${args.prefix ?? ''} ${r.step}: frames ${r.i0} to ${r.i1}`);
    console.log(`wrote ${file}`);
  }
}
