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

## Session 2: project pages (2026-10-06)

Preview: https://redesign.luistanafranca.pages.dev/projects/unify/ (and `/cubic/`, `/lens/`,
`/turtle-trips/`, `/amenity-recommender/`, `/pipeline-simulator/`, `/nutrifit/`)

### Built
- One template, `src/pages/projects/[slug].astro`, for all seven pages. `src/lib/projects.ts`
  evens out the two shapes in `content.json` (destinations and other projects).
- Wide screens follow the mockups: hero in the spinning ring on the left, text column on the
  right, back link and actions along the bottom. The hero is drawn at the mockup's 520px and
  scaled to the space it has.
- Five hero kinds: flat image (Unify), live cube (Cubic), tilted Lens card with the loupe (Lens),
  tilted screenshot (Turtle Trips, Amenity, NutriFit), animated pipeline (Pipeline Simulator).
- Phone layout: header, label pill, hero, text, screenshots, primary button, back link.
- Copy comes from `content.json` everywhere: "web lead", "Software Engineer (Web Lead)",
  "500+ USERS", "EVIDENCE-CHECKED SCORES", NutriFit "4 people" and "Team of 4".
- "Back to the map" only, no previous or next. The Resume link works on every page.

### Judgment calls and things I was unsure about
1. **New `content.json` fields.** Besides `highlights` and `heroAlt` (approved), I added
   `heroKind` to every project and `hero` to Unify, so the template needs no per-project code.
2. **URLs** are `/projects/<slug>/` using the slugs in `content.json`.
3. **Unify role wraps the facts row.** "Software Engineer (Web Lead)" is longer than the
   mockup's "Sole web developer", so the first facts column is allowed to grow. On phones the
   role gets its own row.
4. **Unify page is about 40px taller than 900px** at 1440 wide, because of the awards line and
   longer copy. Every other page fits one screen at 1440 x 900.
5. **Accessibility fixes applied:** the problem label is a real `h2`, facts are a description
   list, the footnote and "Back to the map" are inside the back link, and the secondary links
   are underlined so they read as links.
6. **Cubic screenshots** are pixel art, so they are resized less aggressively (quality 82) and
   drawn with `image-rendering: pixelated`, as in the mockup.
7. **Screenshot thumbnails keep the mockup's 294:150 framing at every size** (they are not
   cropped tighter on phones).
8. **Primary button hover** turns gold. The mockups define no hover state for it.

## Session 3: profile, contact panel, phone layouts (2026-10-06)

Preview: https://redesign.luistanafranca.pages.dev/profile/ (the contact panel opens from the
Contact button on any page)

### Built
- Profile page (`src/pages/profile.astro`) from `ProfileOne.html`: one page, tab bar pinned
  while scrolling and following the section in view, photo column pinned on wide screens,
  experience, skills tree, education, and the closing call to action (Email me, Resume).
- Contact panel (`src/components/ContactPanel.astro`) from `MainContact.html`, on every page.
  It is a native modal dialog: focus stays inside it, Esc and the close button dismiss it, a
  click outside closes it, and focus returns to the Contact button.
- Phone and tablet layouts for the map, all seven project pages, the profile and the panel.
  Checked at 375, 768 and 1440 wide: no sideways scrolling anywhere.

### Judgment calls and things I was unsure about
1. **Pinned photo column holds the back link.** In the mockup "Back to the map" sits at the
   bottom left of a 2020px page. With the column pinned it is under the photo and always in
   view; on phones it is at the end of the page.
2. **Pinned tab bar has a dark backing** so text does not show through it as the page scrolls.
   The mockup's bar is transparent because it never moves.
3. **Tabs.** Skills and Education are one stop on wide screens. The bar highlights Skills there
   unless Education was the tab you clicked. On phones they are separate stops.
4. **Skills tree text is larger than the mockup** (about 13px instead of 9 to 13px), and the
   group names sit above and below each cluster so they do not collide with the skills. On
   phones the labels are set larger again so they stay readable.
5. **The page heading is the name under the photo** (`h1`). The mockup had no `h1`.
6. **"Resume" has no accent anywhere**, including "View full resume (PDF)".
7. **Email in the photo column is a link.** It is plain text in the mockup.
8. **Orbit lines on the profile** keep their size and sit at the top of the page, as in the
   mockup, instead of stretching over the whole page.
9. **Contact panel labels** ("TODAY", "REPLY") are darker than the mockup's grey, which was too
   faint on cream for small text.
10. **Contact panel on phones** is anchored to the bottom of the screen, full width.
11. **"Download my resume"** opens `/resume.pdf` in the browser; it does not force a download.
12. **Without JavaScript** the Contact button is a plain `mailto:` link, the cube shows its
    still frame, and the tab bar keeps "Profile" highlighted.

### Not done yet (Session 4)
Lighthouse pass, Open Graph images and JSON-LD, PostHog. `data-track` attributes are already on
Resume, Contact and every world so analytics can hook in.

### Things to look at when you review
- Reduced motion was checked with a headless Chrome capture (everything drawn, nothing moving,
  cube on its still frame). Keyboard order was checked on the map and inside the contact panel.
- Not tested on a real phone or in Safari or Firefox. The stage scaling uses CSS `tan(atan2())`,
  which needs Safari 15.4, Chrome 111 or Firefox 108 and newer; older browsers get the map at
  a fixed 1440px.
- A fresh `.pages.dev` address took a few minutes before its certificate worked.
