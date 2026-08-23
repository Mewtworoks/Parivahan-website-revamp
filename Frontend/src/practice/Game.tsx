import { useEffect, useMemo, useRef, useState } from 'react';
import { scrollToTop } from '../lib/scrollToTop';
import { Icon } from '../ui/Icon';
import type { GameLogEntry, PageProps } from '../types';
import { PixelScene } from './PixelScene';
import { AXIS_LABELS, DECISION_LIMIT_MS, FAST_ANSWER_MS, scenariosFor, vehicleFocusFrom } from './scenarios';
import { isSfxMuted, playCorrect, playWrong, setSfxMuted } from './sound';

/** Reads a scenario's question and options aloud, when the browser supports speech synthesis. */
function speak(text: string) {
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  } catch {
    // Speech synthesis isn't available in every browser — reading the text is optional.
  }
}

/** The practice round: pick an answer against a 4-second countdown, see why, move on. */
export function Game({ go, state, update }: PageProps) {
  const focusAxis = state.focus || null;
  const vehicleFocus = vehicleFocusFrom(state);
  const queue = useMemo(() => {
    const all = scenariosFor(vehicleFocus).slice();
    if (!focusAxis) return all;
    const matching = all.filter(s => s.axes.includes(focusAxis));
    const rest = all.filter(s => !s.axes.includes(focusAxis));
    return matching.concat(rest).slice(0, 8);
  }, [focusAxis, vehicleFocus]);

  const [index, setIndex] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [hearts, setHearts] = useState(3);
  const [score, setScore] = useState(0);
  const [log, setLog] = useState<GameLogEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState(DECISION_LIMIT_MS);
  const [shake, setShake] = useState(false);
  const [muted, setMuted] = useState(isSfxMuted);
  const startedAt = useRef(Date.now());
  const locked = useRef(false);
  const scenario = queue[index];

  useEffect(() => { startedAt.current = Date.now(); setTimeLeft(DECISION_LIMIT_MS); }, [index]);

  useEffect(() => {
    if (revealed) return;
    const timer = setInterval(() => {
      const remaining = DECISION_LIMIT_MS - (Date.now() - startedAt.current);
      if (remaining <= 0) { clearInterval(timer); commit(null); } else setTimeLeft(remaining);
    }, 50);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, revealed]);

  function commit(choice: number | null) {
    if (revealed || locked.current) return;
    locked.current = true;
    const ms = Math.min(DECISION_LIMIT_MS, Date.now() - startedAt.current);
    const correct = choice === scenario.c;
    const fast = ms <= FAST_ANSWER_MS;
    setLog(l => [...l, { id: scenario.id, axes: scenario.axes, ok: correct, ms, fast, to: choice === null }]);
    if (correct) { setScore(v => v + (fast ? 120 : 70)); playCorrect(); }
    else { setHearts(h => h - 1); setShake(true); setTimeout(() => setShake(false), 420); playWrong(); }
    setPick(choice);
    setRevealed(true);
  }

  function goToNext() {
    const outOfHearts = hearts <= 0;
    const isLast = index >= queue.length - 1;
    if (outOfHearts || isLast) { update({ gameLog: log, focus: null }); go('report'); }
    else { setIndex(index + 1); setPick(null); setRevealed(false); locked.current = false; scrollToTop(); }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const answerIndex: Record<string, number> = { a: 0, b: 1, c: 2 };
      const n = answerIndex[e.key.toLowerCase()];
      if (!revealed && n !== undefined) commit(n);
      else if (revealed && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); goToNext(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  const streak = (() => { let n = 0; for (let i = log.length - 1; i >= 0; i--) { if (log[i].ok) n++; else break; } return n; })();
  const avgMs = log.length ? Math.round(log.reduce((sum, e) => sum + e.ms, 0) / log.length) : 0;
  const lastEntry = log[log.length - 1];

  return (
    <div className="fade" style={{ padding: '28px 24px 0', maxWidth: 980, margin: '0 auto' }}>
      <div className="gamecard col">
        <div className="hud">
          <div className="row g10 center">
            <span className="hearts" role="status" aria-label={`${hearts} of 3 hearts remaining`}>{[0, 1, 2].map(n => <i key={n} data-on={n < hearts ? '1' : null} />)}</span>
            <span className="hud-l hide-m">{AXIS_LABELS[scenario.lvl]}</span>
          </div>
          <div className="row g10 center">
            <span className="hud-l">{String(score).padStart(4, '0')}</span>
            <span className="hud-l" style={{ opacity: 0.7 }}>{index + 1}/{queue.length}</span>
            <button className="hud-btn" onClick={() => { const next = !muted; setMuted(next); setSfxMuted(next); }} aria-label={muted ? 'Unmute sound' : 'Mute sound'}>
              {muted ? Icon.speakerOff({ width: 15, height: 15 }) : Icon.speaker({ width: 15, height: 15 })}
            </button>
          </div>
        </div>
        <div className="gamebody fade" key={scenario.id}>
          <div className="gamescreen">
            <PixelScene map={scenario.map} art={scenario.art} shake={shake} />
            <div className="cdbar" aria-hidden="true"><i style={{ width: (revealed ? 0 : timeLeft / DECISION_LIMIT_MS * 100) + '%', background: timeLeft < 1400 ? 'var(--bad)' : 'var(--accent)' }} /></div>
          </div>
          <div className="col g20" style={{ padding: '22px 24px 24px' }}>
            <div className="row between g12" style={{ alignItems: 'flex-start' }}>
              <p style={{ fontSize: '1.08rem', fontWeight: 500, lineHeight: 1.5 }}>{scenario.q}</p>
              <button className="btn btn-s btn-sm" onClick={() => speak(scenario.q + '. Option A. ' + scenario.a[0] + '. Option B. ' + scenario.a[1] + '. Option C. ' + scenario.a[2])} aria-label="Read the question aloud" style={{ flex: 'none' }}>{Icon.speaker()}</button>
            </div>
            <div className="col g10">
              {scenario.a.map((answer, n) => {
                const isCorrect = n === scenario.c;
                const chosen = pick === n;
                const answerState = revealed && isCorrect ? 'ok' : revealed && chosen && !isCorrect ? 'bad' : chosen ? 'sel' : null;
                return (
                  <button key={n} className="ansrow" data-s={answerState} disabled={revealed} onClick={() => commit(n)}>
                    <span className="letter">{'ABC'[n]}</span><span style={{ fontWeight: 500 }}>{answer}</span>
                    {revealed && isCorrect && <span className="grow" style={{ textAlign: 'right', color: 'var(--ok)', flex: 'none', marginLeft: 'auto' }}>{Icon.check()}</span>}
                  </button>
                );
              })}
            </div>
            {revealed && (
              <div className="col g14 fade" role="status" aria-live="polite">
                <div className="verdict" data-s={pick === scenario.c ? (lastEntry?.fast ? 'ok' : 'slow') : 'bad'}>
                  <b>{pick === null ? 'Time ran out.' : pick === scenario.c ? (lastEntry?.fast ? 'Correct, and quick.' : 'Correct — but slow.') : 'Wrong call.'}</b>
                  <span>{pick === null
                    ? 'In the real test hesitation is scored as a failure to decide. Four seconds is the window you get.'
                    : pick === scenario.c && !lastEntry?.fast
                      ? `You took ${(lastEntry.ms / 1000).toFixed(1)}s. Under two seconds is what a confident driver looks like.`
                      : `Decision time ${(lastEntry.ms / 1000).toFixed(1)}s.`}</span>
                </div>
                <p style={{ lineHeight: 1.6 }}>{scenario.ex}</p>
                <span className="tiny mono">{scenario.cite}</span>
              </div>
            )}
            {!revealed && (
              <div className="row between g12 wrapf tiny">
                <span>Streak {streak} · avg decision {avgMs ? (avgMs / 1000).toFixed(1) + 's' : '—'}</span>
                <span className="hide-m">Keyboard: A, B, C to answer · Enter to continue</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {revealed && (
        <div className="sticky-cta">
          <button className="btn btn-p btn-full" onClick={goToNext}>{hearts <= 0 ? 'See my report card' : index >= queue.length - 1 ? 'Finish and see report card' : 'Next situation'} {Icon.right()}</button>
        </div>
      )}
      <div style={{ height: 48 }} />
    </div>
  );
}
