import { useEffect, useState } from 'react';
import { PRE_BASE } from '../data/applicant';
import { feeRows, feeTotal, inWords } from '../data/fees';
import { rtosFor } from '../data/rtoOffices';
import type { PageProps } from '../types';
import { Field, Input, Note, Tile, Timeline } from '../ui/SharedUI';
import { Icon } from '../ui/Icon';

type PaymentPhase = 'pick' | 'paying' | 'verify';

const PAYMENT_METHODS: [value: 'upi' | 'card' | 'net', title: string, desc: string][] = [
  ['upi', 'UPI', 'Any app — GPay, PhonePe, Paytm, BHIM'],
  ['card', 'Debit or credit card', ''],
  ['net', 'Net banking', "Through the state treasury gateway — CFMS, SBI ePay or the state's own"],
];

/** Fee payment — itemised total, a mock payment method picker, then a simulated bank confirmation. */
export function Pay({ go, state, update }: PageProps) {
  const form = state.form || {};
  const classIds = form.classes || ['MCWG'];
  const stateName = form.state || 'Maharashtra';
  const rows = feeRows(classIds, stateName);
  const total = feeTotal(classIds, stateName);
  const office = rtosFor(stateName).find(r => r.id === form.rto) || rtosFor(stateName)[0];

  const [phase, setPhase] = useState<PaymentPhase>('pick');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft(v => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  const started = phase !== 'pick';
  useEffect(() => {
    if (!started) return;
    const toVerify = setTimeout(() => setPhase('verify'), 1100);
    const toReceipt = setTimeout(() => { update({ stage: 'paid' }); go('receipt'); }, 2600);
    return () => { clearTimeout(toVerify); clearTimeout(toReceipt); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <div className="col g10" style={{ marginBottom: 26 }}>
        <span className="eyebrow">Application SS-2026-004182 · stages 5 and 6</span><h1>Pay the fee</h1>
        <p className="lede">Every line is a statutory charge with a rule behind it. The official portal calculates, collects, verifies and prints a receipt as four separate menu items — here it is one uninterrupted step.</p>
      </div>
      <div className="card card-p col g14">
        <div className="row between g12 wrapf">
          <dl className="kv"><dt>Application</dt><dd className="mono">SS-2026-004182</dd><dt>Applicant</dt><dd>{[form.first ?? PRE_BASE.first, form.last ?? PRE_BASE.last].join(' ')}</dd>
            <dt>RTO</dt><dd>{office.name}</dd></dl>
          <span className="pill" style={{ alignSelf: 'flex-start' }}>{Icon.clock()} {`Session ${minutes}:${seconds}`}</span>
        </div>
        <hr className="hr" />
        {rows.map((row, i) => (
          <div key={i} className="col g4">
            <div className="row between g16"><span style={{ color: 'var(--ink2)' }}>{row.k}{row.state && <span className="pill" style={{ marginLeft: 8, fontSize: '.66rem' }}>{stateName}</span>}</span><b className="mono" style={{ fontWeight: 600 }}>₹{row.v}</b></div>
            <span className="tiny mono">{row.rule}</span>
          </div>
        ))}
        <hr className="hr" />
        <div className="row between g16"><b style={{ fontSize: '1.1rem' }}>Grand total</b><b style={{ fontSize: '1.35rem', fontFamily: 'var(--disp)' }}>₹{total}</b></div>
        <span className="tiny">{inWords(total)}</span>
        {rows.some(r => r.state) && <Note tone="warn"><b>{stateName}'s own charges are in this total.</b> You saw them on the classes screen too, not for the first time here. That is the only difference between this page and the official one.</Note>}
      </div>
      <div className="card card-p col g16" style={{ marginTop: 16 }}>
        {phase === 'pick' ? (
          <>
            <h3>How would you like to pay?</h3>
            <div className="col g10" role="radiogroup">
              {PAYMENT_METHODS.map(([value, title, desc]) => (
                <Tile key={value} checked={(state.paym || 'upi') === value} onClick={() => update({ paym: value })} title={title} desc={desc} />
              ))}
            </div>
            <Field label="Email for the receipt" hint="The official gateway asks for this again at the last moment. Yours is already on the application.">
              <Input type="email" defaultValue={form.email ?? PRE_BASE.email} />
            </Field>
            <button className="tile" role="checkbox" aria-checked={termsAccepted} onClick={() => setTermsAccepted(!termsAccepted)}>
              <span className="tick" style={{ borderRadius: 6 }}>{termsAccepted ? Icon.check() : null}</span>
              <span className="sub" style={{ color: 'var(--ink)' }}>I understand that a completed payment is not refunded automatically. For a double payment or an unused service, a refund is claimed from the RTO.</span>
            </button>
            <Note>Mock payment. Nothing is charged and no real payment details are collected.</Note>
            <button className="btn btn-p btn-full" disabled={!termsAccepted} onClick={() => setPhase('paying')}>Pay ₹{total}</button>
          </>
        ) : (
          <div className="col g16">
            <Timeline items={[
              { state: 'done', title: 'Payment sent to the gateway', tag: 'just now' },
              { state: phase === 'verify' ? 'done' : 'now', title: 'Bank confirmation', tag: phase === 'verify' ? 'received' : 'waiting', body: phase === 'verify' ? null : 'This is where the official flow ends and asks you to come back later and click Verify Payment Status yourself.' },
              { state: phase === 'verify' ? 'now' : 'todo', title: 'Receipt generated', body: 'We poll for you and move you on. A pending payment never becomes your problem to chase.' },
            ]} />
            <button className="btn btn-s" onClick={() => { update({ stage: 'paid' }); go('receipt'); }}>Continue to receipt {Icon.right()}</button>
          </div>
        )}
      </div>
      <div style={{ height: 56 }} />
    </div>
  );
}
