import { Fragment, useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { useT } from '../lib/language';
import { Icon } from './Icon';

/**
 * Which sheets are open, innermost last.
 *
 * Escape closes the top one only. With one sheet at a time this is the same as
 * closing "the" sheet, but a listener per sheet would close every open one at
 * once the moment a second is ever stacked — a silent bug at exactly the point
 * somebody adds a confirmation over a panel.
 */
const openSheets: symbol[] = [];

export function Pill({ tone, children }: { tone?: string; children: ReactNode }) {
  return <span className={'pill' + (tone ? ' pill-' + tone : '')}>{children}</span>;
}

/**
 * `live` marks a note that appeared *because* of something the citizen just
 * did — a failed submit, a lost slot, a refused check-in. Those have to be
 * announced: a screen-reader user pressed a button, the button came back, and
 * without this nothing at all is read out to say why nothing happened.
 *
 * Not the default. Most notes on this site are standing explanations that were
 * on the page before it was read, and marking those as alerts would interrupt
 * the reader to tell them something they are already being told.
 */
export function Note({ tone, icon, live, children }: { tone?: string; icon?: ReactNode | false; live?: boolean; children: ReactNode }) {
  return (
    <div className={'note' + (tone ? ' note-' + tone : '')} role={live ? 'alert' : undefined}>
      {icon !== false && <span style={{ flex: 'none', marginTop: 2, color: 'var(--muted)' }}>{icon || Icon.bang()}</span>}
      <div>{children}</div>
    </div>
  );
}

export function Tile({ checked, onClick, title, desc, right }: {
  checked?: boolean;
  onClick?: () => void;
  title: ReactNode;
  desc?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <button className="tile" role="radio" aria-checked={!!checked} onClick={onClick}>
      <span className="tick">{checked ? Icon.check() : null}</span>
      <span className="col g4 grow"><span style={{ fontWeight: 600 }}>{title}</span>{desc && <span className="sub">{desc}</span>}</span>
      {right}
    </button>
  );
}

/** The three-part "what am I doing, what does it lead to, why does it help me" briefing shown at the top of every wizard step — a short chain of reasoning, numbered like the site's other step sequences. */
export function Purpose({ what, because, why }: { what: ReactNode; because: ReactNode; why: ReactNode }) {
  const t = useT();
  const steps: [string, ReactNode][] = [
    [t('What', 'क्या', 'काय'), what],
    [t('Because of this', 'इसकी वजह से', 'यामुळे'), because],
    [t('Why it helps you', 'यह आपकी मदद कैसे करता है', 'याचा तुम्हाला कसा फायदा होतो'), why],
  ];
  return (
    <div className="purpose">
      {steps.map(([label, body], i) => (
        <Fragment key={label}>
          {i > 0 && <span className="purpose-arrow" aria-hidden="true">{Icon.right()}</span>}
          <div className="purpose-i">
            <div className="purpose-h"><span className="purpose-n">{i + 1}</span><span className="purpose-k">{label}</span></div>
            <p className="purpose-b">{body}</p>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

export function Field({ label, hint, error, children }: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {hint && <span className="hint">{hint}</span>}
      {children}
      {error && <span className="err">{error}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Stepper({ steps, cur, onJump }: { steps: string[]; cur: number; onJump?: (i: number) => void }) {
  const t = useT();
  return (
    <nav className="rail" aria-label={t('Progress', 'प्रगति', 'प्रगती')}>
      {steps.map((label, i) => {
        const state = i < cur ? 'done' : i === cur ? 'now' : 'todo';
        return (
          <button key={i} className="rail-i" data-s={state} disabled={i > cur} onClick={() => onJump && i < cur && onJump(i)}>
            <span className="rail-n">{i < cur ? Icon.check() : i + 1}</span><span className="rail-l">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function Progress({ cur, total, label }: { cur: number; total: number; label: string }) {
  const t = useT();
  return (
    <div className="col g8">
      <div className="row between"><span className="tiny" style={{ fontWeight: 600, color: 'var(--ink2)' }}>{label}</span><span className="tiny">{t('Step', 'चरण', 'टप्पा')} {cur + 1}/{total}</span></div>
      <div className="pbar"><i style={{ width: ((cur + 1) / total * 100) + '%' }} /></div>
    </div>
  );
}

export interface TimelineItem {
  state: 'done' | 'now' | 'todo';
  title: ReactNode;
  tag?: ReactNode;
  tone?: string;
  body?: ReactNode;
  action?: ReactNode;
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="tl">
      {items.map((it, i) => (
        <div key={i} className="tl-i" data-s={it.state}>
          <span className="tl-d">{it.state === 'done' ? Icon.check() : it.state === 'now' ? Icon.dot() : null}</span>
          <div className="col g4" style={{ paddingTop: 1 }}>
            <div className="row g8 wrapf"><b style={{ fontWeight: 600 }}>{it.title}</b>{it.tag && <Pill tone={it.tone}>{it.tag}</Pill>}</div>
            {it.body && <span className="sub">{it.body}</span>}
            {it.action}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A right-hand panel.
 *
 * `fill` hands the scrolling to the child instead of scrolling the panel: a
 * conversation wants to sit at the bottom of the space it has and grow upward,
 * which a panel that scrolls as a whole cannot do.
 */
export function Sheet({ title, onClose, children, fill }: { title: ReactNode; onClose: () => void; children: ReactNode; fill?: boolean }) {
  const t = useT();
  // Named so `aria-labelledby` has something to point at. A dialog with no
  // accessible name is announced as "dialog" and nothing else, which is the
  // same panel whether it is sign-in, help or Saarthi.
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // The control that opened the sheet, so focus can be handed back to it. A
  // panel that closes and drops focus on the document body restarts the
  // keyboard user at the top of the page — punishing them for having opened it.
  const opener = useRef<Element | null>(null);
  // Escape closes it. Until now the only ways out were the X and the backdrop,
  // both of which need a pointer — so anyone driving this from the keyboard was
  // shut inside a panel covering the page, with the rest of the site still
  // clickable underneath and no way to reach it.
  //
  // The page behind it used to stay scrollable too — a wheel over the dimmed
  // backdrop scrolled the site underneath while the sheet sat still on top of
  // it, which reads as the panel not actually being in front of the page.
  // Locked and unlocked off the same `openSheets` stack the Escape handler
  // already keeps, so a sheet opened from inside another sheet does not
  // unlock the page the moment the inner one closes — only the outer one
  // closing, with the stack back to empty, gives scrolling back.
  useEffect(() => {
    const mine = Symbol('sheet');
    const wasEmpty = openSheets.length === 0;
    openSheets.push(mine);
    if (wasEmpty) {
      // Locking overflow removes the scrollbar, which shifts every fixed and
      // sticky element left by its width — compensated here so the page does
      // not visibly flinch open a sheet.
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (openSheets[openSheets.length - 1] !== mine) return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey);

    // Focus moves into the panel, and Tab is kept inside it. Without the trap
    // the panel is a picture: Tab walks straight out into the page behind,
    // which is still there and still clickable, so the "modal" is only modal
    // for people using a mouse.
    opener.current = document.activeElement;
    const focusable = () => Array.from(
      panel.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter(el => el.offsetParent !== null);
    focusable()[0]?.focus();

    const onTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      if (openSheets[openSheets.length - 1] !== mine) return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const here = document.activeElement;
      if (event.shiftKey && (here === first || !panel.current?.contains(here))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && here === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onTab);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keydown', onTab);
      (opener.current as HTMLElement | null)?.focus?.();
      const at = openSheets.indexOf(mine);
      if (at !== -1) openSheets.splice(at, 1);
      if (openSheets.length === 0) {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      }
    };
  }, [onClose]);

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}>
        {/* No longer position:sticky — the panel is a column and the body
            scrolls, so the header stays put by being outside the scroller. */}
        <div className="row between" style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', flex: 'none', background: 'var(--surface)' }}>
          <h3 id={titleId}>{title}</h3><button className="btn btn-g btn-sm" onClick={onClose} aria-label={t('Close', 'बंद करें', 'बंद करा')}>{Icon.x()}</button>
        </div>
        <div className={`sheet-body${fill ? ' fill' : ''}`}>{children}</div>
      </div>
    </div>
  );
}

export function Placeholder({ label, h = 140 }: { label: string; h?: number }) {
  return (
    <div className="stripe" style={{ height: h, borderRadius: 12, display: 'grid', placeItems: 'center', border: '1px solid var(--line)' }}>
      <span className="mono tiny" style={{ background: 'var(--surface)', padding: '4px 9px', borderRadius: 6, border: '1px solid var(--line)' }}>{label}</span>
    </div>
  );
}

/** Sticky bottom bar used to move between wizard steps. */
export function Bar({ back, onBack, next, onNext, disabled, secondary }: {
  back?: string;
  onBack?: () => void;
  next: string;
  onNext: () => void;
  disabled?: boolean;
  secondary?: ReactNode;
}) {
  return (
    <div className="sticky-cta">
      <div className="row g12 wrapf">
        {back && <button className="btn btn-s" onClick={onBack}>{Icon.left()} {back}</button>}
        <div className="grow only-m" style={{ flexBasis: '100%', height: 0 }} />
        <button className="btn btn-p grow" style={{ maxWidth: 320 }} onClick={onNext} disabled={disabled}>{next} {Icon.right()}</button>
        {secondary}
      </div>
    </div>
  );
}
