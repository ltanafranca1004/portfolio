// Pauses the CSS animations of anything that is off screen: floating rings, the Lens loupe,
// the pipeline tokens. A paused animation costs nothing; a running one keeps the phone's
// compositor busy for something nobody can see. (The cube pauses itself, in cube/mount.ts.)

const watch = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) entry.target.classList.toggle('is-offscreen', !entry.isIntersecting);
  },
  { rootMargin: '80px' },
);

for (const el of document.querySelectorAll('.ring, .hero')) watch.observe(el);
