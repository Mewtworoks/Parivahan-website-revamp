import { useLanguage, useT } from '../lib/language';
import { RoadScene } from '../practice/RoadScene';
import { DECISION_LIMIT_MS, ROAD_SPECS, SCENARIOS, spelledOut } from '../practice/scenarios';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { LicenceCard } from '../ui/LicenceCard';
import { Pill } from '../ui/SharedUI';

// A verb code, not a translated label — it reads as a system/step marker (like the "n" it sits
// beside), the same register as the mono application-number placeholder further down the page.
const JOURNEY_STEPS: [verb: string, heading: string, headingHi: string, headingMr: string, body: string, bodyHi: string, bodyMr: string][] = [
  ['CHECK', 'Are you eligible', 'क्या आप पात्र हैं', 'तुम्ही पात्र आहात का',
    'Three questions tell you if you qualify, before any fee is paid.',
    'शुल्क देने से पहले, तीन सवालों से पता चलता है कि आप पात्र हैं या नहीं।',
    'शुल्क भरण्याआधी, तीन प्रश्नांवरून तुम्ही पात्र आहात का हे कळते.'],
  ['APPLY', 'Fill the form once', 'फ़ॉर्म एक बार भरें', 'फॉर्म एकदा भरा',
    'Details arrive from documents you already hold. Photos are checked as you take them.',
    'विवरण उन दस्तावेज़ों से आते हैं जो आपके पास पहले से हैं। फ़ोटो लेते ही जांची जाती है।',
    'तपशील तुमच्याकडे आधीच असलेल्या कागदपत्रांमधून येतो. फोटो घेताच तपासला जातो.'],
  ['BOOK', 'Pick a real slot', 'एक असली स्लॉट चुनें', 'खरा स्लॉट निवडा',
    'Choose an office by distance and remaining capacity, not by luck.',
    'दफ़्तर दूरी और बची हुई क्षमता के आधार पर चुनें, किस्मत के आधार पर नहीं।',
    'कार्यालय अंतर आणि उरलेल्या क्षमतेनुसार निवडा, नशिबावर नाही.'],
  ['TEST', 'Ten questions', 'दस सवाल', 'दहा प्रश्न',
    'Each answer explained. Pass, and the licence is issued at once.',
    'हर जवाब समझाया गया है। पास होने पर लाइसेंस तुरंत जारी होता है।',
    'प्रत्येक उत्तर समजावलेले आहे. उत्तीर्ण झाल्यास लायसन्स लगेच दिले जाते.'],
];

// Two sentences each, and the second one is the sharp one.
//
// These were four-sentence paragraphs, and the qualifications inside them were
// all true and all earned — a claim on this page had twice been wrong and been
// rewritten to say only what the build does. But this is a page somebody scans
// on the way to a button, and a claim nobody finishes reading is not a claim
// that has been made. The scoping did not go anywhere: it lives on the screen
// each card points at, where a reader has already decided to read.
const DIFFERENTIATORS: [icon: ReturnType<typeof Icon.doc>, heading: string, headingHi: string, headingMr: string, body: string, bodyHi: string, bodyMr: string][] = [
  [Icon.doc({ width: 14, height: 14 }), 'The price is on the first screen', 'कीमत पहली स्क्रीन पर ही है', 'किंमत पहिल्याच स्क्रीनवर आहे',
    'Every charge is listed before you begin, and named again on the receipt. Nothing is collected at a counter later.',
    'हर शुल्क शुरू करने से पहले सूचीबद्ध है, और रसीद में दोबारा नाम से। बाद में काउंटर पर कुछ नहीं लिया जाता।',
    'प्रत्येक शुल्क सुरुवातीआधी नोंदवलेले असते, आणि पावतीवर पुन्हा नावासह. नंतर काउंटरवर काहीही घेतले जात नाही.'],
  [Icon.clock({ width: 14, height: 14 }), 'You can stop halfway', 'आप बीच में रुक सकते हैं', 'तुम्ही मध्येच थांबू शकता',
    'The form saves as you go and survives a closed tab. Your number and date of birth reopen it from anywhere.',
    'फ़ॉर्म अपने-आप सहेजा जाता है और टैब बंद होने पर भी बचा रहता है। नंबर और जन्मतिथि से इसे कहीं से भी खोलें।',
    'फॉर्म आपोआप जतन होतो आणि टॅब बंद झाल्यावरही टिकतो. क्रमांक आणि जन्मतारखेने तो कुठूनही उघडा.'],
  [Icon.pin({ width: 14, height: 14 }), 'A slot means a slot', 'स्लॉट का मतलब स्लॉट ही है', 'स्लॉट म्हणजे स्लॉटच',
    'Each RTO publishes what is genuinely left. The queue is called in appointment order, so arriving at dawn earns nothing.',
    'हर आरटीओ बताता है कि सच में कितनी जगह बची है। कतार अपॉइंटमेंट के क्रम में बुलाई जाती है, इसलिए भोर में पहुंचने से कुछ नहीं मिलता।',
    'प्रत्येक आरटीओ खरोखर किती जागा उरली आहे ते सांगतो. रांग अपॉइंटमेंटच्या क्रमाने बोलावली जाते, म्हणून पहाटे पोहोचून काही मिळत नाही.'],
];

// The learner's-licence facts strip, on the one "start here" panel. With the DL journey parked
// (see the note in types.ts) there is only ever one service, so this no longer needs to be a
// mapped list of cards — a fixed panel says so plainly instead of looping over an array of one.
const LL_FACTS: [en: string, hi: string, mr: string][] = [
  ['Eight stages, about 14 minutes', 'आठ चरण, लगभग 14 मिनट', 'आठ टप्पे, सुमारे 14 मिनिटे'],
  ['₹150 per class plus one ₹50 test fee', 'प्रति श्रेणी ₹150 और एक बार ₹50 टेस्ट शुल्क', 'प्रति वर्ग ₹150 आणि एकदा ₹50 टेस्ट शुल्क'],
  ['With Aadhaar: no RTO visit at all', 'आधार के साथ: आरटीओ जाने की ज़रूरत नहीं', 'आधारसह: आरटीओला जाण्याची गरज नाही'],
  ['10 questions, 6 to pass', '10 प्रश्न, पास होने के लिए 6', '10 प्रश्न, उत्तीर्ण होण्यासाठी 6'],
];

export function Home({ go, update }: PageProps) {
  const t = useT();
  const { lang } = useLanguage();

  return (
    <div className="fade">
      <section className="hero">
        <div className="wrap">
          <div className="in">
            <div className="col g20">
              {/* Learner's only, here and in the kicker. The DL journey is parked
                  — see the note in types.ts — so naming it in the first thing
                  anyone reads sends people looking for a door that is not there. */}
              <span className="kicker">{Icon.dot()} {t("Learner's licence · prototype", 'लर्नर लाइसेंस · प्रोटोटाइप', 'लर्नर लायसन्स · प्रोटोटाइप')}</span>
              <h1>{lang === 'hi'
                ? <>अपने लर्नर लाइसेंस के लिए <span className="uline">ऑनलाइन आवेदन करें।</span></>
                : lang === 'mr'
                  ? <>तुमच्या लर्नर लायसन्ससाठी <span className="uline">ऑनलाइन अर्ज करा.</span></>
                  : <>Apply for your<br />learner's licence<br /><span className="uline">online.</span></>}</h1>
              {/* A fixed 520 held on every screen, so as the hero grew the
                sentence stayed a narrow column with the headline stretching
                away above it. Still capped — this is prose — but it now tracks
                the column it sits in. */}
              <p className="lede" style={{ maxWidth: 'min(620px, 100%)' }}>
                {t('Check your eligibility, complete the application, pay the exact fee, book your RTO test slot and track the status — all in one place.',
                  'अपनी पात्रता जाँचिए, आवेदन पूरा कीजिए, सही शुल्क दीजिए, आरटीओ टेस्ट का स्लॉट बुक कीजिए और स्थिति देखिए — सब एक ही जगह।',
                  'तुमची पात्रता तपासा, अर्ज पूर्ण करा, नेमके शुल्क भरा, आरटीओ टेस्टचा स्लॉट बुक करा आणि स्थिती पाहा — सर्व एकाच ठिकाणी.')}
              </p>
              <div className="row g12 wrapf" style={{ marginTop: 4 }}>
                <button className="btn btn-p" onClick={() => go('elig')}>{t('Check if I qualify', 'जांचें कि मैं पात्र हूं', 'मी पात्र आहे का ते तपासा')} {Icon.right()}</button>
                <button className="btn btn-s" onClick={() => go('status')}>{t('Track an application', 'आवेदन ट्रैक करें', 'अर्ज ट्रॅक करा')}</button>
              </div>
            </div>
            <div className="hero-art hide-m">
              {/* A specimen, so every identifying field is masked. The data was
                  always synthetic, but a full name, parentage, date of birth,
                  blood group and home address rendered on a licence read as a
                  real person's record whatever the footer says — and this card is
                  the first thing on the page. What stays is what carries no
                  identity: the state, the classes, the dates and the office.
                  Issued.tsx passes the citizen's own details and is untouched. */}
              <LicenceCard documentTitle="Learner's Licence" stateName="Maharashtra" licenceNo="MH02 ••••••/••••"
                name="•••••• •• •••••" relation="•••••• •••••" dob="••/••/••••" blood="••"
                addressLine1="•••••••••••••••••••••••••" addressLine2="•••••••••••••••••"
                classCodes="LMV-NT, MCWG" issueDate="20/08/2026" validTill="19/02/2027" rtoCode="MH-02" />
            </div>
          </div>
        </div>
      </section>
      <section className="wrap" style={{ marginTop: 44 }}>
        <div className="start">
          <div className="col g16">
            <div className="row g12 wrapf">
              <span className="eyebrow">{t('Start here', 'यहां से शुरू करें', 'येथून सुरू करा')}</span>
              <span className="tiny">· {t('the only module in this prototype', 'इस प्रोटोटाइप में एकमात्र मॉड्यूल', 'या प्रोटोटाइपमध्ये एकमेव मॉड्यूल')}</span>
            </div>
            <div className="col g8">
              <h2>{t("Learner's Licence", 'लर्नर लाइसेंस', 'लर्नर लायसन्स')}</h2>
              <p className="sub" style={{ maxWidth: '52ch' }}>
                {t('Your first licence. Apply online, then visit the RTO once for the test — or not at all, if you authenticate with Aadhaar.',
                  'आपका पहला लाइसेंस। ऑनलाइन आवेदन कीजिए, फिर टेस्ट के लिए एक बार आरटीओ जाइए — या आधार से प्रमाणीकरण करने पर बिल्कुल भी नहीं।',
                  'तुमचे पहिले लायसन्स. ऑनलाइन अर्ज करा, नंतर टेस्टसाठी एकदा आरटीओला जा — किंवा आधारने प्रमाणीकरण केल्यास अजिबात जाऊ नका.')}
              </p>
            </div>
            <ul className="facts">
              {LL_FACTS.map(([en, hi, mr]) => (
                <li key={en}>{Icon.check()} {t(en, hi, mr)}</li>
              ))}
            </ul>
          </div>
          {/* Straight into the wizard. The eligibility check is a separate question
              with its own button in the hero — routing "Start" through it made
              someone who already knows they qualify answer three questions before
              they were allowed to begin. Stage one's Back still goes to the
              checklist, so what you need to have ready stays one press away. */}
          <button className="btn btn-p btn-lg" onClick={() => { update({ module: 'll' }); go('apply'); }}>
            {t('Start the application', 'आवेदन शुरू करें', 'अर्ज सुरू करा')} {Icon.right()}
          </button>
        </div>
      </section>
      <section className="wrap" style={{ marginTop: 44 }}>
        <div className="col g16">
          <div className="row between g16 wrapf">
            <div className="col g8"><span className="eyebrow">{t('How it goes', 'यह कैसे होता है', 'हे कसे होते')}</span><h2>{t('The whole journey, in four moves', 'पूरी यात्रा, चार चरणों में', 'संपूर्ण प्रवास, चार टप्प्यांत')}</h2></div>
            <span className="tiny">{t('About 14 minutes, plus one RTO visit', 'लगभग 14 मिनट, साथ में एक आरटीओ यात्रा', 'साधारण 14 मिनिटे, अधिक एक आरटीओ भेट')}</span>
          </div>
          <div className="steps">
            {JOURNEY_STEPS.map(([verb, heading, headingHi, headingMr, body, bodyHi, bodyMr], n) => (
              <div key={heading}>
                <span className="n"><i>{n + 1}</i> {verb}</span>
                <h3>{t(heading, headingHi, headingMr)}</h3>
                <p>{t(body, bodyHi, bodyMr)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="wrap" style={{ marginTop: 44 }}>
        <div className="card col" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)', alignItems: 'stretch' }} className="learnband">
            <div className="col g16" style={{ padding: '32px 30px', justifyContent: 'center' }}>
              <span className="eyebrow">{t('Practice module', 'अभ्यास मॉड्यूल', 'सराव मॉड्यूल')}</span>
              <h2>{t('Nobody tells you what is in the theory test. So play it instead.', 'थ्योरी टेस्ट में क्या है, यह कोई नहीं बताता। तो इसे खेलकर जानें।', 'थिअरी टेस्टमध्ये काय आहे, हे कोणी सांगत नाही. मग ते खेळूनच जाणून घ्या.')}</h2>
              {/* Says "practice", not "the test". Sitting directly under a card
                  that reads "10 questions, 6 to pass", a bare count of road
                  situations looked like a second, contradictory test length. */}
              <p style={{ color: 'var(--ink2)', lineHeight: 1.6 }}>
                {t(`${spelledOut(SCENARIOS.length).replace(/^./, c => c.toUpperCase())} road situations, ${DECISION_LIMIT_MS / 1000} seconds each. Scored on the decision and on how long it took, like the real test — and the report card names two habits to fix.`,
                  `${SCENARIOS.length} सड़क स्थितियाँ, हर एक ${DECISION_LIMIT_MS / 1000} सेकंड में। मूल्यांकन फैसले पर और उसमें लगे समय पर, असली टेस्ट की तरह — और रिपोर्ट कार्ड सुधारने योग्य दो आदतें बताता है।`,
                  `${SCENARIOS.length} रस्ता परिस्थिती, प्रत्येक ${DECISION_LIMIT_MS / 1000} सेकंदांत। मूल्यमापन निर्णयावर आणि लागलेल्या वेळेवर, खऱ्या टेस्टसारखे — आणि रिपोर्ट कार्ड सुधारण्यासारख्या दोन सवयी सांगते.`)}
              </p>
              <div className="row g10 wrapf">
                <button className="btn btn-p" onClick={() => go('learn')}>{Icon.play()} {t('Play the road', 'सड़क खेलें', 'रस्ता खेळा')}</button>
                <span className="tiny" style={{ alignSelf: 'center' }}>{t('No download · works offline', 'डाउनलोड की ज़रूरत नहीं · ऑफ़लाइन भी काम करता है', 'डाउनलोड करण्याची गरज नाही · ऑफलाइनही काम करते')}</span>
              </div>
            </div>
            {/* The cattle-in-the-lane situation, which is the one that reads
                fastest as a picture of a road problem out of context. */}
            <div style={{ minHeight: 230 }}><RoadScene spec={ROAD_SPECS.H2} /></div>
          </div>
        </div>
      </section>
      <section className="wrap" style={{ marginTop: 44 }}>
        <div className="col g8" style={{ marginBottom: 22 }}>
          <span className="eyebrow">{t('What is different here', 'यहां क्या अलग है', 'इथे काय वेगळे आहे')}</span>
          <h2>{t('Three promises, and a way to check each', 'तीन वादे, और हर एक जांचने का एक तरीका', 'तीन आश्वासने, आणि प्रत्येक तपासण्याचा मार्ग')}</h2>
        </div>
        <div className="claims">
          {DIFFERENTIATORS.map(([icon, heading, headingHi, headingMr, body, bodyHi, bodyMr]) => (
            <div key={heading}>
              <span className="claim-ic">{icon}</span>
              <h3>{t(heading, headingHi, headingMr)}</h3>
              <p>{t(body, bodyHi, bodyMr)}</p>
            </div>
          ))}
        </div>
      </section>
      {/* Directly under the three claims, because these two screens are where
          the claims are checked rather than asserted. Both were reachable only
          from the footer and — for the desk — from a block inside the tracker
          that does not render until somebody has checked in, which meant the
          strongest thing in the build was the hardest thing to find. */}
      <section className="wrap" style={{ marginTop: 20 }}>
        <div className="col g16">
          <div className="row between g16 wrapf">
            <div className="col g8"><span className="eyebrow">{t('Do not take our word', 'हमारी बात न मानें', 'आमचा शब्द मानू नका')}</span><h2>{t('Or check the claims yourself', 'या फिर दावों को खुद जांचें', 'किंवा दावे स्वतः तपासा')}</h2></div>
            <span className="sub">{t('Three screens, all reading the live service', 'तीन स्क्रीन, सभी लाइव सेवा से पढ़ रही हैं', 'तीन स्क्रीन, सर्व लाइव्ह सेवेतून वाचत आहेत')}</span>
          </div>
          <div className="grid3" style={{ gap: 20 }}>
            <div className="card card-p col g12">
              <Pill>{t('Staff view', 'कर्मचारी दृश्य', 'कर्मचारी दृश्य')}</Pill>
              <h3>{t('Inspector desk', 'निरीक्षक डेस्क', 'निरीक्षक डेस्क')}</h3>
              <p className="sub" style={{ lineHeight: 1.6 }}>{t('The counter’s side of the same queue. Call a token here and the wait on the applicant’s phone moves.', 'उसी कतार का काउंटर वाला हिस्सा। यहाँ टोकन बुलाइए और आवेदक के फ़ोन पर इंतज़ार बदल जाएगा।', 'त्याच रांगेची काउंटरकडची बाजू. येथे टोकन बोलवा आणि अर्जदाराच्या फोनवरची वाट बदलेल.')}</p>
              <div className="grow" />
              <div><button className="btn btn-s" onClick={() => go('desk')}>{t('Open the inspector desk', 'निरीक्षक डेस्क खोलें', 'निरीक्षक डेस्क उघडा')} {Icon.right()}</button></div>
            </div>
            <div className="card card-p col g12">
              <Pill tone="brand">{t('Runnable', 'चलाकर देखें', 'चालवून पहा')}</Pill>
              <h3>{t('See the guarantees run', 'गारंटी चलती देखें', 'हमी चालताना पहा')}</h3>
              <p className="sub" style={{ lineHeight: 1.6 }}>{t('No double booking, no double charge, no silent edit — each one fired at the live service while you watch.', 'न दोहरी बुकिंग, न दोहरा शुल्क, न चुपचाप बदलाव — हर एक आपके सामने लाइव सेवा पर चलाया जाता है।', 'दुहेरी बुकिंग नाही, दुहेरी शुल्क नाही, गुपचूप बदल नाही — प्रत्येक तुमच्यासमोर लाइव्ह सेवेवर चालवली जाते.')}</p>
              <div className="grow" />
              <div><button className="btn btn-s" onClick={() => go('proof')}>{t('Run the proofs', 'प्रूफ चलाएं', 'प्रूफ चालवा')} {Icon.right()}</button></div>
            </div>
            <div className="card card-p col g12">
              <Pill>{t('Aggregate', 'समग्र', 'एकत्रित')}</Pill>
              <h3>{t('Where people actually fail', 'लोग असल में कहाँ अटकते हैं', 'लोक खरोखर कुठे अडतात')}</h3>
              <p className="sub" style={{ lineHeight: 1.6 }}>{t('Which road rule most people get wrong, and which form field loses them. No names anywhere.', 'कौन-सा नियम सबसे ज़्यादा लोग गलत करते हैं, और कौन-सी फ़ील्ड उन्हें खो देती है। कहीं कोई नाम नहीं।', 'कोणता नियम सर्वाधिक लोक चुकतात, आणि कोणते फील्ड त्यांना गमावते. कुठेही नाव नाही.')}</p>
              <div className="grow" />
              <div><button className="btn btn-s" onClick={() => go('learning')}>{t('See what it learns', 'देखें यह क्या सीखती है', 'ती काय शिकते ते पहा')} {Icon.right()}</button></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
