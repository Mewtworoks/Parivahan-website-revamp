import { Icon } from '../ui/Icon';
import { Note } from '../ui/SharedUI';
import type { PageProps } from '../types';
import { SKILL_AXES, scoreOf } from './scenarios';

function weakestAxisAdvice(axisKey: string, label: string, scorePercent: number): string {
  const advice =
    axisKey === 'hazard' ? 'You handled the hazards you could see and missed the ones you could not. Slow down near stationary vehicles and bus stops before the danger appears.'
    : axisKey === 'signal' ? 'Amber is the one that catches people. Treat it as stop unless stopping is unsafe.'
    : axisKey === 'priority' ? 'Revise right of way at unmarked junctions and zebra crossings — traffic from the right, and pedestrians already crossing, go first.'
    : axisKey === 'sign' ? 'Learn the shapes before the pictures: triangle warns, circle orders, rectangle informs.'
    : 'Your decision times swing widely. The test rewards a steady four seconds per question, not two fast then one frozen.';
  return `${label} is your weakest axis at ${scorePercent}%. ${advice}`;
}

/** The readiness report card shown after a practice round: score, per-skill breakdown, and what to fix next. */
export function Report({ go, state, update }: PageProps) {
  const log = state.gameLog || [];
  if (!log.length) {
    return (
      // Named, like the report itself. Reached directly — a shared link, a
      // refresh — this was a lone sentence with nothing saying which screen it
      // was or what it would have shown.
      <div className="narrow fade" style={{ padding: '60px 24px' }}>
        <div className="col g10">
          <span className="eyebrow">Practice</span>
          <h1>Readiness report</h1>
          <Note>No round played yet. <a href="#/game" onClick={e => { e.preventDefault(); go('game'); }}>Start the practice game</a> and the report fills in from it.</Note>
        </div>
      </div>
    );
  }

  const scores = scoreOf(log);
  const testedScores = SKILL_AXES.map(([key]) => scores[key]).filter((v): v is number => v !== null);
  const readinessPercent = Math.round(testedScores.reduce((sum, v) => sum + v, 0) / testedScores.length * 100);
  const avgMs = log.reduce((sum, e) => sum + e.ms, 0) / log.length;
  const clearedCount = log.filter(e => e.ok).length;
  const weakestFirst = SKILL_AXES.filter(([key]) => scores[key] !== null).sort((a, b) => scores[a[0]]! - scores[b[0]]!);
  const weakest = weakestFirst[0];
  const correctButSlow = log.filter(e => e.ok && !e.fast);

  const notes: string[] = [];
  if (weakest) notes.push(weakestAxisAdvice(weakest[0], weakest[1], Math.round(scores[weakest[0]]! * 100)));
  if (correctButSlow.length) {
    const avgSlowSeconds = (correctButSlow.reduce((sum, e) => sum + e.ms, 0) / correctButSlow.length / 1000).toFixed(1);
    notes.push(`You answered ${correctButSlow.length} question${correctButSlow.length > 1 ? 's' : ''} correctly but took over 2.2 seconds — averaging ${avgSlowSeconds}s. Correct and slow is still a hesitation, and in the practical test it is the thing an examiner writes down.`);
  }
  if (readinessPercent >= 80) notes.push('You are above the pass line on the current bank. Take the mock test, then book the slot.');

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <div className="col g10" style={{ marginBottom: 24 }}>
        <span className="eyebrow">Practice round complete</span>
        <h1>Readiness report</h1>
        <p className="lede">Scored the way the test scores you — on the decision and the time it took, not just the letter you picked.</p>
      </div>
      <div className="card col" style={{ overflow: 'hidden' }}>
        <div className="row wrapf" style={{ padding: '26px 26px 22px', gap: 32, alignItems: 'flex-end' }}>
          <div className="col g4"><span className="sub">Readiness</span>
            <b style={{ fontFamily: 'var(--disp)', fontSize: '3.4rem', lineHeight: 1, letterSpacing: '-.04em' }}>{readinessPercent}%</b>
            <span className="tiny">{readinessPercent >= 80 ? 'Above the pass line' : readinessPercent >= 60 ? 'Borderline — one more round' : 'Not ready yet'}</span></div>
          <div className="col g4"><span className="sub">Average decision</span><b style={{ fontFamily: 'var(--disp)', fontSize: '1.5rem' }}>{(avgMs / 1000).toFixed(1)}s</b><span className="tiny">of a 4.0s window</span></div>
          <div className="col g4"><span className="sub">Cleared</span><b style={{ fontFamily: 'var(--disp)', fontSize: '1.5rem' }}>{clearedCount} of {log.length}</b><span className="tiny">situations</span></div>
        </div>
        <hr className="hr" />
        <div className="col g16" style={{ padding: 26 }}>
          <h3>Five skills</h3>
          {SKILL_AXES.map(([key, label]) => {
            const value = scores[key];
            return (
              <div key={key} className="col g6">
                <div className="row between g12"><span style={{ fontWeight: 500, fontSize: '.93rem' }}>{label}</span>
                  <span className="tiny mono">{value === null ? 'not tested' : Math.round(value * 100) + '%'}</span></div>
                <div className="pbar"><i style={{ width: (value === null ? 0 : value * 100) + '%', background: value === null ? 'var(--line2)' : value >= 0.75 ? 'var(--ok)' : value >= 0.5 ? 'var(--warn)' : 'var(--bad)' }} /></div>
              </div>
            );
          })}
        </div>
        <hr className="hr" />
        <div className="col g14" style={{ padding: 26, background: 'var(--surface2)' }}>
          <div className="row between g12 wrapf"><h3>What to fix next</h3><span className="tiny mono">written from your score vector</span></div>
          {notes.map((note, i) => (
            <div key={i} className="row g12" style={{ alignItems: 'flex-start' }}><span style={{ color: 'var(--brand)', marginTop: 4, flex: 'none' }}>{Icon.dot()}</span><p style={{ lineHeight: 1.6, fontSize: '.95rem' }}>{note}</p></div>
          ))}
        </div>
      </div>
      {weakest && (
        <div style={{ marginTop: 16 }}>
          <Note tone="brand"><b>Next round adapts.</b> Because {weakest[1].toLowerCase()} scored lowest, the engine will weight the next eight situations towards it instead of reshuffling the same twelve.</Note>
        </div>
      )}
      <div className="sticky-cta"><div className="row g12 wrapf">
        <button className="btn btn-p" onClick={() => { update({ focus: weakest ? weakest[0] : null }); go('game'); }}>{'Practise ' + (weakest ? weakest[1].toLowerCase() : 'again') + ' · 8 situations'} {Icon.right()}</button>
        <button className="btn btn-s" onClick={() => go('test')}>Take the mock test</button>
      </div></div>
    </div>
  );
}
