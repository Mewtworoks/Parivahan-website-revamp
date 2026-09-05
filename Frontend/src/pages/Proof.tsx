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

type Which = 'idem' | 'race' | 'load' | 'ledger';

/** One measured number, with its name under it rather than beside it. */
function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className="col g4" style={{ minWidth: 92 }}>
      <b className="mono" style={{
        fontSize: '1.3rem', fontFamily: 'var(--disp)',
        color: tone === 'warn' ? 'var(--warn)' : tone === 'ok' ? 'var(--ok)' : undefined,
      }}>{value}</b>
      <span className="tiny">{label}</span>
    </div>
  );
}

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

/**
 * A ledger as rows, with the broken link called out rather than left to be spotted.
 *
 * The tint and the seal colour are both derived from `--warn` rather than from
 * `--warn-soft`, which the warning pills share: this row needs to be legible in
 * a screen recording, and a ten-percent wash was not. Mixing against the token
 * keeps it correct in both themes without a second rule.
 */
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
            <tr key={row.seq} style={row.intact ? undefined : {
              background: 'color-mix(in oklab, var(--warn) 20%, transparent)',
              boxShadow: 'inset 3px 0 0 var(--warn)',
            }}>
              <td className="mono">{row.seq}</td>
              <td>{row.note}</td>
              <td className="mono tiny">{row.hash}…</td>
              <td>{row.intact
                ? <span className="tiny">intact</span>
                : <b className="tiny" style={{ color: 'var(--warn)' }}>broken</b>}</td>
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
  const [load, setLoad] = useState<api.BookingLoadProof | null>(null);
  const [ledger, setLedger] = useState<api.TamperProof | null>(null);

  const run = async <T,>(which: Which | 'reset', call: () => Promise<T>, keep: (v: T) => void) => {
    setBusy(which); setError(null);
    try { keep(await call()); } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not run.');
    } finally { setBusy(null); }
  };

  const reset = () => run('reset', api.resetDemo, () => {
    setIdem(null); setRace(null); setLoad(null); setLedger(null);
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

      {/* 2b — the same guarantee, priced.
          Eight threads prove it can be got right. They do not answer the
          question an office actually has, which is whether it still holds when
          a popular Monday grid opens and a hundred people are already waiting
          on it. The counts below are read back off the rows afterwards, not
          reported by the threads about themselves. */}
      <div className="card card-p col g14" style={{ marginTop: 20 }}>
        <div className="row between g12 wrapf">
          <div className="col g4">
            <h3>{t('A hundred and twenty people, eighteen slots', 'एक सौ बीस लोग, अठारह स्लॉट')}</h3>
            <span className="sub">
              {t('The morning a popular office opens its grid. Every slot must sell, each to exactly one person, and everybody who missed must be told — not left holding an appointment the inspector has never heard of.',
                'जिस सुबह कोई व्यस्त कार्यालय अपनी स्लॉट सूची खोलता है। हर स्लॉट बिकना चाहिए, हर एक ठीक एक व्यक्ति को, और जिन्हें नहीं मिला उन्हें बताया जाना चाहिए — न कि ऐसा अपॉइंटमेंट थमा दिया जाए जिसके बारे में निरीक्षक ने कभी सुना ही नहीं।')}
            </span>
          </div>
          <button className="btn btn-p btn-sm" disabled={busy === 'load'}
            onClick={() => run('load', () => api.proveBookingLoad(120), setLoad)}>
            {busy === 'load' ? t('Running…', 'चल रहा है…') : t('Open the grid', 'सूची खोलें')}
          </button>
        </div>
        {load && !load.error && (
          <Result>
            <div className="row g20 wrapf" style={{ rowGap: 16 }}>
              <Stat label={t('pressed at once', 'एक साथ दबाया')} value={String(load.applicants)} />
              <Stat label={t('slots sold', 'स्लॉट बिके')} value={`${load.slots_sold}/${load.slots_offered}`} tone="ok" />
              <Stat label={t('double-booked', 'दोहरी बुकिंग')} value={String(load.double_booked)}
                tone={load.double_booked ? 'warn' : 'ok'} />
              <Stat label={t('lost writes', 'खोए राइट')} value={String(load.lost_writes)}
                tone={load.lost_writes ? 'warn' : 'ok'} />
              <Stat label={t('refused cleanly', 'साफ़ मना')} value={String(load.rejected)} />
            </div>
            <div className="row g20 wrapf" style={{ rowGap: 16 }}>
              <Stat label={t('median', 'माध्यिका')} value={`${load.p50_ms} ms`} />
              <Stat label="p95" value={`${load.p95_ms} ms`} />
              <Stat label="p99" value={`${load.p99_ms} ms`} />
              <Stat label={t('bookings per second', 'प्रति सेकंड बुकिंग')}
                value={load.throughput_per_s ? String(load.throughput_per_s) : '—'} />
            </div>
            {/* Said plainly rather than buried: the write queue is the honest
                cost of the guarantee, and a p99 in the seconds is what serialised
                writes look like under a rush. Hiding it would make the number
                marketing. */}
            <span className="tiny">
              {t('Latency includes the wait for the write lock. Bookings are serialised on purpose — that queue is the guarantee, and its cost is the number above.',
                'विलंब में राइट लॉक की प्रतीक्षा भी शामिल है। बुकिंग जान-बूझकर एक-एक करके होती है — वही कतार यह गारंटी है, और ऊपर का आँकड़ा उसकी कीमत है।')}
            </span>
            <Verdict ok={load.double_booked === 0 && load.lost_writes === 0 && load.errors === 0}>
              {load.verdict}
            </Verdict>
          </Result>
        )}
        {load?.error && <Note tone="warn">{load.error}</Note>}
      </div>

      {/* 3 — the ledger */}
      <div className="card card-p col g14" style={{ marginTop: 20 }}>
        <div className="row between g12 wrapf">
          <div className="col g4">
            <h3>{t('Rewrite a record', 'रिकॉर्ड बदलें')}</h3>
            <span className="sub">
              {/* Not "something with database access". The demonstration alters a
                  recorded event and shows the receipt refusing it; it does not
                  issue an UPDATE, and a card that says otherwise is describing a
                  stronger demonstration than the one the button runs. */}
              {t('Something rewrites a step after it was already recorded. A record that can be edited afterwards is one nobody can rely on — the applicant, and equally the office that wrote it. Watch the change announce itself.',
                'दर्ज हो चुके किसी चरण को कोई बाद में बदल देता है। जो रिकॉर्ड बाद में बदला जा सके, उस पर कोई भरोसा नहीं कर सकता — न आवेदक, न वह कार्यालय जिसने उसे लिखा। देखिए कि बदलाव खुद ही सामने आ जाता है।')}
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
              {t('The honest limit.', 'ईमानदार सीमा।')} {ledger.caveat}
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
