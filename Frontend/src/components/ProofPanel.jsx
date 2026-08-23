import React, { useState } from 'react';

import * as api from '../api';
import { Badge, Button, Callout, JsonPeek, Mono, Panel, Stat } from './ui';
import styles from './ProofPanel.module.scss';

const RETRIES = 50;
const RACERS = 40;

/**
 * Runs the two guarantees as live experiments from the browser. Nothing here
 * is pre-recorded: it fires real requests at the real server and counts what
 * came back.
 */
export default function ProofPanel({ rtoId }) {
  const [storm, setStorm] = useState(null);
  const [race, setRace] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const runRetryStorm = async () => {
    setBusy('storm');
    setError(null);
    setStorm(null);
    const key = `storm:${Date.now().toString(36)}`;
    const t0 = performance.now();
    try {
      const results = await Promise.all(
        Array.from({ length: RETRIES }, () =>
          api.apply({
            citizenRef: 'cit_retry_storm',
            licenceKind: 'learner',
            rtoId,
            idempotencyKey: key,
          }),
        ),
      );
      const ids = new Set(results.map((r) => r.application_id));
      setStorm({
        sent: RETRIES,
        distinct: ids.size,
        applicationId: [...ids][0],
        ms: Math.round(performance.now() - t0),
        key,
      });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const runSlotRace = async () => {
    setBusy('race');
    setError(null);
    setRace(null);
    const stamp = Date.now().toString(36);
    try {
      // A fresh slot, so the race is decided by the race and nothing else.
      const { slots } = await api.listSlots(rtoId);
      if (!slots.length) throw new api.ApiError(0, 'No free slots left to race for');
      const target = slots[0];

      // 40 separate applicants, each with their own idempotency key.
      const apps = await Promise.all(
        Array.from({ length: RACERS }, (_, i) =>
          api.apply({
            citizenRef: `cit_race_${stamp}_${i}`,
            licenceKind: 'learner',
            rtoId,
            idempotencyKey: `race:${stamp}:${i}`,
          }),
        ),
      );

      const t0 = performance.now();
      const outcomes = await Promise.all(
        apps.map((a) => api.tryBookSlot(a.application_id, target.slot_id)),
      );
      const won = outcomes.filter((o) => o.ok);
      const lost = outcomes.filter((o) => !o.ok);

      setRace({
        racers: RACERS,
        winners: won.length,
        rejected: lost.length,
        slot: `${target.start} · ${target.tester_id}`,
        rejectionReason: lost[0]?.detail,
        rejectionStatus: lost[0]?.status,
        ms: Math.round(performance.now() - t0),
        winningBooking: won[0]?.data,
      });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const stormPass = storm && storm.distinct === 1;
  const racePass = race && race.winners === 1 && race.rejected === RACERS - 1;

  return (
    <div className={styles.wrap}>
      <Callout tone="info" title="Read this before you press anything">
        These two buttons fire real traffic at the running backend and count the responses.
        The claim is not "it feels fast" — it is a specific number, and you are about to
        watch it be produced.
      </Callout>

      {error && (
        <Callout tone="danger" title={`${error.status || ''} error`.trim()}>
          {error.detail || error.message}
        </Callout>
      )}

      {/* ------------------------------------------------- the retry storm */}
      <Panel
        title="Guarantee 1 · The retry storm"
        subtitle="A submit on a bad network, tapped again and again. On the current portal that is how you end up with duplicate applications and a blank status page. Here every retry collapses onto the first one."
        action={
          storm && (
            <Badge tone={stormPass ? 'success' : 'danger'}>
              {stormPass ? 'guarantee holds' : 'GUARANTEE BROKEN'}
            </Badge>
          )
        }
      >
        <Button onClick={runRetryStorm} loading={busy === 'storm'}>
          Fire {RETRIES} identical submits
        </Button>

        {storm && (
          <>
            <div className={styles.stats}>
              <Stat label="Submits sent" value={storm.sent} hint={`in ${storm.ms} ms`} />
              <Stat
                label="Applications created"
                value={storm.distinct}
                tone={stormPass ? 'success' : 'danger'}
                hint={stormPass ? 'exactly one, as promised' : 'duplicates leaked through'}
              />
              <Stat
                label="The one application"
                value={<Mono truncate={13}>{storm.applicationId}</Mono>}
              />
            </div>
            <Callout tone={stormPass ? 'success' : 'danger'}>
              {storm.sent} requests carrying the idempotency key <Mono>{storm.key}</Mono> produced{' '}
              <strong>{storm.distinct}</strong> application
              {storm.distinct === 1 ? '' : 's'}. The write happens once; every later arrival is
              handed the result of the first.
            </Callout>
            <JsonPeek label="counted result" data={storm} />
          </>
        )}
      </Panel>

      {/* --------------------------------------------------- the slot race */}
      <Panel
        title="Guarantee 2 · Two people, one appointment"
        subtitle="The failure this replaces: four people are told 10:15, three of them find out on arrival. One slot must have exactly one owner, decided at the moment of booking."
        action={
          race && (
            <Badge tone={racePass ? 'success' : 'danger'}>
              {racePass ? 'guarantee holds' : 'DOUBLE BOOKING'}
            </Badge>
          )
        }
      >
        <Button variant="accent" onClick={runSlotRace} loading={busy === 'race'}>
          Send {RACERS} applicants at one slot
        </Button>

        {race && (
          <>
            <div className={styles.stats}>
              <Stat label="Applicants racing" value={race.racers} hint={`resolved in ${race.ms} ms`} />
              <Stat
                label="Got the slot"
                value={race.winners}
                tone={race.winners === 1 ? 'success' : 'danger'}
              />
              <Stat
                label="Told to pick another"
                value={race.rejected}
                tone="accent"
                hint={`HTTP ${race.rejectionStatus}, instantly`}
              />
              <Stat label="Contested slot" value={race.slot} />
            </div>

            <div className={styles.raceViz}>
              {Array.from({ length: race.racers }).map((_, i) => (
                <span
                  key={i}
                  className={`${styles.racer} ${i === 0 ? styles.racerWon : styles.racerLost}`}
                  title={i === 0 ? 'booked' : race.rejectionReason}
                />
              ))}
            </div>

            <Callout tone={racePass ? 'success' : 'danger'}>
              One booking, {race.rejected} clean rejections — every loser got{' '}
              <Mono>{race.rejectionStatus}</Mono> “{race.rejectionReason}” in the same instant,
              not a wasted trip to the RTO.
            </Callout>

            <Callout tone="warning" title="One honest caveat">
              A browser opens only a handful of connections to one host, so these {race.racers}{' '}
              requests interleave rather than land at literally the same microsecond. For true
              40-thread parallelism run{' '}
              <Mono>python tests/test_concurrency.py</Mono> in the Backend directory — same
              guarantee, no connection limit in the way.
            </Callout>

            <JsonPeek label="counted result" data={race} />
          </>
        )}
      </Panel>

      <Panel tone="dark" title="Why bother proving it">
        <p className={styles.closing}>
          Anyone can put a nicer button on a government portal. The reason this journey breaks
          today is not the button — it is that the writes underneath it are not safe to retry
          and not safe to contend. Those are the two numbers above. Everything else in this
          demo is built on them.
        </p>
      </Panel>
    </div>
  );
}
