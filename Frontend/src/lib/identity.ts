import { useEffect, useState } from 'react';
import { clearConversation } from './conversation';

/**
 * Who the browser is currently acting as, as a mobile number.
 *
 * The number is the whole identity, deliberately — it is what the apply wizard
 * already collects, what `applications.citizen_ref` is indexed on, and what
 * `latest_application_for()` looks up. Before this existed the wizard filed
 * under the number typed into stage two while Saarthi invented a throwaway
 * reference every time its panel opened, so the agent could not find the
 * application the citizen had just filled in and neither could the tracker.
 *
 * Kept beside the journey in localStorage rather than in a cookie: there is no
 * server session to pair one with, and pretending otherwise would be the kind
 * of security theatre this build has avoided everywhere else. See
 * Backend/app/identity.py — nothing here is authentication.
 */
const KEY = 'parivahan.identity';

const listeners = new Set<(phone: string | null) => void>();
let current: string | null = read();

function read(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw && /^[6-9]\d{9}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function signedInPhone(): string | null {
  return current;
}

export function signIn(phone: string): void {
  current = phone;
  try { localStorage.setItem(KEY, phone); } catch { /* private browsing */ }
  for (const listener of listeners) listener(current);
}

export function signOut(): void {
  current = null;
  try { localStorage.removeItem(KEY); } catch { /* nothing stored */ }
  // The transcript belongs to whoever was signed in. Left behind, the next
  // person to open Saarthi on this device reads the last one's conversation —
  // including their name and date of birth, said out loud in it.
  clearConversation();
  for (const listener of listeners) listener(current);
}

/** Reads as `98200 11021`, which is how the number is said and checked. */
export function prettyPhone(phone: string): string {
  return `${phone.slice(0, 5)} ${phone.slice(5)}`;
}

/** Subscribe a component to the current identity. */
export function useIdentity(): string | null {
  const [phone, setPhone] = useState<string | null>(current);
  useEffect(() => {
    listeners.add(setPhone);
    // Another tab may have signed in or out since this mounted.
    setPhone(current);
    return () => { listeners.delete(setPhone); };
  }, []);
  return phone;
}
