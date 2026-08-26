import { useEffect, useRef, useState } from 'react';
import * as api from '../api';
import { useLanguage, useT, type Lang } from '../lib/language';
import type { AppState } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Sheet } from '../ui/SharedUI';

/**
 * The recogniser and the speech synthesiser both want a BCP-47 tag, and getting
 * it wrong is not a degraded experience but a broken one: hi-IN handed an
 * English sentence returns Devanagari nonsense, so the citizen's question
 * reaches Saarthi as words they never said.
 */
const SPEECH_LOCALE: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };

type Turn = { who: 'citizen' | 'saarthi'; text: string };

/**
 * Stand-in details for an application created by voice. Saarthi never asks for a
 * name or a phone number, so the record carries the number the service issued
 * and leaves the rest for the wizard to fill in.
 */
const BLANK_APP = { no: '', name: 'Saarthi applicant', phone: '', fee: 350, clsName: 'MCWG' };

interface VoiceAgentProps {
  state: AppState;
  update: (patch: Partial<AppState>) => void;
  onClose: () => void;
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
export function VoiceAgent({ state, update, onClose }: VoiceAgentProps) {
  const { lang } = useLanguage();
  const t = useT();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  // Opens in the language the citizen is already reading the site in. A Hindi
  // greeting to someone who chose English is an invitation to answer in Hindi,
  // which is not what they asked for.
  const [turns, setTurns] = useState<Turn[]>(() => [{
    who: 'saarthi',
    text: t('Hello, I am Saarthi. I can tell you the right next step for your licence.',
            'नमस्ते, मैं सारथी हूँ। मैं लाइसेंस के लिए सही अगला कदम बता सकता हूँ।'),
  }]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [working, setWorking] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const log = useRef<HTMLDivElement>(null);

  // The newest line is the whole point of a voice panel, and the transcript is a
  // fixed-height scroller — without this the reply lands below the fold and the
  // citizen has to scroll to find the answer they just asked for.
  useEffect(() => {
    const box = log.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [turns, working, pending]);

  useEffect(() => () => {
    if (sessionRef.current) void api.endVoice(sessionRef.current).catch(() => undefined);
    window.speechSynthesis?.cancel();
  }, []);

  // Match the reference the wizard applies under, so Saarthi finds and continues
  // the same journey instead of starting a second one. With no application yet,
  // each panel opens a fresh synthetic citizen: apply is idempotent per
  // reference, so a shared constant would make every later demo run answer
  // "you already have an appointment".
  const citizenRef = useRef(
    state.app?.phone || state.app?.name || `saarthi-demo-${Date.now().toString(36)}`,
  ).current;

  const ensureSession = async () => {
    if (sessionRef.current) return sessionRef.current;
    const created = await api.startVoice(citizenRef);
    sessionRef.current = created.session_id;
    setSessionId(created.session_id);
    return created.session_id;
  };

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
        update({
          applicationId: result.application_id,
          stage: 'submitted',
          ...(typeof result.application_no === 'string'
            ? { app: { ...(state.app ?? BLANK_APP), no: result.application_no } }
            : {}),
        });
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
      const id = await ensureSession();
      acceptReply(await api.voiceTurn(id, transcript));
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
        <Note tone="brand" icon={Icon.speaker()}>
          <b>Talk through the journey.</b> Hindi or English is fine. This independent prototype uses synthetic data only—never say a real Aadhaar, OTP, password, or card number.
        </Note>

        <div ref={log} className="col g10" aria-live="polite" style={{ maxHeight: 285, overflowY: 'auto', paddingRight: 3 }}>
          {turns.map((turn, index) => (
            <div key={index} className="flat" style={{ alignSelf: turn.who === 'citizen' ? 'flex-end' : 'flex-start', maxWidth: '90%', padding: '11px 13px', background: turn.who === 'citizen' ? 'var(--brand-soft)' : undefined }}>
              <span className="tiny" style={{ display: 'block', marginBottom: 3, fontWeight: 600 }}>{turn.who === 'citizen' ? 'You' : 'Saarthi'}</span>
              {turn.text}
            </div>
          ))}
          {working && <span className="tiny">Saarthi is checking the journey…</span>}
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

        <div className="row g10" style={{ alignItems: 'stretch' }}>
          <button className="btn btn-p" style={{ minWidth: 82 }} disabled={working || Boolean(pending)} onClick={listen}>
            {listening ? 'Listening…' : '🎙 Speak'}
          </button>
          <input className="input grow" value={input} disabled={working || Boolean(pending)} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void send(); }} placeholder={canRecogniseSpeech() ? 'Or type your question…' : 'Type your question…'} />
          <button className="btn btn-s" disabled={working || Boolean(pending) || !input.trim()} onClick={() => void send()}>Send</button>
        </div>
        <div className="row g8 wrapf">
          {/* Starters in the citizen's own language — a Hindi chip pressed by an
              English speaker pins the whole conversation to Hindi, because the
              service answers in the language of the last thing it was sent. */}
          {(lang === 'hi'
            ? ['मुझे लर्नर लाइसेंस बनवाना है', 'टेस्ट के लिए स्लॉट दिखाओ', 'मेरा नंबर और इंतज़ार कितना है?']
            : ['I want a learner licence', 'Show me test slots', 'What is my token and wait?']
          ).map(example => (
            <button key={example} className="btn btn-g btn-sm" disabled={working || Boolean(pending)} onClick={() => void send(example)}>{example}</button>
          ))}
        </div>
        {error && <Note tone="warn">{error}</Note>}
      </div>
    </Sheet>
  );
}
