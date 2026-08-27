import { useState } from 'react';
import * as api from '../api';
import { clearConversation } from '../lib/conversation';
import { clearJourney } from '../lib/journeyStore';
import { useT } from '../lib/language';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Pill } from '../ui/SharedUI';

/**
 * The three guarantees, run on demand.
 *
 * Idempotent submission, atomic slot allocation and a tamper-evident ledger are
 * the parts of this build that are actually hard, and on the happy path all
 * three are invisible — nothing goes wrong, so nothing shows. Each button below
 * makes the failure happen against the real engine and prints what came back,
 * so the claim can be watched rather than taken on trust.
 */

type Which = 'idem' | 'race' | 'ledger';

function Verdict({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="row g10" style={{ alignItems: 'flex-start' }}>
      <Pill tone={ok ? 'ok' : 'warn'}>{ok ? Icon.check() : Icon.bang()} {ok ? 'Held' : 'Failed'}</Pill>
      <span className="sub">{children}</span>
    </div>
  );
}

/**
 * The output half of a proof card.
 *
 * Every proof prints its result under the same rule and at the same rhythm, so
 * the three cards read as one instrument rather than three. Kept as a component
 * because the spacing was drifting per card — the race's pills, the ledger's
 * two tables and the idempotency rows each had their own idea of it.
 */
function Result({ children }: { children: React.ReactNode }) {
  return (
    <>
      <hr className="hr" style={{ marginTop: 4 }} />
      <div className="col g20">{children}</div>
    </>
  );
}

/** A ledger as rows, with the broken link called out rather than left to be spotted. */
function Chain({ rows }: { rows: api.LedgerRow[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl" style={{ width: '100%', minWidth: 460 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>#</th>
            <th style={{ textAlign: 'left' }}>Event</th>
            <th style={{ textAlign: 'left' }}>Hash</th>
            <th style={{ textAlign: 'left' }}>Seal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.seq} style={row.intact ? undefined : { background: 'var(--warn-soft, rgba(200,80,20,.10))' }}>
              <td className="mono">{row.seq}</td>
              <td>{row.note}</td>
              <td className="mono tiny">{row.hash}…</td>
              <td>{row.intact
                ? <span className="tiny">intact</span>
                : <b className="tiny">broken</b>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Proof({ go }: PageProps) {
  const t = useT();
  const [busy, setBusy] = useState<Which | 'reset' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idem, setIdem] = useState<api.IdempotencyProof | null>(null);
  const [race, setRace] = useState<api.SlotRaceProof | null>(null);
  const [ledger, setLedger] = useState<api.TamperProof | null>(null);

  const run = async <T,>(which: Which | 'reset', call: () => Promise<T>, keep: (v: T) => void) => {
    setBusy(which); setError(null);
    try { keep(await call()); } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not run.');
    } finally { setBusy(null); }
  };

  const reset = () => run('reset', api.resetDemo, () => {
    setIdem(null); setRace(null); setLedger(null);
    // The browser holds its own copy of the journey now, and the reset just
    // deleted the application it points at. Left behind, the tracker would open
    // on an id the service has never heard of — the exact "somebody else's
    // leftovers" this button exists to prevent. Reloading is the honest way to
    // land on a clean slate rather than clearing thirteen keys by hand.
    clearJourney();
    clearConversation();
    window.location.hash = '#/home';
    window.location.reload();
  });

  return (
    <div className="narrow fade" style={{ padding: '48px 24px 64px' }}>
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }} onClick={() => go('home')}>{Icon.left()} {t('Home', 'होम', 'होम')}</button>
      <div className="col g14" style={{ alignItems: 'flex-start', marginBottom: 26 }}>
        <Pill tone="brand">{Icon.dot()} {t('Under the hood', 'भीतर से')}</Pill>
        <h1>{t('Three things that cannot go wrong', 'तीन चीज़ें जो गलत नहीं हो सकतीं')}</h1>
        <p className="lede">
          {t('Every button here breaks something on purpose, against the same service the rest of the site uses. Nothing is pre-recorded and nothing is mocked — these are the failures the portal is built to survive, made to happen on demand.',
            'यहाँ हर बटन जान-बूझकर कुछ तोड़ता है, उसी सेवा पर जो बाकी साइट चलाती है। कुछ भी पहले से रिकॉर्ड या नकली नहीं है — ये वही विफलताएँ हैं जिन्हें झेलने के लिए यह पोर्टल बना है।')}
        </p>
      </div>

      {/* 1 — idempotency */}
      <div className="card card-p col g14">
        <div className="row between g12 wrapf">
          <div className="col g4">
            <h3>{t('Press Apply twice', 'दो बार Apply दबाएँ')}</h3>
            <span className="sub">
              {t('A dropped connection and a second press. On the real portal this is how one person ends up with two live applications and no way to tell which counts.',
                'कनेक्शन टूटा और दूसरी बार दबाया। असली पोर्टल पर इसी तरह एक व्यक्ति के दो सक्रिय आवेदन बन जाते हैं।')}
            </span>
          </div>
          <button className="btn btn-p btn-sm" disabled={busy === 'idem'}
            onClick={() => run('idem', api.proveIdempotentApply, setIdem)}>
            {busy === 'idem' ? t('Running…', 'चल रहा है…') : t('Submit twice', 'दो बार भेजें')}
          </button>
        </div>
        {idem && (
          <Result>
            <div className="col g12">
              {idem.attempts.map((a, i) => (
                <div key={i} className="row between g16 wrapf">
                  <span className="sub">{a.label}</span>
                  <b className="mono">{a.application_no}</b>
                </div>
              ))}
            </div>
            <Verdict ok={idem.retry_was_deduplicated && idem.new_intent_still_created}>
              {idem.verdict}
            </Verdict>
          </Result>
        )}
      </div>

      {/* 2 — the slot race */}
      <div className="card card-p col g14" style={{ marginTop: 20 }}>
        <div className="row between g12 wrapf">
          <div className="col g4">
            <h3>{t('Eight people, one slot', 'आठ लोग, एक स्लॉट')}</h3>
            <span className="sub">
              {t('Eight bookings released at the same instant at a single appointment. Exactly one may win, and the other seven have to be told clearly enough to pick again.',
                'एक ही अपॉइंटमेंट पर आठ बुकिंग एक ही क्षण में। ठीक एक जीत सकता है, और बाकी सात को साफ़ बताया जाना चाहिए।')}
            </span>
          </div>
          <button className="btn btn-p btn-sm" disabled={busy === 'race'}
            onClick={() => run('race', () => api.proveSlotRace(8), setRace)}>
            {busy === 'race' ? t('Racing…', 'दौड़ रहा है…') : t('Race them', 'दौड़ाएँ')}
          </button>
        </div>
        {race && !race.error && (
          <Result>
            <div className="col g10">
              {/* rowGap as well as gap: eight pills wrap to a second line at
                  most widths, and a wrapped row with no row gap put the winner
                  hard against the losers above it. */}
              <div className="row g10 wrapf" style={{ rowGap: 10 }}>
                {race.results.map(r => (
                  <Pill key={r.applicant} tone={r.outcome === 'won' ? 'ok' : undefined}>
                    #{r.applicant} {r.outcome === 'won' ? t('booked', 'बुक') : t('refused', 'अस्वीकृत')}
                  </Pill>
                ))}
              </div>
              <span className="tiny">
                {race.results.find(r => r.outcome === 'rejected')?.detail}
              </span>
            </div>
            <Verdict ok={race.winners === 1 && !race.double_booked}>{race.verdict}</Verdict>
          </Result>
        )}
        {race?.error && <Note tone="warn">{race.error}</Note>}
      </div>

      {/* 3 — the ledger */}
      <div className="card card-p col g14" style={{ marginTop: 20 }}>
        <div className="row between g12 wrapf">
          <div className="col g4">
            <h3>{t('Rewrite a record', 'रिकॉर्ड बदलें')}</h3>
            <span className="sub">
              {t('Somebody with database access edits what an office recorded. This is the corruption the ledger exists to catch, so it is worth watching it get caught.',
                'डेटाबेस पहुँच वाला कोई व्यक्ति दर्ज बात बदल देता है। यही भ्रष्टाचार पकड़ने के लिए यह लेजर है।')}
            </span>
          </div>
          <button className="btn btn-p btn-sm" disabled={busy === 'ledger'}
            onClick={() => run('ledger', api.proveLedgerTamper, setLedger)}>
            {busy === 'ledger' ? t('Editing…', 'बदला जा रहा है…') : t('Tamper with it', 'छेड़छाड़ करें')}
          </button>
        </div>
        {ledger && (
          <Result>
            {/* The two chains are the whole point of this card and they were
                running together into one long table — the reader could not see
                where "before" stopped. Same caption style, a clear gap, and the
                second one labelled with what changed. */}
            <div className="col g10">
              <span className="tiny" style={{ fontWeight: 600 }}>
                {t('Before — receipt verifies', 'पहले — रसीद सत्यापित')} · {ledger.application_no}
              </span>
              <Chain rows={ledger.before.events} />
            </div>
            <div className="col g10">
              <span className="tiny" style={{ fontWeight: 600 }}>
                {t('After — row', 'बाद में — पंक्ति')} {ledger.edited_row} {t('changed to', 'बदली गई')}:{' '}
                <i>“{ledger.edited_to}”</i>
              </span>
              <Chain rows={ledger.after.events} />
            </div>
            <Verdict ok={ledger.before.chain_valid && !ledger.after.chain_valid}>
              {ledger.verdict}
            </Verdict>
            {/* Stating the limit is the difference between a demo and a claim. */}
            <Note tone="brand" icon={Icon.bang()}>
              <b>{t('The honest limit.', 'ईमानदार सीमा।')}</b> {ledger.caveat}
            </Note>
          </Result>
        )}
      </div>

      {error && <div style={{ marginTop: 16 }}><Note tone="warn">{error}</Note></div>}

      <div className="card card-p col g12" style={{ marginTop: 32 }}>
        <h3>{t('Start over', 'फिर से शुरू करें')}</h3>
        <span className="sub">
          {t('Clears every application, appointment and queue token, and re-seeds the offices. Use it between walkthroughs so the next one does not open on somebody else\'s leftovers.',
            'हर आवेदन, अपॉइंटमेंट और टोकन हटाकर कार्यालय फिर से तैयार करता है। दो प्रदर्शनों के बीच इसका उपयोग करें।')}
        </span>
        <div>
          <button className="btn btn-s btn-sm" disabled={busy === 'reset'} onClick={() => void reset()}>
            {busy === 'reset' ? t('Resetting…', 'रीसेट हो रहा है…') : t('Reset the demo', 'डेमो रीसेट करें')}
          </button>
        </div>
      </div>
    </div>
  );
}
