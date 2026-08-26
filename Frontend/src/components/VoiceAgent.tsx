import { useEffect, useRef, useState } from 'react';
import * as api from '../api';
import { demoForm } from '../data/demoApplicant';
import { loadConversation, saveConversation, type Turn } from '../lib/conversation';
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
const SPEECH_LOCALE: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };

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
  const classes = Array.isArray(prefill.classes) && prefill.classes.length
    ? (prefill.classes as string[])
    : base.classes;
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
 * Read a reply aloud in the language it was actually written in.
 *
 * Devanagari settles it outright. Otherwise the reply is either English or
 * Hinglish \u2014 romanised Hindi, which an en-IN voice pronounces far closer than
 * a hi-IN one does \u2014 so fall back to the picker, which is what the citizen
 * chose to read the rest of the site in.
 */
function speak(text: string, uiLang: Lang) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = /[\u0900-\u097F]/.test(text) ? 'hi-IN' : SPEECH_LOCALE[uiLang];
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
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
            'नमस्ते, मैं सारथी हूँ। मैं लाइसेंस के लिए सही अगला कदम बता सकता हूँ।'),
  };
  // Picked up where it was left, not started over. Closing this panel to look
  // at the screen behind it is the thing Saarthi keeps asking people to do.
  const [turns, setTurns] = useState<Turn[]>(
    () => loadConversation(phone || '').turns.length
      ? loadConversation(phone || '').turns
      : [greeting],
  );
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [working, setWorking] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
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
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  // Every change, so the transcript survives a close, a reopen and a reload.
  useEffect(() => {
    if (phone) saveConversation(phone, turns, sessionRef.current);
  }, [phone, turns, sessionId]);

  // The signed-in number is the reference, so Saarthi reads the same journey the
  // wizard filed and the tracker shows. It used to fall back to
  // `saarthi-demo-<random>` whenever the panel opened cold, which meant the
  // agent could not find an application the citizen had just filled in by hand
  // — the panel and the form were two different people.
  const citizenRef = phone;

  const ensureSession = async () => {
    if (sessionRef.current) return sessionRef.current;
    if (!citizenRef) throw new Error('Sign in first so I know whose application to open.');
    const created = await api.startVoice(citizenRef, lang === 'hi' ? 'hi' : 'en');
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
  useEffect(() => {
    if (!phone || sessionRef.current) return;
    let dropped = false;
    void (async () => {
      try {
        const created = await api.startVoice(phone, lang === 'hi' ? 'hi' : 'en');
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
    // lang is deliberately not a dependency: changing the site language
    // mid-conversation must not silently reopen the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  const acceptReply = (reply: api.VoiceReply) => {
    setTurns(old => [...old, { who: 'saarthi', text: reply.reply }]);
    setPending(reply.pending_confirmation?.label || null);
    speak(reply.reply, lang);
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
          form,
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
            label: t('Book a slot', 'स्लॉट बुक करें'),
            run: () => go('slot'),
          },
        );
      }
      // An appointment made by talking has to reach the screens the wizard's
      // one reaches. Without this the citizen books through Saarthi and every
      // other page still reads "no slot booked".
      if (typeof result.booking_id === 'string') {
        update({
          slot: {
            day: String(result.day ?? ''), time: String(result.time ?? ''),
            rto: String(result.office ?? ''), bookingId: result.booking_id,
            tester: typeof result.tester === 'string' ? result.tester : undefined,
          },
          stage: 'booked',
        });
      }
      if (typeof result.token_id === 'string') update({ tokenId: result.token_id });
    }
  };

  const send = async (raw = input) => {
    const transcript = raw.trim();
    if (!transcript || working) return;
    setInput(''); setError(null); setWorking(true);
    setTurns(old => [...old, { who: 'citizen', text: transcript }]);
    try {
      try {
        acceptReply(await api.voiceTurn(await ensureSession(), transcript));
      } catch (err) {
        // The server drops a conversation after half an hour idle. Now that the
        // transcript outlives the panel, the stored id can point at one that is
        // gone — so open a new one and send the question rather than showing
        // the citizen a failure for something they did not do.
        if (!(err instanceof api.ApiError) || err.status !== 404) throw err;
        sessionRef.current = null;
        setSessionId(null);
        acceptReply(await api.voiceTurn(await ensureSession(), transcript));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saarthi is unavailable right now.');
    } finally { setWorking(false); }
  };

  const confirm = async () => {
    if (!sessionId || !pending || working) return;
    setError(null); setWorking(true);
    try {
      acceptReply(await api.confirmVoiceAction(sessionId));
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
      setTurns(old => [...old, {
        who: 'saarthi',
        text: t('All right, I have cancelled that action.', 'ठीक है, मैंने वह कार्रवाई रद्द कर दी है।'),
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel that action.');
    } finally { setWorking(false); }
  };

  const listen = () => {
    const Ctor = (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!Ctor) { setError('Voice input works in Chrome. You can still type to Saarthi below.'); return; }
    setError(null);
    const recognition = new Ctor();
    // Follows the picker rather than being pinned to Hindi. Pinned, an English
    // speaker's question came back as Devanagari that resembled the sounds and
    // meant nothing, and Saarthi answered a sentence nobody had said.
    recognition.lang = SPEECH_LOCALE[lang];
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onerror = () => { setListening(false); setError('I could not hear that. Try again or type your question.'); };
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: any) => send(event.results[0][0].transcript);
    recognition.start();
  };

  return (
    <Sheet title="सारथी · Voice guide" onClose={onClose}>
      <div className="col g16">
        {/* Says what Saarthi is about to ask for, before it asks. Someone told
            out of nowhere to say their date of birth to a microphone is right
            to hesitate; someone told first why, and what will never be asked,
            is not being surprised. */}
        <Note tone="brand" icon={Icon.speaker()}>
          <b>Saarthi fills the form for you.</b> It will ask your name, date of birth, state and what you want to drive — that is all. It never asks for an Aadhaar number, an OTP, a password or a card, and document checks are simulated in this prototype. Hindi or English is fine.
        </Note>

        {/* Points at the one sign-in rather than carrying a second copy of it.
            Saarthi fills the form on the citizen's behalf, so it has to know
            whose form — but the place to say so is the same place everything
            else on the site says it. One press, and the panel comes back. */}
        {!phone && (
          <div className="flat row between g12 wrapf" style={{ padding: 14, borderColor: 'var(--brand-line)' }}>
            <span className="sub" style={{ flex: '1 1 220px' }}>
              {t('Sign in first, so I open the application that is yours.',
                'पहले साइन इन करें, ताकि मैं वही आवेदन खोलूँ जो आपका है।')}
            </span>
            <button className="btn btn-p btn-sm" onClick={onSignIn}>
              {t('Sign in', 'साइन इन')} {Icon.right()}
            </button>
          </div>
        )}

        <div ref={log} className="col g10" aria-live="polite" style={{ maxHeight: 285, overflowY: 'auto', paddingRight: 3 }}>
          {turns.map((turn, index) => (
            <div key={index} className="flat" style={{ alignSelf: turn.who === 'citizen' ? 'flex-end' : 'flex-start', maxWidth: '90%', padding: '11px 13px', background: turn.who === 'citizen' ? 'var(--brand-soft)' : undefined }}>
              <span className="tiny" style={{ display: 'block', marginBottom: 3, fontWeight: 600 }}>{turn.who === 'citizen' ? 'You' : 'Saarthi'}</span>
              {turn.text}
            </div>
          ))}
          {working && (
            <div className="flat col g6" style={{ alignSelf: 'flex-start', maxWidth: '90%', padding: '11px 13px' }} aria-live="polite">
              <span className="tiny" style={{ fontWeight: 600 }}>Saarthi</span>
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
              <span style={{ display: 'block', height: 3, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', borderRadius: 999, background: 'var(--brand)', width: `${Math.min(92, 12 + waited * 14)}%`, transition: 'width .25s linear' }} />
              </span>
            </div>
          )}
        </div>

        {pending && (
          <div className="flat col g10" style={{ padding: 14, borderColor: 'var(--brand-line)' }}>
            <b>Confirm before Saarthi acts</b>
            <span className="sub">{pending}</span>
            <div className="row g10 wrapf">
              <button className="btn btn-p btn-sm" disabled={working} onClick={confirm}>{Icon.check()} Confirm</button>
              <button className="btn btn-g btn-sm" disabled={working} onClick={() => void cancel()}>Cancel</button>
            </div>
          </div>
        )}

        {/* Everything below waits on the number above it. Left live, the first
            question would fail on a session that could not be opened, and the
            citizen would read that as Saarthi being broken rather than as a
            step they have not done yet. */}
        <div className="row g10" style={{ alignItems: 'stretch' }}>
          <button className="btn btn-p" style={{ minWidth: 82 }} disabled={!phone || working || Boolean(pending)} onClick={listen}>
            {listening ? 'Listening…' : '🎙 Speak'}
          </button>
          <input className="input grow" value={input} disabled={!phone || working || Boolean(pending)} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void send(); }} placeholder={!phone ? t('Enter your number above to begin…', 'शुरू करने के लिए ऊपर नंबर डालें…') : canRecogniseSpeech() ? 'Or type your question…' : 'Type your question…'} />
          <button className="btn btn-s" disabled={!phone || working || Boolean(pending) || !input.trim()} onClick={() => void send()}>Send</button>
        </div>
        <div className="row g8 wrapf">
          {/* Starters in the citizen's own language — a Hindi chip pressed by an
              English speaker pins the whole conversation to Hindi, because the
              service answers in the language of the last thing it was sent. */}
          {(lang === 'hi'
            ? ['मुझे लर्नर लाइसेंस बनवाना है', 'टेस्ट के लिए स्लॉट दिखाओ', 'मेरा नंबर और इंतज़ार कितना है?']
            : ['I want a learner licence', 'Show me test slots', 'What is my token and wait?']
          ).map(example => (
            <button key={example} className="btn btn-g btn-sm" disabled={!phone || working || Boolean(pending)} onClick={() => void send(example)}>{example}</button>
          ))}
        </div>
        {error && <Note tone="warn">{error}</Note>}
      </div>
    </Sheet>
  );
}
