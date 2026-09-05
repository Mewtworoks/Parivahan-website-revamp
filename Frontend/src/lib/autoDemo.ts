/**
 * Shared timing for the demo autopilot (`state.autoDemo`) — a whole journey
 * filling and clicking through itself, unattended, for showing the build
 * rather than typing and clicking through it live.
 *
 * Reached only through the cheat code (type "demo" anywhere outside a text
 * field) rather than a visible button — see the keydown listener in App.tsx
 * and the picker it opens. Three kinds, one per thing on this site worth
 * demonstrating end to end:
 *
 *   'll'   — the learner's-licence journey: eligibility through issued licence
 *   'game' — the practice module: the road-rules primer, then the scored game
 *   'gov'  — the Government Brain pitch, then the live guarantees running
 *
 * Every page's autopilot effect is built the same way: wait `AUTO_DELAY`, act
 * (fill a field, tick a box, press the button a person would), wait again,
 * move on. The delay exists only so a human watching can follow what just
 * happened — instant would look like a jump cut, not a demo.
 */
export const AUTO_DELAY = 1500;

/**
 * The pause held after scrolling reveals a page's real content — an
 * explanation, a fee breakdown, a review screen — right before the autopilot
 * moves on. `AUTO_DELAY` alone was tuned for "something just happened, blink
 * and you'd miss it", not for a paragraph somebody is meant to actually read;
 * every page's final wait before it navigates away uses this one instead.
 */
export const AUTO_READ_DELAY = 3200;

export const autoWait = (ms = AUTO_DELAY) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Scrolls smoothly from wherever the page is now down to the bottom of the
 * actual page content — `<main>`, not the document.
 *
 * Every autopilot page filled itself and moved on before anyone watching had
 * scrolled — the page had more on it than the one screenful the autopilot
 * happened to load on. This is the fix: one visible scroll through the whole
 * page before it advances, so the demo shows the page rather than just its
 * first fold.
 *
 * Stopping at `<main>`'s bottom rather than the document's is deliberate and
 * was the actual bug in the first version: `document.documentElement
 * .scrollHeight` includes the site-wide footer that sits after `<main>` in
 * App.tsx, so a short screen (a receipt, a slip) scrolled straight past its
 * own card into blank space and the footer — content that has nothing to do
 * with whatever the demo is showing right then. Ending at `<main>`'s own
 * bottom edge means the scroll only ever covers the page actually being
 * demonstrated.
 *
 * Resolves once scrolling has actually stopped, not on a fixed timer, so a
 * short page and a long one both get the same steady scroll speed instead of
 * the short one looking instant and the long one looking rushed — which is
 * what a duration capped at a fixed maximum quietly breaks: cap the time
 * rather than the speed and a long page (Future.tsx's pitch, this once did)
 * gets squeezed into that same ceiling regardless of how far it has to
 * travel, so its *speed* rises instead — the "really fast" bug. There is
 * therefore no upper bound here, only the floor that keeps a four-pixel
 * scroll from taking zero time and reading as a flicker.
 *
 * Every step below is issued with `behavior: 'instant'`, on purpose — see
 * lib/scrollToTop.ts for why. `html{scroll-behavior:smooth}` is global, so a
 * plain `window.scrollTo(0, y)` does not jump to `y`, it hands the browser a
 * new smooth-scroll target on top of whichever one the last frame just set —
 * which was the actual bug: two easings, its and this function's own,
 * fighting every frame instead of one clean motion.
 */
export function autoScrollToBottom(pxPerSecond = 900): Promise<void> {
  return new Promise(resolve => {
    const main = document.querySelector('main');
    const contentBottom = main ? main.getBoundingClientRect().bottom + window.scrollY : document.documentElement.scrollHeight;
    const start = window.scrollY;
    const end = Math.max(0, Math.min(contentBottom, document.documentElement.scrollHeight) - window.innerHeight);
    const distance = end - start;
    if (distance <= 4) { resolve(); return; }
    const duration = Math.max(400, (distance / pxPerSecond) * 1000);
    const startTime = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      // ease-out — arrives at the bottom rather than stopping dead at it.
      const eased = 1 - (1 - t) * (1 - t);
      window.scrollTo({ top: start + distance * eased, left: 0, behavior: 'instant' });
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

/**
 * Opens every collapsed `<details>` on the page.
 *
 * Learn.tsx's road-rules primer holds all but its first section closed, which
 * is the right default for a person reading it but means an autopilot scroll
 * would sail past five sixths of the page still folded shut. This is a direct
 * DOM reach rather than lifted component state, on purpose: it is a demo-only
 * concern local to the autopilot, not a reason for the real page to carry
 * state it would otherwise have no use for.
 */
export function autoOpenAllDetails(): void {
  document.querySelectorAll('details').forEach(d => { d.open = true; });
}
