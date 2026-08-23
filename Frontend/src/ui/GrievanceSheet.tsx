import { useState } from 'react';
import type { AppState } from '../types';
import { Icon } from './Icon';
import { Field, Input, Note, Pill, Sheet } from './SharedUI';

/** A short, deterministic reference number so repeated demo submissions don't look identical. */
function grievanceRef(appNo: string, description: string): string {
  let hash = 0;
  for (const ch of appNo + description) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `GRV-${(hash % 900000 + 100000)}`;
}

/** The "Report a problem" flow — file a grievance against an application, get a reference and a response window. */
export function GrievanceSheet({ state, onClose }: { state: AppState; onClose: () => void }) {
  const [appNo, setAppNo] = useState(state.app?.no || '');
  const [description, setDescription] = useState('');
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const canSubmit = appNo.trim().length > 0 && description.trim().length > 0;

  return (
    <Sheet title="Report a problem" onClose={onClose}>
      <div className="col g20">
        {submittedRef ? (
          <div className="col g16 fade">
            <div className="row g12"><Pill tone="ok">{Icon.check()} Grievance logged</Pill></div>
            <div className="flat col g10" style={{ padding: '16px 18px' }}>
              <div className="row between g12 wrapf"><span className="sub">Reference number</span><b className="mono" style={{ fontSize: '1.05rem' }}>{submittedRef}</b></div>
              <hr className="hr" />
              <div className="row between g16 wrapf"><span className="sub">Application</span><b className="mono">{appNo}</b></div>
            </div>
            <Note tone="ok" icon={Icon.check()}>The office handling this application has 7 days to respond, with the stage it failed at already attached — no re-explaining. Quote the reference number above for any follow-up.</Note>
            <Note>Mock prototype. Nothing was actually filed or sent anywhere.</Note>
          </div>
        ) : (
          <>
            <p className="sub" style={{ lineHeight: 1.6 }}>File a grievance against your application number, with the stage it's stuck at, so the office handling it doesn't need the story re-explained.</p>
            <Field label="Application number" hint="Find this on your reference slip or the tracker page.">
              <Input className="input mono" placeholder="SS-2026-004182" value={appNo} onChange={e => setAppNo(e.target.value)} />
            </Field>
            <Field label="What went wrong">
              <textarea className="input" rows={4} placeholder="e.g. My payment was deducted but the application still shows unpaid." value={description} onChange={e => setDescription(e.target.value)} />
            </Field>
            <button className="btn btn-p" disabled={!canSubmit} onClick={() => setSubmittedRef(grievanceRef(appNo, description))}>File grievance {Icon.right()}</button>
            <Note>A grievance that isn't answered inside the stated window escalates on its own — you don't have to follow up. Mock prototype: nothing is actually sent.</Note>
          </>
        )}
      </div>
    </Sheet>
  );
}
