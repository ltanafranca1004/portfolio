// Page-to-page transitions (see the notes in layouts/Base.astro, which inlines this file).
//
// Every transition is the same: the old page and the new one cross-fade in place over 200ms
// (global.css). Nothing is named, so nothing travels and nothing is drawn into a picture of
// its own. This script only records that a transition ran, for the checks, and keeps a
// skipped transition's rejected promises out of the console.
(() => {
  const quiet = (transition) => {
    for (const promise of [transition.ready, transition.finished, transition.updateCallbackDone]) if (promise) promise.catch(() => {});
  };
  window.addEventListener('pageswap', (event) => event.viewTransition && quiet(event.viewTransition));
  window.addEventListener('pagereveal', (event) => {
    if (!event.viewTransition) return;
    quiet(event.viewTransition);
    document.documentElement.dataset.vt = 'fade';
  });
})();
