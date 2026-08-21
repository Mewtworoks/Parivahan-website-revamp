import { useState } from 'react';
import { DAYS, rtosFor, TIMES } from '../data/rtoOffices';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Pill, Tile } from '../ui/SharedUI';

/** Book the RTO test slot — pick an office, a date, then a time. Exempt entirely for Aadhaar applicants. */
export function Slot({ go, state, update }: PageProps) {
  const form = state.form || {};
  const offices = rtosFor(form.state || 'Maharashtra');
  const [officeId, setOfficeId] = useState(offices.find(o => o.id === form.rto) ? form.rto! : offices[0].id);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const office = offices.find(o => o.id === officeId) || offices[0];

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <div className="col g10" style={{ marginBottom: 26 }}><span className="eyebrow">Application SS-2026-004182 · stage 7</span><h1>Book your test slot</h1>
        <p className="lede">You are shown the offices that can take your test, how far they are, and what is actually left. A booking here is an appointment, not a queue token.</p></div>
      {form.route === 'aadhaar' && <div style={{ marginBottom: 16 }}><Note tone="brand">This stage is exempt for you — an Aadhaar-authenticated application takes the test from home. You are only here because you chose to look.</Note></div>}
      <div className="col g20">
        <div className="col g12"><span className="label">Choose an office</span>
          {offices.map(o => (
            <Tile key={o.id} checked={officeId === o.id} onClick={() => { setOfficeId(o.id); setDay(null); setTime(null); }} title={o.name}
              desc={`${o.area} · ${o.km} km away`}
              right={<span className="col g6" style={{ alignItems: 'flex-end', flex: 'none' }}><Pill tone={o.load === 'light' ? 'ok' : 'warn'}>{o.load === 'light' ? 'Light day' : 'Busy'}</Pill><span className="tiny">{o.wait}</span></span>} />
          ))}
        </div>
        <div className="card card-p col g16">
          <div className="row between g12 wrapf"><h3>Pick a date</h3><span className="tiny row g6">{Icon.pin()} {office.name}</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(104px,1fr))', gap: 10 }}>
            {DAYS.map(d => (
              <button key={d.d} className="slot" aria-pressed={day === d.d} disabled={!d.left} onClick={() => { setDay(d.d); setTime(null); }}>
                <span className="col g4"><b style={{ fontWeight: 600, fontSize: '.92rem' }}>{d.d}</b><span className="tiny" style={{ color: day === d.d ? 'oklch(0.92 0.03 262)' : undefined }}>{d.left ? d.left + ' left' : 'Full'}</span></span>
              </button>
            ))}
          </div>
          {day && (
            <div className="col g12 fade"><hr className="hr" /><h3>Pick a time</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(104px,1fr))', gap: 10 }}>
                {TIMES.map(x => (
                  <button key={x.t} className="slot" aria-pressed={time === x.t} disabled={!x.left} onClick={() => setTime(x.t)}>
                    <span className="col g4"><b style={{ fontWeight: 600, fontSize: '.92rem' }}>{x.t}</b><span className="tiny" style={{ color: time === x.t ? 'oklch(0.92 0.03 262)' : undefined }}>{x.left ? x.left + ' left' : 'Full'}</span></span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {time && day && (
          <div className="card card-p col g14 fade">
            <Pill tone="brand">Ready to confirm</Pill>
            <h2>{day}, {time} · {office.name}</h2>
            <p className="sub">Bring the originals of your age and address proof, a print of the e-receipt and this appointment letter. Reach ten minutes early. {office.wait.toLowerCase()}.</p>
            <div className="row g12 wrapf">
              <button className="btn btn-p" onClick={() => { update({ slot: { day, time, rto: office.name }, stage: 'booked' }); go('tutorial'); }}>Confirm and prepare for the test {Icon.right()}</button>
              <button className="btn btn-s" onClick={() => { update({ slot: { day, time, rto: office.name }, stage: 'booked' }); go('status'); }}>Confirm only</button>
            </div>
          </div>
        )}
      </div>
      <div style={{ height: 56 }} />
    </div>
  );
}
