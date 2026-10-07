# Launch checklist: the domain session

Nothing here has been run. Do the steps in order. **(you)** marks a step only Luis can do: it
needs a browser signed in to an account, or a payment.

Throughout, `DOMAIN` stands for the address you buy, for example `luistanafranca.com`. The
personal Cloudflare account is `3a459a47f63c6f049c3217b090c824dd`. The Pages project is
`luistanafranca`. Never touch anything under UnifyCN.

## Before you start

- [ ] `git status` is clean on `redesign`, and `npm run check`, `npm run lint` and the test
      scripts pass (see "How to run the tests" in `BUILD_LOG.md`).
- [ ] `npx wrangler whoami` shows exactly one account, `3a459a47f63c6f049c3217b090c824dd`.
      If it shows anything else, stop.

## 1. Buy the domain **(you)**

1. Open https://dash.cloudflare.com in the browser.
2. **Check which account the browser is signed in to before paying.** The address bar must read
   `dash.cloudflare.com/3a459a47f63c6f049c3217b090c824dd/...`. If it shows a different ID, or
   the account switcher (top left) names Unify, switch accounts first. A domain registered on
   the wrong account cannot simply be moved: a transfer between accounts is a support request,
   and a transfer between registrars is locked for 60 days.
3. Domain Registration, Register Domains, search for `DOMAIN`, buy it. Cloudflare creates the
   DNS zone for it on the same account.
4. Decide now: the site lives on the bare domain (`DOMAIN`), and `www.DOMAIN` redirects to it.
   The rest of this file assumes that.

## 2. Change SITE_URL

1. In `astro.config.mjs`, change the one line:
   `const SITE_URL = 'https://DOMAIN';` (no trailing slash, no `www`).
   Canonical links, share tags, `sitemap.xml`, `robots.txt`, JSON-LD and the analytics host
   check all follow it. Nothing else needs editing.
2. `npm run check && npm run lint && npm run build`.
3. `grep -o 'rel="canonical" href="[^"]*"' dist/index.html` must show `https://DOMAIN/`.
4. Commit on `redesign` and push.

## 3. Production deploy

The production branch of the Pages project is called `main`. That is only a label passed to
Cloudflare: the deploy is built from the folder you are in. **Stay on the `redesign` branch
in git** (git's own `main` is still the old GitHub Pages site, see step 8).

1. `npm run deploy -- main`
   The script checks the account, then builds with `PUBLIC_SITE_ENV=production` (no noindex
   tag) and deploys to production.
2. Open https://luistanafranca.pages.dev and click through the map, one project and the
   profile. It was a 404 until now.

## 4. Connect the custom domain **(you)**

1. Cloudflare dashboard (same account check as step 1), Workers & Pages, `luistanafranca`,
   Custom domains, Set up a custom domain, enter `DOMAIN`. Cloudflare adds the DNS record
   itself because the zone is on the same account. Wait for "Active" (a few minutes).
2. Add `www.DOMAIN` the same way, then make it redirect: in the `DOMAIN` zone, Rules,
   Redirect Rules, create a rule: hostname equals `www.DOMAIN`, dynamic redirect to
   `concat("https://DOMAIN", http.request.uri.path)`, status 301, preserve query string.
3. Open `https://DOMAIN`. If the certificate is not ready yet, wait a few minutes.

## 5. Confirm noindex is gone on production and still on previews

Production must have neither the tag nor the header:

```bash
curl -s https://DOMAIN/ | grep -ci 'name="robots"'
```

```bash
curl -sI https://DOMAIN/ | grep -ci 'x-robots-tag'
```

Both must print `0`. Previews must have both:

```bash
curl -s https://redesign.luistanafranca.pages.dev/ | grep -i 'name="robots"'
```

```bash
curl -sI https://redesign.luistanafranca.pages.dev/ | grep -i 'x-robots-tag'
```

Both must show `noindex, nofollow`. Also check `https://DOMAIN/robots.txt` and
`https://DOMAIN/sitemap.xml` name `DOMAIN`, not `pages.dev`.

Note: `https://luistanafranca.pages.dev` serves the same production build and is indexable,
but every page's canonical link points at `DOMAIN`, so search engines fold it into the domain.

## 6. Add the domain to PostHog **(you)**

1. PostHog, the personal project (the one whose key starts `phc_x8Xs`), Settings, Project,
   Web analytics, Authorized domains (called "Authorized URLs" in some versions): add
   `https://DOMAIN`.
2. While there, consider Settings, Project, "Discard client IP data" (see Session 4, note 5).

## 7. Test PostHog

1. Open `https://DOMAIN/?ph_debug=1` with the browser console open. Each event is printed as
   `[analytics] <event>`. Expect `$pageview` on load.
2. Click Resume, Contact, a project and a GitHub link: expect `resume_open`, `contact_open`,
   `project_open` (with `slug`) and `github_click`.
3. **(you)** In PostHog, Activity: the same events arrive within a minute, with the host
   `DOMAIN`.
4. Open `https://DOMAIN/` without `?ph_debug=1` in a normal window (Do Not Track off) and
   confirm a `$pageview` arrives. Open the preview address and confirm nothing is sent from it.

## 8. Turn the old GitHub Pages site into a redirect

Resumes already sent link to `https://ltanafranca1004.github.io/portfolio`. GitHub Pages cannot
send a real 301, so the old address serves one small page that forwards to `DOMAIN`.

It goes on its own branch, so git's `main` is left free for the new site later:

1. `git switch --orphan old-site-redirect` (an empty branch; `redesign` is untouched).
2. Create `index.html` with `DOMAIN` filled in:

   ```html
   <!doctype html>
   <html lang="en">
     <head>
       <meta charset="utf-8" />
       <title>Luis Tanafranca</title>
       <link rel="canonical" href="https://DOMAIN/" />
       <meta http-equiv="refresh" content="0; url=https://DOMAIN/" />
       <meta name="robots" content="noindex" />
       <script>
         location.replace('https://DOMAIN/');
       </script>
     </head>
     <body>
       <p>This site has moved to <a href="https://DOMAIN/">DOMAIN</a>.</p>
     </body>
   </html>
   ```

3. Copy it to `404.html` (`cp index.html 404.html`), so any other old address under
   `/portfolio/` forwards too. Add an empty `.nojekyll` file.
4. Commit, `git push -u origin old-site-redirect`, then `git switch redesign`.
5. **(you)** GitHub, `ltanafranca1004/portfolio`, Settings, Pages, Build and deployment:
   Source "Deploy from a branch", branch `old-site-redirect`, folder `/ (root)`, Save.
6. After a minute, open https://ltanafranca1004.github.io/portfolio and
   https://ltanafranca1004.github.io/portfolio/anything in a private window. Both must land on
   `https://DOMAIN/`.
7. Keep the repository public and Pages switched on for as long as old resumes are in
   circulation. Renaming or deleting the repository, or the GitHub account, breaks the links.

## 9. After launch

- [ ] **(you)** Google Search Console: add `DOMAIN` (DNS verification is one click with the
      zone on Cloudflare) and submit `https://DOMAIN/sitemap.xml`.
- [ ] Paste `https://DOMAIN/` into a LinkedIn post draft or a chat app to confirm the share
      image appears (the tags now point at a live address).
- [ ] Run `npm run lighthouse -- launch https://DOMAIN`: SEO should now be 100, not 69.
- [ ] **(you)** Update the link on the resume PDF, LinkedIn, the GitHub profile README and the
      `ltanafranca1004/portfolio` repository's "Website" field.
- [ ] Later, optional: open a PR from `redesign` into `main`. Nothing serves from git's `main`
      once step 8 is done, so this is housekeeping only.

## Steps that need you, in one list

1. Buying the domain, on the right account (step 1).
2. Connecting the custom domain and the `www` redirect in the Cloudflare dashboard (step 4).
3. PostHog: authorized domain, and confirming events arrive (steps 6 and 7).
4. GitHub Pages source setting (step 8.5).
5. Search Console, and updating links elsewhere (step 9).
6. `npm run deploy -- main` if the session's permission check refuses it for Claude, as it
   did for preview deploys in Session 7.
