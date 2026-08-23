import { useEffect, useState } from 'react';
import { useT } from '../lib/language';
import { Icon } from './Icon';

/**
 * A floating button that appears once the page is scrolled, so the Home/Back control at the top
 * is never more than one tap away. Always mounted (visibility is a CSS transition, not a
 * mount/unmount) so it fades and slides in/out instead of popping.
 *
 * Scrolls smoothly on click — unlike the shared `scrollToTop()` helper used on route changes,
 * there's no same-tick re-render here to cancel a smooth scroll mid-flight, so an animated
 * glide back to the top is safe.
 */
export function BackToTop() {
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 420);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const label = t('Back to top', 'ऊपर जाएं', 'वर जा');
  return (
    <button className="backtotop" data-shown={visible ? '1' : '0'} tabIndex={visible ? 0 : -1} aria-hidden={!visible}
      onClick={() => window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })} aria-label={label} title={label}>
      {Icon.up({ width: 18, height: 18 })}
    </button>
  );
}
