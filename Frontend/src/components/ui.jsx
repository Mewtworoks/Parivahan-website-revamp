import React, { useState } from 'react';
import styles from './ui.module.scss';

export function Badge({ tone = 'neutral', children }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}

export function Panel({ title, subtitle, action, children, tone }) {
  return (
    <section className={`${styles.panel} ${tone ? styles[`panel_${tone}`] : ''}`}>
      {(title || action) && (
        <header className={styles.panelHead}>
          <div>
            {title && <h3 className={styles.panelTitle}>{title}</h3>}
            {subtitle && <p className={styles.panelSubtitle}>{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Button({ variant = 'primary', loading, children, ...rest }) {
  return (
    <button
      className={`${styles.btn} ${styles[`btn_${variant}`]}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Callout({ tone = 'info', title, children }) {
  return (
    <div className={`${styles.callout} ${styles[`callout_${tone}`]}`}>
      {title && <strong className={styles.calloutTitle}>{title}</strong>}
      <div>{children}</div>
    </div>
  );
}

export function Stat({ label, value, hint, tone }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statValue} ${tone ? styles[`statValue_${tone}`] : ''}`}>
        {value}
      </span>
      {hint && <span className={styles.statHint}>{hint}</span>}
    </div>
  );
}

/** Short monospace id with a copy affordance — ids are everywhere here. */
export function Mono({ children, truncate = 0 }) {
  const text = String(children ?? '');
  const shown = truncate && text.length > truncate ? `${text.slice(0, truncate)}…` : text;
  return (
    <code className={styles.mono} title={text}>
      {shown}
    </code>
  );
}

/**
 * Collapsible raw response. Every claim in this UI is checkable against the
 * JSON the backend actually returned — that is the point of the demo.
 */
export function JsonPeek({ label = 'raw API response', data, open = false }) {
  const [show, setShow] = useState(open);
  if (data === null || data === undefined) return null;
  return (
    <div className={styles.peek}>
      <button className={styles.peekToggle} onClick={() => setShow((s) => !s)}>
        {show ? '▾' : '▸'} {label}
      </button>
      {show && <pre className={styles.peekBody}>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
      {hint && <span className={styles.fieldHint}>{hint}</span>}
    </label>
  );
}

export function EmptyState({ children }) {
  return <p className={styles.empty}>{children}</p>;
}

/** Numbered rail showing where the citizen is in the journey. */
export function StepRail({ steps, current }) {
  return (
    <ol className={styles.rail}>
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo';
        return (
          <li key={s} className={`${styles.railStep} ${styles[`rail_${state}`]}`}>
            <span className={styles.railDot}>{i < current ? '✓' : i + 1}</span>
            <span className={styles.railLabel}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}
