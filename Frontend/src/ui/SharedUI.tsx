import { Fragment, useEffect, type InputHTMLAttributes, type ReactNode } from 'react';
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

export function Note({ tone, icon, children }: { tone?: string; icon?: ReactNode | false; children: ReactNode }) {
  return (
    <div className={'note' + (tone ? ' note-' + tone : '')}>
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
  return (
    <nav className="rail" aria-label="Progress">
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

export function Sheet({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  // Escape closes it. Until now the only ways out were the X and the backdrop,
  // both of which need a pointer — so anyone driving this from the keyboard was
  // shut inside a panel covering the page, with the rest of the site still
  // clickable underneath and no way to reach it.
  useEffect(() => {
    const mine = Symbol('sheet');
    openSheets.push(mine);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (openSheets[openSheets.length - 1] !== mine) return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const at = openSheets.indexOf(mine);
      if (at !== -1) openSheets.splice(at, 1);
    };
  }, [onClose]);

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="row between" style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--surface)' }}>
          <h3>{title}</h3><button className="btn btn-g btn-sm" onClick={onClose} aria-label="Close">{Icon.x()}</button>
        </div>
        <div style={{ padding: '22px' }}>{children}</div>
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
