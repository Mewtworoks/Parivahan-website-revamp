import { useEffect, useRef, useState, type ComponentType, type MouseEvent } from 'react';
import logo from './assets/sadak_setu_icon.png';
import { Desk } from './pages/Desk';
import { Learning } from './pages/Learning';
// DL journey parked — see the note on Route in types.ts.
// import { DrivingLicence } from './pages/DrivingLicence';
import { Eligibility } from './pages/Eligibility';
import { Proof } from './pages/Proof';
import { Checklist } from './pages/Checklist';
import { Home } from './pages/Home';
import { Issued } from './pages/Issued';
import { Pay } from './pages/Pay';
import { Receipt } from './pages/Receipt';
import { Slip } from './pages/Slip';
import { Slot } from './pages/Slot';
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
import { LANGUAGES, useLanguage, useT, type Lang } from './lib/language';
import { scrollToTop } from './lib/scrollToTop';
import type { AppState, PageProps, Route } from './types';
import { BackToTop } from './ui/BackToTop';
import { GrievanceSheet } from './ui/GrievanceSheet';
import { Icon } from './ui/Icon';
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
  Help: { hi: 'सहायता', mr: 'मदत' },
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
  Accessibility: { hi: 'सुगम्यता', mr: 'सुलभता' },
  Source: { hi: 'स्रोत', mr: 'स्रोत' },
};
function footerT(t: ReturnType<typeof useT>, label: string): string {
  return t(label, FOOTER_TRANSLATIONS[label]?.hi, FOOTER_TRANSLATIONS[label]?.mr);
}

const PAGES: Record<Route, ComponentType<PageProps>> = {
  home: Home, elig: Eligibility, checklist: Checklist, apply: Apply, slip: Slip, pay: Pay,
  receipt: Receipt, slot: Slot, tutorial: Tutorial, learn: GameIntro, lesson: Learn, game: Game, report: Report,
  test: Test, issued: Issued, status: Status,
  desk: Desk, proof: Proof, learning: Learning,
  // DL journey parked: dl: DrivingLicence,
};

const FULL_SCREEN_FLOW_ROUTES: Route[] = ['apply', 'slip', 'pay', 'receipt', 'slot', 'tutorial', 'test', 'game'];

/**
 * The screens that need to know whose journey this is.
 *
 * Only the form. Everything before it — checking whether you qualify, playing
 * the practice road — is worth doing before you have decided to apply at all,
 * and demanding a number first would turn a two-minute look into a sign-up.
 * The stages after it are self-gating: they need an application, and there is
 * no way to have one without passing through here.
 *
 * Saarthi is the other gated surface, for the same reason and not by route: it
 * fills this form on the citizen's behalf, so it has to know whose.
 */
const SIGN_IN_REQUIRED: Route[] = ['apply'];

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

type Theme = 'light' | 'dark';

const HELP_FAQ: [question: string, answer: string][] = [
  ['Can I finish this on a slow connection?', 'Every step is a single small page. Nothing here needs video, and the application saves as soon as you move on, so a dropped connection costs you one step, not the whole form.'],
  ['Do I need an agent?', 'No. The fee on screen is the whole fee. Nobody at the office needs to be paid anything, and there is no step that requires a middleman.'],
  ['What if my documents are not in DigiLocker?', 'You can photograph the original instead. The accepted substitutes are listed on the checklist screen before you begin.'],
  ['Can somebody else fill this for me?', 'Yes. The application is tied to a mobile number, so a family member can complete it on their phone as long as you receive the OTP.'],
];

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
  // Saarthi closed itself to show the sign-in sheet, and wants to come back.
  const [resumeVoice, setResumeVoice] = useState(false);
  const phone = useIdentity();
  const [textSize, setTextSize] = useState(16);
  // The inline script in index.html already set this attribute before first paint, so read it back
  // rather than recomputing — that keeps the toggle in sync with whatever it decided.
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'));
  const { lang, setLang } = useLanguage();
  const t = useT();
  // Text size, language and theme used to be three separate top-bar controls — on a phone that
  // was what wrapped the wordmark and pushed things off the end. One "Display" button opening a
  // popover holds all three without needing the bar itself to grow.
  const [dispOpen, setDispOpen] = useState(false);
  const dispRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dispOpen) return;
    const onDocClick = (e: globalThis.MouseEvent) => { if (dispRef.current && !dispRef.current.contains(e.target as Node)) setDispOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDispOpen(false); };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [dispOpen]);

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

  useEffect(() => { document.documentElement.style.setProperty('--rs', textSize + 'px'); }, [textSize]);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch { /* private browsing, etc. — theme just won't persist */ }
  }, [theme]);

  const ActivePage = PAGES[route] || Home;
  const needsSignIn = !phone && SIGN_IN_REQUIRED.includes(route);
  const inFullScreenFlow = FULL_SCREEN_FLOW_ROUTES.includes(route);

  const handleFooterLink = (e: MouseEvent, target: FooterTarget) => {
    e.preventDefault();
    if ('go' in target) go(target.go);
    else if ('help' in target) setHelpOpen(true);
    else if ('grievance' in target) setGrievanceOpen(true);
    else if ('info' in target) setInfoPanelId(target.info);
  };

  return (
    <>
      <header className="tb">
        <div className="wrap tb-in">
          <button className="mark" onClick={() => go('home')} aria-label={t('Parivahan Sewa home', 'परिवहन सेवा होम', 'परिवहन सेवा होम')}>
            <img src={logo} alt="" className="mark-g" />
            {/* Wordmark alone. The strapline and the Prototype badge both said
                here what the hero kicker, the home-page notice and the footer
                disclaimer already say — and on a phone the strapline wrapped to
                three lines and clipped the name it sat under. */}
            <span className="mark-t">{t('Parivahan Sewa', 'परिवहन सेवा', 'परिवहन सेवा')}</span>
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
          <div className="disp hide-m" ref={dispRef}>
            <button className="disp-b" aria-expanded={dispOpen} aria-controls="disppop" onClick={() => setDispOpen(v => !v)}>
              {Icon.sliders()}
              <span className="dlabel">{t('Display', 'डिस्प्ले')}</span>
              <span className="chev">{Icon.down()}</span>
            </button>
            {dispOpen && (
              <div className="pop" id="disppop" role="group" aria-label="Display settings">
                <div className="pop-g">
                  <span className="pop-l" id="szl">{t('Text size', 'टेक्स्ट आकार')}</span>
                  <div className="seg" role="group" aria-labelledby="szl">
                    <button onClick={() => setTextSize(Math.max(14, textSize - 1))} aria-label="Smaller text">A−</button>
                    <button onClick={() => setTextSize(16)} aria-pressed={textSize === 16} aria-label="Normal text">A</button>
                    <button onClick={() => setTextSize(Math.min(21, textSize + 1))} aria-label="Larger text">A+</button>
                  </div>
                </div>
                <div className="pop-g">
                  <label className="pop-l" htmlFor="langsel">{t('Language', 'भाषा')}</label>
                  <select className="lang-select" id="langsel" style={{ width: '100%' }} aria-label="Language" value={lang} onChange={e => setLang(e.target.value as Lang)}>
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.nativeLabel}</option>)}
                  </select>
                </div>
                <div className="pop-g">
                  <span className="pop-l" id="thml">{t('Theme', 'थीम')}</span>
                  <div className="seg" role="group" aria-labelledby="thml">
                    <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>{Icon.moon({ width: 14, height: 14 })} {t('Dark', 'डार्क')}</button>
                    <button aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>{Icon.sun({ width: 14, height: 14 })} {t('Light', 'लाइट')}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Identity, not a gate — nothing on the site is blocked either way.
              Signed out it offers the number; signed in it becomes the profile,
              which is where signing out lives. */}
          <button className="btn btn-s btn-sm hide-m" onClick={() => setIdentityOpen(true)}
            aria-label={phone ? `Profile — signed in as ${prettyPhone(phone)}` : undefined}>
            {phone
              ? <span className="row g6">{Icon.phone()}<span className="mono">{prettyPhone(phone)}</span></span>
              : t('Sign in', 'साइन इन')}
          </button>
          {/* Saarthi is the only call to action up here. Help sat beside it
              competing for the same press, and Saarthi answers the questions
              the sheet lists anyway. The sheet is still reached from the
              footer's "Call 1800 000 000". */}
          <button className="btn btn-p btn-sm" onClick={() => setVoiceOpen(true)}>{Icon.speaker()} {t('Talk to Saarthi', 'सारथी से बात करें')}</button>
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
          : <ActivePage go={go} state={state} update={update} />}
      </main>
      <footer className="footer">
        <div className="wrap col g24">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 28 }}>
            {FOOTER_COLUMNS.map(([heading, links]) => (
              <div key={heading} className="col g12"><b style={{ fontWeight: 600, fontSize: '.93rem' }}>{footerT(t, heading)}</b>
                {/* A link to a route gets that route's real href, so ctrl-click,
                    middle-click and "copy link address" behave the way they do
                    anywhere else. The click handler still routes in-page. Links
                    that open a sheet have no URL of their own and keep "#". */}
                <nav className="linkcol">{links.map(([label, target]) => (
                  <a key={label} href={'go' in target ? `#/${target.go}` : '#'} onClick={e => handleFooterLink(e, target)}>{footerT(t, label)}</a>
                ))}</nav></div>
            ))}
          </div>
          <hr className="hr" />
          <div className="row between g16 wrapf">
            <span className="tiny" style={{ maxWidth: 600 }}>
              {t('An independent redesign concept for the Parivahan Sewa licence journey, built for a public-service design challenge. Not affiliated with, endorsed by, or connected to the Ministry of Road Transport & Highways or any government body. The name is used only to identify the service being redesigned. No official emblem or logo is used. All data shown is synthetic.',
                'परिवहन सेवा लाइसेंस यात्रा के लिए एक स्वतंत्र पुनर्डिज़ाइन अवधारणा, जो एक सार्वजनिक-सेवा डिज़ाइन चैलेंज के लिए बनाई गई है। यह सड़क परिवहन एवं राजमार्ग मंत्रालय या किसी भी सरकारी संस्था से संबद्ध, अनुमोदित या जुड़ी नहीं है। नाम का उपयोग केवल उस सेवा की पहचान के लिए किया गया है जिसे फिर से डिज़ाइन किया जा रहा है। कोई आधिकारिक प्रतीक या लोगो उपयोग नहीं किया गया है। दिखाया गया सभी डेटा बनावटी है।',
                'परिवहन सेवा लायसन्स प्रवासासाठी एक स्वतंत्र पुनर्रचना संकल्पना, जी सार्वजनिक-सेवा डिझाइन चॅलेंजसाठी तयार केली आहे. हे रस्ते वाहतूक आणि महामार्ग मंत्रालय किंवा कोणत्याही सरकारी संस्थेशी संलग्न, मान्यताप्राप्त किंवा जोडलेले नाही. नावाचा वापर फक्त पुनर्रचना केल्या जाणाऱ्या सेवेची ओळख करण्यासाठी केला आहे. कोणतेही अधिकृत बोधचिन्ह किंवा लोगो वापरलेला नाही. दाखवलेला सर्व डेटा बनावट आहे.')}
            </span>
            <span className="tiny">{t('Designed for the public-service rebuild challenge · Aug 2026', 'सार्वजनिक-सेवा पुनर्निर्माण चैलेंज के लिए डिज़ाइन किया गया · अगस्त 2026', 'सार्वजनिक-सेवा पुनर्निर्माण चॅलेंजसाठी डिझाइन केले · ऑगस्ट 2026')}</span>
          </div>
        </div>
      </footer>
      <BackToTop />
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
      {grievanceOpen && <GrievanceSheet state={state} onClose={() => setGrievanceOpen(false)} />}
      {helpOpen && (
        <Sheet title={t('Need help?', 'सहायता चाहिए?', 'मदत हवी आहे?')} onClose={() => setHelpOpen(false)}>
          <div className="col g20">
            <Note tone="brand" icon={Icon.phone()}><b>Call 1800 000 000</b><br />Free, 8 am to 8 pm, in Marathi, Hindi and English. Say your application number and the person who answers can see the same screen you do.</Note>
            <div className="col g12">
              <h3>{t('Common questions', 'सामान्य प्रश्न', 'सामान्य प्रश्न')}</h3>
              {HELP_FAQ.map(([question, answer]) => (
                <details key={question} className="flat" style={{ padding: '14px 16px' }}>
                  <summary style={{ fontWeight: 600, cursor: 'pointer', fontSize: '.93rem' }}>{question}</summary>
                  <p className="sub" style={{ marginTop: 10, lineHeight: 1.6 }}>{answer}</p>
                </details>
              ))}
            </div>
            <Note>Prototype. The helpline number and answers are illustrative.</Note>
          </div>
        </Sheet>
      )}
    </>
  );
}
