import React, { useState } from 'react';

import * as api from './api';
import { usePolling } from './hooks';
import AgentConsole from './components/AgentConsole';
import JourneyFlow from './components/JourneyFlow';
import ProofPanel from './components/ProofPanel';
import RtoBoard from './components/RtoBoard';
import ScenarioTest from './components/ScenarioTest';
import styles from './App.module.scss';

const TABS = [
  {
    id: 'journey',
    label: 'My journey',
    blurb: 'Apply, book a real time slot, check in, watch the queue move, walk away with proof.',
  },
  {
    id: 'desk',
    label: 'RTO desk',
    blurb: 'The inspector’s side and the waiting-hall screen — the same numbers the citizen sees.',
  },
  {
    id: 'test',
    label: 'Theory test',
    blurb: 'Fifteen driving situations to read, in Hindi or English, that teach as you go.',
  },
  {
    id: 'proof',
    label: 'Proof',
    blurb: 'Run the retry storm and the slot race yourself, against the live backend.',
  },
  {
    id: 'agent',
    label: 'Voice copilot',
    blurb: 'The function tools the Realtime model drives — replayed live against real state.',
  },
];

export default function App() {
  const [tab, setTab] = useState('journey');
  const rtoId = api.DEFAULT_RTO;

  const { data: health, error: healthError } = usePolling(
    (signal) => api.health(signal),
    { intervalMs: 6000 },
  );

  const online = Boolean(health) && !healthError;
  const active = TABS.find((t) => t.id === tab);

  return (
    <div className={styles.app}>
      <header className={styles.appHeader}>
        <div className="container">
          <div className={styles.navContainer}>
            <div className={styles.brand}>
              <div className={styles.logoIcon}>🇮🇳</div>
              <div className={styles.brandTitle}>
                Parivahan <span>Revamp</span>
              </div>
            </div>

            <div className={styles.apiStatus}>
              <span className={`${styles.dot} ${online ? styles.dotOn : styles.dotOff}`} />
              <span className={styles.apiText}>
                {online ? 'backend online' : 'backend unreachable'}
              </span>
              <code className={styles.apiBase}>{api.API_BASE}</code>
            </div>
          </div>
        </div>
      </header>

      <main className="container">
        <section className={styles.heroSection}>
          <div className={styles.heroBadge}>
            Build What Moves India · Learner &amp; Driving Licence journey
          </div>
          <h1 className={styles.heroTitle}>
            The licence journey, <span>rebuilt to not break</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Three things go wrong today: submit silently fails and you end up with duplicates,
            you are told to come in the morning and lose a day&apos;s wages, and the only record
            that you passed is whatever a clerk typed. Each one is fixed here — and every fix on
            this page is checkable against the live API.
          </p>
        </section>

        {!online && (
          <div className={styles.offlineBar}>
            <strong>The API is not answering.</strong> Start it with{' '}
            <code>cd Backend</code> then <code>python main.py</code>, then this bar disappears on
            its own. Expecting it at <code>{api.API_BASE}</code>.
          </div>
        )}

        <nav className={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <p className={styles.tabBlurb}>{active?.blurb}</p>

        <section className={styles.tabPanel}>
          {tab === 'journey' && <JourneyFlow rtoId={rtoId} />}
          {tab === 'desk' && <RtoBoard rtoId={rtoId} />}
          {tab === 'test' && <ScenarioTest />}
          {tab === 'proof' && <ProofPanel rtoId={rtoId} />}
          {tab === 'agent' && <AgentConsole />}
        </section>

        <footer className={styles.footer}>
          <span>
            All data here is synthetic — no real Aadhaar, PAN, OTP or payment anywhere in this
            build.
          </span>
          <span>
            {health?.rtos?.length ? `RTO ${health.rtos.join(', ')}` : 'no RTO reported'} ·{' '}
            <a href={`${api.API_BASE}/docs`} target="_blank" rel="noreferrer">
              API docs
            </a>
          </span>
        </footer>
      </main>
    </div>
  );
}
