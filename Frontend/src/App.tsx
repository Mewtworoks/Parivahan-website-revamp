import { useEffect, useState, type ComponentType, type MouseEvent } from 'react';
import { Desk } from './pages/Desk';
import { Future } from './pages/Future';
import { Learning } from './pages/Learning';
import { DrivingLicence } from './pages/DrivingLicence';
import { Eligibility } from './pages/Eligibility';
import { Proof } from './pages/Proof';
import { Checklist } from './pages/Checklist';
import { Home } from './pages/Home';
import { Home2 } from './pages/Home2';
import { Issued } from './pages/Issued';
import { Pay } from './pages/Pay';
import { Receipt } from './pages/Receipt';
import { Slip } from './pages/Slip';
// Parked with the `slot` route below.
// import { Slot } from './pages/Slot';
import { Status } from './pages/Status';
import { Test } from './pages/Test';
import { Tutorial } from './pages/Tutorial';
import { Apply } from './pages/apply/Apply';
import { Game } from './practice/Game';
import { GameIntro } from './practice/GameIntro';
import { Learn } from './practice/Learn';
import { Report } from './practice/Report';
import { FOOTER_COLUMNS, type FooterTarget } from './data/siteContent';
import { prettyPhone, useIdentity } from './lib/identity';
import { loadJourney, saveJourney } from './lib/journeyStore';
import { useLanguage, useT, type Lang } from './lib/language';
import { scrollToTop } from './lib/scrollToTop';
import type { AppState, PageProps, Route } from './types';
import { BackToTop } from './ui/BackToTop';
import { GrievanceSheet } from './ui/GrievanceSheet';
import { AlreadyApplied, useExistingApplication } from './ui/AlreadyApplied';
import { Icon } from './ui/Icon';
import { Mark } from './ui/Mark';
import { InfoSheet } from './ui/InfoSheet';
import { Note, Sheet } from './ui/SharedUI';
import { IdentitySheet } from './ui/SignIn';
import { ToastHost } from './ui/Toast';
import { VoiceAgent } from './components/VoiceAgent';

// Translations for the footer's data-driven labels (FOOTER_COLUMNS lives in data/siteContent.ts as
// plain English strings) — kept as a lookup here rather than restructuring that data shape.
const FOOTER_TRANSLATIONS: Record<string, { hi: string; mr: string }> = {
  "Learner's licence": { hi: 'लर्नर लाइसेंस', mr: 'लर्नर लायसन्स' },
  'Driving licence': { hi: 'ड्राइविंग लाइसेंस', mr: 'ड्रायव्हिंग लायसन्स' },
  'Driving licence · reference': { hi: 'ड्राइविंग लाइसेंस · संदर्भ', mr: 'ड्रायव्हिंग लायसन्स · संदर्भ' },
  'About this build': { hi: 'इस निर्माण के बारे में', mr: 'या निर्मितीबद्दल' },
  'Check eligibility': { hi: 'पात्रता जांचें', mr: 'पात्रता तपासा' },
  Apply: { hi: 'आवेदन करें', mr: 'अर्ज करा' },
  'Practice test': { hi: 'अभ्यास परीक्षण', mr: 'सराव चाचणी' },
  'Book a slot': { hi: 'स्लॉट बुक करें', mr: 'स्लॉट बुक करा' },
  'Road safety tutorial': { hi: 'सड़क सुरक्षा ट्यूटोरियल', mr: 'रस्ता सुरक्षा ट्युटोरियल' },
  'Eligibility window': { hi: 'पात्रता अवधि', mr: 'पात्रता कालावधी' },
  'Driving test tracks': { hi: 'ड्राइविंग टेस्ट ट्रैक', mr: 'ड्रायव्हिंग टेस्ट ट्रॅक' },
  Fees: { hi: 'शुल्क', mr: 'फी' },
  'How a document is verified': { hi: 'दस्तावेज़ सत्यापन कैसे होता है', mr: 'कागदपत्र पडताळणी कशी होते' },
  'What each fee pays for': { hi: 'हर शुल्क किसलिए है', mr: 'प्रत्येक फी कशासाठी आहे' },
  'Report a problem': { hi: 'समस्या दर्ज करें', mr: 'समस्या नोंदवा' },
  'Call 1800 000 000': { hi: '1800 000 000 पर कॉल करें', mr: '1800 000 000 वर कॉल करा' },
  'Problem and approach': { hi: 'समस्या और दृष्टिकोण', mr: 'समस्या आणि दृष्टिकोन' },
  'What is mocked': { hi: 'क्या नकली है', mr: 'काय बनावट आहे' },
  'Inspector desk': { hi: 'निरीक्षक डेस्क', mr: 'निरीक्षक डेस्क' },
  'See the guarantees run': { hi: 'गारंटी चलती देखें', mr: 'हमी चालताना पहा' },
  'Where people actually fail': { hi: 'लोग असल में कहाँ अटकते हैं', mr: 'लोक खरोखर कुठे अडतात' },
  'Government brain': { hi: 'सरकारी दिमाग', mr: 'सरकारी मेंदू' },
  'Common questions': { hi: 'सामान्य प्रश्न', mr: 'सामान्य प्रश्न' },
  Accessibility: { hi: 'सुगम्यता', mr: 'सुलभता' },
  Source: { hi: 'स्रोत', mr: 'स्रोत' },
};
function footerT(t: ReturnType<typeof useT>, label: string): string {
  return t(label, FOOTER_TRANSLATIONS[label]?.hi, FOOTER_TRANSLATIONS[label]?.mr);
}

const PAGES: Record<Route, ComponentType<PageProps>> = {
  home: Home, elig: Eligibility, checklist: Checklist, apply: Apply, slip: Slip, pay: Pay,
  receipt: Receipt, tutorial: Tutorial, learn: GameIntro, lesson: Learn, game: Game, report: Report,
  test: Test, issued: Issued, status: Status, dl: DrivingLicence,
  desk: Desk, proof: Proof, learning: Learning, future: Future,
  home2: Home2,
  // The learner's test is taken online, so there is no learner's appointment to
  // book. The screen that booked one now lives at `dl`, where the appointment
  // actually belongs. Parked rather than deleted:
  // slot: Slot,
};

const FULL_SCREEN_FLOW_ROUTES: Route[] = ['apply', 'slip', 'pay', 'receipt', 'dl', 'tutorial', 'test', 'game'];

/**
 * Routes that render without the service's top bar and footer.
 *
 * One so far, and it earns it by not being the service. `future` is the pitch
 * for the idea rather than a screen of the thing — full-bleed, its own palette,
 * one sculpture behind the text. The site chrome does not merely look wrong
 * around it: a light bar with a backdrop blur sitting over a dark full-bleed
 * page is the join showing, and the footer's near-black mass lands directly
 * under the page's own near-black panel as a second ending.
 *
 * A page in here owes the reader its own way out, since the wordmark goes with
 * the bar. `Future` carries three: one in its bar, two in its closing row.
 */
const CHROMELESS_ROUTES: Route[] = ['future'];

/**
 * The screens that need to know whose journey this is.
 *
 * Only the form. Everything before it — checking whether you qualify, playing
 * the practice road — is worth doing before you have decided to apply at all,
 * and demanding a number first would turn a two-minute look into a sign-up.
 * The stages after it are self-gating: they need an application, and there is
 * no way to have one without passing through here.
 *
 * The driving-test screen is the second, and for the opposite reason: it does
 * not ask for anything, it looks the citizen's learner's licence up. Without a
 * number there is nothing to look up.
 *
 * Saarthi is the other gated surface, for the same reason and not by route: it
 * fills this form on the citizen's behalf, so it has to know whose.
 */
const SIGN_IN_REQUIRED: Route[] = ['apply', 'dl'];

/**
 * The route named in the address bar, or home.
 *
 * Kept in the hash rather than the path so the built app stays a plain static
 * bundle — no server rewrite rule, so a refresh on `#/status` cannot 404 the
 * way `/status` would on a host that has not been told about it.
 *
 * Validated against PAGES rather than cast, because the hash is user-editable:
 * a typo has to land on home, not on `undefined` being rendered as a component.
 */
function routeFromHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return raw in PAGES ? (raw as Route) : 'home';
}

// Translated in place rather than through a lookup table: this is the sheet a
// Hindi reader opens when they are already stuck, and it was the largest block
// of English left on a page whose every other word had been translated.
const HELP_FAQ: [question: string, answer: string, questionHi: string, answerHi: string][] = [
  ['Can I finish this on a slow connection?', 'Every step is a single small page. Nothing here needs video, and the application saves as soon as you move on, so a dropped connection costs you one step, not the whole form.',
    'क्या मैं इसे धीमे कनेक्शन पर पूरा कर सकता हूँ?', 'हर चरण एक छोटा पन्ना है। यहाँ किसी वीडियो की ज़रूरत नहीं, और आगे बढ़ते ही आवेदन सहेज लिया जाता है — इसलिए कनेक्शन टूटने पर एक चरण जाता है, पूरा फ़ॉर्म नहीं।'],
  ['Do I need an agent?', 'No. The fee on screen is the whole fee. Nobody at the office needs to be paid anything, and there is no step that requires a middleman.',
    'क्या मुझे एजेंट चाहिए?', 'नहीं। स्क्रीन पर दिखी फीस ही पूरी फीस है। कार्यालय में किसी को कुछ नहीं देना है, और कोई भी चरण ऐसा नहीं जिसमें बिचौलिया चाहिए।'],
  ['What if my documents are not in DigiLocker?', 'You can photograph the original instead. The accepted substitutes are listed on the checklist screen before you begin.',
    'अगर मेरे दस्तावेज़ DigiLocker में नहीं हैं?', 'आप मूल दस्तावेज़ की फोटो ले सकते हैं। कौन-से विकल्प मान्य हैं, यह शुरू करने से पहले चेकलिस्ट पन्ने पर लिखा है।'],
  ['Can somebody else fill this for me?', 'Yes. The application is tied to a mobile number, so a family member can complete it on their phone as long as you receive the OTP.',
    'क्या कोई और मेरे लिए यह भर सकता है?', 'हाँ। आवेदन एक मोबाइल नंबर से जुड़ा होता है, इसलिए परिवार का कोई सदस्य अपने फ़ोन पर इसे पूरा कर सकता है, बशर्ते OTP आपको मिले।'],
];

/** The wordmark, two-tone: the generic half in ink, "Sewa" in brand green — and
    run together with no space, the way a logotype reads rather than a phrase. */
function Wordmark({ lang }: { lang: Lang }) {
  const [a, b] = lang === 'en' ? ['Parivahan', 'Sewa'] : ['परिवहन', 'सेवा'];
  return <span className="mark-t"><span className="mark-t-a">{a}</span><span className="mark-t-b">{b}</span></span>;
}

/** The whole site: top bar, the active page, footer, and the help/info overlay sheets. */
export default function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  // Restored from the last visit, so a reload mid-form does not start over —
  // see lib/journeyStore.ts for why this had to exist.
  const [state, setState] = useState<AppState>(loadJourney);
  const [helpOpen, setHelpOpen] = useState(false);
  const [grievanceOpen, setGrievanceOpen] = useState(false);
  const [infoPanelId, setInfoPanelId] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  // Set only by the gate's own escape hatch, and cleared on every route change
  // so it cannot outlive the visit it was pressed in.
  const [startingAnother, setStartingAnother] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Saarthi closed itself to show the sign-in sheet, and wants to come back.
  const [resumeVoice, setResumeVoice] = useState(false);
  const phone = useIdentity();
  const { lang, setLang } = useLanguage();
  const t = useT();

  const update = (patch: Partial<AppState>) => setState(s => ({ ...s, ...patch }));

  const go = (next: Route) => {
    // Each move is a history entry, so Back walks the journey backwards instead
    // of leaving the site entirely — the gesture someone reaches for first when
    // a step looks wrong, and the one this had no answer for.
    if (next !== routeFromHash()) window.history.pushState(null, '', `#/${next}`);
    setRoute(next);
    scrollToTop();
  };

  // Back, Forward, and a hash typed straight into the address bar. pushState
  // fires neither event, so `go` above is not caught here and there is no loop;
  // a real Back fires both, and they set the same value.
  useEffect(() => {
    const sync = () => { setRoute(routeFromHash()); scrollToTop(); };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  // Every change to the journey, not just the ones a step boundary notices —
  // the form's own "Saved a moment ago" pill claims this granularity.
  useEffect(() => { saveJourney(state); }, [state]);

  // Leaving the wizard forgets that somebody chose to start a second
  // application. Kept for the visit and no longer, so a decision made once does
  // not quietly disable the gate for the rest of the session.
  useEffect(() => {
    if (route !== 'apply') setStartingAnother(false);
  }, [route]);

  const ActivePage = PAGES[route] || Home;
  const needsSignIn = !phone && SIGN_IN_REQUIRED.includes(route);

  // One application per citizen, enforced where the wizard is reached rather
  // than inside it. The idempotency key is minted when Apply mounts and the
  // service deduplicates on that key alone, so a second mount is a second
  // application — keeping the component unmounted is what actually fixes it.
  //
  // Looked up only for the wizard, and only until somebody says they mean to
  // start another one.
  const existing = useExistingApplication(phone, route === 'apply' && !startingAnother);
  const alreadyApplied = route === 'apply' && !startingAnother && Boolean(existing);
  const inFullScreenFlow = FULL_SCREEN_FLOW_ROUTES.includes(route);
  const chromeless = CHROMELESS_ROUTES.includes(route);

  const handleFooterLink = (e: MouseEvent, target: FooterTarget) => {
    e.preventDefault();
    if ('go' in target) go(target.go);
    else if ('help' in target) setHelpOpen(true);
    else if ('grievance' in target) setGrievanceOpen(true);
    else if ('info' in target) setInfoPanelId(target.info);
  };

  return (
    <>
      <header className="tb" hidden={chromeless}>
        <div className="wrap tb-in">
          <button className="mark" onClick={() => go('home')} aria-label={t('Parivahan Sewa home', 'परिवहन सेवा होम', 'परिवहन सेवा होम')}>
            <Mark size={34} />
            {/* The strapline that used to sit here was pulled because it wrapped
                to three lines on a phone and clipped the wordmark it sat under.
                This one stays a single short line and hides below that width
                instead of wrapping into it. */}
            <span className="col" style={{ gap: 2, textAlign: 'left' }}>
              <Wordmark lang={lang} />
              <span className="mark-tag hide-m">{t('A Build What Moves India Project', 'भारत को गतिमान रखने वाला एक निर्माण')}</span>
            </span>
          </button>
          <div className="grow" />
          {!inFullScreenFlow && (
            <>
              {/* "Services" used to sit here and did exactly what the wordmark
                  beside it does — go home. Two controls, one destination, and
                  the one people reach for first is the wordmark. Its place goes
                  to the staff view, which had no way in from the top bar at all
                  and is the screen worth finding: open it beside the tracker and
                  the citizen's wait moves as the lane is called.

                  A swap, not an addition. The bar has no room to grow — that is
                  what wrapped the wordmark and pushed the text-size control off
                  the end last time — so this label is kept to the width of the
                  one it replaced. */}
              <button className="tb-btn hide-m" onClick={() => go('desk')}>{t('RTO desk', 'आरटीओ डेस्क', 'आरटीओ डेस्क')}</button>
              <button className="tb-btn hide-m" onClick={() => go('learn')}>{t('Practice', 'अभ्यास', 'सराव')}</button>
              <button className="tb-btn hide-m" onClick={() => go('status')}>{t('Track', 'ट्रैक करें', 'ट्रॅक करा')}</button>
            </>
          )}
          {/* Replaces the old Display popover — text size and theme are gone
              with it, not just collapsed into this. A straight two-way toggle
              for the two languages Saarthi's voice actually speaks, rather
              than a control that opened to offer a third. */}
          <div className="seg hide-m" role="group" aria-label={t('Language', 'भाषा')}>
            <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
            <button aria-pressed={lang === 'hi'} onClick={() => setLang('hi')}>HI</button>
          </div>
          {/* Identity, not a gate — nothing on the site is blocked either way.
              Signed out it offers the number; signed in it becomes the profile,
              which is where signing out lives. */}
          <button className="btn btn-s btn-sm hide-m" onClick={() => setIdentityOpen(true)}
            aria-label={phone ? t(`Profile — signed in as ${prettyPhone(phone)}`, `प्रोफ़ाइल — ${prettyPhone(phone)} से साइन इन`) : undefined}>
            {/* The number used to be the label. It is the least useful thing
                this button could say — the citizen knows their own number, and
                it is still one press away inside, set at 1.5rem above the state
                and the sign-out. What the button needed to say was where it
                goes, which is what the aria-label has been saying all along. */}
            {phone
              ? <span className="row g6">{Icon.user()}{t('Profile', 'प्रोफ़ाइल')}</span>
              : t('Sign in', 'साइन इन')}
          </button>
          {/* Saarthi is the only call to action up here. Help sat beside it
              competing for the same press, and Saarthi answers the questions
              the sheet lists anyway. The sheet is still reached from the
              footer's "Call 1800 000 000". */}
          <button className="btn btn-p btn-sm" onClick={() => setVoiceOpen(true)}>{Icon.speaker()} {t('Talk to Saarthi', 'सारथी से बात करें')}</button>
          {/* Everything the bar drops below 860px. It used to drop them into
              nothing: on a phone the whole top bar was the wordmark and Saarthi,
              so the desk, the tracker, sign-in and — worst of the four — the
              language switch had no route at all. A Hindi reader on a phone
              could not reach Hindi. */}
          <button className="btn btn-s btn-sm only-m" aria-label={t('Menu', 'मेन्यू')}
            aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            {Icon.menu()}
          </button>
        </div>
      </header>
      <main>
        {needsSignIn
          ? (
            <div className="narrow fade" style={{ padding: '64px 24px' }}>
              <div className="card card-p col g16" style={{ maxWidth: 520 }}>
                <div className="col g6">
                  <span className="eyebrow">{t('Before you begin', 'शुरू करने से पहले')}</span>
                  <h2>{t('The form needs a mobile number', 'फ़ॉर्म के लिए मोबाइल नंबर चाहिए')}</h2>
                  <p className="sub">
                    {t('It is what your application is saved under, and what the tracker and Saarthi use to find it again. Checking your eligibility and the practice test need no number at all.',
                      'आपका आवेदन इसी नंबर पर सहेजा जाता है, और ट्रैकर व सारथी इसी से उसे दोबारा ढूँढते हैं। पात्रता जाँच और अभ्यास परीक्षा के लिए कोई नंबर नहीं चाहिए।')}
                  </p>
                </div>
                <div className="row g10 wrapf">
                  <button className="btn btn-p" onClick={() => setIdentityOpen(true)}>
                    {t('Sign in', 'साइन इन')} {Icon.right()}
                  </button>
                  <button className="btn btn-s" onClick={() => go('elig')}>
                    {t('Check if I qualify instead', 'इसके बजाय पात्रता जाँचें')}
                  </button>
                </div>
              </div>
            </div>
          )
          : alreadyApplied && existing
            ? (
              <AlreadyApplied
                application={existing}
                state={state}
                go={go}
                onStartAnother={() => {
                  // `update` is a shallow merge and cannot delete a key, but an
                  // explicit undefined does overwrite — and JSON.stringify drops
                  // it on the way to localStorage, so the journey really is
                  // cleared rather than left holding a stale id.
                  update({
                    applicationId: undefined, app: undefined, stage: undefined,
                    slot: undefined, tokenId: undefined, attemptId: undefined,
                    formStep: 0,
                  });
                  setStartingAnother(true);
                }}
              />
            )
            : <ActivePage go={go} state={state} update={update} />}
      </main>
      {/* The footer closes the page with mass: near-black under a paper body, so
          the page gets lighter towards the top where the reader starts. It was
          briefly a green field mirroring a green hero, which sounded like
          bookending and read as one colour painted over everything.

          It used to be four equal columns of link text and nothing else, which
          gave the wordmark no place to sit and treated "Report a problem" as a
          peer of "Road safety tutorial". Now the identity and what this build is
          hold the left, the service's own links take the right, and the
          utilities sit in the last row with the legal line where somebody looks
          for them. */}
      <footer className="footer" hidden={chromeless}>
        <div className="wrap col g24">
          <div className="foot-top">
            <div className="col g12 foot-id">
              <button className="mark foot-mark" onClick={() => go('home')} aria-label={t('Parivahan Sewa home', 'परिवहन सेवा होम', 'परिवहन सेवा होम')}>
                <Mark size={30} />
                <Wordmark lang={lang} />
              </button>
              <p className="foot-line">
                {t('A redesign concept for the learner’s-licence journey. The queue, the fees and the guarantees are real code — the people in them are not.',
                  'लर्नर लाइसेंस यात्रा के लिए एक पुनर्डिज़ाइन अवधारणा। कतार, शुल्क और गारंटी असली कोड हैं — उनमें दिखे लोग असली नहीं।',
                  'लर्नर लायसन्स प्रवासासाठी एक पुनर्रचना संकल्पना. रांग, शुल्क आणि हमी हे खरे कोड आहेत — त्यातील माणसे खरी नाहीत.')}
              </p>
            </div>
            <div className="foot-cols">
              {FOOTER_COLUMNS.map(([heading, links]) => (
                <div key={heading} className="col g12"><b className="foot-h">{footerT(t, heading)}</b>
                  {/* A link to a route gets that route's real href, so ctrl-click,
                      middle-click and "copy link address" behave the way they do
                      anywhere else. The click handler still routes in-page. Links
                      that open a sheet have no URL of their own and keep "#". */}
                  <nav className="linkcol">{links.map(([label, target]) => (
                    <a key={label} href={'go' in target ? `#/${target.go}` : '#'} onClick={e => handleFooterLink(e, target)}>{footerT(t, label)}</a>
                  ))}</nav></div>
              ))}
            </div>
          </div>
          <hr className="hr" />
          <div className="row between g16 wrapf">
            <span className="tiny" style={{ maxWidth: 600 }}>
              {t('An independent redesign concept for the Parivahan Sewa licence journey, built for WHat Moves India challenge. Not affiliated with, endorsed by, or connected to the Ministry of Road Transport & Highways or any government body. The name is used only to identify the service being redesigned. No official emblem or logo is used. All data shown is synthetic.',
                'परिवहन सेवा लाइसेंस यात्रा के लिए एक स्वतंत्र पुनर्डिज़ाइन अवधारणा, जो एक सार्वजनिक-सेवा डिज़ाइन चैलेंज के लिए बनाई गई है। यह सड़क परिवहन एवं राजमार्ग मंत्रालय या किसी भी सरकारी संस्था से संबद्ध, अनुमोदित या जुड़ी नहीं है। नाम का उपयोग केवल उस सेवा की पहचान के लिए किया गया है जिसे फिर से डिज़ाइन किया जा रहा है। कोई आधिकारिक प्रतीक या लोगो उपयोग नहीं किया गया है। दिखाया गया सभी डेटा बनावटी है।',
                'परिवहन सेवा लायसन्स प्रवासासाठी एक स्वतंत्र पुनर्रचना संकल्पना, जी सार्वजनिक-सेवा डिझाइन चॅलेंजसाठी तयार केली आहे. हे रस्ते वाहतूक आणि महामार्ग मंत्रालय किंवा कोणत्याही सरकारी संस्थेशी संलग्न, मान्यताप्राप्त किंवा जोडलेले नाही. नावाचा वापर फक्त पुनर्रचना केल्या जाणाऱ्या सेवेची ओळख करण्यासाठी केला आहे. कोणतेही अधिकृत बोधचिन्ह किंवा लोगो वापरलेला नाही. दाखवलेला सर्व डेटा बनावट आहे.')}
            </span>
            <span className="tiny">{t('Designed for the Build What Moves India challenge · Aug 2026', 'सार्वजनिक-सेवा पुनर्निर्माण चैलेंज के लिए डिज़ाइन किया गया · अगस्त 2026', 'सार्वजनिक-सेवा पुनर्निर्माण चॅलेंजसाठी डिझाइन केले · ऑगस्ट 2026')}</span>
          </div>
        </div>
      </footer>
      {/* Goes with the rest of the chrome. On the one chromeless route it landed
          as a green pill from the service's palette over a page that has none of
          it, in the corner that page uses for its own scroll readout. */}
      {!chromeless && <BackToTop />}
      <ToastHost />
      {/* Saarthi gets `go` because it fills the form on the citizen's behalf and
          then has somewhere to send them — the panel covers the page, so
          "your form is filled, shall we book the slot?" needs a door. */}
      {voiceOpen && (
        <VoiceAgent
          state={state}
          update={update}
          go={route => { setVoiceOpen(false); go(route); }}
          onSignIn={() => { setVoiceOpen(false); setResumeVoice(true); setIdentityOpen(true); }}
          onClose={() => setVoiceOpen(false)}
        />
      )}
      {infoPanelId && <InfoSheet id={infoPanelId} onClose={() => setInfoPanelId(null)} />}
      {/* The only sign-in on the site. Saarthi points here rather than carrying
          a second copy of the form, so there is one shape to learn and one
          place it lives. Signed in, the same sheet is the profile. */}
      {identityOpen && (
        <IdentitySheet
          phone={phone}
          currentState={state.form?.state}
          // The office goes with the state. Written together so no screen can
          // read a Bihar state next to a Mumbai office — which is what happened
          // when only the state was updated and the wizard's earlier pick stayed
          // behind on the same application.
          onPickState={(picked, rtoId) =>
            update({ form: { ...(state.form || {}), state: picked, rto: rtoId } })}
          onClose={() => {
            setIdentityOpen(false);
            // Saarthi steps aside to show this sheet, so it comes back when the
            // citizen is done — being dropped on the home page after signing in
            // means pressing "Talk to Saarthi" all over again.
            if (resumeVoice) { setResumeVoice(false); setVoiceOpen(true); }
          }}
        />
      )}
      {/* The phone's top bar, unfolded. Same controls as the desktop header —
          not a reduced set — because a control that only exists on a laptop is
          a control most of this country does not have. Language sits at the top
          of it for the same reason. */}
      {menuOpen && (
        <Sheet title={t('Menu', 'मेन्यू')} onClose={() => setMenuOpen(false)}>
          <div className="col g20">
            <div className="col g10">
              <span className="label" id="mlang">{t('Language', 'भाषा')}</span>
              <div className="seg" role="group" aria-labelledby="mlang">
                <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
                <button aria-pressed={lang === 'hi'} onClick={() => setLang('hi')}>HI</button>
              </div>
            </div>

            <hr className="hr" />

            <div className="col g10">
              <span className="label">{t('Go to', 'यहाँ जाएँ')}</span>
              {([
                ['elig', t('Check eligibility', 'पात्रता जाँचें')],
                ['learn', t('Practice', 'अभ्यास')],
                ['status', t('Track an application', 'आवेदन ट्रैक करें')],
                ['desk', t('RTO desk', 'आरटीओ डेस्क')],
                ['proof', t('See the guarantees run', 'गारंटी चलती देखें')],
                ['learning', t('Where people actually fail', 'लोग असल में कहाँ अटकते हैं')],
              ] as [Route, string][]).map(([target, label]) => (
                <button key={target} className="btn btn-s btn-full"
                  style={{ justifyContent: 'space-between' }}
                  onClick={() => { setMenuOpen(false); go(target); }}>
                  {label} {Icon.right()}
                </button>
              ))}
            </div>

            <hr className="hr" />

            <button className="btn btn-p btn-full"
              onClick={() => { setMenuOpen(false); setIdentityOpen(true); }}>
              {phone
                ? <span className="row g6">{Icon.user()}{t('Profile', 'प्रोफ़ाइल')}</span>
                : t('Sign in', 'साइन इन')}
            </button>
          </div>
        </Sheet>
      )}
      {grievanceOpen && <GrievanceSheet state={state} onClose={() => setGrievanceOpen(false)} />}
      {helpOpen && (
        <Sheet title={t('Need help?', 'सहायता चाहिए?', 'मदत हवी आहे?')} onClose={() => setHelpOpen(false)}>
          <div className="col g20">
            {/* One notice instead of two. This sheet opened with a brand note
                about the helpline and closed with a second note saying the
                helpline was illustrative — a claim and its retraction, eight
                lines apart, with the FAQ sandwiched between them. Said once, in
                one weight, the caveat lands where the number does. */}
            <Note tone="brand" icon={Icon.phone()}>{t('Call 1800 000 000 — free, 8 am to 8 pm, in Marathi, Hindi or English. The number and the answers below are illustrative: this is a prototype, not a running helpline.', '1800 000 000 पर कॉल करें — नि:शुल्क, सुबह 8 से रात 8 बजे तक, मराठी, हिंदी या अंग्रेज़ी में। यह नंबर और नीचे दिए जवाब उदाहरण के लिए हैं: यह एक प्रोटोटाइप है, कोई चालू हेल्पलाइन नहीं।')}</Note>
            <div className="col g12">
              <h3>{t('Common questions', 'सामान्य प्रश्न', 'सामान्य प्रश्न')}</h3>
              {HELP_FAQ.map(([question, answer, questionHi, answerHi]) => (
                <details key={question} className="flat" style={{ padding: '14px 16px' }}>
                  <summary style={{ fontWeight: 600, cursor: 'pointer', fontSize: '.93rem' }}>{t(question, questionHi)}</summary>
                  <p className="sub" style={{ marginTop: 10, lineHeight: 1.6 }}>{t(answer, answerHi)}</p>
                </details>
              ))}
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
