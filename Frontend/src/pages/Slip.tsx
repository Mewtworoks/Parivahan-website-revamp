import { PRE_BASE, preFor } from '../data/applicant';
import { rtosFor } from '../data/rtoOffices';
import { CLASSES } from '../data/vehicleClasses';
import type { PageProps } from '../types';
import { DocLinks } from '../ui/DocLinks';
import { Icon } from '../ui/Icon';
import { Note, Pill } from '../ui/SharedUI';
import { StageTable } from '../ui/StageTable';

/** Submission confirmation — the Application Reference Slip, the one number you need for everything after this. */
export function Slip({ go, state, update }: PageProps) {
  const form = state.form || {};
  const classIds = form.classes || [];
  const isAadhaar = form.route === 'aadhaar';
  const applicantName = [form.first ?? PRE_BASE.first, form.mid ?? PRE_BASE.mid, form.last ?? PRE_BASE.last].filter(Boolean).join(' ');
  const prefill = preFor(form.state);
  const office = rtosFor(form.state || 'Maharashtra').find(r => r.id === form.rto) || rtosFor(form.state || 'Maharashtra')[0];
  const classCodes = classIds.map(id => CLASSES.find(c => c.id === id)!.code).join(', ') || '—';

  return (
    <div className="narrow fade" style={{ padding: '48px 24px 0' }}>
      <div className="col g14" style={{ alignItems: 'flex-start', marginBottom: 24 }}>
        <span style={{ width: 52, height: 52, borderRadius: 999, background: 'var(--ok-soft)', color: 'var(--ok)', display: 'grid', placeItems: 'center', border: '1px solid var(--brand-line)' }}>{Icon.check({ width: 22, height: 22 })}</span>
        <h1>Submitted. Quote this number for everything that follows.</h1>
        <p className="lede">The official portal calls this the Application Reference Slip. It is the only thing you need to come back to any stage — with your date of birth.</p>
      </div>
      <div className="card card-p col g16">
        <div className="row between g12 wrapf"><h3>Application reference slip</h3><Pill tone="ok">Submitted</Pill></div>
        <div className="flat col g10" style={{ padding: '16px 18px' }}>
          <div className="row between g12 wrapf"><span className="sub">Application number</span><b className="mono" style={{ fontSize: '1.15rem' }}>SS-2026-004182</b></div>
          <hr className="hr" />
          <dl className="kv">
            <dt>Name</dt><dd>{applicantName}</dd>
            <dt>Date of birth</dt><dd>{form.dob || PRE_BASE.dob}</dd>
            <dt>Application date</dt><dd>21 Aug 2026</dd>
            <dt>Service requested</dt><dd>Issue of new learner's licence</dd>
            <dt>Classes</dt><dd>{classCodes}</dd>
            <dt>RTO</dt><dd>{office.name}</dd>
          </dl>
        </div>
        <div className="flat col g10" style={{ padding: '14px 16px' }}>
          <div className="row between g12" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
            <span className="tiny" style={{ fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>Service requested</span>
            <span className="tiny" style={{ fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>Documentary proof required</span>
          </div>
          <div className="row between g16" style={{ alignItems: 'flex-start' }}>
            <span style={{ fontWeight: 600, fontSize: '.92rem' }}>Issue of new LL ({classCodes})</span>
            <span className="sub" style={{ textAlign: 'right', maxWidth: 210 }}>{isAadhaar ? 'None — all proofs taken from e-KYC' : 'Age proof and address proof, originals at the counter'}</span>
          </div>
        </div>
        <div className="grid2" style={{ gap: 16 }}>
          <div className="col g6"><span className="tiny" style={{ fontWeight: 600 }}>Applicant address</span>
            <span className="sub">{form.line ?? prefill.line}, {form.street ?? prefill.street}<br />{form.city ?? prefill.city} {form.pin ?? prefill.pin}<br />{form.state || 'Maharashtra'}</span></div>
          <div className="col g6"><span className="tiny" style={{ fontWeight: 600 }}>RTO location</span>
            <span className="sub">{office.name}<br />{office.area}</span></div>
        </div>
        <div className="col g8">
          <span className="tiny row g8"><span style={{ color: 'var(--ok)' }}>{Icon.check()}</span> An SMS has been sent to {form.phone || '98•••• ••21'}.</span>
          <span className="tiny row g8"><span style={{ color: 'var(--ok)' }}>{Icon.check()}</span> A copy has gone to {form.email || PRE_BASE.email}, with the e-signed Form 2 attached.</span>
          <span className="tiny row g8"><span style={{ color: 'var(--ok)' }}>{Icon.check()}</span> {isAadhaar ? 'Submitted through e-KYC — faceless and contactless.' : 'Submitted without Aadhaar — one verification visit required.'}</span>
        </div>
        <Note>{isAadhaar
          ? 'Because this is a faceless application you are not required to visit the RTO. Acceptance is still subject to scrutiny of the details you submitted — if anything is reverted you will be told what to correct, on this screen, in words.'
          : 'You will be asked to appear at the office with your originals. The slot booking stage below is where you choose when.'}</Note>
        <hr className="hr" />
        <DocLinks />
      </div>
      <div style={{ marginTop: 16 }}><StageTable state={state} go={go} /></div>
      <div className="sticky-cta"><button className="btn btn-p" style={{ maxWidth: 340 }} onClick={() => { update({ stage: 'esign' }); go('pay'); }}>Pay the fee {Icon.right()}</button></div>
    </div>
  );
}
