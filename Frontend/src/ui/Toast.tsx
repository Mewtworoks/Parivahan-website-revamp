import { useEffect, useState } from 'react';
import { useT } from '../lib/language';
import { Icon } from './Icon';

/**
 * Brief confirmations that something finished, shown wherever the citizen is.
 *
 * Needed because Saarthi fills the application in a sheet that covers the page:
 * when it succeeds, the thing that changed is behind the panel they are looking
 * at. Saying so in the transcript is not enough — a spoken line scrolls away,
 * and the citizen has no way to tell whether the form on the site behind them
 * is now actually filled.
 *
 * A module-level emitter rather than context, because the callers are a voice
 * panel and a page component that have no ancestor in common worth threading a
 * provider through, and a toast has no state anyone needs to read back.
 */
export type ToastTone = 'ok' | 'brand' | 'warn';

export interface ToastItem {
  id: number;
  text: string;
  tone: ToastTone;
  /** Optional single action, e.g. "Book a slot". */
  action?: { label: string; run: () => void };
}

const LIFETIME_MS = 6000;

let seq = 0;
let items: ToastItem[] = [];
const listeners = new Set<(next: ToastItem[]) => void>();

function publish() {
  for (const listener of listeners) listener(items);
}

export function dismissToast(id: number) {
  items = items.filter(item => item.id !== id);
  publish();
}

export function toast(
  text: string,
  tone: ToastTone = 'ok',
  action?: ToastItem['action'],
): number {
  const id = ++seq;
  // Newest first, and never more than three on screen: a stack that grows
  // without limit covers the thing it is reporting on.
  items = [{ id, text, tone, action }, ...items].slice(0, 3);
  publish();
  window.setTimeout(() => dismissToast(id), LIFETIME_MS);
  return id;
}

const TONE_BORDER: Record<ToastTone, string> = {
  ok: 'var(--ok-line, var(--brand-line))',
  brand: 'var(--brand-line)',
  warn: 'var(--warn-line, var(--brand-line))',
};

/** Mounted once, at the site root. */
export function ToastHost() {
  const t = useT();
  const [list, setList] = useState<ToastItem[]>(items);

  useEffect(() => {
    listeners.add(setList);
    return () => { listeners.delete(setList); };
  }, []);

  if (!list.length) return null;

  return (
    // aria-live, so somebody using a screen reader is told the form was filled
    // rather than only shown it. Not a dialog: it steals no focus, because it
    // interrupts nothing.
    <div
      aria-live="polite"
      style={{
        position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 90,
        display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {list.map(item => (
        <div
          key={item.id}
          className="card row between g16 wrapf fade"
          style={{
            pointerEvents: 'auto', padding: '12px 14px', maxWidth: 460, width: '100%',
            borderColor: TONE_BORDER[item.tone], boxShadow: '0 8px 28px rgba(0,0,0,.18)',
          }}
        >
          <span className="row g10" style={{ alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--brand)', flex: 'none', marginTop: 2 }}>
              {item.tone === 'warn' ? Icon.bang() : Icon.check()}
            </span>
            <span style={{ fontSize: '.93rem' }}>{item.text}</span>
          </span>
          <span className="row g8" style={{ flex: 'none' }}>
            {item.action && (
              <button
                className="btn btn-p btn-sm"
                onClick={() => { item.action!.run(); dismissToast(item.id); }}
              >
                {item.action.label}
              </button>
            )}
            <button
              className="btn btn-g btn-sm"
              aria-label={t('Dismiss', 'हटाएं', 'काढून टाका')}
              onClick={() => dismissToast(item.id)}
            >
              ✕
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
