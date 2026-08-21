import type { EligibilityAnswers, PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Pill, Tile } from '../ui/SharedUI';

const VEHICLE_OPTIONS: [value: 'scooter' | 'car' | 'gear', title: string, desc: string][] = [
  ['scooter', 'A gearless scooter or moped', 'Up to 50cc — Activa, Jupiter and similar'],
  ['car', 'A car', 'Private car or jeep, non-commercial'],
  ['gear', 'A geared motorcycle, or both bike and car', 'Most people pick this'],
];

const LICENCE_OPTIONS: [value: 'no' | 'll' | 'dl', title: string][] = [
  ['no', 'No, this is my first'],
  ['ll', "Yes, a learner's licence"],
  ['dl', 'Yes, a full driving licence'],
];

/** Works out the age difference between a date of birth and today's fixed prototype date. */
function ageFrom(dob: string): number | null {
  const year = parseInt(dob.slice(0, 4));
  if (!year || dob.length < 10) return null;
  const birth = new Date(dob);
  const today = new Date('2026-08-20');
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/** Step 0 — a quick eligibility check before anyone starts a real application. */
export function Eligibility({ go, state, update }: PageProps) {
  const answers = state.elig || {};
  const updateAnswers = (patch: Partial<EligibilityAnswers>) => update({ elig: { ...answers, ...patch } });

  const age = ageFrom(answers.dob || '');
  const answeredAll = age !== null && answers.want && answers.has;
  const minimumAge = answers.want === 'gear' ? 18 : 16;
  const oldEnough = age !== null && age >= minimumAge;

  const verdict = !answeredAll ? null
    : !oldEnough
      ? { tone: 'bad', title: `You need to be ${minimumAge} to apply for this class`,
          body: `You are ${age}. ${minimumAge === 16 ? 'A gearless scooter licence starts at 16.' : "For a geared bike or a car the minimum age is 18. A licence for a gearless scooter up to 50cc can be taken from 16, with a parent's consent."}` }
      : answers.has === 'll'
        ? { tone: 'warn', title: "You already hold a learner's licence", body: 'Skip ahead — you should be applying for the permanent driving licence, not a second learner\'s licence.' }
        : { tone: 'ok', title: "You can apply for a learner's licence today",
            body: `Age ${age}, ${answers.want === 'gear' ? 'geared two-wheeler and car classes' : answers.want === 'car' ? 'car (LMV) class' : 'gearless scooter class'} — nothing blocks the application. The test is 10 questions on this site, and one visit to the RTO for verification.` };

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }} onClick={() => go('home')}>{Icon.left()} Home</button>
      <div className="col g10" style={{ marginBottom: 28 }}>
        <span className="eyebrow">Step 0 · 4 questions, nothing saved yet</span>
        <h1>Do you qualify?</h1>
        <p className="lede">Answering this now avoids paying a fee for an application that will be rejected. No documents needed.</p>
      </div>
      <div className="col g20">
        <div className="card card-p col g20">
          <label className="field"><span className="label">Date of birth</span><span className="hint">As printed on your school certificate or birth certificate.</span>
            <input className="input" type="date" style={{ maxWidth: 260 }} value={answers.dob || ''} onChange={e => updateAnswers({ dob: e.target.value })} />
          </label>
          <hr className="hr" />
          <div className="col g10" role="radiogroup"><span className="label">What do you want to drive?</span>
            {VEHICLE_OPTIONS.map(([value, title, desc]) => (
              <Tile key={value} checked={answers.want === value} onClick={() => updateAnswers({ want: value })} title={title} desc={desc} />
            ))}
          </div>
          <hr className="hr" />
          <div className="col g10" role="radiogroup"><span className="label">Do you already hold a licence?</span>
            {LICENCE_OPTIONS.map(([value, title]) => (
              <Tile key={value} checked={answers.has === value} onClick={() => updateAnswers({ has: value })} title={title} />
            ))}
          </div>
        </div>
        {verdict && (
          <div className="card card-p col g16 fade" style={{ borderColor: verdict.tone === 'ok' ? 'var(--brand-line)' : verdict.tone === 'warn' ? 'oklch(0.87 0.075 70)' : 'oklch(0.87 0.065 35)' }}>
            <div className="row g12"><Pill tone={verdict.tone}>{verdict.tone === 'ok' ? 'Eligible' : verdict.tone === 'warn' ? 'Wrong journey' : 'Not yet eligible'}</Pill></div>
            <div className="col g8"><h2>{verdict.title}</h2><p style={{ color: 'var(--ink2)' }}>{verdict.body}</p></div>
            {verdict.tone !== 'bad' && (
              <div className="row g12 wrapf">
                {answers.has === 'll'
                  ? <button className="btn btn-p" onClick={() => { update({ module: 'dl' }); go('dl'); }}>Go to driving licence {Icon.right()}</button>
                  : <button className="btn btn-p" onClick={() => go('checklist')}>See what I need {Icon.right()}</button>}
              </div>
            )}
          </div>
        )}
        {!verdict && <Note>Answer all three and you will get a plain answer — eligible, or the exact reason you are not.</Note>}
      </div>
      <div style={{ height: 56 }} />
    </div>
  );
}
