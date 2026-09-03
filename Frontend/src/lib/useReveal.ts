import { useEffect, useRef, type RefObject } from 'react';

/**
 * Scroll-reveal hook — marks children with `[data-reveal]` as visible when
 * they enter the viewport. The CSS transition handles the rest.
 *
 * Usage:
 *   const ref = useReveal();
 *   <div ref={ref}> ... children with data-reveal ... </div>
 *
 * Each element starts invisible via CSS and gets `data-reveal="visible"` when
 * it scrolls into view. A stagger delay is applied automatically based on
 * sibling order inside its parent, so a row of cards fans in left-to-right
 * without any extra markup.
 *
 * Once revealed an element stays visible — there is no hide-on-scroll-up.
 * That is intentional: content that disappears when you scroll back feels
 * broken, and the animation is a one-shot welcome, not a perpetual show.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  /** How far into the viewport the element must be before it fires. */
  threshold = 0.15,
): RefObject<T | null> {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    // Prefer reduced-motion: skip everything, make all children visible.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.querySelectorAll<HTMLElement>('[data-reveal]').forEach(el => {
        el.setAttribute('data-reveal', 'visible');
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.setAttribute('data-reveal', 'visible');
            observer.unobserve(el);
          }
        });
      },
      { threshold, rootMargin: '0px 0px -40px 0px' },
    );

    // Observe everything with `data-reveal`, and set stagger delays based
    // on the element's position among its data-reveal siblings.
    const items = root.querySelectorAll<HTMLElement>('[data-reveal]');
    const parentGroups = new Map<Element | null, number>();

    items.forEach(el => {
      const parent = el.parentElement;
      const idx = parentGroups.get(parent) ?? 0;
      parentGroups.set(parent, idx + 1);

      // Stagger: 80ms per sibling, capped at 400ms so long lists don't
      // have the last item appearing seconds later.
      el.style.transitionDelay = `${Math.min(idx * 80, 400)}ms`;
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [threshold]);

  return containerRef;
}
