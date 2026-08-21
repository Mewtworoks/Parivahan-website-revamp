import { useState } from 'react';
import { PRE_BASE } from '../data/applicant';
import { FEE_DL } from '../data/fees';
import { CLASSES } from '../data/vehicleClasses';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Field, Input, Note, Pill, Timeline } from '../ui/SharedUI';

/** Driving licence (Form 4) journey — only the learner's-licence lookup step is actually built. */
export function DrivingLicence({ go, state }: PageProps) {
  const form = state.form || {};
  const classIds = form.classes || ['MCWG'];
  const alreadyIssued = state.stage === 'issued';
  const [licenceNo, setLicenceNo] = useState(alreadyIssued ? 'MH02 20260/0041' : '');
  const [dob, setDob] = useState(alreadyIssued ? (form.dob || PRE_BASE.dob) : '');
  const [found, setFound] = useState(false);
  const total = FEE_DL.reduce((sum, fee) => sum + fee.v, 0);

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
          <Field label="Date of birth"><Input type="date" value={dob} onChange={e => setDob(e.target.value)} /></Field>
        </div>
        <button className="btn btn-s" style={{ alignSelf: 'flex-start' }} disabled={!licenceNo || !dob} onClick={() => setFound(true)}>Fetch my details</button>
        {found && (
          <div className="fade col g16">
            <hr className="hr" />
            <div className="row between g12 wrapf"><b style={{ fontWeight: 600 }}>Learner's licence found</b><Pill tone="warn">Not yet in the window</Pill></div>
            <dl className="kv"><dt>Holder</dt><dd>{[form.first ?? PRE_BASE.first, form.last ?? PRE_BASE.last].join(' ')}</dd>
              <dt>Classes on it</dt><dd>{classIds.map(id => CLASSES.find(c => c.id === id)!.code).join(', ')}</dd>
              <dt>Issued</dt><dd>21 Aug 2026</dd><dt>You may apply between</dt><dd>20 Sep 2026 and 17 Feb 2027</dd></dl>
            <div className="col g8"><div className="row between"><span className="sub">Mandatory waiting period</span><span className="sub">Day 0 of 30</span></div><div className="pbar"><i style={{ width: '4%' }} /></div></div>
            <Note tone="brand" icon={Icon.clock()}><b>We will message you on 20 Sep 2026</b> with a draft Form 4 already filled from this licence. The window closes on 17 Feb 2027, after which the learner's licence lapses and you start again.</Note>
          </div>
        )}
      </div>
      <div className="card card-p col g16" style={{ marginTop: 16 }}>
        <h3>The five stages, once the window opens</h3>
        <Timeline items={[
          { state: 'todo', title: 'Confirm the details on Form 4', body: 'Carried over from the learner\'s licence. You pick which of the classes on it you want endorsed — you do not have to take all of them.' },
          { state: 'todo', title: 'Form 1 again, or Form 1A if a transport class', body: 'The self-declaration is repeated at this stage. A transport endorsement needs a fresh medical certificate.' },
          { state: 'todo', title: `Pay ₹${total}`, body: FEE_DL.map(fee => `₹${fee.v} ${fee.k.toLowerCase()}`).join(', ') + '. The test fee is charged again on a retest.' },
          { state: 'todo', title: 'Book the driving test', body: 'Only offices with a test track appear. This is where the process trips people up: you bring the vehicle you are being tested on, with valid registration, insurance and PUC. The RTO does not provide one. We show you which driving schools at each track rent a vehicle, and what they charge.' },
          { state: 'todo', title: 'Take the test, get the card', body: 'Result the same day. The smart card is posted to your present address, and the digital copy appears here and in your wallet immediately.' },
        ]} />
        <Note><b>Honest limitation.</b> The learner's licence journey runs end to end in this prototype. The driving licence journey is designed to the same stage map but only the lookup step is built.</Note>
      </div>
      <div className="sticky-cta"><button className="btn btn-s" onClick={() => go('status')}>See my applications</button></div>
    </div>
  );
}
