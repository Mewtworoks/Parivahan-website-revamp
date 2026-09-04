/**
 * Saarthi's transcript, kept outside the panel that renders it.
 *
 * Closing the panel used to throw the conversation away: the component
 * unmounted, its state went with it, and the server session was ended on the
 * way out. So someone who closed Saarthi to look at the screen behind it — the
 * exact thing it keeps telling them to do — came back to an empty greeting and
 * had to answer every question again.
 *
 * Stored per citizen reference, because the transcript is theirs. Signing out
 * drops it rather than showing the next person what the last one said.
 */
/** A day from `find_slot_days`, offered as a pill under the turn that asked. */
export interface DayOption {
  date: string;
  label: string;
  left: number;
}

/** A time from `find_slots`, offered as a card under the turn that asked. */
export interface SlotOption {
  time: string;
  start: string;
  left: number;
  slot_id: string | null;
}

export interface Turn {
  who: 'citizen' | 'saarthi';
  text: string;
  /** Present only on the saarthi turn that just read these back — real
      results from find_slot_days/find_slots, not decoration. */
  days?: DayOption[];
  slots?: SlotOption[];
}

interface Stored {
  ref: string;
  sessionId: string | null;
  turns: Turn[];
}

const KEY = 'parivahan.conversation';

// A long conversation is not worth unbounded storage, and the model only ever
// sees the server's copy anyway — this is what the citizen reads back.
const MAX_TURNS = 60;

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    return parsed && Array.isArray(parsed.turns) ? parsed : null;
  } catch {
    return null;
  }
}

/** The stored transcript for this citizen, or nothing if it belongs to another. */
export function loadConversation(ref: string): { turns: Turn[]; sessionId: string | null } {
  const stored = read();
  if (!stored || stored.ref !== ref) return { turns: [], sessionId: null };
  return { turns: stored.turns, sessionId: stored.sessionId };
}

export function saveConversation(ref: string, turns: Turn[], sessionId: string | null): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      ref, sessionId, turns: turns.slice(-MAX_TURNS),
    } satisfies Stored));
  } catch { /* private browsing, or full — the panel still works for this visit */ }
}

export function clearConversation(): void {
  try { localStorage.removeItem(KEY); } catch { /* nothing stored */ }
}
