# Build log

Preview (always the latest deploy of the `redesign` branch): https://redesign.luistanafranca.pages.dev

Deploys go through `npm run deploy` (`scripts/deploy.sh`) only. It aborts unless `wrangler whoami`
shows exactly one account and it is `3a459a47f63c6f049c3217b090c824dd`.

## Session 1: setup, palette, fonts, map home (2026-10-06)

### Built
- Astro 7 (TypeScript strict, static output) at the repo root on the `redesign` branch. The old
  static site is removed on this branch only; `main` and GitHub Pages are untouched.
- `redesign/content.json` is read directly by the site (`src/lib/content.ts`), and images come
  straight from `redesign/assets/`, so there is one copy of every fact and file.
- Palette as CSS custom properties, Jost self-hosted (one variable latin file, preloaded).
- Map home, desktop: the 1440 x 900 composition as one stage that scales with the window, route
  draw-in, comet, worlds arriving in order, spinning ring frames, Lens loupe, four small worlds.
- Map home, phone and tablet (below 1200px): the stacked layout from `Mobile.html`.
- Live Cubic cube: `mat.ts`, `spin.ts` and the first 145 lines of `raster.ts` ported to
  `src/scripts/cube/`. 48000 ms per turn, 15 fps, pauses off screen, one still frame under
  reduced motion or without JavaScript. Face textures were baked once to
  `src/assets/cube-faces.png` by a throwaway script that only read `~/Cubic`.
- Known fixes: route bent away from the Unify and Lens text (checked by script: no text within
  14px of the line), soft dark glow behind every text block, the dotted orbit moved off the
  Amenity Recommender label, other-projects row at 120px rings, 24px gaps, 14px names, 12px tags,
  20px lower.
- Cloudflare: `luistanafranca` Pages project on the personal account, deployed from the guarded
  script. `/resume.pdf` serves `redesign/assets/resume.pdf`.

### Judgment calls and things I was unsure about
1. **Account pin.** Cloudflare Pages rejects `account_id` in a Pages config file. `wrangler.toml`
   keeps `account_id` (it pins every other wrangler command in this folder) but has no
   `pages_build_output_dir`, so Pages ignores the file and prints a warning on each deploy. The
   deploy script enforces the same ID through `CLOUDFLARE_ACCOUNT_ID` plus the `whoami` check.
2. **Classic Pages.** wrangler 4.148 tried to create the project as a Worker and failed. The
   script creates it with `--force`, which keeps it a classic Pages project with `.pages.dev`
   URLs. This was a one-time step.
3. **Scale range.** The stage scales from 0.83x to 1.25x and the phone layout starts below
   1200px (you approved "about 0.85x" and "about 1100px"; 0.83 at 1200 keeps the two consistent).
   The scale also follows window height so the three main worlds stay above the fold. Checked
   at 1366 x 650, 1440 x 900 and 1920 x 1080.
4. **When the stage is narrower than the window** (short or very wide windows) it is centred and
   the sky, orbit lines and route continue past its edges. The header sits inside the stage, so
   it moves in with it.
5. **Dotted orbit.** The big dotted circle that crossed the Amenity label is now an arc that
   comes in from the top right, passes between the other-projects row and Cubic, and ends at a
   small node marker. A full circle there would have crossed "SELECT A DESTINATION".
6. **Other orbit lines still pass behind text** (they do in the mockup too). The dark glow
   behind each text block dims them so they do not cut through letters. Tell me if the glow is
   too strong or too boxy.
7. **Unify phone blurb.** The mockup's phone blurb had no "web lead". I wrote: "Settlement app
   for newcomers to Canada. I'm the web lead: web platform, database, landing page."
8. **Arrival animation.** The mockup fades worlds in with a blur. Blur is not transform or
   opacity, so worlds fade and rise 10px instead.
9. **Loupe.** The mockup animates `background-position`. It now moves a magnified copy of the
   screenshot with transforms; it looks the same.
10. **Whole world is clickable**, but the link itself is the heading, so screen readers hear
    "Unify Social" and not the whole card. Keyboard order: GitHub, LinkedIn, Resume, Contact,
    About, Unify, Cubic, Lens, then the four other projects.
11. **Contact button** is a `mailto:` link until the contact panel lands in Session 3.
12. **Phone sky** is a narrow crop of the same star field (13 to 15 KB) so stars keep their size
    on a tall page.
13. **`redesign/assets/cubic-spin48.webp`** is git-ignored as asked, so `Main.html` and
    `DetailCubic.html` will show a missing image on a fresh clone.
