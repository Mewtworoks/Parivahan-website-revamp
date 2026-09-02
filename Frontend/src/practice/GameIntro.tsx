import { useT } from '../lib/language';
import { Icon } from '../ui/Icon';
import { Note } from '../ui/SharedUI';
import type { PageProps } from '../types';
import { PixelScene } from './PixelScene';
import { scenariosFor, spelledOut, vehicleFocusFrom } from './scenarios';

const TOPICS: [heading: string, body: string, headingHi: string, bodyHi: string][] = [
  ['Signals & priority', 'Amber decisions, unmarked junctions, who goes first.',
    'संकेत और प्राथमिकता', 'पीली बत्ती के फैसले, बिना निशान वाले चौराहे, पहले कौन जाए।'],
  ['Hazards', 'The child behind the van, cattle, a bus unloading, blind spots.',
    'खतरे', 'वैन के पीछे खड़ा बच्चा, मवेशी, सवारी उतारती बस, वे जगहें जो दिखती नहीं।'],
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
  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }} onClick={() => go('home')}>{Icon.left()} {t('Home', 'होम', 'होम')}</button>
      <div className="col g12" style={{ marginBottom: 24 }}>
        <span className="eyebrow">{t("Practice module · learner's theory", 'अभ्यास मॉड्यूल · लर्नर थ्योरी', 'सराव मॉड्यूल · लर्नर थिअरी')}</span>
        <h1>{t('Play the road, then take the test', 'सड़क खेलिए, फिर परीक्षा दीजिए', 'रस्ता खेळा, मग परीक्षा द्या')}</h1>
        <p className="lede">{t(
          `${count} real road situations. Four seconds each. You are scored on the decision and on how long you took to make it, because in the test and on the road, hesitation counts.`,
          `${total} असली सड़क स्थितियाँ। हर एक के लिए चार सेकंड। आपको फैसले पर और यह लेने में लगे समय दोनों पर अंक मिलते हैं, क्योंकि परीक्षा में और सड़क पर, हिचक मायने रखती है।`,
          `${total} खऱ्या रस्त्यावरील परिस्थिती. प्रत्येकासाठी चार सेकंद. तुम्हाला निर्णयावर आणि तो घेण्यास लागलेल्या वेळेवर गुण मिळतात, कारण परीक्षेत आणि रस्त्यावर, संकोच महत्त्वाचा असतो.`,
        )}</p>
        {scopeNote && <Note tone="brand">{t(scopeNote.en, scopeNote.hi)}</Note>}
      </div>
      <div className="card col" style={{ overflow: 'hidden' }}>
        <PixelScene map={pool[0].map} art={pool[0].art} />
        <div className="col g16" style={{ padding: 24 }}>
          <div className="grid3" style={{ gap: 20 }}>
            {TOPICS.map(([heading, body, headingHi, bodyHi]) => (
              <div key={heading} className="col g6"><b style={{ fontWeight: 600, fontSize: '.95rem' }}>{t(heading, headingHi)}</b><span className="sub" style={{ lineHeight: 1.55 }}>{t(body, bodyHi)}</span></div>
            ))}
          </div>
          <hr className="hr" />
          <div className="row between g12 wrapf">
            <span className="tiny" style={{ maxWidth: 420 }}>{t(
              'Drawn as pixel-art tiles on purpose: the whole scene set is a few kilobytes, renders on a 2015 Android and works with no connection. A 3D driving sim would not.',
              'पिक्सेल-आर्ट टाइलों में जानबूझकर बनाया गया: पूरा दृश्य सेट कुछ ही किलोबाइट का है, 2015 के एंड्रॉइड पर चलता है और बिना कनेक्शन के भी काम करता है। कोई 3D ड्राइविंग सिम ऐसा नहीं कर पाता।',
              'पिक्सेल-आर्ट टाइल्समध्ये मुद्दाम काढले: संपूर्ण दृश्य संच काही किलोबाइटचा आहे, 2015 च्या अँड्रॉइडवर चालतो आणि कनेक्शनशिवायही काम करतो. कोणतेही 3D ड्रायव्हिंग सिम असे करू शकत नाही.',
            )}</span>
            {/* One way in. This was briefly two — a scored round with three
                lives beside a full-bank mode without them — and then the lives
                went, at which point the two modes were the same round with two
                names. */}
            <button className="btn btn-p" onClick={() => { update({ focus: null, gameLog: null }); go('lesson'); }}>{t(`Start · all ${total} situations`, `शुरू करें · सभी ${total} स्थितियाँ`, `सुरू करा · सर्व ${total} परिस्थिती`)} {Icon.right()}</button>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}><Note>{t(
        'Scenario bank written offline from the Motor Vehicles Act and state RTO question banks, then human-reviewed and frozen. Nothing is generated while you play — only the coaching paragraphs on the report card are written at runtime.',
        'स्थितियों का बैंक मोटर वाहन अधिनियम और राज्य आरटीओ प्रश्न बैंकों से पहले ही लिखा गया, फिर इंसानों ने जाँचा और तय कर दिया। खेलते समय कुछ भी नया नहीं बनाया जाता — सिर्फ रिपोर्ट कार्ड पर मार्गदर्शन के पैराग्राफ उसी समय लिखे जाते हैं।',
        'परिस्थितींचा संच मोटर वाहन कायदा आणि राज्य आरटीओ प्रश्न संचांमधून आधीच लिहिला गेला, नंतर माणसांनी तपासला आणि निश्चित केला. खेळताना काहीही नवीन तयार होत नाही — फक्त रिपोर्ट कार्डवरील मार्गदर्शन परिच्छेद त्याच वेळी लिहिले जातात.',
      )}</Note></div>
      <div style={{ marginTop: 12 }}><Note icon={false}><span className="tiny mono">{t(
        'Keyboard: A, B or C to answer · Enter or Space to continue after each reveal.',
        'कीबोर्ड: उत्तर के लिए A, B या C · हर जवाब दिखने के बाद आगे बढ़ने के लिए Enter या Space।',
        'कीबोर्ड: उत्तरासाठी A, B किंवा C · प्रत्येक उत्तर दिसल्यावर पुढे जाण्यासाठी Enter किंवा Space.',
      )}</span></Note></div>
      <div style={{ height: 48 }} />
    </div>
  );
}
