import { useState } from 'react';
import { PRE_BASE, preFor } from '../data/applicant';
import { rtosFor } from '../data/rtoOffices';
import { CLASSES } from '../data/vehicleClasses';
import { TODAY_ISO } from '../lib/validate';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { LicenceCard } from '../ui/LicenceCard';
import { Bar, Field, Input, Note, Pill, Progress, Stepper, Timeline } from '../ui/SharedUI';
import { BookTest, ConfirmForm4, Form1Again, PayDlFee, TakeTest, type DlFormState } from './dl/dlSteps';

const DL_STEPS = ['Confirm Form 4', 'Form 1 again', 'Pay the fee', 'Book the test', 'Take the test'];

const DL_STEP_BODY = [
  "Carried over from the learner's licence. You pick which of the classes on it you want endorsed — you do not have to take all of them.",
  'The self-declaration is repeated at this stage. A transport endorsement needs a fresh medical certificate.',
  'Grant of licence plus the driving test fee. The test fee is charged again on a retest.',
  'Only offices with a test track appear. You bring the vehicle you are being tested on, with valid registration, insurance and PUC — the RTO does not provide one.',
  'Result the same day. The smart card is posted to your present address, and the digital copy appears here and in your wallet immediately.',
];

/** Formats an ISO "YYYY-MM-DD" date as "DD/MM/YYYY", the way it's printed on the physical card. */
function asCardDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Whether the current wizard step's required fields are filled. */
function stepValid(step: number, dl: DlFormState): boolean {
  const needsMedical = dl.classIds.some(id => CLASSES.find(c => c.id === id)?.medical);
  return [
    dl.confirmed && dl.classIds.length > 0,
    dl.f1sign && (!needsMedical || dl.form1a),
    dl.paid,
    !!dl.day && !!dl.time,
    true,
  ][step];
}

/** Driving licence (Form 4) journey: look up the learner's licence, then a 5-step wizard, then the issued card. */
export function DrivingLicence({ go, state }: PageProps) {
  const form = state.form || {};
  const baseClassIds = form.classes || ['MCWG'];
  const stateName = form.state || 'Maharashtra';
  const prefill = preFor(stateName);
  const alreadyIssued = state.stage === 'issued';
  const applicantName = [form.first ?? PRE_BASE.first, form.last ?? PRE_BASE.last].join(' ');
  const addressLine1 = `${form.line ?? prefill.line}, ${form.street ?? prefill.street}`;
  const addressLine2 = `${form.city ?? prefill.city} ${form.pin ?? prefill.pin}`;

  const [phase, setPhase] = useState<'lookup' | 'wizard' | 'issued'>('lookup');
  const [licenceNo, setLicenceNo] = useState(alreadyIssued ? 'MH02 20260/0041' : '');
  const [dob, setDob] = useState(alreadyIssued ? (form.dob || PRE_BASE.dob) : '');
  const [found, setFound] = useState(false);
  const [step, setStep] = useState(0);
  const [dl, setDl] = useState<DlFormState>(() => ({
    classIds: baseClassIds.slice(),
    confirmed: false,
    f1: {},
    f1sign: false,
    form1a: false,
    paid: false,
    officeId: rtosFor(stateName)[0].id,
    day: null,
    time: null,
  }));
  const updateDl = (patch: Partial<DlFormState>) => setDl(d => ({ ...d, ...patch }));

  if (phase === 'issued') {
    const relation = `${form.relType ?? PRE_BASE.relType} ${form.relFirst ?? PRE_BASE.relFirst} ${form.relLast ?? PRE_BASE.relLast}`;
    const office = rtosFor(stateName).find(o => o.id === dl.officeId) || rtosFor(stateName)[0];
    const rtoCode = office.name.match(/\(([^)]+)\)/)?.[1] || office.name;
    return (
      <div className="narrow fade" style={{ padding: '48px 24px 0' }}>
        <div className="col g14" style={{ alignItems: 'flex-start', marginBottom: 26 }}>
          <Pill tone="ok">{Icon.check()} Test passed</Pill>
          <h1>Your driving licence is issued.</h1>
          <p className="lede">Form 4, valid for twenty years or until age 50, whichever comes first. Carry it with you whenever you drive.</p>
        </div>
        <LicenceCard documentTitle="Driving Licence" stateName={stateName} licenceNo={licenceNo || 'MH02 20260/0041'}
          name={applicantName} relation={relation} dob={asCardDate(form.dob || PRE_BASE.dob)} blood={form.blood || PRE_BASE.blood}
          addressLine1={addressLine1} addressLine2={addressLine2}
          classCodes={dl.classIds.map(id => CLASSES.find(c => c.id === id)!.code).join(', ')}
          issueDate="22/08/2026" validTill="21/08/2046" rtoCode={rtoCode} />
        <div className="row g10 wrapf" style={{ marginTop: 16 }}>
          <button className="btn btn-s btn-sm">{Icon.doc()} Download Form 4</button>
          <button className="btn btn-s btn-sm">{Icon.card({ width: 16, height: 16 })} Add to phone wallet</button>
        </div>
        <div className="sticky-cta"><button className="btn btn-p" onClick={() => go('status')}>Go to my applications {Icon.right()}</button></div>
      </div>
    );
  }

  if (phase === 'wizard') {
    const dlProps = { dl, updateDl, baseClassIds, holderName: applicantName, holderDob: asCardDate(form.dob || PRE_BASE.dob), addressLine1, addressLine2, llNo: licenceNo || 'MH02 20260/0041', stateName };
    const valid = stepValid(step, dl);
    const goNext = () => (step === DL_STEPS.length - 1 ? setPhase('issued') : setStep(step + 1));
    const goBack = () => (step === 0 ? setPhase('lookup') : setStep(step - 1));
    const StepComponent = [ConfirmForm4, Form1Again, PayDlFee, BookTest, TakeTest][step];
    return (
      <div className="wrap fade" style={{ padding: '32px 24px 0' }}>
        <div className="row between g16 wrapf" style={{ marginBottom: 24 }}>
          <div className="col g4"><span className="eyebrow">Driving licence · Form 4 · {stateName}</span><h1 style={{ fontSize: '1.9rem' }}>{DL_STEPS[step]}</h1></div>
        </div>
        <div style={{ display: 'grid', gap: 36, gridTemplateColumns: '250px minmax(0,1fr)' }} className="applygrid">
          <aside className="hide-m"><div style={{ position: 'sticky', top: 88 }}>
            <Stepper steps={DL_STEPS} cur={step} onJump={setStep} />
            <hr className="hr" style={{ margin: '16px 0' }} />
            <p className="tiny" style={{ padding: '0 12px', lineHeight: 1.5 }}>Same five stages as the real Form 4 process, in the same order.</p>
          </div></aside>
          <div className="col g20" style={{ maxWidth: 670 }}>
            <div className="only-m"><Progress cur={step} total={DL_STEPS.length} label={DL_STEPS[step]} /></div>
            <StepComponent {...dlProps} />
            <Bar back="Back" onBack={goBack} next={step === DL_STEPS.length - 1 ? 'Submit application' : 'Continue'} onNext={goNext} disabled={!valid} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }} onClick={() => go('home')}>{Icon.left()} Home</button>
      <div className="col g10" style={{ marginBottom: 26 }}>
        <span className="eyebrow">Driving licence · Form 4</span>
        <h1>Turn your learner's licence into a permanent one</h1>
        <p className="lede">This journey does not start with a form. It starts with your learner's licence number, and everything on the application is pulled from it.</p>
      </div>
      <div className="card card-p col g16">
        <h3>Find your learner's licence</h3>
        <div className="grid2">
          <Field label="Learner's licence number"><Input className="input mono" placeholder="MH02 20260/0041" value={licenceNo} onChange={e => setLicenceNo(e.target.value)} /></Field>
          <Field label="Date of birth"><Input type="date" max={TODAY_ISO} value={dob} onChange={e => setDob(e.target.value)} /></Field>
        </div>
        <button className="btn btn-s" style={{ alignSelf: 'flex-start' }} disabled={!licenceNo || !dob} onClick={() => setFound(true)}>Fetch my details</button>
        {found && (
          <div className="fade col g16">
            <hr className="hr" />
            <div className="row between g12 wrapf"><b style={{ fontWeight: 600 }}>Learner's licence found</b><Pill tone="warn">Not yet in the window</Pill></div>
            <dl className="kv"><dt>Holder</dt><dd>{applicantName}</dd>
              <dt>Classes on it</dt><dd>{baseClassIds.map(id => CLASSES.find(c => c.id === id)!.code).join(', ')}</dd>
              <dt>Issued</dt><dd>21 Aug 2026</dd><dt>You may apply between</dt><dd>20 Sep 2026 and 17 Feb 2027</dd></dl>
            <div className="col g8"><div className="row between"><span className="sub">Mandatory waiting period</span><span className="sub">Day 1 of 30</span></div><div className="pbar"><i style={{ width: '4%' }} /></div></div>
            <Note tone="brand" icon={Icon.clock()}>We will message you on 20 Sep 2026 with a draft Form 4 already filled from this licence. The window closes on 17 Feb 2027, after which the learner's licence lapses and you start again.</Note>
            <button className="btn btn-p" style={{ alignSelf: 'flex-start' }} onClick={() => setPhase('wizard')}>Preview the application now (demo) {Icon.right()}</button>
          </div>
        )}
      </div>
      <div className="card card-p col g16" style={{ marginTop: 16 }}>
        <h3>The five stages, once the window opens</h3>
        <Timeline items={DL_STEPS.map((label, i) => ({ state: 'todo' as const, title: label, body: DL_STEP_BODY[i] }))} />
        <Note>Honest limitation. The 30-day waiting period is enforced by the real RTO, not by this prototype — "Preview the application now" above lets you walk through all five steps immediately, for demonstration.</Note>
      </div>
      <div className="sticky-cta"><button className="btn btn-s" onClick={() => go('status')}>See my applications</button></div>
    </div>
  );
}
