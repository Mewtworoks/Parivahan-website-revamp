import { feeRows, feeTotal, inWords } from '../data/fees';
import { rtosFor } from '../data/rtoOffices';
import type { PageProps } from '../types';
import { DocLinks } from '../ui/DocLinks';
import { Icon } from '../ui/Icon';
import { Note, Pill } from '../ui/SharedUI';

/** e-Receipt shown right after a (mock) payment confirms. */
export function Receipt({ go, state, update }: PageProps) {
  const form = state.form || {};
  const classIds = form.classes || ['MCWG'];
  const isAadhaar = form.route === 'aadhaar';
  const stateName = form.state || 'Maharashtra';
  const rows = feeRows(classIds, stateName);
  const total = feeTotal(classIds, stateName);
  const office = rtosFor(stateName).find(r => r.id === form.rto) || rtosFor(stateName)[0];

  return (
    <div className="narrow fade" style={{ padding: '56px 24px 0' }}>
      <div className="col g16" style={{ alignItems: 'flex-start' }}>
        <span style={{ width: 52, height: 52, borderRadius: 999, background: 'var(--ok-soft)', color: 'var(--ok)', display: 'grid', placeItems: 'center', border: '1px solid var(--brand-line)' }}>{Icon.check({ width: 22, height: 22 })}</span>
        <h1>Paid and verified.</h1>
        <p className="lede">{isAadhaar ? 'Slot booking is exempt for you. The next thing is the test itself, taken wherever you are.' : 'Next: book the slot for your test at the office.'}</p>
      </div>
      <div className="card card-p col g14" style={{ marginTop: 26 }}>
        <div className="row between g12 wrapf"><h3>e-Receipt</h3><Pill tone="ok">Confirmed by the bank</Pill></div>
        <dl className="kv"><dt>Receipt number</dt><dd className="mono">SS-RCPT-77401</dd><dt>Application</dt><dd className="mono">SS-2026-004182</dd>
          <dt>Paid on</dt><dd>21 Aug 2026, 4:52 pm</dd><dt>Gateway</dt><dd>Multi-bank · mock</dd>
          <dt>Office</dt><dd>{office.name}</dd></dl>
        <hr className="hr" />
        {rows.map((row, i) => <div key={i} className="row between g16"><span className="sub">{row.k}</span><b className="mono" style={{ fontWeight: 600 }}>₹{row.v}</b></div>)}
        <hr className="hr" />
        <div className="row between g16"><b>Total</b><b className="mono" style={{ fontSize: '1.1rem' }}>₹{total}</b></div>
        <span className="tiny">{inWords(total)}</span>
        <hr className="hr" />
        <div className="row g10 wrapf"><button className="btn btn-s btn-sm">{Icon.doc()} Download e-receipt</button><button className="btn btn-s btn-sm">Email to me</button></div>
        <hr className="hr" />
        <DocLinks />
        <Note>{isAadhaar
          ? 'As this is a faceless e-KYC application there is no need to visit the RTO or MLO office. We keep the receipt against your application number, so a lost print costs you nothing.'
          : 'Carry a print of this to the office. The official process requires it at the counter — we also keep a copy against your application number.'}</Note>
      </div>
      <div className="sticky-cta"><div className="row g12 wrapf">
        {isAadhaar
          ? <button className="btn btn-p" onClick={() => { update({ stage: 'booked' }); go('tutorial'); }}>Road safety tutorial, then the test {Icon.right()}</button>
          : <button className="btn btn-p" onClick={() => go('slot')}>Book the test slot {Icon.right()}</button>}
        <button className="btn btn-s" onClick={() => go('status')}>See all stages</button>
      </div></div>
    </div>
  );
}
