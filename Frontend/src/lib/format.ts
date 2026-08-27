/** Display helpers for values that arrive from the API as ISO strings. */

import type { Lang } from './language';

/**
 * The locale each language formats dates and numbers in.
 *
 * Hindi gets 'hi-IN', which renders "21 अग॰ 2026" rather than "21 Aug 2026" —
 * a date is user-facing copy like any other, and leaving it English was the
 * most visible thing still in the wrong language on a translated page.
 * Marathi falls back to Hindi rather than English: a Marathi reader is far
 * better served by Devanagari than by Latin.
 */
function localeFor(lang?: Lang): string {
  if (lang === 'hi') return 'hi-IN';
  if (lang === 'mr') return 'mr-IN';
  return 'en-IN';
}

/** "21 Aug 2026" — the form the slip and the tracker print. */
export function formatDay(iso?: string | null, lang?: Lang): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "21 Aug 2026, 4:52 pm" — used on the receipt, where the time matters. */
export function formatDayTime(iso?: string | null, lang?: Lang): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const loc = localeFor(lang);
  const day = d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  return `${day}, ${time}`;
}

/** "4:52 pm" on its own, for the live queue lines. */
export function formatTime(iso?: string | null, lang?: Lang): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(localeFor(lang), { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

/** A wait in minutes, said the way a person would say it. */
export function formatWait(minutes: number, lang?: Lang): string {
  const hi = lang === 'hi' || lang === 'mr';
  if (minutes <= 0) return hi ? 'कोई प्रतीक्षा नहीं — आपकी बारी है' : 'no wait — you are next';
  if (minutes < 60) return hi ? `लगभग ${minutes} मिनट` : `about ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (hi) return m ? `लगभग ${h} घंटे ${m} मिनट` : `लगभग ${h} घंटे`;
  return m ? `about ${h} hr ${m} min` : `about ${h} hr`;
}

/**
 * A day on the booking strip — "Tue 01 Sep", or "मंगल 01 सित॰".
 *
 * The service sends both an ISO date and a ready-made English label. English
 * uses the label as sent, so the strip reads exactly as the service describes
 * it; every other language rebuilds it from the ISO date, because the label was
 * composed server-side and cannot be translated here.
 */
export function formatDayLabel(iso: string, fallback: string, lang?: Lang): string {
  if (!lang || lang === 'en') return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString(localeFor(lang), { weekday: 'short', day: '2-digit', month: 'short' });
}

/**
 * The office queue line.
 *
 * Built from the minute count rather than the sentence the service sends,
 * because that sentence is composed server-side in English and cannot be
 * translated here. Falls back to it only when the number is missing.
 */
export function formatOfficeWait(minutes: number | undefined, fallback: string, lang?: Lang): string {
  if (minutes == null) return fallback;
  if (lang === 'hi') return `पहुँचने के बाद औसत प्रतीक्षा: ${minutes} मिनट`;
  if (lang === 'mr') return `पोहोचल्यावर सरासरी प्रतीक्षा: ${minutes} मिनिटे`;
  return `Avg wait once you arrive: ${minutes} min`;
}
