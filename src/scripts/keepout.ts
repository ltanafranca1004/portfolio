// Keeps the decorative orbit lines and node markers away from text.
//
// Every svg[data-keepout] gets a mask with a hole over each line of text on the page,
// 14px larger than the text on every side and stepped down in strength beyond that, so a
// line fades out before it reaches a word instead of passing behind it. The holes are
// measured from the real layout, so this holds at any window size.
//
// It runs when the page loads and when the layout changes, never while scrolling. On a phone
// the browser's toolbar hides and shows as you scroll, which changes the window height and
// fires "resize" each time; the stacked layouts only depend on the width, so those are ignored.

const PAD = 14; // px kept completely clear around text
// The soft edge beyond that: rings of rising brightness, drawn as plain shapes. (A blur
// filter inside the mask looked the same and cost a slow repaint on phones.)
const EDGE = [
  { grow: PAD + 11, fill: '#aaa' },
  { grow: PAD + 7, fill: '#555' },
  { grow: PAD + 3, fill: '#000' },
];
const STAGE_FROM = 1200; // px: from this width the page is one scaled stage (see global.css)
const NS = 'http://www.w3.org/2000/svg';
let version = 0;

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The nearest pinned (position: sticky) ancestor, if any. */
function pinned(el: Element): Element | null {
  for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
    if (getComputedStyle(node).position === 'sticky') return node;
  }
  return null;
}

/** One box per line of visible text, in viewport coordinates. */
function textBoxes(): Box[] {
  const boxes: Box[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const el = node.parentElement;
    if (!el || !node.data.trim()) continue;
    if (el.closest('svg[data-keepout], script, style, noscript, dialog, .sr-only')) continue;
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue; // hidden: needs no hole
    const sticky = pinned(el);
    // pinned text travels down the page as it scrolls: clear its whole path
    const floor = sticky?.parentElement ? sticky.parentElement.getBoundingClientRect().bottom : null;
    // Text inside an SVG: take the element's own box. A Range there can answer with the
    // scale the drawing had when it was first laid out (seen in Chromium, on the pipeline
    // hero, after its scale was set), which put the hole in the wrong place.
    let rects: Iterable<DOMRect>;
    if (el instanceof SVGElement) rects = [el.getBoundingClientRect()];
    else {
      range.selectNodeContents(node);
      rects = range.getClientRects();
    }
    for (const r of rects) {
      if (r.width < 1 || r.height < 1) continue;
      boxes.push({ left: r.left, top: r.top, right: r.right, bottom: floor === null ? r.bottom : Math.max(r.bottom, floor) });
    }
  }
  return boxes;
}

function apply(svg: SVGSVGElement, index: number, boxes: Box[]): void {
  const lines = svg.querySelector<SVGGElement>('.orbit-lines');
  const ctm = svg.getScreenCTM();
  if (!lines || !ctm) return;
  const toSvg = ctm.inverse();
  const scale = Math.abs(toSvg.a); // svg units per screen px

  const view = svg.getBoundingClientRect();
  const near: { x: number; y: number; w: number; h: number }[] = [];
  for (const b of boxes) {
    // skip text nowhere near this drawing
    if (b.right < view.left - 600 || b.left > view.right + 600 || b.bottom < view.top - 600 || b.top > view.bottom + 600) continue;
    const p = new DOMPoint(b.left, b.top).matrixTransform(toSvg);
    const q = new DOMPoint(b.right, b.bottom).matrixTransform(toSvg);
    near.push({ x: p.x, y: p.y, w: q.x - p.x, h: q.y - p.y });
  }
  // every outer ring first, so one line's soft edge never lightens the hole of the next line
  let html = '';
  for (const { grow, fill } of EDGE) {
    const g = grow * scale;
    html += `<g fill="${fill}">`;
    for (const r of near) html += `<rect x="${(r.x - g).toFixed(1)}" y="${(r.y - g).toFixed(1)}" width="${(r.w + g * 2).toFixed(1)}" height="${(r.h + g * 2).toFixed(1)}" rx="${(8 * scale).toFixed(1)}"/>`;
    html += '</g>';
  }
  // A fresh mask under a new name each time. Changing the shapes inside the old one left
  // Chromium showing stale tiles: lines drawn through text until something else repainted.
  const id = `keepout-${index}-${++version}`;
  const defs = document.createElementNS(NS, 'defs');
  defs.setAttribute('data-keepout-mask', '');
  defs.innerHTML = `<mask id="${id}" maskUnits="userSpaceOnUse" x="-4000" y="-4000" width="12000" height="12000"><rect x="-4000" y="-4000" width="12000" height="12000" fill="#fff"/>${html}</mask>`;
  const old = svg.querySelector('defs[data-keepout-mask]');
  svg.prepend(defs);
  lines.setAttribute('mask', `url(#${id})`);
  old?.remove();
  svg.classList.add('is-ready');
}

function update(): void {
  const drawings = [...document.querySelectorAll<SVGSVGElement>('svg[data-keepout]')].filter((svg) => svg.getClientRects().length > 0);
  if (!drawings.length) return;
  const boxes = textBoxes();
  drawings.forEach((svg, i) => apply(svg, i, boxes));
}

let timer = 0;
const later = (): void => {
  window.clearTimeout(timer);
  timer = window.setTimeout(update, 150);
};
let width = window.innerWidth;
let height = window.innerHeight;
const resized = (): void => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // below the stage width only a change of width moves anything
  const changed = w !== width || (h !== height && w >= STAGE_FROM);
  width = w;
  height = h;
  if (changed) later();
};

update();
void document.fonts?.ready.then(update);
window.addEventListener('load', update);
window.addEventListener('resize', resized);
// A drawing that fills the page is rescaled when the page changes height (a font arriving
// can rewrap a paragraph), which moves its lines but not the text: measure again.
if ('ResizeObserver' in window) {
  const sized = new ResizeObserver(later);
  for (const svg of document.querySelectorAll('svg[data-keepout]')) sized.observe(svg);
}
document.fonts?.addEventListener?.('loadingdone', later);
// a page can ask for a fresh measurement after it changes what text is showing
document.addEventListener('keepout:update', update);
