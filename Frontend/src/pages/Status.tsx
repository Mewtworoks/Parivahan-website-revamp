import { useState } from 'react';
import { SEED_STATUS } from '../data/applicant';
import { rtosFor } from '../data/rtoOffices';
import { CLASSES } from '../data/vehicleClasses';
import type { PageProps } from '../types';
import { DocLinks } from '../ui/DocLinks';
import { Icon } from '../ui/Icon';
import { Field, Input, Note, Pill } from '../ui/SharedUI';
import { StageTable } from '../ui/StageTable';

/** Application tracker — look up an application number + DOB, see every stage and what's next. */
export function Status({ go, state }: PageProps) {
  const form = state.form || {};
  const hasLiveApplication = !!state.app || !!state.stage;
  const [applicationNo, setApplicationNo] = useState(hasLiveApplication ? 'SS-2026-004182' : '');
  const [dob, setDob] = useState(hasLiveApplication ? (form.dob || '2005-04-12') : '');
  const [found, setFound] = useState(hasLiveApplication);
  const isAadhaar = form.route === 'aadhaar';
  const applicantName = [form.first, form.last].filter(Boolean).join(' ') || SEED_STATUS.name;
  const classCodes = (form.classes || []).map(id => CLASSES.find(c => c.id === id)?.code).filter(Boolean).join(', ') || SEED_STATUS.cls;
  const rtoName = (rtosFor(form.state || 'Maharashtra').find(r => r.id === form.rto) || rtosFor(form.state || 'Maharashtra')[0]).name;

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }} onClick={() => go('home')}>{Icon.left()} Home</button>
      <div className="col g10" style={{ marginBottom: 26 }}>
        <span className="eyebrow">Track an application</span>
        <h1>Where your application is</h1>
        <p className="lede">The official portal asks for your application number, your date of birth and a captcha, then shows a table of stage names. Same two inputs, no captcha, and each stage says what it means for you.</p>
      </div>
      <div className="card card-p col g16">
        <div className="grid2">
          <Field label="Application number"><Input className="input mono" placeholder="SS-2026-004182" value={applicationNo} onChange={e => setApplicationNo(e.target.value)} /></Field>
          <Field label="Date of birth"><Input type="date" value={dob} onChange={e => setDob(e.target.value)} /></Field>
        </div>
        <div className="row g10 wrapf">
          <button className="btn btn-s" disabled={!applicationNo || !dob} onClick={() => setFound(true)}>{Icon.search()} Find my application</button>
          {!hasLiveApplication && <span className="tiny" style={{ alignSelf: 'center' }}>Try SS-2026-004182 with any date.</span>}
        </div>
      </div>
      {found && (
        <div className="col g16 fade" style={{ marginTop: 16 }}>
          <div className="card card-p col g16">
            <div className="row between g16 wrapf" style={{ alignItems: 'flex-start' }}>
              <dl className="kv grow" style={{ minWidth: 230 }}>
                <dt>Application</dt><dd className="mono">SS-2026-004182</dd>
                <dt>Applied on</dt><dd>21 Aug 2026</dd>
                <dt>Applicant</dt><dd>{applicantName}</dd><dt>Service</dt><dd>Issue of learner's licence</dd>
                <dt>Classes</dt><dd>{classCodes}</dd><dt>RTO</dt><dd>{rtoName}</dd>
                <dt>Route</dt><dd>{isAadhaar ? 'Aadhaar e-KYC · faceless' : 'Without Aadhaar'}</dd>
              </dl>
              <div className="col g8" style={{ flex: 'none', alignItems: 'center' }}>
                <div className="stripe" style={{ width: 88, height: 106, borderRadius: 8, border: '1px solid var(--line)' }} />
                <Pill tone={state.stage === 'issued' ? 'ok' : 'brand'}>{state.stage === 'issued' ? 'Licence issued' : 'In progress'}</Pill>
              </div>
            </div>
            {isAadhaar && <Note tone="ok" icon={Icon.check()}><b>Submitted for contactless service.</b> No visit to the RTO office is needed for this application.</Note>}
            <hr className="hr" />
            <DocLinks />
          </div>
          <StageTable state={state} go={go} />
          {state.stage === 'issued' && <Note tone="ok" icon={Icon.check()}>Learner's licence MH02 20260/0041 issued and valid to 20 Feb 2027. The driving licence window opens 20 Sep 2026 — we will remind you.</Note>}
          <div className="card card-p col g12">
            <h3>Test result and allotment</h3>
            {state.stage === 'issued'
              ? <div className="row between g12 wrapf"><span className="sub">Recording LL test results</span><Pill tone="ok">Passed · licence generated</Pill></div>
              : <div className="row between g12 wrapf"><span className="sub">Recording LL test results</span><Pill>Not yet — test pending</Pill></div>}
            <span className="tiny">The official portal shows this as a Counter column reading "Allotment Information Unavailable", which tells you nothing. Here it says what is actually pending and what unblocks it.</span>
          </div>
          <Note>If a stage is ever <b>Reverted</b> on the real portal it means a document was rejected, and the reason is a code. Here it would say which document, what was wrong with it, and give you the one button that fixes it.</Note>
        </div>
      )}
      <div style={{ height: 56 }} />
    </div>
  );
}
