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
            'नमस्ते, मैं सारथी हूँ। मैं लाइसेंस के लिए सही अगला कदम बता सकती हूँ।'),
  };
  // Picked up where it was left, not started over. Closing this panel to look
  // at the screen behind it is the thing Saarthi keeps asking people to do.
  const [turns, setTurns] = useState<Turn[]>(
    () => loadConversation(phone || '').turns.length
      ? loadConversation(phone || '').turns
      : [greeting],
  );
  const [input, setInput] = useState('');
  const [muted, setMuted] = useState(storedMute);
  const [listening, setListening] = useState(false);
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
  // The microphone goes with it. Closed mid-sentence, the recogniser stayed
  // live on a panel nobody could see — the browser kept showing the recording
  // dot, and reopening met a recogniser Chrome would not let us start a second
  // copy of.
  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    try { recogniserRef.current?.abort(); } catch { /* already gone */ }
    recogniserRef.current = null;
  }, []);

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
  }, [phone, lang]);

  const acceptReply = (reply: api.VoiceReply) => {
    setTurns(old => [...old, { who: 'saarthi', text: reply.reply }]);
    setPending(reply.pending_confirmation?.label || null);
    if (!muted) speak(reply.reply, lang);
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
      setTurns(old => [...old, {
        who: 'saarthi',
        text: t('All right, I have cancelled that action.', 'ठीक है, मैंने वह कार्रवाई रद्द कर दी है।'),
      }]);
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

  return (
    // The title followed the script rather than the picker: "सारथी" was shown
    // to somebody who had chosen English, on the one panel whose whole promise
    // is that it answers in the language you use.
    <Sheet fill title={t('Saarthi · Voice guide', 'सारथी · वॉइस गाइड', 'सारथी · व्हॉइस गाइड')} onClose={onClose}>
      <div className="col g12" style={{ height: '100%', minHeight: 0 }}>
        {/* Says what Saarthi is about to ask for, before it asks. Someone told
            out of nowhere to say their date of birth to a microphone is right
            to hesitate; someone told first why, and what will never be asked,
            is not being surprised.

            Folded to one line, because it was taking a third of the panel on
            every turn of every conversation and the thing it makes room for is
            the conversation. The half that matters — what is never asked for —
            stays on the visible line rather than behind the toggle: a promise
            about your Aadhaar number is worth nothing if you have to go looking
            for it. Opens on hover and on click, and it is a real <details>, so
            it also opens on Enter from the keyboard. */}
        <div className="row between g10" style={{ flex: 'none' }}>
          {/* The speaker was decoration on a notice. It is a control now: the
              one thing a voice panel must let you do is make it stop. */}
          <button
            className="btn btn-g btn-sm"
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
            {muted ? Icon.speakerOff() : Icon.speaker()}
            <span className="tiny">{muted ? t('Muted', 'म्यूट') : t('Speaking', 'बोल रहा है')}</span>
          </button>

          {/* One word, and everything behind it. The notice was five lines at
              the top of every conversation; what it says matters once, on the
              first visit, and is worth a hover after that. */}
          <details
            className="disclose"
            onMouseEnter={e => { e.currentTarget.open = true; }}
            onMouseLeave={e => { e.currentTarget.open = false; }}
          >
            <summary className="tiny">{Icon.bang()} {t('Disclaimer', 'अस्वीकरण')}</summary>
            <div className="flat disclose-body">
              <b>{t('Saarthi never asks for an Aadhaar number, an OTP, a password or a card.',
                    'सारथी कभी आधार नंबर, OTP, पासवर्ड या कार्ड नहीं मांगता।')}</b>
              <p className="tiny" style={{ marginTop: 7 }}>
                {t('It asks your name, date of birth, state and what you want to drive — that is all. Document checks are simulated in this prototype, and nothing here is a government service. Hindi or English is fine.',
                  'यह आपका नाम, जन्मतिथि, राज्य और आप क्या चलाना चाहते हैं पूछता है — बस इतना। इस प्रोटोटाइप में दस्तावेज़ जाँच नकली है, और यह कोई सरकारी सेवा नहीं है। हिंदी या अंग्रेज़ी, दोनों ठीक हैं।')}
              </p>
            </div>
          </details>
        </div>

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
        <div ref={log} className="col g10" aria-live="polite"
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 3 }}>
          <div style={{ marginTop: 'auto', flex: 'none' }} />
          {turns.map((turn, index) => (
            <div key={index} className="flat" style={{ alignSelf: turn.who === 'citizen' ? 'flex-end' : 'flex-start', maxWidth: '90%', padding: '11px 13px', background: turn.who === 'citizen' ? 'var(--brand-soft)' : undefined }}>
              <span className="tiny" style={{ display: 'block', marginBottom: 3, fontWeight: 600 }}>{turn.who === 'citizen' ? t('You', 'आप') : t('Saarthi', 'सारथी')}</span>
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
            <b>{t('Confirm before Saarthi acts', 'सारथी के काम करने से पहले पुष्टि करें')}</b>
            <span className="sub">{pending}</span>
            <div className="row g10 wrapf">
              <button className="btn btn-p btn-sm" disabled={working} onClick={confirm}>{Icon.check()} {t('Confirm', 'पुष्टि करें')}</button>
              <button className="btn btn-g btn-sm" disabled={working} onClick={() => void cancel()}>{t('Cancel', 'रद्द करें')}</button>
            </div>
          </div>
        )}

        {/* Everything below waits on the number above it. Left live, the first
            question would fail on a session that could not be opened, and the
            citizen would read that as Saarthi being broken rather than as a
            step they have not done yet. */}
        <div className="row g10" style={{ alignItems: 'stretch' }}>
          <button className="btn btn-p" style={{ minWidth: 82 }} disabled={!phone || working || Boolean(pending)} onClick={listen}>
            {listening ? t('Listening…', 'सुन रही हूँ…') : `🎙 ${t('Speak', 'बोलिए')}`}
          </button>
          <input className="input grow" value={input} disabled={!phone || working || Boolean(pending)} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void send(); }} placeholder={!phone ? t('Enter your number above to begin…', 'शुरू करने के लिए ऊपर नंबर डालें…') : canRecogniseSpeech() ? t('Or type your question…', 'या अपना सवाल लिखिए…') : t('Type your question…', 'अपना सवाल लिखिए…')} />
          <button className="btn btn-s" disabled={!phone || working || Boolean(pending) || !input.trim()} onClick={() => void send()}>{t('Send', 'भेजें')}</button>
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
