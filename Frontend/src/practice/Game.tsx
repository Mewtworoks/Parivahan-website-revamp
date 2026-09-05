import { useEffect, useMemo, useRef, useState } from 'react';
import { AUTO_READ_DELAY, autoScrollToBottom, autoWait } from '../lib/autoDemo';
import { scrollToTop } from '../lib/scrollToTop';
import { Icon } from '../ui/Icon';
import type { GameLogEntry, PageProps } from '../types';
import { PixelScene } from './PixelScene';
import { RoadScene } from './RoadScene';
import { AXIS_LABELS, DECISION_LIMIT_MS, FAST_ANSWER_MS, ROAD_SPECS, scenariosFor, vehicleFocusFrom } from './scenarios';
import { isSfxMuted, playCorrect, playWrong, setSfxMuted } from './sound';

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
    setLog(l => [...l, { id: scenario.id, axes: scenario.axes, ok: correct, ms, fast, to: choice === null, pick: choice }]);
    if (correct) { setScore(v => v + (fast ? 120 : 70)); playCorrect(); }
    else {
      // Shake and a wrong-answer tone, and that is the whole consequence. There
      // used to be three lives here, and a game-over sound when the last went.
      setShake(true); setTimeout(() => setShake(false), 420);
      playWrong();
    }
    setPick(choice);
    setRevealed(true);
  }

  function goToNext() {
    // The round ends when the questions do, and only then.
    //
    // It used to end at the third wrong answer, which meant the situations a
    // learner most needed were exactly the ones they never reached — get three
    // wrong early and the remaining twenty-odd were simply never shown. Three
    // lives is the right shape for an arcade game and the wrong shape for a
    // practice test, and this is a practice test.
    const isLast = index >= queue.length - 1;
    if (isLast) { update({ gameLog: log, focus: null, autoDemo: undefined }); go('report'); }
    else { setIndex(index + 1); setPick(null); setRevealed(false); locked.current = false; scrollToTop(); }
  }

  // Demo autopilot — commits the scenario's own correct answer (`scenario.c`,
  // known locally rather than hidden server-side the way the real theory
  // test's is), then moves on once the explanation is revealed.
  const autoAnsweredFor = useRef<string | null>(null);
  useEffect(() => {
    if (state.autoDemo !== 'game' || revealed || autoAnsweredFor.current === scenario.id) return;
    autoAnsweredFor.current = scenario.id;
    void (async () => { await autoWait(); commit(scenario.c); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.autoDemo, scenario.id, revealed]);
  useEffect(() => {
    if (state.autoDemo !== 'game' || !revealed) return;
    void (async () => { await autoWait(); await autoScrollToBottom(); await autoWait(AUTO_READ_DELAY); goToNext(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.autoDemo, revealed]);

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
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }} onClick={() => go('home')}>{Icon.left()} Home</button>
      <div className="gamecard col">
        <div className="hud">
          <div className="row g10 center">
            <span className="hud-l">{AXIS_LABELS[scenario.lvl]}</span>
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
            {/* The chase-camera view where a scene has been authored for it, and
                the overhead one otherwise. Every one of the twenty-nine has a
                scene now, so the fallback should never fire — it is kept because
                a missing entry should degrade to the old illustration rather
                than render an empty road with the situation not in it. */}
            {ROAD_SPECS[scenario.id]
              ? <RoadScene spec={ROAD_SPECS[scenario.id]} progress={1 - timeLeft / DECISION_LIMIT_MS} revealed={revealed} />
              : <PixelScene map={scenario.map} art={scenario.art} shake={shake} progress={1 - timeLeft / DECISION_LIMIT_MS} revealed={revealed} />}
            <div className="cdbar" aria-hidden="true"><i style={{ width: (revealed ? 0 : timeLeft / DECISION_LIMIT_MS * 100) + '%', background: timeLeft < DECISION_LIMIT_MS * 0.35 ? 'var(--bad)' : 'var(--accent)' }} /></div>
          </div>
          <div className="col g20" style={{ padding: '22px 24px 24px' }}>
            <p style={{ fontSize: '1.08rem', fontWeight: 500, lineHeight: 1.5 }}>{scenario.q}</p>
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
                {/* The sub-line only appears when it has something to say.
                    A wrong answer used to be followed by "Decision time 2.5s.",
                    which is a stopwatch reading placed directly above the
                    paragraph explaining what the right answer was — it competed
                    with the only sentence on the screen that teaches anything,
                    and how long somebody took to be wrong is not the lesson.
                    A timeout and a correct-but-slow answer are different: there
                    the time *is* the finding, so it stays. */}
                <div className="verdict" data-s={pick === scenario.c ? (lastEntry?.fast ? 'ok' : 'slow') : 'bad'}>
                  <b>{pick === null ? 'Time ran out.' : pick === scenario.c ? (lastEntry?.fast ? 'Correct, and quick.' : 'Correct — but slow.') : 'Wrong call.'}</b>
                  {pick === null && <span>{`In the real test hesitation is scored as a failure to decide. ${DECISION_LIMIT_MS / 1000} seconds is the window you get.`}</span>}
                  {pick === scenario.c && !lastEntry?.fast && <span>{`You took ${(lastEntry.ms / 1000).toFixed(1)}s. Under ${FAST_ANSWER_MS / 1000} seconds is what a confident driver looks like.`}</span>}
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
          <button className="btn btn-p btn-full" onClick={goToNext}>{index >= queue.length - 1 ? 'Finish and see report card' : 'Next situation'} {Icon.right()}</button>
        </div>
      )}
      <div style={{ height: 48 }} />
    </div>
  );
}
