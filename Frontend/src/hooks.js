import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Poll an async function on an interval. Used for the queue view and the RTO
 * board — the "live" in live queue. Aborts in flight on unmount so React's
 * StrictMode double-mount does not leave a stray request behind.
 */
export function usePolling(fn, { intervalMs = 3000, enabled = true, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) return undefined;

    const controller = new AbortController();
    let timer;
    let alive = true;

    const run = async () => {
      setLoading(true);
      try {
        const result = await fnRef.current(controller.signal);
        if (alive) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (alive && err.name !== 'AbortError') setError(err);
      } finally {
        if (alive) setLoading(false);
        if (alive && intervalMs > 0) timer = setTimeout(run, intervalMs);
      }
    };

    run();
    return () => {
      alive = false;
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, tick, ...deps]);

  return { data, error, loading, refresh };
}

/** Elapsed seconds since `startedAt`, ticking. Times the scenario answers. */
export function useElapsed(startedAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [startedAt]);
  return startedAt ? (now - startedAt) / 1000 : 0;
}
