import { useEffect, useRef, useState } from 'react';
import * as api from '../api';
import type { AppState } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Sheet } from '../ui/SharedUI';

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

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = /[\u0900-\u097F]/.test(text) ? 'hi-IN' : 'en-IN';
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

/** Voice facade for Saarthi. The API key remains in FastAPI; this is mic + UI only. */
export function VoiceAgent({ state, update, onClose }: VoiceAgentProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([{ who: 'saarthi', text: 'नमस्ते, मैं सारथी हूँ। मैं लाइसेंस के लिए सही अगला कदम बता सकता हूँ।' }]);
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
    speak(reply.reply);
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
      setTurns(old => [...old, { who: 'saarthi', text: 'ठीक है, मैंने वह कार्रवाई रद्द कर दी है।' }]);
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
    recognition.lang = 'hi-IN';
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
          {['मुझे लर्नर लाइसेंस बनवाना है', 'टेस्ट के लिए स्लॉट दिखाओ', 'मेरा नंबर और इंतज़ार कितना है?'].map(example => (
            <button key={example} className="btn btn-g btn-sm" disabled={working || Boolean(pending)} onClick={() => void send(example)}>{example}</button>
          ))}
        </div>
        {error && <Note tone="warn">{error}</Note>}
      </div>
    </Sheet>
  );
}
