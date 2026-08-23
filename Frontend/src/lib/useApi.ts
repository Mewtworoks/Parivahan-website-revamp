import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Load something from the API once (and again when `deps` change).
 * Aborts in flight on unmount so StrictMode's double-mount doesn't leave a
 * stray request behind.
 */
export function useApi<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
  enabled = true,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(enabled);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    if (!enabled) { setLoading(false); return undefined; }
    const controller = new AbortController();
    let alive = true;
    setLoading(true);
    loaderRef.current(controller.signal)
      .then(res => { if (alive) { setData(res); setError(null); } })
      .catch(err => { if (alive && err.name !== 'AbortError') setError(err as Error); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...deps]);

  return { data, error, loading, reload };
}

/**
 * Same, but repeats on an interval — this is the "live" in the live queue and
 * in the office load figures. Set `enabled` false to stop polling entirely.
 */
export function usePolling<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  { intervalMs = 3000, enabled = true, deps = [] as unknown[] } = {},
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const run = async () => {
      try {
        const res = await loaderRef.current(controller.signal);
        if (alive) { setData(res); setError(null); }
      } catch (err) {
        if (alive && (err as Error).name !== 'AbortError') setError(err as Error);
      } finally {
        if (alive && intervalMs > 0) timer = setTimeout(run, intervalMs);
      }
    };
    run();
    return () => { alive = false; clearTimeout(timer); controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, nonce, ...deps]);

  return { data, error, refresh };
}

/**
 * Wraps a one-shot action (submit, book, check in) with pending + error state,
 * so a page never has to hand-roll three useStates for one button.
 */
export function useAction() {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(async <T,>(key: string, fn: () => Promise<T>): Promise<T | null> => {
    setPending(key);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setPending(null);
    }
  }, []);

  return { pending, error, setError, run };
}
