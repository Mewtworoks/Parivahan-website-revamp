import { useState } from 'react';
import { QUESTIONS } from '../data/theoryTest';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Progress } from '../ui/SharedUI';

/** The 10-question learner's theory test — six correct passes, every answer explained on reveal. */
export function Test({ go, state, update }: PageProps) {
  const isAadhaar = state.form?.route === 'aadhaar';
  const [index, setIndex] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const question = QUESTIONS[index];
  const isLast = index === QUESTIONS.length - 1;
  if (index >= QUESTIONS.length) return null;

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <div className="col g16" style={{ marginBottom: 22 }}>
        <Progress cur={index} total={QUESTIONS.length} label="Learner's test · stage 8 of 8" />
        <Note>{isAadhaar ? 'Ten questions in the real test, six correct to pass, taken from home with a password sent by SMS.' : 'Ten questions in the real test, six correct to pass, taken at the office.'} A fail costs the ₹50 test fee again and a rebooking, so every answer here explains itself.</Note>
      </div>
      <div className="card card-p col g20">
        <h2 style={{ fontSize: '1.3rem' }}>{question.q}</h2>
        <div className="col g10" role="radiogroup">
          {question.a.map((answer, n) => {
            const isCorrect = n === question.c;
            const chosen = pick === n;
            const style = revealed && isCorrect ? { borderColor: 'var(--ok)', background: 'var(--ok-soft)' } : revealed && chosen && !isCorrect ? { borderColor: 'var(--bad)', background: 'var(--bad-soft)' } : undefined;
            return (
              <button key={n} className="tile" role="radio" aria-checked={chosen} style={style} disabled={revealed} onClick={() => setPick(n)}>
                <span className="tick">{chosen ? Icon.check() : null}</span><span style={{ fontWeight: 500 }}>{answer}</span>
              </button>
            );
          })}
        </div>
        {revealed && (
          <div className="fade col g14">
            <Note tone={pick === question.c ? 'ok' : 'warn'} icon={pick === question.c ? Icon.check() : undefined}><b>{pick === question.c ? 'Correct.' : 'Not quite.'}</b> {question.ex}</Note>
            <button className="btn btn-p" onClick={() => {
              if (isLast) { update({ stage: 'issued', score }); go('issued'); }
              else { setIndex(index + 1); setPick(null); setRevealed(false); window.scrollTo(0, 0); }
            }}>{isLast ? 'Finish and see the result' : 'Next question'} {Icon.right()}</button>
          </div>
        )}
        {!revealed && <button className="btn btn-p" disabled={pick === null} onClick={() => { if (pick === question.c) setScore(score + 1); setRevealed(true); }}>Check answer</button>}
      </div>
      <div style={{ height: 56 }} />
    </div>
  );
}
