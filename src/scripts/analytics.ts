// Privacy-first analytics (PostHog, Luis's personal project).
//
// - Nothing is stored on the visitor's device: no cookies, no local storage.
// - No session recording, no autocapture, no heatmaps, no surveys, no remote config.
// - Do Not Track is respected.
// - Events are only sent from the real site (the host in SITE_URL), never from localhost
//   or a preview address. Add ?ph_debug=1 to any URL to force it on and log every event
//   to the console.
// - The library loads after the page is idle, so it never competes with the first paint.

// A PostHog project key is public by design: it can only send events.
const POSTHOG_KEY = 'phc_x8XspjLqKUuoMVN82A5utaqS9HARcJerpRew3hfeyd3x';
const POSTHOG_HOST = 'https://us.i.posthog.com';

type Props = Record<string, string>;
type Capture = (event: string, props?: Props) => void;

const siteHost = new URL(import.meta.env.SITE ?? location.origin).hostname;
const debug = new URLSearchParams(location.search).get('ph_debug') === '1';
const doNotTrack = navigator.doNotTrack === '1' || (window as { doNotTrack?: string }).doNotTrack === '1';
const enabled = debug || (location.hostname === siteHost && !doNotTrack);

let ready: Promise<Capture> | null = null;

function load(): Promise<Capture> {
  ready ??= (async () => {
    // The standard build with the web-vitals add-on bundled alongside it, so nothing is
    // fetched from a PostHog CDN. (The slim build cannot carry web vitals without pulling in
    // every other add-on, which comes to the same size.)
    const [{ default: posthog }] = await Promise.all([import('posthog-js/dist/module.no-external'), import('posthog-js/dist/web-vitals')]);
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      persistence: 'memory',
      person_profiles: 'identified_only',
      respect_dnt: !debug,
      // ?ph_debug=1: print each event. (PostHog's own debug flag is not used: it writes
      // to localStorage and stays on for later visits.)
      before_send: (event) => {
        if (debug && event) console.info('[analytics]', event.event, event.properties);
        return event;
      },
      capture_pageview: true,
      capture_pageleave: false,
      capture_performance: { web_vitals: true, network_timing: false },
      autocapture: false,
      rageclick: false,
      capture_dead_clicks: false,
      capture_exceptions: false,
      enable_heatmaps: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_web_experiments: true,
      disable_external_dependency_loading: true,
      // no remote config call, so nothing above can be switched on from the PostHog dashboard
      advanced_disable_flags: true,
    });
    return (event, props) => posthog.capture(event, props);
  })();
  return ready;
}

if (debug) console.info('[analytics] debug mode: events are sent from this page and printed here');

if (enabled) {
  // The custom events: an element says which one with data-event (and data-slug, data-placement).
  document.addEventListener('click', (event) => {
    const el = (event.target as Element | null)?.closest<HTMLElement>('[data-event]');
    const name = el?.dataset.event;
    if (!el || !name) return;
    const props: Props = {};
    if (el.dataset.slug) props.slug = el.dataset.slug;
    if (el.dataset.placement) props.placement = el.dataset.placement;
    void load().then((capture) => capture(name, props));
  });

  const start = (): void => {
    if ('requestIdleCallback' in window) requestIdleCallback(() => void load(), { timeout: 4000 });
    else setTimeout(() => void load(), 1500);
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
