import { useState, type ReactNode } from 'react';
import { useLanguage, useT } from '../lib/language';
import { PixelScene } from '../practice/PixelScene';
import { SCENARIOS, spelledOut } from '../practice/scenarios';
import type { PageProps, Route } from '../types';
import { Icon } from '../ui/Icon';
import { LicenceCard } from '../ui/LicenceCard';
import { Pill } from '../ui/SharedUI';

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

const JOURNEY_STEPS: [heading: string, headingHi: string, headingMr: string, body: string][] = [
  ['Check', 'जांचें', 'तपासा', 'Three questions tell you if you qualify, before any fee is paid.'],
  ['Apply', 'आवेदन करें', 'अर्ज करा', 'Details arrive from documents you already hold. Photos are checked as you take them.'],
  ['Book', 'बुक करें', 'बुक करा', 'Pick an office by distance and remaining capacity, not by luck.'],
  ['Test', 'परीक्षा', 'परीक्षा', 'Ten questions, each answer explained. Pass and the licence is issued at once.'],
];

const DIFFERENTIATORS: [heading: string, headingHi: string, headingMr: string, body: string][] = [
  ['The price is on the first screen', 'कीमत पहली स्क्रीन पर ही है', 'किंमत पहिल्याच स्क्रीनवर आहे', 'Every charge for your class is listed before you begin, and the receipt names each one. Nothing is collected at a counter later.'],
  // Both of these used to claim something the build did not do. The first
  // promised a cross-device resume off a mobile number, with nothing behind it
  // at all — the application lived in memory and a refresh threw it away. The
  // browser keeps it now, so the claim is scoped to what is actually true.
  ['You can stop halfway', 'आप बीच में रुक सकते हैं', 'तुम्ही मध्येच थांबू शकता', 'The application saves as you go and survives closing the tab, so a dropped connection costs you one step and not the whole form. Once it is submitted, the number and your date of birth open it from anywhere.'],
  // The second said a booking is "an appointment rather than a token", which
  // reads as a dig at the queue token this build issues and spends a whole
  // screen making meaningful. The two are not rivals: the appointment is the
  // time you were given, the token is your place on the day — and it is now
  // ordered by appointment, which is the thing worth claiming.
  ['A slot means a slot', 'स्लॉट का मतलब स्लॉट ही है', 'स्लॉट म्हणजे स्लॉटच', 'Each RTO publishes what is genuinely left and the average wait once you arrive. On the day, the queue is called in appointment order — so turning up at dawn earns nothing, and the time you booked is the time you are seen.'],
];

export function Home({ go, update }: PageProps) {
  const [applicationLookup, setApplicationLookup] = useState('');
  const t = useT();
  const { lang } = useLanguage();

  const services: ServiceCard[] = [
    { id: 'll', icon: Icon.card({ width: 22, height: 22 }), tag: t('Start here', 'यहां से शुरू करें', 'येथून सुरू करा'), title: t("Learner's Licence", 'लर्नर लाइसेंस', 'लर्नर लायसन्स'),
      desc: t('Your first licence. Apply online, then visit the RTO once for the test.',
              'आपका पहला लाइसेंस। ऑनलाइन आवेदन कीजिए, फिर टेस्ट के लिए एक बार आरटीओ जाइए।',
              'तुमचे पहिले लायसन्स. ऑनलाइन अर्ज करा, नंतर टेस्टसाठी एकदा आरटीओला जा.'),
      meta: [
        t('Eight stages, about 14 minutes', 'आठ चरण, लगभग 14 मिनट', 'आठ टप्पे, सुमारे 14 मिनिटे'),
        t('₹150 per class plus one ₹50 test fee', 'प्रति श्रेणी ₹150 और एक बार ₹50 टेस्ट शुल्क', 'प्रति वर्ग ₹150 आणि एकदा ₹50 टेस्ट शुल्क'),
        t('With Aadhaar: no RTO visit at all', 'आधार के साथ: आरटीओ जाने की ज़रूरत नहीं', 'आधारसह: आरटीओला जाण्याची गरज नाही'),
        t('10 questions, 6 to pass', '10 प्रश्न, पास होने के लिए 6', '10 प्रश्न, उत्तीर्ण होण्यासाठी 6'),
      ],
      // Straight into the wizard. The eligibility check is a separate question
      // with its own button in the hero — routing "Start" through it made
      // someone who already knows they qualify answer three questions before
      // they were allowed to begin. Stage one's Back still goes to the
      // checklist, so what you need to have ready stays one press away.
      cta: t("Start learner's licence", 'लर्नर लाइसेंस शुरू करें', 'लर्नर लायसन्स सुरू करा'), targetRoute: 'apply' },
    // DL journey parked — the wizard exists but has no service behind it, and a
    // card here is an invitation to find that out. See the note in types.ts.
    // { id: 'dl', icon: Icon.wheel({ width: 22, height: 22 }), tag: t('You already have an LL', 'आपके पास पहले से LL है', 'तुमच्याकडे आधीच LL आहे'), title: t('Driving Licence', 'ड्राइविंग लाइसेंस', 'ड्रायव्हिंग लायसन्स'),
    //   desc: 'Convert a valid learner\'s licence into a permanent driving licence.',
    //   meta: ['Starts from your LL number', '₹500 — ₹200 grant + ₹300 test', 'LL must be 30 to 180 days old', 'You bring the vehicle to the test'],
    //   cta: t('Start driving licence', 'ड्राइविंग लाइसेंस शुरू करें', 'ड्रायव्हिंग लायसन्स सुरू करा'), targetRoute: 'dl' },
  ];

  return (
    <div className="fade">
      <section className="hero">
        <div className="wrap in">
          <div className="col g20">
            {/* Learner's only, here and in the kicker. The DL journey is parked
                — see the commented service card above — so naming it in the
                first thing anyone reads sends people looking for a door that is
                not there. */}
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
            {/* One figure, the one the journey actually measures. "0 visits" and
                "₹350" quoted an Aadhaar route and a fee total that nothing on
                the way through commits to. */}
            <div className="hero-stats">
              <span><b>14 min</b><span>to apply, start to end</span></span>
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
      </section>
      {/* Two-column only while there are two services. With the DL card parked
          the lone card sat in the left half of a 1fr 1fr grid and the right half
          read as a panel that had failed to load. */}
      <section className="wrap" style={{ marginTop: -34, position: 'relative', zIndex: 5 }}>
        <div className={services.length > 1 ? 'grid2' : ''} style={services.length > 1 ? { gap: 20 } : undefined}>
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
              {/* A lone card spans the row, so the four points sit side by side
                  rather than as a short stack with half the section empty. */}
              <ul className={services.length > 1 ? 'col g10' : ''} style={services.length > 1
                ? { margin: 0, padding: 0, listStyle: 'none', fontSize: '.92rem' }
                : { margin: 0, padding: 0, listStyle: 'none', fontSize: '.92rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14 }}>
                {service.meta.map(line => (
                  <li key={line} className="row g10" style={{ alignItems: 'flex-start' }}><span style={{ color: i === 0 ? 'var(--accent)' : 'var(--brand)', marginTop: 5, flex: 'none' }}>{Icon.check()}</span><span style={{ color: i === 0 ? 'oklch(0.88 0.015 196)' : 'var(--ink2)' }}>{line}</span></li>
                ))}
              </ul>
              <div className="grow" />
              {/* Capped when the card is full-width: btn-full across the whole
                  row is a button the length of the page. */}
              <button className={i === 0 ? 'btn btn-a btn-full' : 'btn btn-p btn-full'}
                style={services.length > 1 ? undefined : { maxWidth: 360 }}
                onClick={() => { update({ module: service.id }); go(service.targetRoute); }}>{service.cta} {Icon.right()}</button>
            </div>
          ))}
        </div>
      </section>
      <section className="wrap" style={{ marginTop: 44 }}>
        <div className="col g16">
          <div className="row between g16 wrapf"><h2>{t('The whole journey, in four moves', 'पूरी यात्रा, चार चरणों में', 'संपूर्ण प्रवास, चार टप्प्यांत')}</h2><span className="sub">Learner's licence · about 14 minutes plus one RTO visit</span></div>
          <div className="strip">
            {JOURNEY_STEPS.map(([heading, headingHi, headingMr, body], n) => (
              <div key={heading}><span className="strip-n">{n + 1}</span><div className="col g6"><h3>{t(heading, headingHi, headingMr)}</h3><p className="sub" style={{ lineHeight: 1.55 }}>{body}</p></div></div>
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
              <p style={{ color: 'var(--ink2)', lineHeight: 1.6 }}>{spelledOut(SCENARIOS.length).replace(/^./, c => c.toUpperCase())} road situations to practise on, four seconds each — not the test itself. You are scored on the decision and on how long it took, which is what the real test measures. The report card names the two habits to fix.</p>
              <div className="row g10 wrapf">
                <button className="btn btn-p" onClick={() => go('learn')}>{Icon.play()} {t('Play the road', 'सड़क खेलें', 'रस्ता खेळा')}</button>
                <span className="tiny" style={{ alignSelf: 'center' }}>No download · works offline</span>
              </div>
            </div>
            <div style={{ minHeight: 230 }}><PixelScene map={SCENARIOS[4].map} art={SCENARIOS[4].art} /></div>
          </div>
        </div>
      </section>
      <section className="wrap" style={{ marginTop: 20 }}>
        <div className="card card-p row between g16 wrapf">
          <div className="col g4"><h3>{t('Already applied?', 'पहले से आवेदन किया है?', 'आधीच अर्ज केला आहे का?')}</h3><span className="sub">Enter your application number to see where it is stuck and what to do about it.</span></div>
          <div className="row g10 wrapf">
            <input className="input mono" style={{ width: 210 }} placeholder="SS-2026-004182" value={applicationLookup} onChange={e => setApplicationLookup(e.target.value)} />
            <button className="btn btn-s" onClick={() => go('status')}>{Icon.search()} {t('Find', 'खोजें', 'शोधा')}</button>
          </div>
        </div>
      </section>
      <section className="wrap" style={{ marginTop: 44 }}>
        <div className="panel" style={{ padding: '36px 32px' }}>
          <span className="eyebrow" style={{ color: 'oklch(0.85 0.025 196)' }}>{t('What is different here', 'यहां क्या अलग है', 'इथे काय वेगळे आहे')}</span>
          <div className="grid3" style={{ marginTop: 22, gap: 32 }}>
            {DIFFERENTIATORS.map(([heading, headingHi, headingMr, body]) => (
              <div key={heading} className="col g8"><h3 style={{ color: '#fff' }}>{t(heading, headingHi, headingMr)}</h3><p className="sub" style={{ lineHeight: 1.6 }}>{body}</p></div>
            ))}
          </div>
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
            <h2>{t('Or check the claims yourself', 'या फिर दावों को खुद जांचें', 'किंवा दावे स्वतः तपासा')}</h2>
            <span className="sub">{t('Two screens, both reading the live service', 'दो स्क्रीन, दोनों लाइव सेवा से पढ़ रही हैं', 'दोन स्क्रीन, दोन्ही लाइव्ह सेवेतून वाचत आहेत')}</span>
          </div>
          <div className="grid2" style={{ gap: 20 }}>
            <div className="card card-p col g12">
              <span className="eyebrow">{t('Staff view', 'कर्मचारी दृश्य', 'कर्मचारी दृश्य')}</span>
              <h3>{t('Inspector desk', 'निरीक्षक डेस्क', 'निरीक्षक डेस्क')}</h3>
              <p className="sub" style={{ lineHeight: 1.6 }}>{t('The counter’s side of the same queue. Open it beside the tracker, call the next token, and the wait on the applicant’s phone recalculates while you watch. Nothing is simulated — both screens read one queue.', 'उसी कतार का काउंटर वाला हिस्सा। इसे ट्रैकर के साथ खोलिए, अगला टोकन बुलाइए, और आवेदक के फ़ोन का इंतज़ार आपकी आंखों के सामने बदल जाएगा। कुछ भी नकली नहीं — दोनों स्क्रीन एक ही कतार पढ़ती हैं।', 'त्याच रांगेची काउंटरकडची बाजू. ट्रॅकरशेजारी उघडा, पुढचे टोकन बोलवा, आणि अर्जदाराच्या फोनवरची वाट तुमच्या डोळ्यांसमोर बदलेल. काहीही बनावट नाही — दोन्ही स्क्रीन एकच रांग वाचतात.')}</p>
              <div className="grow" />
              <div><button className="btn btn-s" onClick={() => go('desk')}>{t('Open the inspector desk', 'निरीक्षक डेस्क खोलें', 'निरीक्षक डेस्क उघडा')} {Icon.right()}</button></div>
            </div>
            <div className="card card-p col g12">
              <span className="eyebrow">{t('Runnable', 'चलाकर देखें', 'चालवून पहा')}</span>
              <h3>{t('See the guarantees run', 'गारंटी चलती देखें', 'हमी चालताना पहा')}</h3>
              <p className="sub" style={{ lineHeight: 1.6 }}>{t('No double booking, no double charge, no silent edit. Each one is fired at the live service from this page — two people race for one slot, the same application is submitted twice, a record is tampered with — and you are shown what came back.', 'न दोहरी बुकिंग, न दोहरा शुल्क, न चुपचाप बदलाव। हर एक इसी पेज से लाइव सेवा पर चलाया जाता है — दो लोग एक ही स्लॉट के लिए दौड़ते हैं, एक ही आवेदन दो बार जमा होता है, एक रिकॉर्ड से छेड़छाड़ की जाती है — और जो जवाब आया वह आपको दिखाया जाता है।', 'दुहेरी बुकिंग नाही, दुहेरी शुल्क नाही, गुपचूप बदल नाही. प्रत्येक याच पानावरून लाइव्ह सेवेवर चालवली जाते — दोन माणसे एकाच स्लॉटसाठी धावतात, एकच अर्ज दोनदा सादर होतो, एका नोंदीत फेरफार केला जातो — आणि काय उत्तर आले ते तुम्हाला दाखवले जाते.')}</p>
              <div className="grow" />
              <div><button className="btn btn-s" onClick={() => go('proof')}>{t('Run the proofs', 'प्रूफ चलाएं', 'प्रूफ चालवा')} {Icon.right()}</button></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
