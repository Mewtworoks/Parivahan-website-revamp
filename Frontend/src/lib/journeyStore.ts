import type { AppState } from '../types';

/**
 * Keeps the citizen's half-finished application across a page reload.
 *
 * Three places on the site promised this and none of them delivered it: a green
 * "Saved a moment ago" pill on every step of the form, "Saved after every step"
 * printed under it, and a home-page claim that you could stop halfway and come
 * back. All of that sat on top of plain React state, which a refresh threw away
 * — so the person most likely to read the promise, someone on a phone with a
 * connection that dropped, was the person it failed.
 *
 * Making it true was cheaper than removing it. The server side of the journey
 * was already durable; this is the browser catching up.
 *
 * What this is not: a cross-device resume. There is no account here, so nothing
 * follows you to another phone until the application is submitted and can be
 * looked up by its number and date of birth. The home-page copy now says that
 * rather than the other thing.
 */
const KEY = 'parivahan.journey';

export function loadJourney(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    // A stored shape from an older build is dropped rather than half-trusted:
    // a form resumed into fields that no longer exist is worse than a fresh one.
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as AppState)
      : {};
  } catch {
    // Private browsing, disabled storage, or a truncated write. Starting clean
    // is a working form; throwing here is a blank page.
    return {};
  }
}

export function saveJourney(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota or private browsing. The application still works for this visit —
    // it just will not survive a reload, which is where it started.
  }
}

export function clearJourney(): void {
  try {
    localStorage.removeItem(KEY);
  } catch { /* nothing stored, nothing to clear */ }
}
