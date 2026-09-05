import { useT } from '../lib/language';
import { Icon } from '../ui/Icon';
import { Note } from '../ui/SharedUI';
import type { PageProps } from '../types';
import { RoadScene } from './RoadScene';
import { DECISION_LIMIT_MS, ROAD_SPECS, scenariosFor, spelledOut, vehicleFocusFrom } from './scenarios';

const TOPICS: [heading: string, body: string, headingHi: string, bodyHi: string][] = [
  ['Signals & priority', 'Yellow-light decisions, unmarked junctions, who goes first.',
    'संकेत और प्राथमिकता', 'पीली बत्ती के फैसले, बिना निशान वाले चौराहे, पहले कौन जाए।'],
  // "The child behind the van" named the parked-van scenario, which was removed
  // for duplicating the stopped-bus one. Copy that lists examples has to be
  // checked against the bank when the bank changes.
  ['Hazards', 'Cattle in the lane, a bus unloading, wrong-side riders, blind spots.',
    'खतरे', 'लेन में मवेशी, सवारी उतारती बस, उलटी दिशा से आते सवार, वे जगहें जो दिखती नहीं।'],
  ['Signs & documents', 'Triangle warns, circle orders. What a learner must carry.',
    'चिह्न और दस्तावेज़', 'तिकोना चेतावनी देता है, गोल आदेश। लर्नर को क्या साथ रखना चाहिए।'],
];

const VEHICLE_SCOPE_NOTE: Record<string, { en: string; hi: string }> = {
  car: {
    en: "Scoped to car questions, plus the general road rules — since that's what you're applying for.",
    hi: 'कार से जुड़े सवालों तक सीमित, साथ में आम सड़क नियम — क्योंकि आपने उसी के लिए आवेदन किया है।',
  },
  bike: {
    en: "Scoped to two-wheeler questions, plus the general road rules — since that's what you're applying for.",
    hi: 'दोपहिया से जुड़े सवालों तक सीमित, साथ में आम सड़क नियम — क्योंकि आपने उसी के लिए आवेदन किया है।',
  },
};

export function GameIntro({ go, state, update }: PageProps) {
  const t = useT();
  const vehicleFocus = vehicleFocusFrom(state);
  const pool = scenariosFor(vehicleFocus);
  const total = pool.length;
  const scopeNote = VEHICLE_SCOPE_NOTE[vehicleFocus];
  // Hindi uses the numeral rather than the spelled-out word: `spelledOut` writes
  // English number words, and "उनतीस" reads as heavier than the digit does here.
  const count = spelledOut(total).replace(/^./, c => c.toUpperCase());
  const secs = DECISION_LIMIT_MS / 1000;
  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }} onClick={() => go('home')}>{Icon.left()} {t('Home', 'होम', 'होम')}</button>
      <div className="col g12" style={{ marginBottom: 24 }}>
        <span className="eyebrow">{t("Practice module · learner's theory", 'अभ्यास मॉड्यूल · लर्नर थ्योरी', 'सराव मॉड्यूल · लर्नर थिअरी')}</span>
        <h1>{t('Play the road, then take the test', 'सड़क खेलिए, फिर परीक्षा दीजिए', 'रस्ता खेळा, मग परीक्षा द्या')}</h1>
        <p className="lede">{t(
          `${count} real road situations, ${secs} seconds each. You are scored on the decision and on how long you took to make it.`,
          `${total} असली सड़क स्थितियाँ, हर एक के लिए ${secs} सेकंड। आपको फैसले पर और उसमें लगे समय पर अंक मिलते हैं।`,
          `${total} खऱ्या रस्त्यावरील परिस्थिती, प्रत्येकासाठी ${secs} सेकंद. तुम्हाला निर्णयावर आणि त्यास लागलेल्या वेळेवर गुण मिळतात.`,
        )}</p>
        {scopeNote && <Note tone="brand">{t(scopeNote.en, scopeNote.hi)}</Note>}
      </div>
      <div className="card col" style={{ overflow: 'hidden' }}>
        <RoadScene spec={ROAD_SPECS[pool[0].id] || ROAD_SPECS.H2} />
        <div className="col g16" style={{ padding: 24 }}>
          <div className="grid3" style={{ gap: 20 }}>
            {TOPICS.map(([heading, body, headingHi, bodyHi]) => (
              <div key={heading} className="col g6"><b style={{ fontWeight: 600, fontSize: '.95rem' }}>{t(heading, headingHi)}</b><span className="sub" style={{ lineHeight: 1.55 }}>{t(body, bodyHi)}</span></div>
            ))}
          </div>
          <hr className="hr" />
          {/* One way in. This was briefly two — a scored round with three lives
              beside a full-bank mode without them — and then the lives went, at
              which point the two modes were the same round with two names. */}
          {/* The keyboard hint is gone from here. It belongs on the round
              itself, where those keys actually do something — Game.tsx still
              carries it — and on the way in it was a line of instructions for a
              screen with one button on it. */}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-p" onClick={() => { update({ focus: null, gameLog: null }); go('lesson'); }}>{t(`Start · all ${total} situations`, `शुरू करें · सभी ${total} स्थितियाँ`, `सुरू करा · सर्व ${total} परिस्थिती`)} {Icon.right()}</button>
          </div>
        </div>
      </div>
      <div style={{ height: 48 }} />
    </div>
  );
}
