import { useEffect, useState, type ComponentType, type MouseEvent } from 'react';
import logo from './assets/logo-master.png';
import { DrivingLicence } from './pages/DrivingLicence';
import { Eligibility } from './pages/Eligibility';
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
import { LANGUAGES, useLanguage, useT, type Lang } from './lib/language';
import { scrollToTop } from './lib/scrollToTop';
import type { AppState, PageProps, Route } from './types';
import { BackToTop } from './ui/BackToTop';
import { GrievanceSheet } from './ui/GrievanceSheet';
import { Icon } from './ui/Icon';
import { InfoSheet } from './ui/InfoSheet';
import { Note, Sheet } from './ui/SharedUI';

// Translations for the footer's data-driven labels (FOOTER_COLUMNS lives in data/siteContent.ts as
// plain English strings) — kept as a lookup here rather than restructuring that data shape.
const FOOTER_TRANSLATIONS: Record<string, { hi: string; mr: string }> = {
  "Learner's licence": { hi: 'लर्नर लाइसेंस', mr: 'लर्नर लायसन्स' },
  'Driving licence': { hi: 'ड्राइविंग लाइसेंस', mr: 'ड्रायव्हिंग लायसन्स' },
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
  Accessibility: { hi: 'सुगम्यता', mr: 'सुलभता' },
  Source: { hi: 'स्रोत', mr: 'स्रोत' },
};
function footerT(t: ReturnType<typeof useT>, label: string): string {
  return t(label, FOOTER_TRANSLATIONS[label]?.hi, FOOTER_TRANSLATIONS[label]?.mr);
}

const PAGES: Record<Route, ComponentType<PageProps>> = {
  home: Home, elig: Eligibility, checklist: Checklist, apply: Apply, slip: Slip, pay: Pay,
  receipt: Receipt, slot: Slot, tutorial: Tutorial, learn: GameIntro, lesson: Learn, game: Game, report: Report,
  test: Test, issued: Issued, dl: DrivingLicence, status: Status,
};

const FULL_SCREEN_FLOW_ROUTES: Route[] = ['apply', 'slip', 'pay', 'receipt', 'slot', 'tutorial', 'test', 'game'];

type Theme = 'light' | 'dark';

const HELP_FAQ: [question: string, answer: string][] = [
  ['Can I finish this on a slow connection?', 'Every step is a single small page. Nothing here needs video, and the application saves as soon as you move on, so a dropped connection costs you one step, not the whole form.'],
  ['Do I need an agent?', 'No. The fee on screen is the whole fee. Nobody at the office needs to be paid anything, and there is no step that requires a middleman.'],
  ['What if my documents are not in DigiLocker?', 'You can photograph the original instead. The accepted substitutes are listed on the checklist screen before you begin.'],
  ['Can somebody else fill this for me?', 'Yes. The application is tied to a mobile number, so a family member can complete it on their phone as long as you receive the OTP.'],
];

/** The whole site: top bar, the active page, footer, and the help/info overlay sheets. */
export default function App() {
  const [route, setRoute] = useState<Route>('home');
  const [state, setState] = useState<AppState>({});
  const [helpOpen, setHelpOpen] = useState(false);
  const [grievanceOpen, setGrievanceOpen] = useState(false);
  const [infoPanelId, setInfoPanelId] = useState<string | null>(null);
  const [textSize, setTextSize] = useState(16);
  // The inline script in index.html already set this attribute before first paint, so read it back
  // rather than recomputing — that keeps the toggle in sync with whatever it decided.
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'));
  const { lang, setLang } = useLanguage();
  const t = useT();

  const update = (patch: Partial<AppState>) => setState(s => ({ ...s, ...patch }));
  const go = (next: Route) => { setRoute(next); scrollToTop(); };

  useEffect(() => { document.documentElement.style.setProperty('--rs', textSize + 'px'); }, [textSize]);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch { /* private browsing, etc. — theme just won't persist */ }
  }, [theme]);

  const ActivePage = PAGES[route] || Home;
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
          <button className="mark" onClick={() => go('home')} aria-label="Parivahan Sewa home">
            <img src={logo} alt="" className="mark-g" />
            <span className="col" style={{ alignItems: 'flex-start' }}><span className="mark-t">Parivahan Sewa</span><span className="mark-s">{t('Licence services · redesign concept', 'लाइसेंस सेवाएं · पुनर्रचना संकल्पना', 'परवाना सेवा · पुनर्रचना संकल्पना')}</span></span>
          </button>
          <span className="badge-proto hide-m">{t('Prototype', 'प्रोटोटाइप', 'प्रोटोटाइप')}</span>
          <div className="grow" />
          {!inFullScreenFlow && (
            <>
              <button className="tb-btn hide-m" onClick={() => go('home')}>{t('Services', 'सेवाएं', 'सेवा')}</button>
              <button className="tb-btn hide-m" onClick={() => go('learn')}>{t('Practice', 'अभ्यास', 'सराव')}</button>
              <button className="tb-btn hide-m" onClick={() => go('status')}>{t('Track', 'ट्रैक करें', 'ट्रॅक करा')}</button>
            </>
          )}
          <div className="seg hide-m" role="group" aria-label="Text size">
            <button onClick={() => setTextSize(Math.max(14, textSize - 1))} aria-label="Smaller text">A−</button>
            <button onClick={() => setTextSize(16)} aria-pressed={textSize === 16} aria-label="Normal text">A</button>
            <button onClick={() => setTextSize(Math.min(21, textSize + 1))} aria-label="Larger text">A+</button>
          </div>
          <select className="lang-select hide-m" aria-label="Language" value={lang} onChange={e => setLang(e.target.value as Lang)}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.nativeLabel}</option>)}
          </select>
          <button className="btn btn-s btn-sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? Icon.sun() : Icon.moon()}
          </button>
          <button className="btn btn-s btn-sm" onClick={() => setHelpOpen(true)}>{Icon.phone()} {t('Help', 'सहायता', 'मदत')}</button>
        </div>
      </header>
      <main><ActivePage go={go} state={state} update={update} /></main>
      <footer className="footer">
        <div className="wrap col g24">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 28 }}>
            {FOOTER_COLUMNS.map(([heading, links]) => (
              <div key={heading} className="col g12"><b style={{ fontWeight: 600, fontSize: '.93rem' }}>{footerT(t, heading)}</b>
                <nav className="linkcol">{links.map(([label, target]) => <a key={label} href="#" onClick={e => handleFooterLink(e, target)}>{footerT(t, label)}</a>)}</nav></div>
            ))}
          </div>
          <hr className="hr" />
          <div className="row between g16 wrapf">
            <span className="tiny" style={{ maxWidth: 600 }}>An independent redesign concept for the Parivahan Sewa licence journey, built for a public-service design challenge. Not affiliated with, endorsed by, or connected to the Ministry of Road Transport &amp; Highways or any government body. The name is used only to identify the service being redesigned. No official emblem or logo is used. All data shown is synthetic.</span>
            <span className="tiny">{t('Designed for the public-service rebuild challenge · Aug 2026', 'सार्वजनिक-सेवा पुनर्निर्माण चैलेंज के लिए डिज़ाइन किया गया · अगस्त 2026', 'सार्वजनिक-सेवा पुनर्निर्माण चॅलेंजसाठी डिझाइन केले · ऑगस्ट 2026')}</span>
          </div>
        </div>
      </footer>
      <BackToTop />
      {infoPanelId && <InfoSheet id={infoPanelId} onClose={() => setInfoPanelId(null)} />}
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
