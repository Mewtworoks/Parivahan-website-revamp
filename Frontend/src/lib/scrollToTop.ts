/**
 * Jumps the window to the top instantly.
 *
 * `html{scroll-behavior:smooth}` is set globally, so a plain `window.scrollTo(0,0)` starts an
 * animated scroll — one that a same-tick React re-render (new step's content, different height)
 * reliably cancels mid-flight, leaving the page exactly where it was. Passing `behavior:'instant'`
 * explicitly overrides the CSS smooth-scroll default, so the jump actually happens.
 */
export function scrollToTop(): void {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}
