import { useState } from 'react';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Note } from '../ui/SharedUI';

const TUTORIAL_ITEMS: [heading: string, body: string][] = [
  ['Signals and priority', 'Amber means stop unless stopping is unsafe. At an unmarked junction, traffic from your right goes first. A pedestrian already on a zebra crossing goes before you, whatever your light says.'],
  ['Hazards you cannot see yet', 'Slow down before a parked van, a stopped bus or a blind bend — not after something appears. Most learner failures are about reacting late, not about not knowing the rule.'],
  ['Signs by shape', 'A triangle warns you. A circle orders or prohibits you. A rectangle informs you. Learn the three shapes and half the sign questions answer themselves.'],
  ['Markings', 'A solid centre line must not be crossed. A broken line allows overtaking when the road ahead is clear. Most people have this the wrong way round.'],
  ['What a learner must carry', "Your learner's licence, an L plate on the vehicle, and for most classes a licensed holder of that class beside you. Riding without them is an offence even with a valid LL."],
];

/** Mandatory road-safety tutorial gate before the theory test. */
export function Tutorial({ go, state }: PageProps) {
  const isAadhaar = state.form?.route === 'aadhaar';
  const [read, setRead] = useState<Record<number, boolean>>({});
  const allRead = TUTORIAL_ITEMS.every((_, i) => read[i]);

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <div className="col g10" style={{ marginBottom: 24 }}>
        <span className="eyebrow">Before stage 8 · mandatory</span><h1>Road safety tutorial</h1>
        <p className="lede">Watching this is mandatory, and in some states you have already paid a road safety fee for it. The official portal links a video most people leave playing in another tab. This is the same content as five things you can read in two minutes, ticked off as you go.</p>
      </div>
      <div className="card card-p col g12">
        {TUTORIAL_ITEMS.map(([heading, body], i) => (
          <button key={heading} className="tile" role="checkbox" aria-checked={!!read[i]} onClick={() => setRead({ ...read, [i]: !read[i] })}>
            <span className="tick" style={{ borderRadius: 6 }}>{read[i] ? Icon.check() : null}</span>
            <span className="col g6 grow"><b style={{ fontWeight: 600 }}>{heading}</b><span className="sub" style={{ lineHeight: 1.55 }}>{body}</span></span>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        {allRead && <div className="fade" style={{ marginBottom: 12 }}><Note tone="ok" icon={Icon.check()}><b>Tutorial complete.</b> Recorded against your application, so nobody can ask you to watch it again.</Note></div>}
        <Note tone={isAadhaar ? 'brand' : undefined}>{isAadhaar
          ? <span><b>Your test password will arrive by SMS</b> to the mobile registered against your Aadhaar. You can take the ten-question test from home, and download the licence the moment you pass.</span>
          : <span>You will take the test at the office on your appointment day. Practising here first means you walk in knowing the format.</span>}</Note>
      </div>
      <div className="sticky-cta"><div className="row g12 wrapf">
        <button className="btn btn-p" onClick={() => go('learn')} disabled={!allRead}>Practise the situations {Icon.right()}</button>
        <button className="btn btn-s" onClick={() => go('test')} disabled={!allRead}>Go straight to the test</button>
      </div></div>
    </div>
  );
}
