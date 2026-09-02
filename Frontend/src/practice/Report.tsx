import { Icon } from '../ui/Icon';
import { Note } from '../ui/SharedUI';
import type { GameLogEntry, PageProps } from '../types';
import { DECISION_LIMIT_MS, FAST_ANSWER_MS, SCENARIOS, SKILL_AXES, scoreOf } from './scenarios';

/**
 * The wrong answers, joined back to the situations they came from.
 *
 * The log stores scenario ids, so the report could always count mistakes and
 * never name them. Counting is scoring; naming is teaching, and only one of
 * those helps somebody pass on the next attempt.
 */
type Mistake = {
  entry: GameLogEntry;
  n: number;
  q: string;
  chose: string | null;
  answer: string;
  ex: string;
  cite: string;
};

function mistakesFrom(log: GameLogEntry[]): Mistake[] {
  const byId = new Map(SCENARIOS.map(s => [s.id, s]));
  const out: Mistake[] = [];
  log.forEach((entry, i) => {
    if (entry.ok) return;
    const s = byId.get(entry.id);
    if (!s) return;
    out.push({
      entry,
      n: i + 1,
      q: s.q,
      // A timeout has no wrong answer to show, and pretending otherwise ("you
      // chose A") would be a lie about the one thing this sheet is for.
      //
      // Loose null check on purpose. journeyStore persists the whole state to
      // localStorage, so a round played before `pick` existed comes back with
      // the field absent rather than null — a strict `=== null` would fall
      // through and index the answers with undefined, printing a blank where the
      // wrong answer should be.
      chose: typeof entry.pick !== 'number' ? null : s.a[entry.pick] ?? null,
      answer: s.a[s.c],
      ex: s.ex,
      cite: s.cite,
    });
  });
  return out;
}

function weakestAxisAdvice(axisKey: string, label: string, scorePercent: number): string {
  const advice =
    axisKey === 'hazard' ? 'You handled the hazards you could see and missed the ones you could not. Slow down near stationary vehicles and bus stops before the danger appears.'
    : axisKey === 'signal' ? 'Amber is the one that catches people. Treat it as stop unless stopping is unsafe.'
    : axisKey === 'priority' ? 'Revise right of way at unmarked junctions and zebra crossings — traffic from the right, and pedestrians already crossing, go first.'
    : axisKey === 'sign' ? 'Learn the shapes before the pictures: triangle warns, circle orders, rectangle informs.'
    : `Your decision times swing widely. The test rewards a steady pace inside the ${DECISION_LIMIT_MS / 1000}-second window, not two fast then one frozen.`;
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
        <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }} onClick={() => go('home')}>{Icon.left()} Home</button>
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
  const mistakes = mistakesFrom(log);

  const notes: string[] = [];
  if (weakest) notes.push(weakestAxisAdvice(weakest[0], weakest[1], Math.round(scores[weakest[0]]! * 100)));
  if (correctButSlow.length) {
    const avgSlowSeconds = (correctButSlow.reduce((sum, e) => sum + e.ms, 0) / correctButSlow.length / 1000).toFixed(1);
    notes.push(`You answered ${correctButSlow.length} question${correctButSlow.length > 1 ? 's' : ''} correctly but took over ${FAST_ANSWER_MS / 1000} seconds — averaging ${avgSlowSeconds}s. Correct and slow is still a hesitation, and in the practical test it is the thing an examiner writes down.`);
  }
  if (readinessPercent >= 80) notes.push('You are above the pass line on the current bank. Take the mock test, then book the slot.');

  return (
    <div className="narrow fade report-root" style={{ padding: '40px 24px 0' }}>
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }} onClick={() => go('home')}>{Icon.left()} Home</button>
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
          <div className="col g4"><span className="sub">Average decision</span><b style={{ fontFamily: 'var(--disp)', fontSize: '1.5rem' }}>{(avgMs / 1000).toFixed(1)}s</b><span className="tiny">of a {DECISION_LIMIT_MS / 1000}s window</span></div>
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
      {/* The part of a report card that is actually revisable: every situation
          that went wrong, the answer that was given, the answer that was right,
          and the rule it comes from. */}
      {mistakes.length > 0 && (
        <div className="card col printable" style={{ marginTop: 16, overflow: 'hidden' }}>
          {/* Only on paper. A printed sheet leaves the page it came from behind,
              so it has to say what it is, what it is not, and when it was made —
              a revision sheet with a date on it is checkable against the bank it
              was drawn from later. */}
          <div className="print-only printhead">
            <b>Road-rule revision sheet</b>
            <span>{mistakes.length} situation{mistakes.length > 1 ? 's' : ''} answered wrong of {log.length} · readiness {readinessPercent}% · {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <span>Parivahan Sewa redesign concept · practice bank written from the Motor Vehicles Act, the Central Motor Vehicles Rules and published state question banks. Not an official document.</span>
          </div>
          <div className="row between g12 wrapf" style={{ padding: '22px 26px', alignItems: 'flex-end' }}>
            <div className="col g4 noprint">
              <h3>Where you went wrong</h3>
              <span className="tiny">{mistakes.length} of {log.length} situations · every one with the rule it comes from</span>
            </div>
            {/* The browser's own print-to-PDF rather than a PDF library. Two
                reasons, and the second is decisive: it adds no dependency to a
                bundle this size, and it renders Devanagari correctly. A
                client-side PDF writer needs a Devanagari font embedded to avoid
                emitting tofu, and the scenario bank is on its way to Hindi and
                Marathi — a study sheet that cannot be read in the language
                somebody revises in is not a study sheet. */}
            <button className="btn btn-s noprint" onClick={() => window.print()}>
              {Icon.doc({ width: 15, height: 15 })} Save these as a PDF
            </button>
          </div>
          <hr className="hr noprint" />
          {mistakes.map((m, i) => (
            <div key={m.entry.id} className="col g10 mistake" style={{ padding: '20px 26px', borderTop: i === 0 ? undefined : '1px solid var(--line)' }}>
              <div className="row g10" style={{ alignItems: 'baseline' }}>
                <span className="tiny mono" style={{ color: 'var(--muted)', flex: 'none' }}>{String(m.n).padStart(2, '0')}</span>
                <p style={{ fontWeight: 500, lineHeight: 1.5 }}>{m.q}</p>
              </div>
              <div className="col g6" style={{ paddingLeft: 30 }}>
                <div className="row g8" style={{ alignItems: 'flex-start' }}>
                  <span className="tiny mono" style={{ color: 'var(--bad)', flex: 'none', minWidth: 62 }}>{m.chose === null ? 'no answer' : 'you said'}</span>
                  <span className="sub" style={{ color: 'var(--bad)' }}>{m.chose === null ? (m.entry.to ? `The ${DECISION_LIMIT_MS / 1000} seconds ran out.` : 'Not recorded — this round predates answer logging.') : m.chose}</span>
                </div>
                <div className="row g8" style={{ alignItems: 'flex-start' }}>
                  <span className="tiny mono" style={{ color: 'var(--ok)', flex: 'none', minWidth: 62 }}>correct</span>
                  <span className="sub" style={{ color: 'var(--ink)', fontWeight: 500 }}>{m.answer}</span>
                </div>
                <p className="sub" style={{ lineHeight: 1.6, marginTop: 4 }}>{m.ex}</p>
                <span className="tiny mono" style={{ color: 'var(--muted)' }}>{m.cite}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {mistakes.length === 0 && (
        <div style={{ marginTop: 16 }}><Note tone="brand">Nothing wrong to revise. Every situation in this round was answered correctly.</Note></div>
      )}

      {weakest && (
        <div style={{ marginTop: 16 }}>
          <Note tone="brand">Next round adapts. Because {weakest[1].toLowerCase()} scored lowest, the engine will weight the next eight situations towards it instead of reshuffling the same twelve.</Note>
        </div>
      )}
      <div className="sticky-cta"><div className="row g12 wrapf">
        <button className="btn btn-p" onClick={() => { update({ focus: weakest ? weakest[0] : null }); go('game'); }}>{'Practise ' + (weakest ? weakest[1].toLowerCase() : 'again') + ' · 8 situations'} {Icon.right()}</button>
        <button className="btn btn-s" onClick={() => go('test')}>Take the mock test</button>
      </div></div>
    </div>
  );
}
