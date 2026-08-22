import { PRE_BASE, preFor } from '../data/applicant';
import { rtosFor } from '../data/rtoOffices';
import { CLASSES } from '../data/vehicleClasses';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { LicenceCard } from '../ui/LicenceCard';
import { Pill, Timeline } from '../ui/SharedUI';

/** Formats an ISO "YYYY-MM-DD" date as "DD/MM/YYYY", the way it's printed on the physical card. */
function asCardDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** The issued Form 3 licence, plus a preview of what happens over the next six months. */
export function Issued({ go, state }: PageProps) {
  const form = state.form || {};
  const classIds = form.classes || ['MCWG'];
  const stateName = form.state || 'Maharashtra';
  const prefill = preFor(stateName);
  const applicantName = [form.first ?? PRE_BASE.first, form.last ?? PRE_BASE.last].join(' ');
  const relation = `${form.relType ?? PRE_BASE.relType} ${form.relFirst ?? PRE_BASE.relFirst} ${form.relLast ?? PRE_BASE.relLast}`;
  const office = rtosFor(stateName).find(r => r.id === form.rto) || rtosFor(stateName)[0];
  const rtoCode = office.name.match(/\(([^)]+)\)/)?.[1] || office.name;

  return (
    <div className="narrow fade" style={{ padding: '48px 24px 0' }}>
      <div className="col g14" style={{ alignItems: 'flex-start', marginBottom: 26 }}>
        <Pill tone="ok">{Icon.check()} Passed · {state.score ?? 4} of 5</Pill>
        <h1>Your learner's licence is issued.</h1>
        <p className="lede">Form 3, valid for six months. Practise with an L plate on the vehicle and a licensed holder of the same class beside you — that is a legal condition, not advice.</p>
      </div>
      <LicenceCard documentTitle="Learner's Licence" stateName={stateName} licenceNo="MH02 20260/0041"
        name={applicantName} relation={relation} dob={asCardDate(form.dob || PRE_BASE.dob)} blood={form.blood || PRE_BASE.blood}
        addressLine1={`${form.line ?? prefill.line}, ${form.street ?? prefill.street}`} addressLine2={`${form.city ?? prefill.city} ${form.pin ?? prefill.pin}`}
        classCodes={classIds.map(id => CLASSES.find(c => c.id === id)!.code).join(', ')}
        issueDate="21/08/2026" validTill="20/02/2027" rtoCode={rtoCode} />
      <div className="row g10 wrapf" style={{ marginTop: 16 }}>
        <button className="btn btn-s btn-sm">{Icon.doc()} Download Form 3</button>
        <button className="btn btn-s btn-sm">{Icon.card({ width: 16, height: 16 })} Add to phone wallet</button>
      </div>
      <div className="card card-p col g14" style={{ marginTop: 24 }}>
        <h3>What happens next</h3>
        <Timeline items={[
          { state: 'now', title: 'Practise for 30 days', tag: 'Until 20 Sep', tone: 'brand', body: 'The law sets a minimum of 30 days as a learner and a maximum of 180. We will remind you the day the window opens and again before it closes.' },
          { state: 'todo', title: 'Apply for the driving licence', body: 'Form 4. You enter this licence number and your details carry over.',
            action: <button className="btn btn-a btn-sm" style={{ marginTop: 8 }} onClick={() => go('dl')}>See that journey {Icon.right()}</button> },
        ]} />
      </div>
      <div className="sticky-cta"><div className="row g12 wrapf"><button className="btn btn-p" onClick={() => go('status')}>Go to my applications {Icon.right()}</button></div></div>
    </div>
  );
}
