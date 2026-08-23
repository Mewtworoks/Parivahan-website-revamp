import React, { useCallback, useEffect, useMemo, useState } from 'react';

import * as api from '../api';
import { usePolling } from '../hooks';
import {
  Badge, Button, Callout, EmptyState, Field, JsonPeek, Mono, Panel, Stat, StepRail,
} from './ui';
import styles from './JourneyFlow.module.scss';

const STEPS = ['Apply', 'Book a slot', 'Check in', 'Live queue', 'Receipt'];

const STATUS_TONE = {
  submitted: 'info',
  verified: 'brand',
  slot_booked: 'brand',
  checked_in: 'warning',
  completed: 'success',
  rejected: 'danger',
};

let runCounter = 0;
const newRunId = () => `web${Date.now().toString(36)}${runCounter++}`;

export default function JourneyFlow({ rtoId }) {
  const [citizenRef, setCitizenRef] = useState('cit_demo');
  const [licenceKind, setLicenceKind] = useState('learner');
  const [runId, setRunId] = useState(newRunId);

  const [application, setApplication] = useState(null);
  const [applyCount, setApplyCount] = useState(0);
  const [booking, setBooking] = useState(null);
  const [token, setToken] = useState(null);
  const [receipt, setReceipt] = useState(null);

  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const idempotencyKey = `${citizenRef}:${runId}`;

  // Slots refresh on a slow poll so a slot taken in another tab disappears here.
  const { data: slotData, refresh: refreshSlots } = usePolling(
    (signal) => api.listSlots(rtoId, signal),
    { intervalMs: 15000, deps: [rtoId] },
  );

  // The live part: position and ETA, repolled while we hold a token.
  const { data: queue } = usePolling(
    (signal) => api.queueStatus(token.token_id, signal),
    { intervalMs: 2500, enabled: Boolean(token), deps: [token?.token_id] },
  );

  const step = useMemo(() => {
    if (receipt) return 4;
    if (token) return 3;
    if (booking) return 2;
    if (application) return 1;
    return 0;
  }, [application, booking, token, receipt]);

  const run = useCallback(async (name, fn) => {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      return await fn();
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setBusy(null);
    }
  }, []);

  const doApply = () =>
    run('apply', async () => {
      const res = await api.apply({ citizenRef, licenceKind, rtoId, idempotencyKey });
      const isRetry = applyCount > 0;
      const sameId = application && application.application_id === res.application_id;
      setApplication(res);
      setApplyCount((c) => c + 1);
      if (isRetry) {
        setNotice(
          sameId
            ? `Submitted ${applyCount + 1} times now — still one application, id unchanged.`
            : 'A different application came back — that would be the bug we fixed.',
        );
      }
      return res;
    });

  const doBook = (slotId) =>
    run(`book:${slotId}`, async () => {
      const res = await api.bookSlot(application.application_id, slotId);
      setBooking(res);
      refreshSlots();
      return res;
    });

  const doCheckIn = () =>
    run('checkin', async () => {
      const res = await api.checkIn(application.application_id);
      setToken(res);
      return res;
    });

  const doCheckInAgain = () =>
    run('checkin2', async () => {
      const res = await api.checkIn(application.application_id);
      setNotice(
        res.token_id === token.token_id
          ? `Checked in twice — still token #${res.token_number}. No number burned, queue not pushed out.`
          : 'A second token was issued — that would be the bug.',
      );
      return res;
    });

  const doReceipt = () =>
    run('receipt', async () => {
      const res = await api.getReceipt(application.application_id);
      setReceipt(res);
      return res;
    });

  const reset = () => {
    setRunId(newRunId());
    setApplication(null);
    setApplyCount(0);
    setBooking(null);
    setToken(null);
    setReceipt(null);
    setError(null);
    setNotice(null);
    refreshSlots();
  };

  // Keep the ledger fresh as the journey advances, so the receipt is never stale.
  useEffect(() => {
    if (receipt && application) {
      api.getReceipt(application.application_id).then(setReceipt).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking, token, queue?.status]);

  const slots = slotData?.slots ?? [];

  return (
    <div className={styles.wrap}>
      <StepRail steps={STEPS} current={step} />

      {error && (
        <Callout tone="danger" title={`${error.status || ''} ${error.name}`.trim()}>
          {error.detail || error.message}
          {error.status === 0 && (
            <>
              {' '}Start it with <Mono>cd Backend &amp;&amp; python main.py</Mono>.
            </>
          )}
        </Callout>
      )}
      {notice && <Callout tone="success">{notice}</Callout>}

      {/* ------------------------------------------------------ 1. apply */}
      <Panel
        title="1 · Apply — and hammer the button"
        subtitle="On the real portal a flaky network plus an impatient tap makes duplicate applications and no readable status. Here, retries collapse into one."
        action={application && <Badge tone={STATUS_TONE[application.status]}>{application.status}</Badge>}
      >
        <div className={styles.row}>
          <Field label="Citizen reference" hint="synthetic id — no real Aadhaar anywhere">
            <input
              value={citizenRef}
              onChange={(e) => setCitizenRef(e.target.value)}
              disabled={Boolean(application)}
            />
          </Field>
          <Field label="Licence">
            <select
              value={licenceKind}
              onChange={(e) => setLicenceKind(e.target.value)}
              disabled={Boolean(application)}
            >
              <option value="learner">Learner (LL)</option>
              <option value="permanent">Permanent (DL)</option>
            </select>
          </Field>
          <Field label="Idempotency key" hint="client-generated; this is what makes retries safe">
            <input value={idempotencyKey} readOnly />
          </Field>
        </div>

        <div className={styles.actions}>
          {!application ? (
            <Button onClick={doApply} loading={busy === 'apply'}>Submit application</Button>
          ) : (
            <>
              <Button variant="accent" onClick={doApply} loading={busy === 'apply'}>
                Submit again (simulate a retry)
              </Button>
              <Button variant="ghost" onClick={reset}>Start a fresh journey</Button>
            </>
          )}
        </div>

        {application && (
          <>
            <div className={styles.stats}>
              <Stat label="Application id" value={<Mono truncate={13}>{application.application_id}</Mono>} />
              <Stat label="Times submitted" value={applyCount} hint="every one of them returned the id on the left" tone="accent" />
              <Stat label="Applications created" value="1" tone="success" hint="never a duplicate" />
            </div>
            <JsonPeek label="POST /apply — raw response" data={application} />
          </>
        )}
      </Panel>

      {/* ------------------------------------------------------- 2. book */}
      {application && (
        <Panel
          title="2 · Pick a fixed time slot"
          subtitle='Not "come in the morning". A real 15-minute appointment, and the slot goes to exactly one person.'
          action={<Badge tone="neutral">{slotData?.count ?? '—'} free today</Badge>}
        >
          {booking ? (
            <Callout tone="success" title={`Booked ${booking.start} on ${booking.date}`}>
              Inspector <Mono>{booking.tester_id}</Mono> · booking <Mono truncate={13}>{booking.booking_id}</Mono>
              <div className={styles.subActions}>
                <Button
                  variant="secondary"
                  onClick={() =>
                    run('rebook', async () => {
                      const res = await api.tryBookSlot(application.application_id, booking.slot_id);
                      setNotice(
                        res.ok
                          ? 'It booked twice — that would be the bug.'
                          : `Backend refused it: ${res.status} — ${res.detail}`,
                      );
                    })
                  }
                  loading={busy === 'rebook'}
                >
                  Try to book it a second time
                </Button>
              </div>
            </Callout>
          ) : slots.length === 0 ? (
            <EmptyState>No free slots returned for {rtoId}.</EmptyState>
          ) : (
            <div className={styles.slotGrid}>
              {slots.slice(0, 24).map((s) => (
                <button
                  key={s.slot_id}
                  className={styles.slot}
                  onClick={() => doBook(s.slot_id)}
                  disabled={busy?.startsWith('book')}
                >
                  <span className={styles.slotTime}>{s.start}</span>
                  <span className={styles.slotTester}>{s.tester_id.replace(`${rtoId}_`, '')}</span>
                </button>
              ))}
            </div>
          )}
          <JsonPeek label="GET /slots — raw response" data={slotData} />
        </Panel>
      )}

      {/* --------------------------------------------------- 3+4. queue */}
      {booking && (
        <Panel
          title="3 · Arrive and check in"
          subtitle="From here the wait stops being a mystery: a token, a named inspector, and a number that moves."
        >
          {!token ? (
            <Button onClick={doCheckIn} loading={busy === 'checkin'}>
              I have arrived at the RTO
            </Button>
          ) : (
            <>
              <div className={styles.stats}>
                <Stat label="Your token" value={`#${queue?.token_number ?? token.token_number}`} />
                <Stat label="Inspector" value={queue?.tester ?? '—'} />
                <Stat
                  label="People ahead"
                  value={queue?.people_ahead ?? '—'}
                  hint={queue?.someone_in_test ? 'one is mid-test' : 'nobody mid-test'}
                />
                <Stat
                  label="Estimated wait"
                  value={queue ? `${queue.eta_minutes} min` : '—'}
                  tone={queue?.eta_minutes === 0 ? 'success' : 'accent'}
                  hint="recomputed every 2.5s"
                />
              </div>
              <div className={styles.actions}>
                <Badge tone={queue?.status === 'in_test' ? 'warning' : 'info'}>
                  {queue?.status ?? token.status ?? 'waiting'}
                </Badge>
                <Button variant="ghost" onClick={doCheckInAgain} loading={busy === 'checkin2'}>
                  Check in again (double tap)
                </Button>
              </div>
              <Callout tone="info">
                Open the <strong>RTO desk</strong> tab and press <em>Call next</em> — this number
                changes here, live, without a reload. Same truth on the phone and on the wall.
              </Callout>
              <JsonPeek label="GET /queue/{token_id} — raw response" data={queue} />
            </>
          )}
        </Panel>
      )}

      {/* ----------------------------------------------------- 5. receipt */}
      {token && (
        <Panel
          title="5 · The tamper-evident receipt"
          subtitle="Every step is a sealed row carrying the fingerprint of the row before it. Edit any of them and the seal stops matching."
          action={
            receipt && (
              <Badge tone={receipt.chain_valid ? 'success' : 'danger'}>
                chain_valid: {String(receipt.chain_valid)}
              </Badge>
            )
          }
        >
          {!receipt ? (
            <Button onClick={doReceipt} loading={busy === 'receipt'}>
              Show my proof-of-journey
            </Button>
          ) : (
            <>
              <ol className={styles.ledger}>
                {receipt.events.map((ev) => (
                  <li key={ev.seq} className={styles.ledgerRow}>
                    <span className={styles.ledgerSeq}>{ev.seq}</span>
                    <div className={styles.ledgerBody}>
                      <div className={styles.ledgerTop}>
                        <Badge tone={STATUS_TONE[ev.status] || 'neutral'}>{ev.status}</Badge>
                        <span className={styles.ledgerTime}>
                          {new Date(ev.at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className={styles.ledgerNote}>{ev.note}</p>
                      <Mono>{ev.hash}</Mono>
                    </div>
                  </li>
                ))}
              </ol>
              <Callout tone={receipt.chain_valid ? 'success' : 'danger'}>
                Chain head <Mono truncate={24}>{receipt.chain_head}</Mono> — this is the value the
                citizen keeps. Rewrite the history behind the API and it no longer matches what is
                in their hand.
              </Callout>
              <div className={styles.actions}>
                <Button variant="secondary" onClick={doReceipt} loading={busy === 'receipt'}>
                  Re-verify the chain
                </Button>
              </div>
              <JsonPeek label="GET /application/{id}/receipt — raw response" data={receipt} />
            </>
          )}
        </Panel>
      )}
    </div>
  );
}
