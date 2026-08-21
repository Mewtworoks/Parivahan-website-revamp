import { Icon } from '../ui/Icon';
import { Note } from '../ui/SharedUI';
import type { PageProps } from '../types';
import { PixelScene } from './PixelScene';
import { SCENARIOS } from './scenarios';

const TOPICS: [heading: string, body: string][] = [
  ['Signals & priority', 'Amber decisions, unmarked junctions, who goes first.'],
  ['Hazards', 'The child behind the van, cattle, a bus unloading, blind spots.'],
  ['Signs & documents', 'Triangle warns, circle orders. What a learner must carry.'],
];

export function GameIntro({ go, update }: PageProps) {
  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }} onClick={() => go('home')}>{Icon.left()} Home</button>
      <div className="col g12" style={{ marginBottom: 24 }}>
        <span className="eyebrow">Practice module · learner's theory</span>
        <h1>Play the road, then take the test</h1>
        <p className="lede">Twelve real road situations. Four seconds each. You are scored on the decision and on how long you took to make it, because in the test and on the road, hesitation counts.</p>
      </div>
      <div className="card col" style={{ overflow: 'hidden' }}>
        <PixelScene map={SCENARIOS[0].map} art={SCENARIOS[0].art} />
        <div className="col g16" style={{ padding: 24 }}>
          <div className="grid3" style={{ gap: 20 }}>
            {TOPICS.map(([heading, body]) => (
              <div key={heading} className="col g6"><b style={{ fontWeight: 600, fontSize: '.95rem' }}>{heading}</b><span className="sub" style={{ lineHeight: 1.55 }}>{body}</span></div>
            ))}
          </div>
          <hr className="hr" />
          <div className="row between g12 wrapf">
            <span className="tiny" style={{ maxWidth: 420 }}>Drawn as 8-pixel tiles on purpose: the whole scene set is a few kilobytes, renders on a 2015 Android and works with no connection. A 3D driving sim would not.</span>
            <button className="btn btn-p" onClick={() => { update({ focus: null, gameLog: null }); go('game'); }}>Start · 12 situations {Icon.right()}</button>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}><Note>Scenario bank written offline from the Motor Vehicles Act and state RTO question banks, then human-reviewed and frozen. Nothing is generated while you play — only the coaching paragraphs on the report card are written at runtime.</Note></div>
      <div style={{ height: 48 }} />
    </div>
  );
}
