import { PRE_BASE } from '../data/applicant';
import { feeTotal } from '../data/fees';
import { CLASSES } from '../data/vehicleClasses';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Pill, Timeline } from '../ui/SharedUI';

/** The issued Form 3 licence, plus a preview of what happens over the next six months. */
export function Issued({ go, state }: PageProps) {
  const form = state.form || {};
  const classIds = form.classes || ['MCWG'];
  const applicantName = [form.first ?? PRE_BASE.first, form.last ?? PRE_BASE.last].join(' ');
  const total = feeTotal(classIds, form.state || 'Maharashtra');

  return (
    <div className="narrow fade" style={{ padding: '48px 24px 0' }}>
      <div className="col g14" style={{ alignItems: 'flex-start', marginBottom: 26 }}>
        <Pill tone="ok">{Icon.check()} Passed · {state.score ?? 4} of 5</Pill>
        <h1>Your learner's licence is issued.</h1>
        <p className="lede">Form 3, valid for six months. Practise with an L plate on the vehicle and a licensed holder of the same class beside you — that is a legal condition, not advice.</p>
      </div>
      <div className="lic col g20">
        <div className="row between g12 wrapf"><span className="eyebrow" style={{ color: 'oklch(0.85 0.045 262)' }}>Form 3 · See Rule 3(a) and 13 · {form.state || 'Maharashtra'}</span><span className="mono" style={{ fontSize: '.8rem', opacity: 0.8 }}>MH02 20260/0041</span></div>
        <div className="row g16" style={{ alignItems: 'flex-end' }}>
          <div className="stripe" style={{ width: 78, height: 96, borderRadius: 8, flex: 'none', opacity: 0.55 }} />
          <div className="col g6"><h2 style={{ fontSize: '1.5rem' }}>{applicantName}</h2><span className="sub">{classIds.map(id => CLASSES.find(c => c.id === id)!.code).join(', ')}</span></div>
        </div>
        <div className="row between g16 wrapf" style={{ fontSize: '.85rem' }}>
          <span className="col"><span className="sub">Issued</span><b>21 Aug 2026</b></span>
          <span className="col"><span className="sub">Valid till</span><b>20 Feb 2027</b></span>
          <span className="col"><span className="sub">Blood group</span><b>{form.blood || PRE_BASE.blood}</b></span>
          <span className="col"><span className="sub">Fee paid</span><b>₹{total}</b></span>
          <span className="col"><span className="sub">Qualification</span><b>{(form.qual || PRE_BASE.qual).replace(' or equivalent', '')}</b></span>
        </div>
        <span className="tiny" style={{ color: 'oklch(0.82 0.03 262)' }}>Specimen signature / thumb impression of the holder is printed on the reverse.</span>
      </div>
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
