// Keeps the decorative orbit lines and node markers away from text.
//
// Every svg[data-keepout] gets a mask with a hole over each line of text on the page,
// 14px larger than the text on every side and feathered beyond that, so a line fades out
// before it reaches a word instead of passing behind it. The holes are measured from the
// real layout, so this holds at any window size, and is redone when the layout changes.

const PAD = 14; // px kept completely clear around text
const FEATHER = 12; // px of soft edge beyond that
const NS = 'http://www.w3.org/2000/svg';

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
    const sticky = pinned(el);
    // pinned text travels down the page as it scrolls: clear its whole path
    const floor = sticky?.parentElement ? sticky.parentElement.getBoundingClientRect().bottom : null;
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
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
  const grow = (PAD + FEATHER) * scale;

  let mask = svg.querySelector<SVGMaskElement>('mask[data-keepout-mask]');
  if (!mask) {
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `<filter id="keepout-soft-${index}" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur/></filter><mask id="keepout-${index}" data-keepout-mask maskUnits="userSpaceOnUse" x="-4000" y="-4000" width="12000" height="12000"><rect x="-4000" y="-4000" width="12000" height="12000" fill="#fff"/><g fill="#000" filter="url(#keepout-soft-${index})"></g></mask>`;
    svg.prepend(defs);
    mask = svg.querySelector<SVGMaskElement>('mask[data-keepout-mask]');
    lines.setAttribute('mask', `url(#keepout-${index})`);
  }
  svg.querySelector('feGaussianBlur')?.setAttribute('stdDeviation', String((FEATHER / 2) * scale));
  const holes = mask?.querySelector('g');
  if (!holes) return;

  const view = svg.getBoundingClientRect();
  let html = '';
  for (const b of boxes) {
    // skip text nowhere near this drawing
    if (b.right < view.left - 600 || b.left > view.right + 600 || b.bottom < view.top - 600 || b.top > view.bottom + 600) continue;
    const p = new DOMPoint(b.left, b.top).matrixTransform(toSvg);
    const q = new DOMPoint(b.right, b.bottom).matrixTransform(toSvg);
    html += `<rect x="${(p.x - grow).toFixed(1)}" y="${(p.y - grow).toFixed(1)}" width="${(q.x - p.x + grow * 2).toFixed(1)}" height="${(q.y - p.y + grow * 2).toFixed(1)}" rx="${(10 * scale).toFixed(1)}"/>`;
  }
  holes.innerHTML = html;
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
  timer = window.setTimeout(update, 120);
};

update();
void document.fonts?.ready.then(update);
window.addEventListener('load', update);
window.addEventListener('resize', later);
