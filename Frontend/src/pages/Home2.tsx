import { useLanguage, useT } from '../lib/language';
import { PixelScene } from '../practice/PixelScene';
import { DECISION_LIMIT_MS, SCENARIOS, spelledOut } from '../practice/scenarios';
import type { PageProps, Route } from '../types';
import { Icon } from '../ui/Icon';
import { LicenceCard } from '../ui/LicenceCard';

/**
 * The home page, restructured. Same copy, same CSS classes, same colours — the
 * change is what sits next to what.
 *
 * The page this replaces had six stacked sections and ten boxes of near-equal
 * weight, and three of its problems were structural rather than cosmetic.
 *
 * It asked for the same thing twice. The hero said "Apply for your learner's
 * licence online" and then a panel two hundred pixels below said "Learner's
 * Licence — your first licence, apply online". Both carried a button. So the
 * first screen offered three competing calls to action ("Check if I qualify",
 * "Track an application", "Start the application") for a service with exactly
 * one thing to do. That panel is gone: its four facts are now the hero's own
 * floor, which answers what it costs and how long it takes before anybody has
 * scrolled, and its button is the hero's single primary.
 *
 * It asserted, then separately offered proof. Three promise cards, and three
 * screens-that-check-the-promises in a different section under a different
 * heading. A reader had to hold one to reach the other. Each promise now sits
 * in a row with the button that checks it, which is one section instead of two
 * and four rows instead of six cards.
 *
 * And it used none of the stylesheet built for it. `.hero .floor` — bordered
 * inline stat cells with their own responsive collapse — and `.strip` were
 * already there, unused, while the page reached for another grid of cards. So
 * this file adds no CSS. Every class here already existed.
 */

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
    'Each answer explained, six correct to pass. Pass, and the licence is issued at once.',
    'हर जवाब समझाया गया है, पास होने के लिए छह सही। पास होने पर लाइसेंस तुरंत जारी होता है।',
    'प्रत्येक उत्तर समजावलेले आहे, उत्तीर्ण होण्यासाठी सहा बरोबर. उत्तीर्ण झाल्यास लायसन्स लगेच दिले जाते.'],
];

/**
 * The hero floor. Three figures, and they are the three questions somebody asks
 * before they will begin: what does it cost, how long does it take, and do I
 * have to go anywhere. They were previously four ticks in a list inside a panel
 * below the fold.
 */
const FLOOR: [figure: string, figureHi: string, label: string, labelHi: string, labelMr: string][] = [
  ['₹150 + ₹50', '₹150 + ₹50', 'per class, plus one test fee', 'प्रति श्रेणी, और एक बार टेस्ट शुल्क', 'प्रति वर्ग, आणि एकदा टेस्ट शुल्क'],
  ['8 stages', '8 चरण', 'about 14 minutes end to end', 'शुरू से आख़िर तक लगभग 14 मिनट', 'सुरुवातीपासून शेवटपर्यंत सुमारे 14 मिनिटे'],
  ['No RTO visit', 'आरटीओ जाना नहीं', 'if you authenticate with Aadhaar', 'अगर आप आधार से प्रमाणीकरण करते हैं', 'तुम्ही आधारने प्रमाणीकरण केल्यास'],
];

/**
 * A promise and the screen that checks it, on one row. The pairing is the point,
 * so the button is not decoration — each one opens the screen that would expose
 * the claim beside it if it were false.
 *
 * The third row is why "Track an application" is no longer a second button in
 * the hero competing with the first. It belongs here: the claim is that a
 * half-finished application survives, and the tracker is where you find out.
 */
const PROMISES: [icon: ReturnType<typeof Icon.doc>, heading: string, headingHi: string, headingMr: string, body: string, bodyHi: string, bodyMr: string, cta: string, ctaHi: string, ctaMr: string, route: Route][] = [
  [Icon.doc({ width: 14, height: 14 }), 'The price is on the first screen', 'कीमत पहली स्क्रीन पर ही है', 'किंमत पहिल्याच स्क्रीनवर आहे',
    'Every charge for your class is listed before you begin, and the receipt names each one. Nothing is collected at a counter later — and no double charge, because the same application submitted twice is fired at the live service on the next screen.',
    'शुरू करने से पहले आपकी श्रेणी का हर शुल्क सूचीबद्ध है, और रसीद में हर एक का नाम है। बाद में काउंटर पर कुछ भी नहीं लिया जाता — और दोहरा शुल्क नहीं, क्योंकि एक ही आवेदन दो बार जमा करके अगली स्क्रीन पर लाइव सेवा पर चलाया जाता है।',
    'सुरुवात करण्याआधी तुमच्या वर्गाचे प्रत्येक शुल्क नोंदवलेले असते, आणि पावतीवर प्रत्येकाचे नाव असते. नंतर काउंटरवर काहीही घेतले जात नाही — आणि दुहेरी शुल्क नाही, कारण तोच अर्ज दोनदा सादर करून पुढच्या स्क्रीनवर लाइव्ह सेवेवर चालवला जातो.',
    'Run the proofs', 'प्रूफ चलाएं', 'प्रूफ चालवा', 'proof'],
  [Icon.pin({ width: 14, height: 14 }), 'A slot means a slot', 'स्लॉट का मतलब स्लॉट ही है', 'स्लॉट म्हणजे स्लॉटच',
    'Each RTO publishes what is genuinely left and the average wait once you arrive. On the day, the queue is called in appointment order — so turning up at dawn earns nothing. Open the counter’s side of that queue, call the next token, and the wait on the applicant’s phone recalculates while you watch.',
    'हर आरटीओ बताता है कि सच में कितनी जगह बची है और पहुंचने पर औसत इंतज़ार कितना है। दिन में, कतार अपॉइंटमेंट के क्रम में बुलाई जाती है — इसलिए भोर में पहुंचने से कुछ फ़ायदा नहीं। उसी कतार का काउंटर वाला हिस्सा खोलिए, अगला टोकन बुलाइए, और आवेदक के फ़ोन का इंतज़ार आपकी आंखों के सामने बदल जाएगा।',
    'प्रत्येक आरटीओ खरोखर किती जागा उरली आहे आणि पोहोचल्यावर सरासरी किती वाट पाहावी लागेल हे सांगतो. त्या दिवशी, रांग अपॉइंटमेंटच्या क्रमाने बोलावली जाते — त्यामुळे पहाटे पोहोचण्याचा काही फायदा नाही. त्याच रांगेची काउंटरकडची बाजू उघडा, पुढचे टोकन बोलवा, आणि अर्जदाराच्या फोनवरची वाट तुमच्या डोळ्यांसमोर बदलेल.',
    'Open the inspector desk', 'निरीक्षक डेस्क खोलें', 'निरीक्षक डेस्क उघडा', 'desk'],
  [Icon.clock({ width: 14, height: 14 }), 'You can stop halfway', 'आप बीच में रुक सकते हैं', 'तुम्ही मध्येच थांबू शकता',
    'The application saves as you go and survives closing the tab, so a dropped connection costs you one step and not the whole form. Once it is submitted, the number and your date of birth open it from anywhere.',
    'आवेदन अपने-आप सहेजा जाता रहता है और टैब बंद करने पर भी बना रहता है, इसलिए कनेक्शन टूटने पर सिर्फ़ एक चरण गंवाना पड़ता है, पूरा फ़ॉर्म नहीं। जमा होने के बाद, नंबर और जन्मतिथि से इसे कहीं से भी खोला जा सकता है।',
    'अर्ज आपोआप जतन होत राहतो आणि टॅब बंद केल्यावरही टिकतो, त्यामुळे कनेक्शन तुटल्यास फक्त एक टप्पा गमवावा लागतो, संपूर्ण फॉर्म नाही. सादर झाल्यानंतर, क्रमांक आणि जन्मतारखेने तो कुठूनही उघडता येतो.',
    'Track an application', 'आवेदन ट्रैक करें', 'अर्ज ट्रॅक करा', 'status'],
  [Icon.check({ width: 14, height: 14 }), 'Where people actually fail', 'लोग असल में कहाँ अटकते हैं', 'लोक खरोखर कुठे अडतात',
    'The only screen here with no name on it anywhere. Which road rule the most people get wrong, and which form field loses them — both worth knowing, neither needing to know who any of them were.',
    'यही इकलौता पन्ना है जिस पर कहीं कोई नाम नहीं। कौन-सा नियम सबसे ज़्यादा लोग गलत करते हैं, और कौन-सी फ़ील्ड उन्हें खो देती है — दोनों जानने लायक हैं, और दोनों के लिए यह जानना ज़रूरी नहीं कि वे कौन थे।',
    'हेच एकमेव पान आहे ज्यावर कुठेही नाव नाही. कोणता नियम सर्वाधिक लोक चुकतात, आणि कोणते फील्ड त्यांना गमावते — दोन्ही जाणून घेण्यासारखे, आणि दोन्हीसाठी ते कोण होते हे कळण्याची गरज नाही.',
    'See what it learns', 'देखें यह क्या सीखती है', 'ती काय शिकते ते पहा', 'learning'],
];

export function Home2({ go, update }: PageProps) {
  const t = useT();
  const { lang } = useLanguage();

  return (
    <div className="fade">
      <section className="hero">
        <div className="wrap">
          <div className="in">
            <div className="col g20">
              <span className="kicker">{Icon.dot()} {t("Learner's licence · prototype", 'लर्नर लाइसेंस · प्रोटोटाइप', 'लर्नर लायसन्स · प्रोटोटाइप')}</span>
              <h1>{lang === 'hi'
                ? <>अपने लर्नर लाइसेंस के लिए <span className="uline">ऑनलाइन आवेदन करें।</span></>
                : lang === 'mr'
                  ? <>तुमच्या लर्नर लायसन्ससाठी <span className="uline">ऑनलाइन अर्ज करा.</span></>
                  : <>Apply for your<br />learner's licence<br /><span className="uline">online.</span></>}</h1>
              <p className="lede" style={{ maxWidth: 'min(620px, 100%)' }}>
                {t('Check your eligibility, complete the application, pay the exact fee, book your RTO test slot and track the status — all in one place.',
                  'अपनी पात्रता जाँचिए, आवेदन पूरा कीजिए, सही शुल्क दीजिए, आरटीओ टेस्ट का स्लॉट बुक कीजिए और स्थिति देखिए — सब एक ही जगह।',
                  'तुमची पात्रता तपासा, अर्ज पूर्ण करा, नेमके शुल्क भरा, आरटीओ टेस्टचा स्लॉट बुक करा आणि स्थिती पाहा — सर्व एकाच ठिकाणी.')}
              </p>
              {/* One primary, and the eligibility check demoted to the quiet
                  button beside it. Three CTAs of equal weight on the first
                  screen of a service with one thing to do was the page asking
                  the reader to make a decision it should have made for them. */}
              <div className="row g12 wrapf" style={{ marginTop: 4 }}>
                <button className="btn btn-p btn-lg" onClick={() => { update({ module: 'll' }); go('apply'); }}>
                  {t('Start the application', 'आवेदन शुरू करें', 'अर्ज सुरू करा')} {Icon.right()}
                </button>
                <button className="btn btn-g" onClick={() => go('elig')}>{t('Check if I qualify first', 'पहले जांचें कि मैं पात्र हूं', 'आधी मी पात्र आहे का ते तपासा')}</button>
              </div>
            </div>
            <div className="hero-art hide-m">
              <LicenceCard documentTitle="Learner's Licence" stateName="Maharashtra" licenceNo="MH02 ••••••/••••"
                name="•••••• •• •••••" relation="•••••• •••••" dob="••/••/••••" blood="••"
                addressLine1="•••••••••••••••••••••••••" addressLine2="•••••••••••••••••"
                classCodes="LMV-NT, MCWG" issueDate="20/08/2026" validTill="19/02/2027" rtoCode="MH-02" />
            </div>
          </div>
          {/* The panel that used to sit below the fold, as three figures inside
              the band it was describing. */}
          <div className="floor">
            {FLOOR.map(([figure, figureHi, label, labelHi, labelMr]) => (
              <div key={label}>
                <b>{t(figure, figureHi, figureHi)}</b>
                <span>{t(label, labelHi, labelMr)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap" style={{ marginTop: 48 }}>
        <div className="col g16">
          <h2>{t('The whole journey, in four moves', 'पूरी यात्रा, चार चरणों में', 'संपूर्ण प्रवास, चार टप्प्यांत')}</h2>
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

      {/* Four promises, each in a row with the screen that would catch it out.
          This is two sections and six cards in the page it replaces. */}
      <section className="wrap" style={{ marginTop: 64 }}>
        <div className="col g16">
          <div className="col g8">
            <span className="eyebrow">{t('Do not take our word', 'हमारी बात न मानें', 'आमचा शब्द मानू नका')}</span>
            <h2>{t('Four promises, and the screen that checks each', 'चार वादे, और हर एक जांचने वाली स्क्रीन', 'चार आश्वासने, आणि प्रत्येक तपासणारी स्क्रीन')}</h2>
          </div>
          <div className="card">
            {PROMISES.map(([icon, heading, headingHi, headingMr, body, bodyHi, bodyMr, cta, ctaHi, ctaMr, route], i) => (
              <div key={heading} className="promise-row" style={{ borderTop: i === 0 ? undefined : '1px solid var(--line)' }}>
                <div className="col g8">
                  <span className="claim-ic" style={{ marginBottom: 0 }}>{icon}</span>
                  <h3 style={{ margin: 0 }}>{t(heading, headingHi, headingMr)}</h3>
                  <p className="sub" style={{ lineHeight: 1.6, margin: 0 }}>{t(body, bodyHi, bodyMr)}</p>
                </div>
                <button className="btn btn-s" onClick={() => go(route)}>
                  {t(cta, ctaHi, ctaMr)} {Icon.right()}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap" style={{ marginTop: 64, marginBottom: 8 }}>
        <div className="card col" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)', alignItems: 'stretch' }} className="learnband">
            <div className="col g16" style={{ padding: '32px 30px', justifyContent: 'center' }}>
              <span className="eyebrow">{t('Practice module', 'अभ्यास मॉड्यूल', 'सराव मॉड्यूल')}</span>
              <h2>{t('Nobody tells you what is in the theory test. So play it instead.', 'थ्योरी टेस्ट में क्या है, यह कोई नहीं बताता। तो इसे खेलकर जानें।', 'थिअरी टेस्टमध्ये काय आहे, हे कोणी सांगत नाही. मग ते खेळूनच जाणून घ्या.')}</h2>
              <p style={{ color: 'var(--ink2)', lineHeight: 1.6 }}>
                {t(`${spelledOut(SCENARIOS.length).replace(/^./, c => c.toUpperCase())} road situations to practise on, ${DECISION_LIMIT_MS / 1000} seconds each — not the test itself. You are scored on the decision and on how long it took, which is what the real test measures. The report card names the two habits to fix.`,
                  `${SCENARIOS.length} सड़क स्थितियों पर अभ्यास करें, हर एक ${DECISION_LIMIT_MS / 1000} सेकंड में — यह असली टेस्ट नहीं है। आपका मूल्यांकन फैसले पर और उसमें लगे समय पर होता है, जो असली टेस्ट भी मापता है। रिपोर्ट कार्ड सुधारने योग्य दो आदतें बताता है।`,
                  `${SCENARIOS.length} रस्ता परिस्थितींवर सराव करा, प्रत्येक ${DECISION_LIMIT_MS / 1000} सेकंदांत — ही खरी टेस्ट नाही. तुमचे मूल्यमापन निर्णयावर आणि त्यासाठी लागलेल्या वेळेवर होते, जे खरी टेस्टही मोजते. रिपोर्ट कार्ड सुधारण्यासारख्या दोन सवयी सांगते.`)}
              </p>
              <div className="row g10 wrapf">
                <button className="btn btn-p" onClick={() => go('learn')}>{Icon.play()} {t('Play the road', 'सड़क खेलें', 'रस्ता खेळा')}</button>
                <span className="tiny" style={{ alignSelf: 'center' }}>{t('No download · works offline', 'डाउनलोड की ज़रूरत नहीं · ऑफ़लाइन भी काम करता है', 'डाउनलोड करण्याची गरज नाही · ऑफलाइनही काम करते')}</span>
              </div>
            </div>
            <div style={{ minHeight: 230 }}><PixelScene map={SCENARIOS[4].map} art={SCENARIOS[4].art} /></div>
          </div>
        </div>
      </section>
    </div>
  );
}
