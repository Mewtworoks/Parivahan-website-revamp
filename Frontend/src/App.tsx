import { useEffect, useState, type ComponentType, type MouseEvent } from 'react';
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
import { Report } from './practice/Report';
import { FOOTER_COLUMNS, type FooterTarget } from './data/siteContent';
import type { AppState, PageProps, Route } from './types';
import { Icon } from './ui/Icon';
import { InfoSheet } from './ui/InfoSheet';
import { Note, Sheet } from './ui/SharedUI';

const PAGES: Record<Route, ComponentType<PageProps>> = {
  home: Home, elig: Eligibility, checklist: Checklist, apply: Apply, slip: Slip, pay: Pay,
  receipt: Receipt, slot: Slot, tutorial: Tutorial, learn: GameIntro, game: Game, report: Report,
  test: Test, issued: Issued, dl: DrivingLicence, status: Status,
};

const FULL_SCREEN_FLOW_ROUTES: Route[] = ['apply', 'slip', 'pay', 'receipt', 'slot', 'tutorial', 'test', 'game'];

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
  const [infoPanelId, setInfoPanelId] = useState<string | null>(null);
  const [textSize, setTextSize] = useState(16);

  const update = (patch: Partial<AppState>) => setState(s => ({ ...s, ...patch }));
  const go = (next: Route) => { setRoute(next); window.scrollTo(0, 0); };

  useEffect(() => { document.documentElement.style.setProperty('--rs', textSize + 'px'); }, [textSize]);

  const ActivePage = PAGES[route] || Home;
  const inFullScreenFlow = FULL_SCREEN_FLOW_ROUTES.includes(route);

  const handleFooterLink = (e: MouseEvent, target: FooterTarget) => {
    e.preventDefault();
    if ('go' in target) go(target.go);
    else if ('help' in target) setHelpOpen(true);
    else if ('info' in target) setInfoPanelId(target.info);
  };

  return (
    <>
      <div className="ribbon" aria-hidden="true"><i /><i /><i /></div>
      <header className="tb">
        <div className="wrap tb-in">
          <button className="mark" onClick={() => go('home')} aria-label="Parivahan Sewa home">
            <span className="mark-g">{Icon.mark()}</span>
            <span className="col" style={{ alignItems: 'flex-start' }}><span className="mark-t">Parivahan Sewa</span><span className="mark-s">Licence services · redesign concept</span></span>
          </button>
          <span className="badge-proto hide-m">Prototype</span>
          <div className="grow" />
          {!inFullScreenFlow && (
            <>
              <button className="tb-btn hide-m" onClick={() => go('home')}>Services</button>
              <button className="tb-btn hide-m" onClick={() => go('learn')}>Practice</button>
              <button className="tb-btn hide-m" onClick={() => go('status')}>Track</button>
            </>
          )}
          <div className="seg hide-m" role="group" aria-label="Text size">
            <button onClick={() => setTextSize(Math.max(14, textSize - 1))} aria-label="Smaller text">A−</button>
            <button onClick={() => setTextSize(16)} aria-pressed={textSize === 16} aria-label="Normal text">A</button>
            <button onClick={() => setTextSize(Math.min(21, textSize + 1))} aria-label="Larger text">A+</button>
          </div>
          <button className="btn btn-s btn-sm" onClick={() => setHelpOpen(true)}>{Icon.phone()} Help</button>
        </div>
      </header>
      <main><ActivePage go={go} state={state} update={update} /></main>
      <footer className="footer">
        <div className="wrap col g24">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 28 }}>
            {FOOTER_COLUMNS.map(([heading, links]) => (
              <div key={heading} className="col g12"><b style={{ fontWeight: 600, fontSize: '.93rem' }}>{heading}</b>
                <nav className="linkcol">{links.map(([label, target]) => <a key={label} href="#" onClick={e => handleFooterLink(e, target)}>{label}</a>)}</nav></div>
            ))}
          </div>
          <hr className="hr" />
          <div className="row between g16 wrapf">
            <span className="tiny" style={{ maxWidth: 600 }}>An independent redesign concept for the Parivahan Sewa licence journey, built for a public-service design challenge. Not affiliated with, endorsed by, or connected to the Ministry of Road Transport &amp; Highways or any government body. The name is used only to identify the service being redesigned. No official emblem or logo is used. All data shown is synthetic.</span>
            <span className="tiny">Designed for the public-service rebuild challenge · Aug 2026</span>
          </div>
        </div>
      </footer>
      {infoPanelId && <InfoSheet id={infoPanelId} onClose={() => setInfoPanelId(null)} />}
      {helpOpen && (
        <Sheet title="Need help?" onClose={() => setHelpOpen(false)}>
          <div className="col g20">
            <Note tone="brand" icon={Icon.phone()}><b>Call 1800 000 000</b><br />Free, 8 am to 8 pm, in Marathi, Hindi and English. Say your application number and the person who answers can see the same screen you do.</Note>
            <div className="col g12">
              <h3>Common questions</h3>
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
