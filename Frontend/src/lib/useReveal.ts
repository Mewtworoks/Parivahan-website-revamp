import { useEffect, useRef } from 'react';

/**
 * Fades in each `[data-reveal]` descendant as it enters the viewport, once.
 *
 * Attach the returned ref to the page's outer container. Children opt in with
 * a bare `data-reveal` attribute rather than a class, so the CSS staying
 * present is what does the animating — this hook only ever adds `.revealed`
 * and never removes it, so a page that renders after `prefers-reduced-motion`
 * has already made the CSS transition instant still ends up in the right
 * final state.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = root.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!targets.length) return;

    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach(el => el.classList.add('revealed'));
      return;
    }

    const io = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('revealed');
        io.unobserve(entry.target);
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    targets.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  return ref;
}
