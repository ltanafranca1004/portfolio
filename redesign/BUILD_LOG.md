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

## Session 4: performance, accessibility, SEO, analytics, cross-browser (2026-10-06)

Preview: https://redesign.luistanafranca.pages.dev (deployed through `scripts/deploy.sh`; account
check passed for `3a459a47f63c6f049c3217b090c824dd`).

### Review fixes
- **Viewport heights.** Measured with `npm run test:viewports` at 1280x720, 1366x768, 1440x790
  and 1920x960. The map's four worlds end at 679, 724, 764 and 928px, so they are fully on the
  first screen at every size with no change needed. On all seven project pages the title, role
  and awards or tag line end between 354 and 435px. The only change: the pinned profile photo now
  shrinks a little sooner on short windows, so "Back to the map" under it is not cut off at 790.
- **Safari masks.** `-webkit-mask-image` and `-webkit-mask-composite: source-in` were already
  there next to the unprefixed versions. Checked in WebKit 26.6: the route passes behind every
  world. `-webkit-mask-image` is also on the new fade option.
- **Text glow, two versions.** A (live): the dark glow. B: no glow, and the orbit lines fade out
  where they pass behind text. B is behind a review switch: add `?lines=fade` to any URL.
  Side by side: `redesign/screenshots/glow-compare-map.png` and `glow-compare-unify.png`.

### Cross-browser
- Playwright with Chromium 153, WebKit 26.6 and Firefox 155, installed inside `node_modules`
  (`PLAYWRIGHT_BROWSERS_PATH=0`), dev dependency only. `npm run screenshots` captures `/`,
  `/projects/unify/`, `/projects/cubic/` and `/profile/` at 1440x790 and 390x844 in all three
  (24 files plus two contact sheets in `redesign/screenshots/browsers/`).
- Nothing was broken: no console errors, no sideways scrolling, the same stage and hero scale,
  route masks and comet path in all three, and the cube runs in all three.

### Performance (Lighthouse 13.5 on the preview)
| Page | Form | Before: Perf / A11y / BP / SEO | After: Perf / A11y / BP / SEO | LCP before | LCP after |
|---|---|---|---|---|---|
| `/` | mobile | 99 / 100 / 100 / 61 | 99 / 100 / 100 / 69 | 1.93s | 1.86s |
| `/` | desktop | 99 / 100 / 100 / 61 | 100 / 100 / 100 / 69 | 0.64s | 0.46s |
| `/projects/unify/` | mobile | 100 / 100 / 100 / 61 | 100 / 100 / 100 / 69 | 1.60s | 1.27s |
| `/projects/unify/` | desktop | 100 / 100 / 100 / 61 | 100 / 100 / 100 / 69 | 0.33s | 0.48s |
| `/profile/` | mobile | 100 / 100 / 100 / 61 | 99 / 100 / 100 / 69 | 1.27s | 1.85s |
| `/profile/` | desktop | 100 / 100 / 100 / 61 | 100 / 100 / 100 / 69 | 0.48s | 0.44s |

- CLS is 0.000 and blocking time 0ms on every run. Run-to-run noise is a point or so and a few
  tenths of a second of LCP.
- **SEO is 69 on the preview on purpose.** The one failing audit is "page is blocked from
  indexing", which is the noindex you asked for. The same code built in production mode and
  served locally scores **100 / 100 / 100 / 100** on all three pages, mobile and desktop.
  (Before, SEO was 61 because unknown addresses, including `/robots.txt`, returned the home page.)
- First load, transferred: `/` is 141 KB in 13 requests on mobile and 209 KB in 18 on desktop
  (images 96 and 164 KB, font 26 KB, CSS 7 KB, HTML 9 KB, script 2 KB). `/projects/unify/` is
  92 KB in 11 requests on mobile and 85 KB on desktop.
- Sky: AVIF and WebP at 1280, 1920 and 2880 wide plus a 16 KB phone crop, picked by `srcset`.
  It is fetched first only on the map. Project pages and the profile give that priority to
  their hero image or photo, which is their largest paint.
- Cube: a 15 KB still frame, then a 39 KB strip of six face textures, fetched only when a cube
  is near the screen. No frame sequence is shipped.
- Font: one Jost file (26 KB, variable, latin), preloaded. Nothing else is preloaded.
- Lazy loading: map art for Unify, Cubic and Lens, the small worlds, project screenshots and the
  contact avatar. Build files under `/_astro/` are cached for a year.

### Accessibility (`npm run test:a11y`, 56 checks, all pass)
- Keyboard, in all three browsers: GitHub, LinkedIn, Resume, Contact, About me, Unify Social,
  Cubic, Lens, Turtle Trips AI, Amenity Recommender, Pipeline Simulator, NutriFit. Every stop
  draws a 2px gold ring. Project pages and the profile (including all four tabs) pass too.
- Contact panel: opens with Enter, Tab now wraps inside it, Esc closes, focus returns to Contact.
- Screen reader order on the map: About me, then a "Projects" heading and list with Unify
  Social first, Cubic, Lens, then "Other projects" as a second list.
- Images: none without an alt attribute. Meaningful ones are described; ring frames, the cube
  canvas, the loupe and the small-world art are empty or hidden.
- Contrast against the brightest patch of sky: muted text 5.5:1, gold labels 6.9:1, body text
  8.5:1, the ID line 5.0:1. All small text needs 4.5:1.
- Reduced motion, in all three browsers: zero running animations on the map, Cubic, Lens,
  Pipeline and profile pages, and the cube does not move.
- Fixed: the header name link's label now contains its visible text, focus rings inside the
  cream part of the contact panel are navy (gold was too faint there), and the tab bar is no
  longer an extra Tab stop in Firefox.

### SEO and sharing
- `SITE_URL` is one constant at the top of `astro.config.mjs`. Canonical links, share tags,
  `sitemap.xml`, `robots.txt`, JSON-LD and the analytics host check all read it.
- Every page has its own title and description from `content.json`, a canonical link, and Open
  Graph and Twitter tags. `/` carries Person JSON-LD (name, job title, SFU, GitHub, LinkedIn).
- Share image: `public/og.jpg`, 1200x630, 93 KB, made by `npm run og`.
- `sitemap.xml` (9 pages) and `robots.txt`. A real `404.html`, so unknown addresses return 404.
- Noindex: every build except the production branch gets `<meta name="robots"
  content="noindex, nofollow">`, and `public/_headers` sends `X-Robots-Tag: noindex, nofollow`
  on every `*.luistanafranca.pages.dev` preview host. Confirmed on the live preview.

### PostHog (`npm run test:analytics`, all pass)
- `posthog-js` 1.438, loaded when the page is idle, only when the hostname matches `SITE_URL`.
  `persistence: 'memory'`, no session recording, autocapture, heatmaps, surveys or remote
  config. Page views and web vitals on. Do Not Track respected.
- Events: `resume_open`, `contact_open`, `email_click`, `github_click`, `linkedin_click`,
  `project_open` (with `slug`). Each also carries a `placement` (header, contact_panel,
  profile and so on).
- `?ph_debug=1` forces it on anywhere and prints each event to the console.
- The test intercepts requests to PostHog and reads them, so **no test events were sent to your
  project**. Nothing was stored: 0 cookies, 0 localStorage keys, 0 sessionStorage keys.

### Judgment calls, limits, and things I could not do
1. **Share previews will not show the image yet.** Tags point at `https://luistanafranca.pages.dev`,
   which returns 404 until there is a production deploy. The image itself is fine at
   `/og.jpg` on the preview.
2. **PostHog is not confirmed end to end.** I did not send real events. Open the preview with
   `?ph_debug=1` and check that events arrive in your project.
3. **`persistence: 'memory'` counts every page view as a new visitor**, because nothing links
   one page load to the next. Unique-visitor numbers will be inflated and there are no sessions.
4. **PostHog bundle is 106 KB gzipped.** It never loads on the preview or before idle. The slim
   build is about half that but cannot do web vitals without pulling in every other add-on.
5. **PostHog drops automated and headless browsers**, so Lighthouse and uptime checks are not
   counted. IP addresses are still seen by PostHog unless you turn on "Discard client IP data"
   in the project settings.
6. **Project GitHub links fire `github_click`** with the project slug. "Open Unify", "Play
   Cubic", "Try Lens", "Landing page" and "Devpost" fire nothing, since they are not in your list.
7. **The primary button on project pages is below the first screen** at 1280x720, 1366x768 and
   1440x790 (it sits at 781 to 862px). It was outside what you asked me to check, so I left it.
8. **Safari leaves links out of the Tab order by default** (a macOS setting; Option+Tab works).
   That includes the Contact button, which is a link so it still works without JavaScript.
9. **WebKit is Playwright's build**, close to Safari but not Safari itself, and nothing was run
   on a real phone.
10. **Lighthouse 13.5 also has `llms.txt` and `ai-catalog.json` audits.** They failed before only
    because of the missing 404 and no longer apply. I did not add either file.
11. **The favicon is still the old site's orange "LT".** Not in scope, so unchanged.
12. **New heading on the map:** a visually hidden "Projects" heading labels the list.
13. **404 page copy** ("This page is not on the map") is mine.

## Session 5: polish and transitions (2026-10-06)

Preview: https://redesign.luistanafranca.pages.dev (deployed through `scripts/deploy.sh`; account
check passed for `3a459a47f63c6f049c3217b090c824dd`). No production deploy, domain, DNS or
GitHub Pages change.

### What changed
1. **Glow removed everywhere.** No dark glow, no dark fills behind text, and the `?lines=`
   switch is gone. Also removed: the text shadow the mockup had on map headings and blurbs,
   the dark fill on phone chips, and the dark fill of the phone "Other projects" box (its gold
   border stays). The profile tab bar has no box: what scrolls under it is blurred instead.
2. **Lines and nodes keep 14px from text.** `src/scripts/keepout.ts` measures every line of
   text on the page and cuts a feathered hole in the orbit drawing around it, so this holds on
   every page at any size, for lines and node markers alike. Pinned text (the profile photo
   column and tab bar) clears its whole scroll path. Project and profile pages also fade the
   lines over the whole text column, as in version B. `npm run test:keepout` checks it from
   pixels on 9 pages at 6 sizes (1280x720, 1366x768, 1440x790, 1920x960, 768x1024, 390x844) at
   every scroll position: all 54 pass, and its self-test fails as it should with the mask off.
3. **Profile.** The gold eyebrow labels are gone; the back link's small label says "Map".
4. **Route animation** plays on the first map load in a browser tab (a `sessionStorage` flag).
   After that the map appears settled.
5. **Sharper images.** Map art and project images now ship 1x, 2x and 3x files (AVIF and WebP).
   The Lens card and loupe come from the full-size capture (1340px wide, recovered from this
   repo's history) instead of the 760px copy: the loupe on the map gets a file three times its
   CSS size. Quality is up too (AVIF 62, WebP 84; pixel art 72 and 90).
6. **Previous and next** on every project page, in the header beside the badge, with the
   neighbour's name, looping. Left and Right arrow keys work (not while typing, not while the
   contact panel is open). The badge counts all seven: "Destination 3 of 7", "Other project 4
   of 7". They are on the first screen at every tested size.
7. **Page transitions** with native cross-document view transitions, no ClientRouter. Map to
   project: the clicked world grows into the hero ring while the sky scales to 1.12 and fades
   (500ms). Back: the reverse. Previous and next: a 56px sideways slide (300ms). Off for reduced
   motion. `npm run test:transitions` passes in Chromium and WebKit; Firefox navigates plainly
   with no errors.
8. **Links.** GitHub, LinkedIn, Resume and every project link open in a new tab with
   `rel="noopener noreferrer"`, a spoken "(opens in new tab)" and a small arrow (not on the two
   icon buttons). Email links stay in the same tab. The contact panel has "Copy email".
9. **PostHog** persistence is `sessionStorage`. Nothing else changed.
10. **Project buttons moved up**, under the role and facts. With title, role and awards or tag
    line they end between 428 and 509px, so all are on the first screen at 1280x720 and up.
11. **Favicon:** a gold map pin on navy (`favicon.svg`, `favicon-32.png`, 180px touch icon).

### Lighthouse (deployed preview)
| Page | Form | Perf / A11y / BP / SEO | LCP | First load |
|---|---|---|---|---|
| `/` | mobile | 100 / 100 / 100 / 69 | 1.26s | 198 KB, 13 requests (was 141 KB) |
| `/` | desktop | 99 / 100 / 100 / 69 | 0.62s | 249 KB, 18 requests (was 209 KB) |
| `/projects/unify/` | mobile | 100 / 100 / 100 / 69 | 1.25s | 100 KB, 11 requests (was 92 KB) |
| `/projects/unify/` | desktop | 100 / 100 / 100 / 69 | 0.54s | 93 KB, 11 requests (was 85 KB) |
| `/projects/lens/` | mobile | 99 / 100 / 100 / 69 | 2.03s | 204 KB, 12 requests |
| `/projects/lens/` | desktop | 100 / 100 / 100 / 69 | 0.45s | 185 KB, 12 requests |

SEO stays at 69 on the preview because of the intended noindex. CLS is 0 and blocking time 0ms
everywhere. The extra weight is the sharper images. Lens on mobile ranged from 1.6s to 2.3s LCP
across three runs: under 2.5s, but the closest to it.

### Did Session 4 compression make images worse?
No. Session 4 did not touch image compression. The softness came from earlier choices: files
sized for 1x that the page then enlarged (the Lens card was a 380px file drawn 2.35x larger on
the Lens page, and its loupe a 684px file drawn at up to 1600 device pixels), and default
AVIF quality on screenshots full of small text.

### Judgment calls and limits
1. **Lens page loupe is 1.7x, not 2x or 3x.** There the loupe layer is 804 CSS px wide and the
   best source is 1340px. A 2x screen wants 1608. Sharper needs a new, larger capture of that
   Lens screen. On the map the loupe is past 3x.
2. **Turtle Trips screenshots are still soft on 2x.** Their sources are 430 and 455px wide for a
   294px slot.
3. **Tab bar.** With no backing, text scrolling under the pinned tabs would collide with them,
   so the bar blurs what is behind it. It is not a dark panel, but it is not nothing either.
4. **Text shadow removed.** The mockup's dark text shadow on the map is a glow of its own, so
   I took "no dark glow or shadow behind text" to cover it.
5. **Where the buttons went.** The mockup has them bottom right. They are now in the text
   column under the facts, on phones too. The footer keeps only "Back to the map".
6. **Prev and next are in the header**, not at the page edges, so they are always on the first
   screen. On phones they sit on their own row under the badge.
7. **Badge wording for the last four** is "Other project 4 of 7".
8. **A fix found by testing:** the transition script first loaded with the other scripts, and
   WebKit often decided on the transition before it ran. It is now inline in the head, and the
   page waits for its last element before first paint (`rel="expect"`).
9. **Playwright's cut-down headless Chromium skips transitions at random**, so that test runs
   in the full Chromium build. WebKit is Playwright's build, not Safari itself.
10. **Without JavaScript** the orbit lines are not masked and cross text as in the mockup, and
    the route draws in on every map visit.
11. **Keep-out leaves the profile's left column nearly bare of lines**, because the pinned
    name and back link clear a strip all the way down the page.
12. **`sessionStorage` now also holds** a "map seen" flag and the last transition's zoom centre.
    Neither is sent anywhere.
13. **Copy email** says "Copy failed" if the browser refuses clipboard access.

### Files for review (`redesign/screenshots/`, git-ignored)
`map-before-after.jpg`, `profile-before-after.jpg`, `lens-before-after.jpg`,
`loupe-before-after.png`, `transition-frames.png`, `transition-chromium.webm`,
`transition-webkit.webm`, and `browsers/` for the cross-browser sheets.

## Session 6: phone fixes, one screen, profile tabs, navigation, transitions (2026-10-06)

Preview: https://redesign.luistanafranca.pages.dev (deployed through `scripts/deploy.sh` after each
part; `wrangler whoami` showed only `3a459a47f63c6f049c3217b090c824dd` before every deploy). No
production deploy, domain, DNS or GitHub Pages change. `content.json` is untouched.

### 1. The broken project pages on iPhone
- **Which way breaks:** a direct load. So it was the scaling, not the transition and not the
  stored zoom centre.
- **Cause:** the hero was scaled with `transform: scale(tan(atan2(100cqw, 520px)))`. Safari
  works that out wrongly. Measured in four WebKit builds:

  | WebKit | 390px-wide phone | 430px-wide phone | Should be |
  |---|---|---|---|
  | 17.4 | 0.19 | 0.19 | 0.67 / 0.69 |
  | 18.0, 18.4, 26.0 | -0.70 (mirrored, off its box) | 0.14 | 0.67 / 0.69 |
  | 26.6 (Playwright's current build) | 0.67 | 0.69 | 0.67 / 0.69 |

  At 0.14 the 520px hero is drawn 72px wide in the top-left corner of its 360px box, with the
  title below the empty box: what you saw. The map's `tan(atan2(100vw, 1440px))` was wrong in
  the same builds (desktop Safari got a clamped, wrong scale).
- **Reproducing it:** Playwright's own WebKit (26.6) does not have the bug, which is why
  Sessions 4 and 5 saw nothing. I reproduced it in older Playwright WebKit builds installed in
  the session's temp folder, outside the repo (nothing added to `package.json`).
- **Fix:** no trigonometry in CSS any more. The hero's scale is measured by a few lines of
  inline script inside `.hero` (its width / 520, kept current by a ResizeObserver). The stage
  scale uses the window size as plain numbers (`--vw`, `--vh`, set in the head).
- **Test:** `npm run test:phone` (iPhone emulation in WebKit and Chromium at 390x844, 390x664
  and 430x932; every project page loaded directly and tapped from the map). The hero must be
  centred, at least 70% of the screen wide and fully on the first screen with the title. It also
  fails if any stylesheet uses `atan2()` again. `--selftest` puts Safari's 0.14 back and
  confirms the check fails.

### 2. Phone header and layout
- Project pages below 1200px: the top row is the back control and Contact. Resume, GitHub and
  LinkedIn are still in the contact panel, on the map and on the profile.
- The badge sits small above the title. Previous and next are two buttons at the end of the
  page with the neighbours' names.
- First screen at 390x844: hero from 84 to 434px, title ends at 544px. It also fits 390x664
  (Safari with its toolbars showing).

### 3. Phone performance
Measured with `npm run perf:phone` (`scripts/perf-phone.mjs`): Chromium at 390x844 with the CPU
slowed 4x and real touch scrolling, and WebKit with iPhone emulation.

| | Before | After |
|---|---|---|
| Chromium 4x: long tasks over 50ms while scrolling the map | 2 (longest 85ms) | 0 |
| Chromium 4x: worst frame while scrolling the map | 100ms | 33ms |
| Chromium 4x: cube frame rate, at rest / while scrolling | 13.3 / 12.6 fps | 15 / 14.9 fps |
| Chromium 4x: longest gap between cube frames | 84 to 102ms | 68ms |
| WebKit: toolbar hides and shows, map (frame rate / worst frame) | 3.8 fps / 435ms | 29.9 fps / 35ms |
| WebKit: toolbar hides and shows, Cubic page | 2.8 fps / 467ms | 27.4 fps / 85ms |
| WebKit: opening Cubic, first 2.5s (frame rate / worst frame) | 10.5 fps / 659ms | 23.5 fps / 184ms |
| Animations running on the map (of those, off screen) | 10 (6) | 2 (0) |
| Compositor layers on the map (Chromium) | 18 | 15 |

Playwright's WebKit paints 30 frames a second at most, so 30 there is "no dropped frames".
What changed, each backed by a number above:
- **The cube ran slow and uneven.** Its clock restarted inside every frame and lost the time
  the frame itself took. Fixed; it holds 15 fps under 4x slowdown, so the canvas stays (no
  lower resolution or pre-rendered image needed). Its textures now load when the page is idle
  instead of in the middle of a scroll.
- **Safari's toolbar.** Hiding and showing it fires `resize` on every scroll. That re-ran the
  keep-out measurement (and, after part 1, a restyle). Now nothing runs when only the height
  changes below 1200px. The keep-out never ran on scroll itself.
- **Keep-out masks** are plain shapes now. The blur filter inside each mask was the slow part
  of repainting them.
- **Ring frames stand still** below 1200px and on touch screens. Everything else pauses when
  it is off screen (`src/scripts/offscreen.ts`).
- **No animation on a masked element** on phones: the orbit lines appear without their fade.

### 4. Tappable worlds
The stretched link stopped at the text block, so the ring, screenshot, cube and photo did
nothing, on every layout. Now each world is one link that covers its ring and text: one Tab
stop, named by the title. `npm run test:worlds` checks the middle and all four edges of every
ring on desktop, tablet and phone, follows the photo and the cube, and confirms the cube still
animates.

### 5. One screen on wide windows
- From 1200px wide, the map, the seven project pages and the profile are each a 1440x900 stage
  scaled by min(width / 1440, height / 900), kept within 0.75 to 1.25, centred. The sky and the
  orbit lines belong to the page, so they fill what is left. Below 675px of height the stage
  stays at 0.75 and the page scrolls down.
- Everything fits at design size with nothing cut: the tallest project column (Unify) ends at
  863px of 900.
- `npm run test:viewports` checks 12 pages (every profile tab) at 1280x720, 1366x768, 1440x790,
  1512x860, 1728x1000 and 1920x960: no scrolling, the right scale, centred, and every piece of
  text, image, link and button fully inside the window. 75 of 75 pass. Keep-out passes on 72
  page and size combinations.

### 6. Profile as tabs
- Four tabs: Profile, Experience, Skills, Education. Photo on the left, tabs at the top of the
  right column, one panel on screen. Nothing is pinned and no panel scrolls.
- Profile (the default) has the quote, the four facts, Email me and Resume.
- Experience has all three jobs with every bullet. It fits at 1280x720 with Unify across the
  full width and Spotwork and STEMA side by side, so nothing needed cutting.
- ARIA tabs: one Tab stop; Left, Right, Home and End move between tabs; each tab has an address
  (`/profile/#experience`) that opens it directly; a click adds a history entry, so Back and
  Forward walk the tabs (arrow keys replace the entry instead of piling them up).
- Switching cross-fades over 250ms with a 16px shift in the direction of travel. Nothing moves
  under reduced motion. All four panels are always in the HTML.
- Phones and tablets: one stacked page, and the same four links jump down it.
- `npm run test:tabs`: 48 checks in Chromium, WebKit and Firefox.

### 7. Back navigation
- On project pages and the profile the header's left block is the back control: an arrow in a
  circle, "Back to map", the name under it. The whole block is one link.
- The bottom "Back to the map" link and its footnote are gone.
- Esc goes back to the map. With the contact panel open, Esc only closes the panel.

### 8. About me zoom
Clicking About me (the title or the photo) grows the photo world into the profile's photo ring;
Back, the header block and Esc reverse it. Same on phones.

### 9. Transitions without the blink
- **Measured first.** `npm run test:transition-frames` records every transition. Before:
  2 to 5 dark frames on previous and next in Chromium (down to 49% of the page's brightness),
  and a dip to 69% in WebKit.
- **Fix.** The page layer (the sky) is never moved now: old and new cross-fade in place at full
  strength, so there is no gap to see through. What moves is named only for the length of the
  transition: the travelling world, and on wide screens the stage, or between two projects the
  hero and text column, which cross-fade with a 20px shift over 280ms. Custom animations use
  `mix-blend-mode: normal`. The zooms were changed the same way.
- The page colour `#050815` is inline in the head, with the view-transition opt-in.
- After: 0 dark frames in all 24 recordings (Chromium and WebKit, desktop 1512x860 and iPhone
  emulation; next, previous, map to project and back, map to profile and back).

### 10. Lens image
Skipped: `redesign/assets/lens-capture-2x.png` and `turtle-capture-2x.png` are not there.

### 11. Checks
`astro check` and `eslint` clean. All check scripts pass: phone, worlds, viewports, tabs,
transitions (26), transition frames (24), keep-out, accessibility (63), analytics.

Lighthouse 13.5 on the deployed preview:

| Page | Form | Perf / A11y / BP / SEO | LCP | First load |
|---|---|---|---|---|
| `/` | mobile | 100 / 100 / 100 / 69 | 1.70s | 239 KB, 15 requests |
| `/` | desktop | 100 / 100 / 100 / 69 | 0.69s | 252 KB, 19 requests |
| `/projects/unify/` | mobile | 100 / 100 / 100 / 69 | 1.70s | 103 KB, 11 requests |
| `/projects/unify/` | desktop | 100 / 100 / 100 / 69 | 0.56s | 94 KB, 11 requests |
| `/projects/pipeline-simulator/` | mobile | 100 / 100 / 100 / 69 | 1.72s | 82 KB, 10 requests |
| `/projects/pipeline-simulator/` | desktop | 100 / 100 / 100 / 69 | 0.51s | 82 KB, 10 requests |
| `/profile/` | mobile | 100 / 100 / 100 / 69 | 1.12s | 101 KB, 9 requests |
| `/profile/` | desktop | 100 / 100 / 100 / 69 | 0.45s | 89 KB, 9 requests |
| `/projects/lens/` | mobile | 98 / 100 / 100 / 69 | 2.39s | 205 KB, 12 requests |

SEO is 69 because of the intended noindex on the preview. CLS 0 and blocking time 0ms everywhere.

### Two faults found by the tests and fixed
1. **Transitions were dropped about 1 time in 10 in Chromium.** The view-transition opt-in was
   in the stylesheet, which sometimes loaded after the browser had decided the page had not
   opted in. It is inline at the top of the head now: 0 of 30 round trips dropped.
2. **A keep-out hole in the wrong place on the Pipeline page, about 1 load in 3.** Chromium
   answered a Range over SVG text with the scale the drawing had before its hero was scaled.
   SVG text is now measured by its element's box (30 of 30 loads correct).

### Judgment calls and limits
1. **Not checked on your iPhone.** The bug is reproduced and fixed in WebKit 17.4 to 26.0, but
   those are Playwright builds on a Mac. Please open a project page on the phone.
2. **Part 9 is not built exactly as written.** You asked for the sky and header to have their
   own view-transition names with no animation. I left them in the page layer and stopped
   moving that layer instead. The result is the same (they stay still), with fewer layers.
3. **On phones only the travelling world moves in a zoom,** and previous and next is a plain
   cross-fade with no 20px shift: a whole stacked page is too large to move as one picture.
4. **Parts 7, 8 and 9 are one commit.** They all change the same transition script.
5. **Text is smaller on small laptop windows.** One stage scaled to fit means 16px body text
   is 12.8px at 1280x720 (0.8x) and 15.3px at 1512x860. That follows from the one-screen rule.
6. **The map scales differently now:** min(width / 1440, height / 900) down to 0.75. It used
   to fit the width and 790px of height, down to 0.83.
7. **The profile between 1000 and 1199px wide is now the stacked page.** It used to be two
   columns from 1000px.
8. **Phone tabs** are not pinned and do not highlight the section in view any more.
9. **Without JavaScript** the hero uses fixed scales (0.67 on phones, 0.81 on tablets), the
   stage is not scaled to the window, and the profile's panels follow the address (`:target`).
10. **The map's first load is 41 KB heavier** (239 KB on mobile, was 198 KB): the cube's
    textures now load when the page is idle instead of when the cube scrolls into view.
11. **Ring frames also stand still on touch laptops and tablets** of any width.
12. **The keep-out edge** is three stepped rings instead of a blur. At 30% line opacity I
    cannot see the difference.
13. **`footnote` in `content.json` is no longer shown anywhere.** The field is still there.
14. **Esc also goes back to the map from the 404 page.**
15. **Performance was measured in emulation,** not on a phone. It shows main-thread work and
    frame pacing, not what the phone's graphics chip is doing.
16. **Lens on mobile is 2.39s LCP** in this run: under 2.5s, and still the closest to it.
17. **Unify on mobile is 1.70s LCP** (1.25s in Session 5). The ring frame stands still on
    phones now, so it counts as the largest paint; it is fetched with high priority.
18. **The route's draw-in on the desktop map still animates inside a masked wrapper** for its
    1.7 seconds. That is desktop only and I left it.

### Files for review (`redesign/screenshots/`, git-ignored)
- `session6/iphone-map.png`, `iphone-unify-direct.png`, `iphone-unify-tapped.png`
- `session6/1512x860-*.png` and `session6/1280x720-*.png`: map, pipeline, profile,
  profile-experience, profile-skills, profile-education
- `transition-frames-chromium-desktop.png`, `-chromium-iphone.png`, `-webkit-desktop.png`,
  `-webkit-iphone.png` (rows: map to project, next, previous, project to map, map to profile,
  profile to map)
- `perf-phone-before.json`, `perf-phone-after.json`

## Session 7: stability (2026-10-07)

No new features. Measured first, then fixed or removed. `content.json` is untouched. Pushed to
`redesign` (`40a6593` to `e8b2614`). **Not deployed:** the deploy step was refused by the
session's permission check, so the preview still shows Session 6. Run `npm run deploy` yourself
(`wrangler whoami` showed only `3a459a47f63c6f049c3217b090c824dd` when I checked).

### What could and could not be measured
| | State |
|---|---|
| Real Chrome 155 on this Mac (1470 x 751 at 2x) | Driven and measured. Frame times come from Chrome's own trace (every frame it presented). |
| Screen recording | **Blocked.** macOS gave Claude the wallpaper only (no windows), which is what it does without Screen Recording permission. The Chrome videos are every frame Chrome painted (DevTools screencast) instead. |
| Real Safari 26.5.2 | **Blocked.** "Allow remote automation" is still off (Safari > Settings > Developer). `scripts/measure/safari.mjs` is written and waiting. |
| iPhone simulator | **Not available.** Xcode is not installed (Command Line Tools only). About 30 GB with a simulator runtime; not installed. |
| WebKit instead of both | Playwright WebKit 18.4, 26.0, a build between, and 26.6, at iPhone size (390 x 664 at 3x, taps) and at this laptop's window size. It is WebKit on a Mac, not Safari and not a phone. |

So every Safari and iPhone statement below is from WebKit builds, not from your devices.

### What flickered, exactly (Session 6 build)
Real Chrome, from the recorded frames (`recordings/sheets/before-chrome-*.png`, `zoomout-detail.png`):
- **Map to a project:** the map froze for 375ms (453ms in the trace; 852ms on the live preview),
  then the whole 500ms zoom was squeezed into about 70ms.
- **Back to the map:** a 118ms freeze, then two frames (about 70ms) with the lower half of the
  sky missing, then the zoom with no orbit lines on the map, then **one frame of flat page
  colour with only the cube and two small icons on it**, then the map with its lines popping in.
- **After every page load:** the orbit lines were hidden and faded in over 300ms, and their mask
  was rebuilt 4 or 5 times in the first 300 to 500ms (counted in WebKit). Pictures below the
  first world were lazy and arrived 45 to 80ms after the first frame.

WebKit 26.0 at iPhone size (`recordings/sheets/iphone-before-*.png`):
- **Map to a project:** the sky went black with only the hero showing for about 200ms, the page
  appeared, then the header and text vanished again for about 160ms.
- **Next:** two black frames, then about 160ms of sky with no content.

### Causes, with numbers
1. **Choppy zooms in Chrome: commit `7e4f4cb`** (Session 6, "no transition blinks dark"). It gave
   the whole 1440 x 900 stage a view-transition-name, with the masked route and orbit drawings
   inside it. Each Session 6 commit was built and measured:

   | Build | Zoom in, worst frame | Zoom out, worst frame | Frames over 33ms |
   |---|---|---|---|
   | Session 5 (`2047c23`) | 18ms | 18ms | 0 |
   | `6cf3177`, `b248fa7`, `8b5255b`, `243659a`, `d5e7d6b`, `cbe6f8b` | 18 to 20ms | 17 to 19ms | 0 |
   | `7e4f4cb` and after | 234 to 453ms | 67 to 85ms | 1 to 3 per transition |

   No other Session 6 commit changed frame times in Chrome. Cold-load first paint was the same in
   Session 5 and Session 6 (160 and 148ms locally).
2. **The blank frame after a zoom:** removing the stage's name at the end of the transition.
3. **Lines appearing after the page, and repainting:** the keep-out ran from a deferred script
   after first paint, then again on fonts, load, resize observer and font events.
4. **Slow phone transitions (older than Session 6):** the keep-out mask covered the whole
   2840 x 1700 orbit drawing, about 8500 x 5100 pixels on a 3x phone, with a second CSS mask on
   top. WebKit 18.4 at iPhone size: about 120ms per frame during every transition into a project
   page or the profile. Session 5 was worse there than Session 6 (200 to 420ms frames).
5. **Text blinking out on phones:** the masked orbit backdrop on project pages. With it gone the
   same transitions had no blank frames.
6. **"Seconds to load":** cold first paint is 150 to 300ms in Chrome (304ms on the live preview).
   What took a second was the first click into a project: 1036ms from click to settled, 852ms of
   it frozen. The first map visit also brings the worlds in over 1.9s by design (item 4 below).

### What changed
1. **Transitions: one 200ms cross-fade for everything** (map to project, back, previous, next,
   About me). Nothing has a view-transition-name. The sky is the same picture in the same place
   on every page (project pages used a different sky position), so it stands still.
   - I made one attempt at a cheap zoom first (only the small ring named). Real Chrome: every
     frame within 19ms. WebKit 26.0 at desktop size: on the way back the map vanished and the
     screen was black with only the ring for about 200ms
     (`sheets/webkit-26.0-desktop-zoom-attempt-back-to-map.png`). That fails "no flicker", so
     per the rule it was replaced, not tuned.
2. **Keep-out masks are made before the first paint,** by an inline script at the end of the
   content, once. They are only remade when the layout really changes (resize, a profile tab).
   The mask is now the size of the page, not of the whole drawing.
3. **Nothing is shown before it is settled.** The stage and the lines stay hidden until the text
   is in its real font and the lines are masked. When the font is cached (every page after the
   first) that is before the first paint. On a first visit they fade in once, 200ms.
4. **Pictures:** the sky and every first-screen picture are eager, high priority and decoded
   with the frame. Pictures that are on the first screen only on wide windows (Lens, the small
   worlds, project screenshots) are made eager there by a three-line inline script and stay lazy
   on phones, so the phone map is not heavier (237 KB, was 240 KB).
5. **Speculation rules:** Chrome prerenders `/`, `/profile/` and `/projects/*` on hover or press.
   Confirmed from the server log (requests marked `prefetch;prerender`). Other browsers fetch the
   page and its high-priority pictures on hover, focus or touch (`src/scripts/prefetch.ts`).
   Analytics waits until a prerendered page is actually shown.
6. **`rel="expect"` stays.** Measured with and without it, 9 cold loads per page:

   | Connection | With | Without | Things changing after first paint (map), with / without |
   |---|---|---|---|
   | 40ms, 20 Mbps | 176ms | 180ms | 15 / 15 |
   | 150ms, 1.6 Mbps | 476ms | 468ms | 17 / 33 |

   It costs 0 to 16ms, and without it a slow connection paints the page in pieces.
7. **Phones: no orbit lines behind project pages and the profile.** Removed, see cause 5.
8. **Profile tabs on phones:** the same four tabs. Header, tab bar (not pinned), then the one
   panel, which scrolls with the page. Addresses and the Back button work as on desktop.

### Before and after
Real Chrome, local builds served with 40ms latency at 20 Mbps (`npm run measure:report`):

| | Session 5 | Session 6 | Now |
|---|---|---|---|
| Worst frame during a zoom or fade into a page | 18ms | 243 to 453ms | 18ms |
| Worst frame on the way back to the map | 18ms | 67 to 85ms | 19ms |
| Frames over 33ms during any transition | 0 | 1 to 2 on every zoom | 0 |
| Click to the new page's first frame | 60 to 127ms | 60 to 128ms | 12 to 78ms |
| First click into a project, click to settled | 0.63s | 0.62s (1.2s live) | 0.32s |
| Things that change after first paint, arriving on a page | 1 to 4 | 1 to 10 | 0 to 2 |
| Mask rebuilds per page load | 2 or more | 4 to 5 | 1 |
| Cold first paint: map / Unify / profile | 160 / 152 / 168ms | 148 / 144 / 160ms | 184 / 180 / 180ms |

The "0 to 2" left are the cube switching from its still picture to the live canvas, and
screenshots still arriving on a first visit.

WebKit at iPhone size (the page's own frame clock, 8 transitions):

| | Session 6, 18.4 | Now, 18.4 | Session 6, 26.0 | Now, 26.0 | Now, 26.6 |
|---|---|---|---|---|---|
| Worst frame | 132ms | 23ms | 131ms | 20ms | 21ms |
| Frames over 33ms | 22 | 0 | 16 | 0 | 0 |
| First-screen pictures in, project page | 228ms | 102ms | 229ms | 103ms | |

Lighthouse 13.5. "Before" is the deployed Session 6 preview; "now" is the new build served from
this Mac, so the times are not like for like. Run it again after deploying.

| Page | Form | Before: Perf / A11y / BP / SEO, LCP | Now (local): Perf / A11y / BP / SEO, LCP |
|---|---|---|---|
| `/` | mobile | 99 / 100 / 100 / 69, 1.99s | 100 / 100 / 100 / 69, 1.66s |
| `/` | desktop | 100 / 100 / 100 / 69, 0.62s | 100 / 100 / 100 / 69, 0.51s |
| `/projects/unify/` | mobile | 100 / 100 / 100 / 69, 1.76s | 100 / 100 / 100 / 69, 1.58s |
| `/projects/unify/` | desktop | 100 / 100 / 100 / 69, 0.52s | 100 / 100 / 100 / 69, 0.37s |
| `/profile/` | mobile | 99 / 100 / 100 / 69, 1.82s | 100 / 100 / 100 / 69, 1.66s |
| `/profile/` | desktop | 100 / 100 / 100 / 69, 0.44s | 100 / 100 / 100 / 69, 0.37s |

CLS 0 everywhere. `astro check` and `eslint` clean. All nine check scripts pass (tabs 60,
transitions 28, transition frames 24, accessibility 63, analytics, phone, worlds, viewports,
keep-out).

### Things that are not perfect, and judgment calls
1. **The target is not confirmed in real Safari.** It could not be driven. The cross-fade is
   clean in WebKit 18.4, a build after 26.0, and 26.6 at desktop size
   (`sheets/webkit-*-desktop-crossfade.png`).
2. **WebKit 26.0 blinks during any view transition,** zoom or cross-fade: page content drops out
   for a frame or two (`sheets/webkit-26.0-desktop-crossfade-blinks.png`). With transitions
   switched off that build is clean. At iPhone size the final build shows one faint frame, on
   the browser's Back button. If your iPhone is on an early iOS 26 and still flickers, the fix
   is to turn transitions off for Safari; I did not do that without evidence from a real device.
3. **A held frame at the click in Chrome.** The old page stands still for 40 to 93ms while the
   next page takes over (2 to 5 frames), then the fade runs at 60 frames a second. It is before
   the transition, not in it, but it is a frame over 33ms. Session 6 had 243 to 453ms there.
4. **The first map visit still brings the worlds in one by one over 1.9s** (the route draw-in
   you asked for in Session 5). It moves things after first paint by design. Say so and I will
   remove it.
5. **Cold first paint is about 35ms later** (148 to 184ms on the map). Nothing is painted until
   the font is in, instead of painting text in a fallback font and swapping it.
6. **The zoom is gone,** including the About me zoom from Session 6.
7. **Phones: the photo and name are on the Profile tab only,** so the other tabs start straight
   under the bar. Tell me if the photo should stay above every tab.
8. **Phones lose the faint orbit lines** at the top of project pages and the profile.
9. **The Safari prefetch fallback is untested in Safari.** It type-checks and runs in WebKit
   without errors; whether it makes Safari feel faster is not measured.
10. **Prerendering means a hovered page is loaded before the click.** Nothing is counted or
    sent until the page is shown.
11. **`scripts/measure/`** is new tooling: a throttled static server, a probe injected into
    served pages (never shipped), drivers for Chrome, Safari and WebKit, and a report.
    `npm run measure:chrome -- --build=dist --label=x`, then `npm run measure:report -- file...`.
12. **Older WebKit builds** were installed in the session's temp folder, outside the repo.
    Nothing was added to `package.json` for them.

### Files for review (`redesign/recordings/`, git-ignored)
- `before-chrome.mov`, `after-chrome.mov`: every frame Chrome painted, real Chrome.
- `before-iphone.mov`, `after-iphone.mov`: WebKit 26.0 at iPhone size. `after-iphone-wk26.6.mov`.
- No `before-safari.mov` or `after-safari.mov` (blocked, see the top of this section).
- `*.json`: the numbers behind every table. `sheets/`: the contact sheets named above, and
  `phone-profile.png` (the four tabs at phone size).
