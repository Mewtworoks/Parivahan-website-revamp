/** Display helpers for values that arrive from the API as ISO strings. */

/** "21 Aug 2026" — the form the slip and the tracker print. */
export function formatDay(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "21 Aug 2026, 4:52 pm" — used on the receipt, where the time matters. */
export function formatDayTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  return `${day}, ${time}`;
}

/** "4:52 pm" on its own, for the live queue lines. */
export function formatTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

/** A wait in minutes, said the way a person would say it. */
export function formatWait(minutes: number): string {
  if (minutes <= 0) return 'no wait — you are next';
  if (minutes < 60) return `about ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `about ${h} hr ${m} min` : `about ${h} hr`;
}
