import { clearTarget, createTarget, drawCube, pack, FACES, type CubeFaces } from './raster';
import { SPIN_FPS, frameSize, spinView } from './spin';

// The live spinning cube from Cubic's menu, on a plain canvas. Same numbers as the game:
// one turn in 48 seconds, redrawn 15 times a second.

/** One full turn of the cube. */
const TURN_MS = 48_000;
const TURN_STEPS = Math.round((TURN_MS / 1000) * SPIN_FPS);
/** Half the cube's edge, in canvas pixels. */
const HALF = 72;
const SIZE = frameSize(HALF);
const INK = pack('#2e222f');

interface Live {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  image: ImageData;
  visible: boolean;
  step: number;
}

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const target = createTarget(SIZE, SIZE);
const lives: Live[] = [];
let faces: CubeFaces | null = null;
let loading: Promise<void> | null = null;
let clock = 0;
let last = 0;
let frame = 0;

/** The six face textures, cut from one strip (192px squares, faces 1 to 6 left to right). */
async function loadFaces(url: string): Promise<void> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const size = img.height;
  const sheet = document.createElement('canvas');
  sheet.width = img.width;
  sheet.height = size;
  const g = sheet.getContext('2d', { willReadFrequently: true });
  if (!g) return;
  g.drawImage(img, 0, 0);
  const out = {} as CubeFaces;
  for (const face of FACES) out[face] = { size, px: new Uint32Array(g.getImageData((face - 1) * size, 0, size, size).data.buffer) };
  faces = out;
}

function draw(live: Live, step: number): void {
  if (!faces || live.step === step) return;
  live.step = step;
  clearTarget(target);
  drawCube(target, faces, spinView(step / TURN_STEPS), { cx: SIZE / 2, cy: SIZE / 2, half: HALF, ink: INK });
  live.image.data.set(new Uint8ClampedArray(target.px.buffer));
  live.g.putImageData(live.image, 0, 0);
  live.canvas.parentElement?.classList.add('is-live');
}

function tick(now: number): void {
  frame = 0;
  // a hidden tab or a long pause must not make the cube jump
  clock += Math.min(100, now - last);
  last = now;
  const step = Math.floor(((clock % TURN_MS) / TURN_MS) * TURN_STEPS) % TURN_STEPS;
  for (const live of lives) if (live.visible) draw(live, step);
  // Keep going from this frame's own time. (Restarting the clock here, as schedule() does,
  // dropped the time spent inside each frame: on a busy phone the cube ran slow and uneven.)
  if (lives.some((l) => l.visible) && !reduced.matches) frame = requestAnimationFrame(tick);
}

function schedule(): void {
  if (frame || !faces) return;
  const anyVisible = lives.some((l) => l.visible);
  if (!anyVisible) return;
  if (reduced.matches) {
    // reduced motion: one still frame, the start of the turn
    for (const live of lives) if (live.visible) draw(live, 0);
    return;
  }
  // starting, or starting again after a pause: time counts from the next frame
  frame = requestAnimationFrame((now) => {
    last = now;
    tick(now);
  });
}

function start(url: string): void {
  loading ??= loadFaces(url).then(schedule, () => undefined);
}

const seen = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const live = lives.find((l) => l.canvas === entry.target);
      if (!live) continue;
      live.visible = entry.isIntersecting;
      if (live.visible) start(live.canvas.dataset.atlas ?? '');
    }
    schedule();
  },
  { rootMargin: '200px' },
);

for (const canvas of document.querySelectorAll<HTMLCanvasElement>('canvas[data-cube]')) {
  canvas.width = canvas.height = SIZE;
  const g = canvas.getContext('2d');
  if (!g) continue;
  lives.push({ canvas, g, image: g.createImageData(SIZE, SIZE), visible: false, step: -1 });
  seen.observe(canvas);
}

// Fetch and cut the face textures once the page has loaded and the browser is idle, so that
// work never lands in the middle of a scroll as a cube comes into view.
const first = lives[0]?.canvas.dataset.atlas;
if (first) {
  const warm = (): void => {
    const idle = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 600));
    idle(() => start(first));
  };
  if (document.readyState === 'complete') warm();
  else window.addEventListener('load', warm, { once: true });
}

reduced.addEventListener('change', () => {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  schedule();
});
