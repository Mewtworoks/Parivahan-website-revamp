import { useEffect, useRef, useState } from 'react';
import * as api from '../api';
import { demoForm } from '../data/demoApplicant';
import { STEPS } from '../data/applicationFlow';
import { CLASSES } from '../data/vehicleClasses';
import { loadConversation, saveConversation, type DayOption, type SlotOption, type Turn } from '../lib/conversation';
import { useIdentity } from '../lib/identity';
import { useLanguage, useT, type Lang } from '../lib/language';
import type { AppState, ApplicationForm, Route } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Sheet } from '../ui/SharedUI';
import { toast } from '../ui/Toast';

/**
 * The recogniser and the speech synthesiser both want a BCP-47 tag, and getting
 * it wrong is not a degraded experience but a broken one: hi-IN handed an
 * English sentence returns Devanagari nonsense, so the citizen's question
 * reaches Saarthi as words they never said.
 */
// Saarthi's voice — recognition and synthesis — speaks Hindi and English only.
// The site's own UI can still be read in Marathi; a citizen on the Marathi
// interface who talks to Saarthi is heard and answered in Hindi instead of
// asking the browser for an mr-IN voice that is rare enough to not exist on
// most machines.
const SPEECH_LOCALE: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'hi-IN' };

// Turn now lives in lib/conversation.ts, because the transcript outlives this
// component — it is stored there and read back when the panel reopens.

interface VoiceAgentProps {
  state: AppState;
  update: (patch: Partial<AppState>) => void;
  go: (route: Route) => void;
  /** Steps aside and opens the site's single sign-in sheet. */
  onSignIn: () => void;
  onClose: () => void;
}

/** "Anita Shubhangi Kulkarni" -> first / mid / last, as the form stores it. */
function splitName(full: string): { first?: string; mid?: string; last?: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return {};
  if (parts.length === 1) return { first: parts[0] };
  // Indexed rather than .at(-1): the project's tsconfig targets a lib older
  // than es2022, where Array.prototype.at does not exist.
  return {
    first: parts[0],
    mid: parts.slice(1, -1).join(' ') || undefined,
    last: parts[parts.length - 1],
  };
}

/**
 * The vehicle classes out of a prefill, or null if none of them are real.
 *
 * `form.classes` holds CLASSES **ids**, and five screens look an id up and take
 * `.code` off the result without checking it came back — so an id that is not
 * in the table is a TypeError during render, which is a blank page rather than
 * a wrong value. The value arrives from the model's `licence_classes` argument,
 * and the tool schema invites arbitrary strings, so it cannot be trusted the
 * way a value from the wizard's own tiles can.
 *
 * A code is accepted as an alias for its id because the model is shown codes
 * and quite reasonably echoes them: `E-RICKSHAW` is the code whose id is
 * `E-RICK`, the one pair in the table where the two differ, and it was already
 * enough to blank the receipt.
 */
function readClasses(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value
    .map(entry => {
      if (typeof entry !== 'string') return null;
      const wanted = entry.trim().toUpperCase();
      const match = CLASSES.find(c => c.id.toUpperCase() === wanted || c.code.toUpperCase() === wanted);
      return match ? match.id : null;
    })
    .filter((id): id is string => id !== null);
  return ids.length ? Array.from(new Set(ids)) : null;
}

/**
 * Turn what the citizen told Saarthi into the form the wizard reads.
 *
 * The sample applicant underneath supplies the twenty-odd fields nobody would
 * sit through being asked out loud — address, blood group, parentage. What the
 * citizen actually said is written over the top, so the form they open shows
 * their own name and date of birth rather than the fixture's, and the fields
 * that are not theirs are the ones Saarthi is required to say are not theirs.
 */
function formFromPrefill(prefill: Record<string, unknown>): ApplicationForm {
  const state = typeof prefill.state === 'string' && prefill.state ? prefill.state : 'Maharashtra';
  const base = demoForm(state);
  const name = typeof prefill.full_name === 'string' ? splitName(prefill.full_name) : {};
  const classes = readClasses(prefill.classes) ?? base.classes;
  return {
    ...base,
    state,
    rto: typeof prefill.rto === 'string' && prefill.rto ? prefill.rto : base.rto,
    ...(name.first ? { first: name.first, mid: name.mid ?? '', last: name.last ?? '' } : {}),
    ...(typeof prefill.dob === 'string' && prefill.dob ? { dob: prefill.dob } : {}),
    ...(typeof prefill.phone === 'string' && prefill.phone ? { phone: prefill.phone } : {}),
    classes,
  };
}

function canRecogniseSpeech(): boolean {
  return Boolean((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
    || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
}

/**
 * Whether Saarthi reads its replies out.
 *
 * Remembered, because somebody who muted it did so for a reason — a shared
 * office, a quiet room, a screen reader already talking — and having to mute it
 * again on every visit is the service not listening in the other direction.
 */
const MUTE_KEY = 'parivahan.voice.muted';

function storedMute(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

/** Stop mid-sentence. Safe to call when nothing is speaking. */
function hush() {
  try { window.speechSynthesis?.cancel(); } catch { /* no synthesiser here */ }
}

/**
 * Every voice the browser will admit to having.
 *
 * `getVoices()` is populated asynchronously and returns an empty array on the
 * first call in Chrome and Edge \u2014 which is exactly the call that matters here,
 * because Saarthi's opening line is spoken within a second of the panel opening.
 * An empty list means no voice is chosen, which means the platform default, and
 * on Windows the platform default is Microsoft David: the flattest voice on the
 * machine. So the list is cached at module load and refreshed on the event that
 * fires when it finally arrives.
 */
let voices: SpeechSynthesisVoice[] = [];

function refreshVoices() {
  try { voices = window.speechSynthesis?.getVoices() ?? []; } catch { voices = []; }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
}

/**
 * Names that mark a neural voice, and names that mark a formant one.
 *
 * There is no flag for "sounds like a person" \u2014 `localService` is the closest
 * thing, since the good voices are the ones streamed from the vendor, but Chrome
 * reports its own bundled Google voices as remote too and those are also the
 * good ones. So this matches on names. `Natural` and `Online` are Edge's neural
 * range, and the Indian-language names below are its hi-IN and mr-IN pair; the
 * cold list is the decade-old SAPI5 set that ships with Windows and reads a
 * sentence at one pitch from end to end.
 */
const WARM = /natural|neural|online|google|aria|guy|neerja|prabhat|swara|madhur|manohar|aarohi/i;
const COLD = /espeak|festival|compact|desktop|\bdavid\b|\bzira\b|\bmark\b|\bhemant\b|\bkalpana\b|\bheera\b/i;

/**
 * Which locales to try, best first.
 *
 * Devanagari settles the language outright \u2014 read as Hindi, since Saarthi's
 * voice does not offer Marathi at all. Otherwise the reply is English or
 * Hinglish, and both go to the locale the citizen is reading the site in,
 * with Marathi itself mapped to Hindi by `SPEECH_LOCALE` above.
 */
function localeChain(text: string, uiLang: Lang): string[] {
  if (/[\u0900-\u097F]/.test(text)) return ['hi-IN'];
  return [SPEECH_LOCALE[uiLang], 'en-IN'];
}

function pickVoice(locale: string): SpeechSynthesisVoice | undefined {
  if (!voices.length) refreshVoices();
  const base = locale.split('-')[0].toLowerCase();
  const tag = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();
  const scored = voices
    .filter(v => tag(v).startsWith(base))
    .map(v => {
      let score = 0;
      // An exact locale beats a warm voice in the wrong one: en-IN said plainly
      // is closer to how the citizen speaks than en-US said beautifully, and
      // every place name in this service is an Indian one.
      if (tag(v) === locale.toLowerCase()) score += 40;
      if (WARM.test(v.name)) score += 30;
      if (!v.localService) score += 15;
      if (COLD.test(v.name)) score -= 35;
      return { v, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.v;
}

/**
 * Rewrite the bits a synthesiser reads badly.
 *
 * An application number is the worst of them: `DL1420110012345` arrives at the
 * synthesiser as one token and leaves as either a fourteen-digit cardinal number
 * or silence, and it is the one string in the whole conversation somebody is
 * trying to write down. Digits get spaced so they are read out one at a time,
 * the way a person reading a number aloud to somebody with a pen would.
 */
function pronounceable(text: string, uiLang: Lang): string {
  const rupees = uiLang === 'en' ? ' rupees' : ' \u0930\u0941\u092A\u092F\u0947';
  return text
    .replace(/[*_`#]+/g, '')
    .replace(/\u20B9\s?([\d,]+)/g, (_m, n: string) => n + rupees)
    .replace(/\bRTO\b/g, 'R T O')
    .replace(/\b(?=[A-Z0-9-]*\d)([A-Z]{2}[A-Z0-9-]{6,})\b/g, m => m.replace(/-/g, ' ').split('').join(' '))
    .replace(/\d{5,}/g, m => m.split('').join(' '))
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * One utterance per sentence, rather than one per reply.
 *
 * Two reasons. A synthesiser handed a paragraph reads it at a constant clip with
 * no breath in it, and the gap between queued utterances is the pause a person
 * would leave \u2014 so the punctuation starts being audible. And Chrome truncates a
 * single utterance at around fifteen seconds with no error and no `end` event,
 * which for Saarthi meant the last sentence of a long answer \u2014 usually the one
 * naming what to do next \u2014 was the sentence that got cut.
 */
const MAX_CHUNK = 170;

function chunks(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.match(/[^.!?\u0964\n]+[.!?\u0964]*/g) ?? []) {
    let rest = raw.trim();
    if (!rest) continue;
    // A sentence past the cap is split at a comma if there is one deep enough to
    // be a real clause boundary, and at a word break otherwise. Never mid-word:
    // a word cut in half is pronounced as two nonsense words.
    while (rest.length > MAX_CHUNK) {
      const comma = rest.lastIndexOf(',', MAX_CHUNK);
      const space = rest.lastIndexOf(' ', MAX_CHUNK);
      const at = comma > 60 ? comma + 1 : space > 0 ? space : MAX_CHUNK;
      out.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) out.push(rest);
  }
  // Abbreviations leave stubs ("No.", "Rs."), and a two-word utterance lands as
  // a clipped bark with a pause on either side. Fold the tiny ones back.
  const merged: string[] = [];
  for (const c of out) {
    if (c.length < 12 && merged.length) merged[merged.length - 1] += ' ' + c;
    else merged.push(c);
  }
  return merged.length ? merged : [text];
}

/** Read a reply aloud, in the language it was actually written in. */
function speak(text: string, uiLang: Lang) {
  if (!('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();

  const chain = localeChain(text, uiLang);
  let voice: SpeechSynthesisVoice | undefined;
  let locale = chain[0];
  for (const candidate of chain) {
    const found = pickVoice(candidate);
    if (found) { voice = found; locale = candidate; break; }
  }

  // A neural voice already carries its own pacing, and slowing one down is what
  // makes it sound synthetic again. The old 0.95 was compensating for a formant
  // voice, so it stays only where a formant voice is what we got.
  const neural = voice ? WARM.test(voice.name) : false;

  for (const chunk of chunks(pronounceable(text, uiLang))) {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = voice?.lang ?? locale;
    if (voice) utterance.voice = voice;
    utterance.rate = neural ? 1 : 0.94;
    utterance.pitch = neural ? 1 : 1.04;
    synth.speak(utterance);
  }
}

/** Voice facade for Saarthi. The API key remains in FastAPI; this is mic + UI only. */
export function VoiceAgent({ state, update, go, onSignIn, onClose }: VoiceAgentProps) {
  const { lang } = useLanguage();
  const t = useT();
  const phone = useIdentity();
  const [sessionId, setSessionId] = useState<string | null>(() => loadConversation(phone || '').sessionId);
  const sessionRef = useRef<string | null>(loadConversation(phone || '').sessionId);
  // Shown until the service answers with its own opening line. That one is
  // built from the record — an appointment, a filed application, a form left
  // half-answered — and this is only what stands in for it when nobody is
  // signed in yet, or the backend cannot be reached.
  const greeting: Turn = {
    who: 'saarthi',
    text: t('Hello, I am Saarthi. I can tell you the right next step for your licence.',
            'नमस्ते, मैं सारथी हूँ। मैं लाइसेंस के लिए सही अगला कदम बता सकती हूँ।'),
  };
  // Picked up where it was left, not started over. Closing this panel to look
  // at the screen behind it is the thing Saarthi keeps asking people to do.
  const [turns, setTurns] = useState<Turn[]>(
    () => loadConversation(phone || '').turns.length
      ? loadConversation(phone || '').turns
      : [greeting],
  );
  /**
   * The transcript as it stands, and whether this panel is still on screen.
   *
   * Both exist because a reply can outlive the panel that asked for it. The
   * sheet is conditionally rendered, so closing it unmounts the component; an
   * in-flight `voiceTurn` then resolved into a dead component, `setTurns` was a
   * no-op, and the effect that saves the transcript never ran. The answer was
   * lost from the citizen's side while sitting perfectly intact on the server —
   * ask a question, glance at the page behind, and Saarthi had never replied.
   */
  // Seeded from the transcript rather than empty. The effect below syncs it, but
  // an effect runs after the first paint, and an append that landed before it
  // would have built the next transcript on top of nothing — losing the stored
  // conversation and the greeting with it.
  const turnsRef = useRef<Turn[]>(turns);
  const mountedRef = useRef(true);

  const [input, setInput] = useState('');
  const [muted, setMuted] = useState(storedMute);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  /**
   * The live recogniser, or null.
   *
   * Held because Chrome allows exactly one per page: without a handle on the
   * running one there is no way to stop it before starting the next, and
   * `start()` throws rather than queueing.
   */
  const recogniserRef = useRef<any>(null);
  const [working, setWorking] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  /** The answers, waiting for the citizen to say they want to see the form. */
  const [handover, setHandover] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waited, setWaited] = useState(0);
  const log = useRef<HTMLDivElement>(null);

  // A turn takes three to six seconds against the language service. Spent
  // against a line that never changes, that is indistinguishable from a panel
  // that has hung — it was read as broken more than once. Counting up says the
  // wait is being spent rather than lost.
  useEffect(() => {
    if (!working) { setWaited(0); return; }
    const started = Date.now();
    const tick = setInterval(() => setWaited(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(tick);
  }, [working]);

  // `speak()` fires utterances at the synthesiser directly and does not report
  // back, so the status row polls the one thing the browser does expose —
  // whether it is talking right now — rather than threading a callback through
  // a module-level function every caller of `speak` would then have to supply.
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const id = setInterval(() => setSpeaking(window.speechSynthesis.speaking), 200);
    return () => clearInterval(id);
  }, []);

  // The newest line is the whole point of a voice panel, and the transcript is a
  // fixed-height scroller — without this the reply lands below the fold and the
  // citizen has to scroll to find the answer they just asked for.
  useEffect(() => {
    const box = log.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [turns, working, pending]);

  // Closing the panel stops it talking and nothing else. Ending the server
  // session here is what made a close-and-reopen start from nothing — the
  // conversation is ended when the citizen signs out, not when they glance at
  // the page behind it.
  // The microphone goes with it. Closed mid-sentence, the recogniser stayed
  // live on a panel nobody could see — the browser kept showing the recording
  // dot, and reopening met a recogniser Chrome would not let us start a second
  // copy of.
  //
  // `mountedRef` is set true here rather than only at its declaration, and that
  // is load-bearing rather than tidy. StrictMode mounts, unmounts and remounts
  // every component once in development. The cleanup below therefore runs on the
  // first pass and sets the flag false, and a ref initialised once is never set
  // back — so on the mount the citizen actually sees, the component believes it
  // is unmounted. Everything guarded by the flag then goes quiet: `appendTurn`
  // skips `setTurns`, so neither the question nor the reply reaches the screen,
  // and `acceptReply` skips `speak`. The turn completes, the server answers, the
  // transcript is saved, and the panel shows nothing at all.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.speechSynthesis?.cancel();
      try { recogniserRef.current?.abort(); } catch { /* already gone */ }
      recogniserRef.current = null;
    };
  }, []);

  // Every change, so the transcript survives a close, a reopen and a reload.
  useEffect(() => {
    turnsRef.current = turns;
    if (phone) saveConversation(phone, turns, sessionRef.current);
  }, [phone, turns, sessionId]);

  /**
   * Add a line, and write the transcript to storage in the same breath.
   *
   * Not `setTurns` plus the effect above: that effect only runs while the
   * component is mounted, which is exactly the case that was broken. Saving
   * here, from a closure that survives unmount, is what makes a reply arriving
   * after the panel closed still be there when it reopens.
   */
  const appendTurn = (turn: Turn) => {
    const next = [...turnsRef.current, turn];
    turnsRef.current = next;
    if (phone) saveConversation(phone, next, sessionRef.current);
    if (mountedRef.current) setTurns(next);
  };

  // The signed-in number is the reference, so Saarthi reads the same journey the
  // wizard filed and the tracker shows. It used to fall back to
  // `saarthi-demo-<random>` whenever the panel opened cold, which meant the
  // agent could not find an application the citizen had just filled in by hand
  // — the panel and the form were two different people.
  const citizenRef = phone;

  const ensureSession = async () => {
    if (sessionRef.current) return sessionRef.current;
    if (!citizenRef) throw new Error('Sign in first so I know whose application to open.');
    const created = await api.startVoice(citizenRef, lang === 'hi' ? 'hi' : 'en',
                                        state.form?.state, state.form?.rto);
    sessionRef.current = created.session_id;
    setSessionId(created.session_id);
    return created.session_id;
  };

  // Open the conversation as soon as the panel does, rather than on the first
  // question. Two things come back with it and both need to be on screen before
  // the citizen speaks: the session, and an opening line that already knows
  // where they got to — "we were filling your form and I have your name" beats
  // "hello" for somebody who was here an hour ago. It costs one cheap request
  // and no model call, so there is nothing to save by waiting.
  //
  // `lang` is a dependency, but only while nothing has been said yet. The
  // greeting was fetched once and kept: switch the site to Hindi, open Saarthi,
  // and the first line was English above a conversation that then ran entirely
  // in Hindi — the one turn in the exchange that does not follow the citizen,
  // because it is the only one written before they have said anything. Asking
  // again is safe: start_session resumes the same conversation inside its
  // window rather than opening a second one.
  const started = useRef(turns.length > 1);
  started.current = turns.length > 1;
  useEffect(() => {
    if (!phone || started.current) return;
    let dropped = false;
    void (async () => {
      try {
        const created = await api.startVoice(phone, lang === 'hi' ? 'hi' : 'en',
                                            state.form?.state, state.form?.rto);
        if (dropped) return;
        sessionRef.current = created.session_id;
        setSessionId(created.session_id);
        // Only when there is nothing to replace. A transcript already on screen
        // is the citizen's conversation, and dropping a greeting into the
        // middle of it would read as Saarthi starting over.
        setTurns(old => (old.length <= 1 ? [{ who: 'saarthi', text: created.greeting }] : old));
      } catch {
        // The stand-in greeting is already showing, and the first question will
        // report the failure properly. Nothing useful to say here.
      }
    })();
    return () => { dropped = true; };
  }, [phone, lang]);

  const acceptReply = (reply: api.VoiceReply) => {
    // find_slot_days and find_slots are real lookups against the same booking
    // engine the wizard uses, not sample content — the day pills and time
    // cards below read straight off whatever the tool actually returned, so a
    // day showing "0 left" is drawn disabled rather than left off the list.
    let days: DayOption[] | undefined;
    let slots: SlotOption[] | undefined;
    for (const event of reply.tool_events) {
      const result = event.result as Record<string, unknown> | undefined;
      if (!result) continue;
      if (event.tool === 'find_slot_days' && Array.isArray(result.days)) {
        days = result.days as DayOption[];
      }
      if (event.tool === 'find_slots' && Array.isArray(result.slots)) {
        slots = result.slots as SlotOption[];
      }
    }
    appendTurn({ who: 'saarthi', text: reply.reply, days, slots });

    // Every answer is in. Rather than raise a Confirm button here and file from
    // the panel, hand the answers to the wizard and take the confirmation on the
    // review screen. Two reasons. The citizen approves the fields themselves
    // instead of a sentence they heard once — and there is then one way to file
    // an application on this site rather than two, which is the same argument
    // the rest of the build makes about having one write path.
    //
    // Offered, not taken. Being thrown onto another screen mid-conversation is
    // disorienting even when it is the right screen, and somebody who still has
    // a question should be able to ask it. So the answers are held here and the
    // move is a button.
    //
    // The queued action is cancelled now rather than at the button, because it
    // is dead either way: left standing, the next thing said to Saarthi is
    // answered with "press the confirmation button first" for an action the
    // citizen has stopped thinking about.
    // Not offered to somebody who has already applied. "See my form" jumps
    // straight to Review and Submit with the declarations pre-ticked, which is
    // the one door on this site that lands past the gate on the wizard and in
    // front of a live Submit button — so a second application is one press away
    // for exactly the person who must not make one.
    const prefill = state.applicationId ? undefined : reply.pending_confirmation?.form_prefill;
    if (prefill) {
      setHandover(prefill);
      setPending(null);
      if (sessionRef.current) void api.cancelVoiceAction(sessionRef.current).catch(() => {});
    } else {
      setPending(reply.pending_confirmation?.label || null);
    }
    // Only speak if the panel is still open. A reply that arrives after the
    // citizen closed it used to start talking at them from a panel that was no
    // longer on screen.
    if (!muted && mountedRef.current) speak(reply.reply, lang);
    for (const event of reply.tool_events) {
      const result = event.result;
      if (!result) continue;
      if (typeof result.application_id === 'string') {
        // An application made by talking is the same record as one made through
        // the wizard, so put its number where the tracker and receipt read from.
        // Without this the citizen applies by voice and the Track screen is empty.
        const prefill = (result.form_prefill ?? {}) as Record<string, unknown>;
        const form = formFromPrefill(prefill);
        const applicantName = typeof result.applicant_name === 'string' && result.applicant_name
          ? result.applicant_name
          : [form.first, form.mid, form.last].filter(Boolean).join(' ');
        const applicationNo = typeof result.application_no === 'string' ? result.application_no : '';
        update({
          applicationId: result.application_id,
          stage: 'submitted',
          // The form itself, not just the number. Saarthi filled it in, so the
          // wizard has to show what was filled — otherwise "your form is filled"
          // is another claim with nothing behind it, which is the thing this
          // whole change is about.
          //
          // Merged over whatever is already there rather than replacing it.
          // This assignment used to be a whole-form overwrite, so asking
          // Saarthi a question that happened to complete an application threw
          // away eight screens of typing.
          //
          // `bySaarthi` is set here as well as on the handover button. Both
          // paths land the citizen on a form that is four spoken answers and
          // thirty-odd fields of sample data, and only one of them used to say
          // so — which is exactly the disclosure this flag exists to raise.
          form: { ...(state.form ?? {}), ...form, bySaarthi: true },
          app: {
            ...(state.app ?? { fee: 350, clsName: 'MCWG' }),
            no: applicationNo,
            name: applicantName || 'Saarthi applicant',
            phone: form.phone ?? '',
            clsName: (form.classes ?? []).join(', ') || 'MCWG',
          },
        });
        toast(
          t(`Your form is filled — ${applicationNo || 'application created'}. Document checks are simulated in this prototype.`,
            `आपका फ़ॉर्म भर गया — ${applicationNo || 'आवेदन बन गया'}। इस प्रोटोटाइप में दस्तावेज़ जाँच नकली है।`),
          'ok',
          {
            // The fee, not an appointment. Filing the form leaves the fee
            // outstanding, and the learner's test that follows it is taken
            // online — the only appointment on this service is the driving
            // test, a month after the licence is issued.
            label: t('Pay the fee', 'फीस भरें'),
            run: () => go('pay'),
          },
        );
      }
      // An appointment made by talking has to reach the screens that read it.
      // The stage is deliberately not touched: by the time a booking exists the
      // learner's journey is over — this is the driving test — and writing
      // `stage: 'booked'` here would rewind a citizen who has already passed
      // back to "test outstanding".
      if (typeof result.booking_id === 'string') {
        update({
          slot: {
            day: String(result.day ?? ''), time: String(result.time ?? ''),
            rto: String(result.office ?? ''), bookingId: result.booking_id,
            tester: typeof result.tester === 'string' ? result.tester : undefined,
          },
        });
      }
      if (typeof result.token_id === 'string') update({ tokenId: result.token_id });
    }
  };

  const send = async (raw = input) => {
    const transcript = raw.trim();
    if (!transcript || working) return;
    setInput(''); setError(null); setWorking(true);
    appendTurn({ who: 'citizen', text: transcript });
    try {
      try {
        acceptReply(await api.voiceTurn(await ensureSession(), transcript, lang === 'hi' ? 'hi' : 'en'));
      } catch (err) {
        // The server drops a conversation after half an hour idle. Now that the
        // transcript outlives the panel, the stored id can point at one that is
        // gone — so open a new one and send the question rather than showing
        // the citizen a failure for something they did not do.
        if (!(err instanceof api.ApiError) || err.status !== 404) throw err;
        sessionRef.current = null;
        setSessionId(null);
        acceptReply(await api.voiceTurn(await ensureSession(), transcript, lang === 'hi' ? 'hi' : 'en'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saarthi is unavailable right now.');
    } finally { setWorking(false); }
  };

  const confirm = async () => {
    if (!sessionId || !pending || working) return;
    setError(null); setWorking(true);
    try {
      acceptReply(await api.confirmVoiceAction(sessionId, lang === 'hi' ? 'hi' : 'en'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete that action.');
    } finally { setWorking(false); }
  };

  const cancel = async () => {
    if (!sessionId) { setPending(null); return; }
    setWorking(true);
    try {
      await api.cancelVoiceAction(sessionId);
      setPending(null);
      appendTurn({
        who: 'saarthi',
        text: t('All right, I have cancelled that action.', 'ठीक है, मैंने वह कार्रवाई रद्द कर दी है।'),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel that action.');
    } finally { setWorking(false); }
  };

  /** Forget the recogniser and drop the listening state. Safe to call twice. */
  const release = () => {
    recogniserRef.current = null;
    setListening(false);
  };

  /** Stop a running recogniser. `abort` discards the audio; `stop` would submit it. */
  const stopListening = () => {
    const running = recogniserRef.current;
    release();
    try { running?.abort(); } catch { /* already gone */ }
  };

  const listen = () => {
    const Ctor = (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!Ctor) { setError(t('Voice input works in Chrome. You can still type to Saarthi below.', 'बोलकर पूछना Chrome में काम करता है। आप नीचे लिखकर भी पूछ सकते हैं।')); return; }

    // Pressing it while it is already listening stops it. That is what the
    // button looks like it should do while it reads "Listening…", and it is
    // also the only way to get out of a recogniser that has latched onto a
    // noisy room and will not settle.
    if (recogniserRef.current) { stopListening(); return; }

    // Stop talking the moment somebody starts. Saarthi kept reading its last
    // reply into the open microphone, which is both rude and self-defeating —
    // the recogniser hears the synthesiser and sends Saarthi its own words.
    hush();
    setError(null);
    const recognition = new Ctor();
    // Follows the picker rather than being pinned to Hindi. Pinned, an English
    // speaker's question came back as Devanagari that resembled the sounds and
    // meant nothing, and Saarthi answered a sentence nobody had said.
    recognition.lang = SPEECH_LOCALE[lang];
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onerror = (event: any) => {
      release();
      // "I could not hear that" was said for every one of these, including a
      // refused microphone — which is advice to try again at the one problem
      // trying again cannot fix.
      const reason = event?.error;
      if (reason === 'aborted') return;               // we stopped it ourselves
      setError(
        reason === 'not-allowed' || reason === 'service-not-allowed'
          ? t('The microphone is blocked for this site. Allow it in the address bar, or type your question below.',
            'इस साइट के लिए माइक्रोफ़ोन बंद है। पता बार से अनुमति दीजिए, या नीचे सवाल लिखिए।')
          : reason === 'no-speech'
            ? t('I did not hear anything. Press Speak and try again, or type your question.',
              'मुझे कुछ सुनाई नहीं दिया। बोलिए दबाकर दोबारा कोशिश कीजिए, या सवाल लिखिए।')
            : t('I could not hear that. Try again or type your question.',
              'मैं सुन नहीं सकी। दोबारा कोशिश कीजिए या सवाल लिखिए।'));
    };
    recognition.onend = () => release();
    recognition.onresult = (event: any) => send(event.results[0][0].transcript);
    recogniserRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // Chrome allows one live recogniser per page and throws InvalidStateError
      // if the last one has not finished releasing. Uncaught, that killed the
      // click handler on the way out, so the second press after a failed first
      // one did nothing at all and the panel kept showing the old error — the
      // button looked broken exactly when somebody was retrying.
      release();
      setError(t('The microphone is still busy. Press Speak again in a moment, or type your question.',
        'माइक्रोफ़ोन अभी व्यस्त है। एक पल बाद बोलिए दबाइए, या सवाल लिखिए।'));
    }
  };

  const canAct = Boolean(phone) && !working && !pending;

  return (
    // The title followed the script rather than the picker: "सारथी" was shown
    // to somebody who had chosen English, on the one panel whose whole promise
    // is that it answers in the language you use.
    <Sheet fill title={t('Saarthi · Voice guide', 'सारथी · वॉइस गाइड', 'सारथी · व्हॉइस गाइड')} onClose={onClose}>
      <div className="col g10" style={{ height: '100%', minHeight: 0 }}>
        {/* Points at the one sign-in rather than carrying a second copy of it.
            Saarthi fills the form on the citizen's behalf, so it has to know
            whose form — but the place to say so is the same place everything
            else on the site says it. One press, and the panel comes back. */}
        {!phone && (
          <div className="flat row between g12 wrapf" style={{ padding: 14, borderColor: 'var(--brand-line)', flex: 'none' }}>
            <span className="sub" style={{ flex: '1 1 220px' }}>
              {t('Sign in first, so I open the application that is yours.',
                'पहले साइन इन करें, ताकि मैं वही आवेदन खोलूँ जो आपका है।')}
            </span>
            <button className="btn btn-p btn-sm" onClick={onSignIn}>
              {t('Sign in', 'साइन इन')} {Icon.right()}
            </button>
          </div>
        )}

        {/* Takes whatever the panel has left instead of a fixed 285px box.
            On a laptop that box left roughly four hundred pixels of empty
            sidebar under the starter chips while the conversation scrolled
            inside a third of the height available to it.

            The spacer below, not justify-content:flex-end. They look identical
            until the conversation outgrows the box, at which point flex-end
            puts the overflow above the scroll origin and the earlier messages
            become unreachable — the scrollbar simply will not go up. A first
            child with margin-top:auto pushes a short conversation down to the
            input in the same way and leaves the overflow scrollable. */}
        <div ref={log} className="voice-log col g14" aria-live="polite"
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 3 }}>
          <div style={{ marginTop: 'auto', flex: 'none' }} />
          {turns.map((turn, index) => (
            <div key={index} className="voice-turn" data-who={turn.who}>
              <span className="voice-who">{turn.who === 'citizen' ? t('You', 'आप') : t('Saarthi', 'सारथी')}</span>
              <div className="voice-bubble">{turn.text}</div>
              {/* Real day/time options off find_slot_days and find_slots — a
                  day or time with nothing left is shown, not hidden, so the
                  list still answers "what did Saarthi actually see". */}
              {!!turn.days?.length && (
                <div className="voice-pills">
                  {turn.days.map(d => (
                    <button key={d.date} className="voice-pill" disabled={!d.left || !canAct} onClick={() => void send(d.label)}>
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
              {!!turn.slots?.length && (
                <div className="voice-slotgrid">
                  {turn.slots.map(s => (
                    <button key={s.start} className="voice-slotcard" disabled={!s.slot_id || !canAct} onClick={() => void send(s.time)}>
                      {Icon.clock()}
                      <span className="grow">{s.time}</span>
                      <span className={`voice-slotleft${s.left <= 3 ? ' is-low' : ''}`}>
                        {s.left ? t(`${s.left} left`, `${s.left} बचे`) : t('Full', 'पूरा भरा')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {working && (
            <div className="voice-turn" data-who="saarthi" aria-live="polite">
              <span className="voice-who"><i className="voice-livedot" />{t('Saarthi', 'सारथी')}</span>
              <div className="voice-bubble col g6">
                <span className="tiny">
                  {waited < 3
                    ? t('Checking the journey…', 'यात्रा देखी जा रही है…')
                    : waited < 7
                      ? t('Looking up the licence service…', 'लाइसेंस सेवा से जानकारी ली जा रही है…')
                      : t('Still working — this one is taking longer than usual.', 'अभी भी काम जारी है — इसमें सामान्य से ज़्यादा समय लग रहा है।')}
                  {' '}<span className="mono">{waited}s</span>
                </span>
                {/* A bar that fills over the six seconds a turn usually takes. It
                    keeps moving past that rather than completing and sitting
                    still, which would claim the reply had arrived. */}
                <span className="voice-progress"><span style={{ width: `${Math.min(92, 12 + waited * 14)}%` }} /></span>
              </div>
            </div>
          )}
        </div>

        {handover && (
          <div className="flat col g10" style={{ padding: 14, borderColor: 'var(--brand-line)', flex: 'none' }}>
            <b>{t('Your form is ready.', 'आपका फ़ॉर्म तैयार है।')}</b>
            {/* Handed over complete, and submit-ready. Leaving the e-sign box
                unticked was tried and reverted: it lands the citizen on a review
                screen with a greyed-out Submit and nothing on it explaining why,
                which is the exact failure this build argues against everywhere
                else. The declarations being pre-filled is a disclosure problem,
                and it is solved by the note on that screen saying so — not by a
                dead button. */}
            <span className="sub">
              {t('I filled it from your answers, and filled the rest with sample data — including the declarations. Read it before you send it.',
                'मैंने आपके जवाबों से इसे भरा है, और बाकी नमूना डेटा से — घोषणाएँ भी। भेजने से पहले पढ़ लें।')}
            </span>
            <div className="row g10 wrapf">
              <button className="btn btn-p btn-sm" onClick={() => {
                update({
                  // Merged, for the same reason as the tool-event path above:
                  // anything already typed into the wizard is the citizen's and
                  // outranks the fixture underneath the prefill.
                  form: { ...(state.form ?? {}), ...formFromPrefill(handover), bySaarthi: true },
                  formStep: STEPS.length - 1,
                });
                setHandover(null);
                go('apply');
                onClose();
              }}>{t('See my form', 'मेरा फ़ॉर्म देखें')}</button>
              <button className="btn btn-g btn-sm" onClick={() => setHandover(null)}>
                {t('Not yet', 'अभी नहीं')}
              </button>
            </div>
          </div>
        )}

        {pending && (
          <div className="flat col g10" style={{ padding: 14, borderColor: 'var(--brand-line)', flex: 'none' }}>
            <b>{t('Confirm before Saarthi acts', 'सारथी के काम करने से पहले पुष्टि करें')}</b>
            <span className="sub">{pending}</span>
            <div className="row g10 wrapf">
              <button className="btn btn-p btn-sm" disabled={working} onClick={confirm}>{Icon.check()} {t('Confirm', 'पुष्टि करें')}</button>
              <button className="btn btn-g btn-sm" disabled={working} onClick={() => void cancel()}>{t('Cancel', 'रद्द करें')}</button>
            </div>
          </div>
        )}

        {/* Mic and send share the one bar rather than sitting beside it as
            their own buttons — everything below waits on the phone number
            above, so both are disabled together rather than independently. */}
        <div className="voice-inputbar" style={{ flex: 'none' }}>
          <input
            className="voice-input grow"
            value={input}
            disabled={!canAct}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') void send(); }}
            placeholder={!phone ? t('Enter your number above to begin…', 'शुरू करने के लिए ऊपर नंबर डालें…') : t('Ask Saarthi or type your question…', 'सारथी से पूछें या अपना सवाल लिखें…')}
          />
          <button
            className="voice-mic-btn"
            aria-pressed={listening}
            disabled={!canAct}
            title={listening ? t('Listening… press to stop', 'सुन रही हूँ… रोकने के लिए दबाएँ') : canRecogniseSpeech() ? t('Speak', 'बोलिए') : t('Voice input works in Chrome', 'बोलकर पूछना Chrome में काम करता है')}
            onClick={listen}
          >
            {Icon.mic()}
          </button>
          {/* Hidden rather than merely disabled until there is something to
              send — an always-on send button next to an empty box invites a
              press that does nothing, which reads as broken rather than as
              "nothing typed yet". */}
          {!!input.trim() && (
            <button className="voice-send-btn" disabled={!canAct} onClick={() => void send()} aria-label={t('Send', 'भेजें')}>
              {Icon.up()}
            </button>
          )}
        </div>

        {/* Says what Saarthi is about to ask for, before it asks. Someone told
            out of nowhere to say their date of birth to a microphone is right
            to hesitate; someone told first why, and what will never be asked,
            is not being surprised. One word, and everything behind it — the
            notice matters once, on the first visit, and is worth a hover
            after that. It is a real <details>, so it also opens on Enter. */}
        <div className="voice-statusrow" style={{ flex: 'none' }}>
          <button
            className="voice-speaking-toggle"
            aria-pressed={muted}
            title={muted ? t('Saarthi is muted', 'सारथी म्यूट है') : t('Mute Saarthi', 'सारथी को म्यूट करें')}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              // Muting stops the sentence in progress, not just the next one.
              if (next) hush();
              try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* private browsing */ }
            }}
          >
            {muted
              ? <>{Icon.speakerOff()} <span>{t('Muted', 'म्यूट')}</span></>
              : speaking
                ? <><span className="voice-eq"><i /><i /><i /></span> <span>{t('Speaking', 'बोल रहा है')}</span></>
                : <>{Icon.speaker()} <span>{t('Voice on', 'आवाज़ चालू')}</span></>}
          </button>
          <details
            className="disclose voice-disclaimer"
            onMouseEnter={e => { e.currentTarget.open = true; }}
            onMouseLeave={e => { e.currentTarget.open = false; }}
          >
            <summary className="tiny">{Icon.bang()} {t('Disclaimer', 'अस्वीकरण')}</summary>
            {/* One weight, one paragraph.
                This was a bold sentence with a lighter one under it, which reads
                as a headline over body copy — a shape that tells the reader the
                second half is optional. In a notice about what will never be
                asked of them, none of it is optional. */}
            <div className="flat disclose-body">
              <p>{t('Saarthi never asks for an Aadhaar number, an OTP, a password or a card. It asks your name, date of birth, state and what you want to drive. Nothing here is a government service, and document checks are simulated. Hindi or English is fine.',
                'सारथी कभी आधार नंबर, OTP, पासवर्ड या कार्ड नहीं मांगता। यह आपका नाम, जन्मतिथि, राज्य और आप क्या चलाना चाहते हैं पूछता है। यह कोई सरकारी सेवा नहीं है, और दस्तावेज़ जाँच नकली है। हिंदी या अंग्रेज़ी, दोनों ठीक हैं।')}</p>
            </div>
          </details>
        </div>
        {/* Names what Saarthi's voice actually speaks, not what the site's UI
            offers to read in — SPEECH_LOCALE above maps mr to hi-IN, so
            Marathi is not a third voice, it is Hindi with the site's text
            still readable in Marathi around it. */}
        <p className="tiny" style={{ textAlign: 'center', flex: 'none' }}>
          {t('Supports Hindi and English', 'हिंदी और अंग्रेज़ी में उपलब्ध')}
        </p>
        {/* No starter chips.
            Three suggested questions sat here, and they cost more than the row
            they occupied. Saarthi's opening line is already built from the
            citizen's own record and names the next step, so a chip reading "I
            want a learner licence" answers a question the panel has just
            answered better. They also taught the wrong thing: a citizen who
            presses a chip learns that this is a menu of three, when the point of
            an assistant is that you can ask it anything in your own words. */}
        {error && <Note tone="warn">{error}</Note>}
      </div>
    </Sheet>
  );
}
