import React, { useState } from 'react';

import * as api from '../api';
import { usePolling } from '../hooks';
import { Badge, Button, Callout, EmptyState, JsonPeek, Panel, Stat } from './ui';
import styles from './RtoBoard.module.scss';

/**
 * The inspector's desk and the waiting-hall display, in one screen. Pressing
 * "Call next" here moves the ETA on the citizen's phone in the Journey tab —
 * that shared number is the whole point.
 */
export default function RtoBoard({ rtoId }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [lastCalled, setLastCalled] = useState({});

  const { data: board, refresh } = usePolling(
    (signal) => api.rtoBoard(rtoId, signal),
    { intervalMs: 2000, deps: [rtoId] },
  );

  const callNext = async (testerId) => {
    setBusy(testerId);
    setError(null);
    try {
      const res = await api.callNext(testerId);
      setLastCalled((m) => ({ ...m, [testerId]: res.now_serving }));
      refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const lanes = board?.lanes ?? [];
  const totalWaiting = lanes.reduce((n, l) => n + l.waiting, 0);

  return (
    <div className={styles.wrap}>
      {error && (
        <Callout tone="danger" title={`${error.status || ''} error`.trim()}>
          {error.detail || error.message}
        </Callout>
      )}

      <Panel
        title="RTO desk · live"
        subtitle="Left: what the inspector clicks. Right: what the hall screen shows. One source of truth, refreshed every 2 seconds."
        action={<Badge tone={totalWaiting ? 'warning' : 'neutral'}>{totalWaiting} waiting</Badge>}
      >
        {lanes.length === 0 ? (
          <EmptyState>
            No lanes yet — check someone in from the Journey tab first.
          </EmptyState>
        ) : (
          <div className={styles.lanes}>
            {lanes.map((lane) => (
              <div key={lane.tester_id} className={styles.lane}>
                <header className={styles.laneHead}>
                  <div>
                    <h4 className={styles.laneName}>{lane.tester}</h4>
                    <span className={styles.laneMeta}>
                      {lane.avg_test_minutes} min average per test
                    </span>
                  </div>
                  <Badge tone={lane.waiting ? 'warning' : 'neutral'}>
                    {lane.waiting} in queue
                  </Badge>
                </header>

                <div className={styles.serving}>
                  <span className={styles.servingLabel}>Now serving</span>
                  <span className={styles.servingNumber}>
                    {lane.now_serving !== null ? `#${lane.now_serving}` : '—'}
                  </span>
                </div>

                <div className={styles.upNext}>
                  <span className={styles.upNextLabel}>Up next</span>
                  {lane.next_numbers.length === 0 ? (
                    <span className={styles.upNextEmpty}>queue is clear</span>
                  ) : (
                    <div className={styles.chips}>
                      {lane.next_numbers.map((n, i) => (
                        <span
                          key={n}
                          className={`${styles.chip} ${i === 0 ? styles.chipNext : ''}`}
                        >
                          #{n}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => callNext(lane.tester_id)}
                  loading={busy === lane.tester_id}
                  disabled={lane.waiting === 0 && lane.now_serving === null}
                >
                  Call next
                </Button>

                {lastCalled[lane.tester_id] != null && (
                  <span className={styles.laneNote}>
                    last call put #{lastCalled[lane.tester_id]} in the test
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <Callout tone="info" title="Why this matters">
          The current system has no shared number at all — you stand in a corridor and guess.
          Every press here recomputes every waiting citizen's ETA from the inspector's own
          average, and they see it on their phone without asking anyone.
        </Callout>

        <JsonPeek label="GET /rto/{id}/board — raw response" data={board} />
      </Panel>

      <div className={styles.hall}>
        <span className={styles.hallTitle}>Waiting hall display</span>
        <div className={styles.hallGrid}>
          {lanes.map((lane) => (
            <div key={lane.tester_id} className={styles.hallLane}>
              <span className={styles.hallTester}>{lane.tester}</span>
              <span className={styles.hallNumber}>
                {lane.now_serving !== null ? lane.now_serving : '--'}
              </span>
              <span className={styles.hallWaiting}>{lane.waiting} waiting</span>
            </div>
          ))}
          {lanes.length === 0 && <span className={styles.hallIdle}>RTO idle</span>}
        </div>
      </div>

      <div className={styles.statRow}>
        <Stat label="RTO" value={board?.rto_id ?? rtoId} />
        <Stat label="Lanes open" value={lanes.length} />
        <Stat
          label="Total waiting"
          value={totalWaiting}
          tone={totalWaiting > 3 ? 'danger' : 'success'}
        />
      </div>
    </div>
  );
}
