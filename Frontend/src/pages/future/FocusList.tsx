import { useEffect, useRef, useState } from 'react';

/**
 * A list where the item nearest the middle of the screen is the one in focus:
 * it darkens and opens its explanation, and the rest sit back as ghosts.
 *
 * The mechanic is the reference's, and it is here for a reason beyond looking
 * good. Four explanations shown at once are four things to skim and none to
 * read — the eye takes the headings and skips the bodies, which on a page whose
 * whole problem was "nothing is explained" is the failure mode to design
 * against. Showing one at a time means each explanation is read, and the ghosts
 * still tell the reader how many are coming.
 *
 * Focus is decided by distance from the viewport's middle rather than by an
 * IntersectionObserver threshold. With four tall items, two are usually
 * intersecting at once, and "whichever crossed the line most recently" flickers
 * at the handover; nearest-to-centre has exactly one winner at every scroll
 * position.
 */

export interface FocusItem {
  /** The big serif title. */
  title: string;
  /** One or two sentences. This is the part that has to be read. */
  body: string;
  /** Optional short label above the title, e.g. a step number. */
  tag?: string;
}

interface FocusListProps {
  items: FocusItem[];
}

export function FocusList({ items }: FocusListProps) {
  const scope = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const list = scope.current;
    if (!list) return;

    let queued = false;
    const measure = () => {
      queued = false;
      const middle = window.innerHeight / 2;
      let best = 0;
      let bestGap = Infinity;
      Array.from(list.children).forEach((node, index) => {
        const box = (node as HTMLElement).getBoundingClientRect();
        const gap = Math.abs(box.top + box.height / 2 - middle);
        if (gap < bestGap) { bestGap = gap; best = index; }
      });
      setActive(current => (current === best ? current : best));
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [items.length]);

  return (
    <ol className="gb-focus" ref={scope}>
      {items.map((item, index) => (
        <li key={item.title} className={index === active ? 'is-on' : ''}>
          {item.tag && <span className="gb-focus-tag">{item.tag}</span>}
          <h3>{item.title}</h3>
          {/*
            The body is always in the document and always readable by a screen
            reader; only its height and opacity change. Rendering it
            conditionally would mean the page's actual explanation existed only
            for whoever happened to be scrolled to the right place, and would
            hide three quarters of the content from search and from print.
          */}
          <p>{item.body}</p>
        </li>
      ))}
    </ol>
  );
}
