import { useState, type ReactNode } from 'react';
import { PixelScene } from '../practice/PixelScene';
import { SCENARIOS } from '../practice/scenarios';
import type { PageProps, Route } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Pill } from '../ui/SharedUI';

interface ServiceCard {
  id: 'll' | 'dl';
  icon: ReactNode;
  tag: string;
  title: string;
  desc: string;
  meta: string[];
  cta: string;
  targetRoute: Route;
}

const JOURNEY_STEPS: [heading: string, body: string][] = [
  ['Check', 'Three questions tell you if you qualify, before any fee is paid.'],
  ['Apply', 'Details arrive from documents you already hold. Photos are checked as you take them.'],
  ['Book', 'Pick an office by distance and remaining capacity, not by luck.'],
  ['Test', 'Ten questions, each answer explained. Pass and the licence is issued at once.'],
];

const DIFFERENTIATORS: [heading: string, body: string][] = [
  ['The price is on the first screen', 'Every charge for your class is listed before you begin, and the receipt names each one. Nothing is collected at a counter later.'],
  ['You can stop halfway', 'The application saves after every step. Come back on any device with the same mobile number and continue from where you left.'],
  ['A slot means a slot', 'Each RTO publishes remaining capacity and the average wait after you arrive, so a booking is a real appointment rather than a token.'],
];

export function Home({ go, update }: PageProps) {
  const [applicationLookup, setApplicationLookup] = useState('');

  const services: ServiceCard[] = [
    { id: 'll', icon: Icon.card({ width: 22, height: 22 }), tag: 'Start here', title: "Learner's Licence",
      desc: 'Your first licence. Apply online, then visit the RTO once for the test.',
      meta: ['Eight stages, about 14 minutes', '₹150 per class plus one ₹50 test fee', 'With Aadhaar: no RTO visit at all', '10 questions, 6 to pass'],
      cta: "Start learner's licence", targetRoute: 'elig' },
    { id: 'dl', icon: Icon.wheel({ width: 22, height: 22 }), tag: 'You already have an LL', title: 'Driving Licence',
      desc: 'Convert a valid learner\'s licence into a permanent driving licence.',
      meta: ['Starts from your LL number', '₹500 — ₹200 grant + ₹300 test', 'LL must be 30 to 180 days old', 'You bring the vehicle to the test'],
      cta: 'Start driving licence', targetRoute: 'dl' },
  ];

  return (
    <div className="fade">
      <section className="hero">
        <div className="wrap in">
          <div className="col g20">
            <span className="kicker">{Icon.dot()} Learner's &amp; driving licence · prototype</span>
            <h1>Apply for your<br />learner's or driving<br />licence <span className="uline">online.</span></h1>
            <p className="lede" style={{ maxWidth: 520 }}>Check your eligibility, complete the application, pay the exact fee, book your RTO test slot and track the status — all in one place.</p>
            <div className="row g12 wrapf" style={{ marginTop: 4 }}>
              <button className="btn btn-p" onClick={() => go('elig')}>Check if I qualify {Icon.right()}</button>
              <button className="btn btn-s" onClick={() => go('status')}>Track an application</button>
            </div>
            <div className="hero-stats">
              <span><b>14 min</b><span>to apply, start to end</span></span>
              <span><b>0 visits</b><span>to the RTO, with Aadhaar</span></span>
              <span><b>₹350</b><span>two classes, itemised up front</span></span>
            </div>
          </div>
          <div className="hero-art hide-m">
            <div className="lic col g20">
              <div className="row between g12"><span className="eyebrow" style={{ color: 'oklch(0.85 0.045 262)' }}>Learner's Licence · Maharashtra</span><span className="mono" style={{ fontSize: '.78rem', opacity: 0.75 }}>MH02 20260/0041</span></div>
              <div className="row g16" style={{ alignItems: 'flex-end' }}>
                <div className="stripe" style={{ width: 70, height: 86, borderRadius: 8, flex: 'none', opacity: 0.5 }} />
                <div className="col g6"><h2 style={{ fontSize: '1.4rem' }}>Rehan Q. Mirza</h2><span className="sub">LMV-NT, MCWG</span></div>
              </div>
              <div className="row between g16 wrapf" style={{ fontSize: '.82rem' }}>
                <span className="col"><span className="sub">Issued</span><b>20 Aug 2026</b></span>
                <span className="col"><span className="sub">Valid till</span><b>19 Feb 2027</b></span>
                <span className="col"><span className="sub">Blood group</span><b>B+</b></span>
              </div>
            </div>
            <div className="float float-a"><span style={{ color: 'var(--ok)' }}>{Icon.check()}</span> Documents verified in 4 seconds</div>
            <div className="float float-b"><span style={{ color: 'var(--brand)' }}>{Icon.pin()}</span> Slot held · Thu 27 Aug, 11:00 am</div>
          </div>
        </div>
      </section>
      <section className="wrap" style={{ marginTop: -34, position: 'relative', zIndex: 5 }}>
        <div className="grid2" style={{ gap: 20 }}>
          {services.map((service, i) => (
            <div key={service.id} className={'card modcard' + (i === 0 ? ' dark' : '')} style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <span className="idx">{i + 1}</span>
              <div className="row between g12">
                <span style={i === 0
                  ? { width: 44, height: 44, borderRadius: 12, background: 'oklch(1 0 0/.12)', color: 'var(--accent)', display: 'grid', placeItems: 'center', border: '1px solid oklch(1 0 0/.16)' }
                  : { width: 44, height: 44, borderRadius: 12, background: 'var(--brand-soft)', color: 'var(--brand)', display: 'grid', placeItems: 'center', border: '1px solid var(--brand-line)' }}>{service.icon}</span>
                {i === 0
                  ? <span className="pill" style={{ background: '#fff', borderColor: 'transparent', color: 'var(--brand)' }}>{service.tag}</span>
                  : <Pill>{service.tag}</Pill>}
              </div>
              <div className="col g8"><h2>{service.title}</h2><p style={{ color: i === 0 ? 'oklch(0.89 0.035 262)' : 'var(--ink2)' }}>{service.desc}</p></div>
              <hr className="hr" />
              <ul className="col g10" style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '.92rem' }}>
                {service.meta.map(line => (
                  <li key={line} className="row g10" style={{ alignItems: 'flex-start' }}><span style={{ color: i === 0 ? 'var(--accent)' : 'var(--brand)', marginTop: 5, flex: 'none' }}>{Icon.check()}</span><span style={{ color: i === 0 ? 'oklch(0.88 0.015 196)' : 'var(--ink2)' }}>{line}</span></li>
                ))}
              </ul>
              <div className="grow" />
              <button className={i === 0 ? 'btn btn-a btn-full' : 'btn btn-p btn-full'} onClick={() => { update({ module: service.id }); go(service.targetRoute); }}>{service.cta} {Icon.right()}</button>
            </div>
          ))}
        </div>
      </section>
      <section className="wrap" style={{ marginTop: 44 }}>
        <div className="col g16">
          <div className="row between g16 wrapf"><h2>The whole journey, in four moves</h2><span className="sub">Learner's licence · about 14 minutes plus one RTO visit</span></div>
          <div className="strip">
            {JOURNEY_STEPS.map(([heading, body], n) => (
              <div key={heading}><span className="strip-n">{n + 1}</span><div className="col g6"><h3>{heading}</h3><p className="sub" style={{ lineHeight: 1.55 }}>{body}</p></div></div>
            ))}
          </div>
        </div>
      </section>
      <section className="wrap" style={{ marginTop: 44 }}>
        <div className="card col" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)', alignItems: 'stretch' }} className="learnband">
            <div className="col g16" style={{ padding: '32px 30px', justifyContent: 'center' }}>
              <span className="eyebrow">Practice module</span>
              <h2>Nobody tells you what is in the theory test. So play it instead.</h2>
              <p style={{ color: 'var(--ink2)', lineHeight: 1.6 }}>Twelve road situations, four seconds each. You are scored on the decision and on how long it took — the same thing the test measures. The report card names the two habits to fix.</p>
              <div className="row g10 wrapf">
                <button className="btn btn-p" onClick={() => go('learn')}>{Icon.play()} Play the road</button>
                <span className="tiny" style={{ alignSelf: 'center' }}>No download · works offline</span>
              </div>
            </div>
            <div style={{ minHeight: 230 }}><PixelScene map={SCENARIOS[4].map} art={SCENARIOS[4].art} /></div>
          </div>
        </div>
      </section>
      <section className="wrap" style={{ marginTop: 20 }}>
        <div className="card card-p row between g16 wrapf">
          <div className="col g4"><h3>Already applied?</h3><span className="sub">Enter your application number to see where it is stuck and what to do about it.</span></div>
          <div className="row g10 wrapf">
            <input className="input mono" style={{ width: 210 }} placeholder="SS-2026-004182" value={applicationLookup} onChange={e => setApplicationLookup(e.target.value)} />
            <button className="btn btn-s" onClick={() => go('status')}>{Icon.search()} Find</button>
          </div>
        </div>
      </section>
      <section className="wrap" style={{ marginTop: 44 }}>
        <div className="panel" style={{ padding: '36px 32px' }}>
          <span className="eyebrow" style={{ color: 'oklch(0.85 0.025 196)' }}>What is different here</span>
          <div className="grid3" style={{ marginTop: 22, gap: 32 }}>
            {DIFFERENTIATORS.map(([heading, body]) => (
              <div key={heading} className="col g8"><h3 style={{ color: '#fff' }}>{heading}</h3><p className="sub" style={{ lineHeight: 1.6 }}>{body}</p></div>
            ))}
          </div>
        </div>
      </section>
      <div className="wrap" style={{ marginTop: 24 }}>
        <Note tone="warn">This is a design prototype. It is not a government service, it is not connected to any live system, and every name, number, document and payment in it is synthetic.</Note>
      </div>
    </div>
  );
}
