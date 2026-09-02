import { useState } from 'react';
import * as api from '../api';
import { STATES, STATE_HI } from '../data/applicationFlow';
import { RTO_BY_STATE, rtosFor } from '../data/rtoOffices';
import { prettyPhone, signIn, signOut } from '../lib/identity';
import { useT } from '../lib/language';
import { Icon } from './Icon';
import { Note, Pill, Sheet, Tile } from './SharedUI';

/**
 * The one place the citizen ever signs in.
 *
 * One popup, reached from the header and pointed at by Saarthi — not a form
 * repeated on every screen that happens to need a number. Two sheets cannot be
 * open at once here anyway (they share a backdrop and a z-index, so the wrong
 * one closes), but the real reason is that a sign-in a citizen meets twice in
 * two different shapes is a sign-in they stop trusting.
 *
 * It is not authentication. The code arrives on screen, under a line saying no
 * message was sent and nothing was checked — see Backend/app/identity.py. A
 * mock one-time password dressed as a real one would be the only dishonest
 * thing in a build whose whole argument is honesty.
 */

/** The number the sample applicant carries, so a demo lines up end to end. */
const DEMO_PHONE = '9820011021';

/**
 * The states with their own office list and fee schedule behind them.
 *
 * Named rather than counted, because the picker offers every state the official
 * portal does and only two of them are modelled. A citizen who picks Kerala and
 * is quietly given three Mumbai offices has been misled by the one screen whose
 * entire job is to ask where they are.
 */
const MODELLED = new Set(['Maharashtra', ...Object.keys(RTO_BY_STATE)]);

export function IdentitySheet({ phone, currentState, onPickState, onClose }: {
  phone: string | null;
  currentState?: string;
  onPickState: (state: string, rtoId: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  /**
   * Signing in hands straight over to the state question, the way the official
   * portal opens on one. The state scopes every fee, office and form after it,
   * so asking once at the start is the difference between a journey that is
   * about your state and one that quietly assumes Maharashtra.
   */
  const [picking, setPicking] = useState(false);

  const title = picking
    ? t('Where are you applying?', 'आप कहाँ आवेदन कर रहे हैं?')
    : phone ? t('Your profile', 'आपकी प्रोफ़ाइल') : t('Sign in', 'साइन इन');

  return (
    <Sheet title={title} onClose={onClose}>
      {picking
        ? (
          <StatePicker
            current={currentState}
            onPick={(state, rtoId) => { onPickState(state, rtoId); onClose(); }}
            onSkip={onClose}
          />
        )
        : phone
          ? <Profile phone={phone} currentState={currentState}
              onChangeState={() => setPicking(true)} onClose={onClose} />
          : <SignInForm onDone={() => setPicking(true)} />}
    </Sheet>
  );
}

/**
 * The state question, asked once and remembered.
 *
 * Two columns of plain buttons rather than a `<select>`: a dropdown hides the
 * one fact worth seeing here, which is that only two of these have real data
 * behind them. Shown as a list, the badge sits next to the name and the choice
 * is made with the caveat visible instead of after it.
 */
function StatePicker({ current, onPick, onSkip }: {
  current?: string;
  onPick: (state: string, rtoId: string) => void;
  onSkip: () => void;
}) {
  const t = useT();
  const [chosen, setChosen] = useState(current || '');

  const confirm = (state: string) => {
    // The office travels with the state. Left behind, a Bihar applicant kept
    // the Mumbai office picked before they switched, and the appointment landed
    // two thousand kilometres from the address on the same application.
    onPick(state, rtosFor(state)[0].id);
  };

  return (
    <div className="col g14">
      {/* One line of purpose, and the caveat folded behind a pill — the same
          shape Saarthi's panel uses, for the same reason. Spelled out, the
          disclaimer was three lines of prose under a scrolling list of eleven
          tiles, and the screen whose only job is to take one tap read as
          homework. The badge on each row already carries the fact; this holds
          the explanation for whoever wants it. */}
      <div className="row between g10 wrapf" style={{ alignItems: 'flex-start' }}>
        <span className="sub" style={{ flex: '1 1 220px' }}>
          {t('Every fee, office and form after this is picked for the state you choose.',
            'इसके बाद हर शुल्क, कार्यालय और फ़ॉर्म आपके चुने राज्य के हिसाब से आता है।')}
        </span>
        <details
          className="disclose"
          onMouseEnter={e => { e.currentTarget.open = true; }}
          onMouseLeave={e => { e.currentTarget.open = false; }}
        >
          <summary className="tiny">{Icon.bang()} {t('Disclaimer', 'अस्वीकरण')}</summary>
          {/* One weight, one paragraph — see the note on Saarthi's disclaimer. */}
          <div className="flat disclose-body">
            <p>{t('Only Maharashtra and Bihar have real data behind them: their own offices, live queues and state charges. The rest of the list is the official portal\'s and falls back to the Maharashtra offices, marked "Sample" so you know which is which before you pick.',
              'सिर्फ़ महाराष्ट्र और बिहार के पीछे असली डेटा है: उनके अपने कार्यालय, लाइव कतारें और राज्य शुल्क। बाकी सूची आधिकारिक पोर्टल की है और महाराष्ट्र के कार्यालयों पर लौट आती है, जिन पर "नमूना" लिखा है ताकि चुनने से पहले पता चले।')}</p>
          </div>
        </details>
      </div>

      {/* No second line per row. The badge is the whole distinction, and a
          description under it was being clipped by the tile rather than
          wrapping — a caveat cut in half is worse than no caveat. */}
      {/* No inner scroll. Capped, the list showed five states down a scrollbar
          nobody could see while the sheet below it sat empty — two scrolling
          regions on one panel, and the shorter one hiding six of the eleven
          answers. The sheet scrolls; the list is just a list. */}
      <div className="col g8" role="radiogroup">
        {STATES.map(s => (
          <Tile
            key={s}
            checked={chosen === s}
            onClick={() => { setChosen(s); confirm(s); }}
            title={t(s, STATE_HI[s])}
            right={MODELLED.has(s)
              ? <Pill tone="ok">{t('Real data', 'असली डेटा')}</Pill>
              : <Pill>{t('Sample', 'नमूना')}</Pill>}
          />
        ))}
      </div>

      <div>
        <button className="btn btn-s btn-sm" onClick={onSkip}>
          {t('Decide later', 'बाद में तय करें')}
        </button>
      </div>
    </div>
  );
}

function Profile({ phone, currentState, onChangeState, onClose }: {
  phone: string;
  currentState?: string;
  onChangeState: () => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <div className="col g16">
      <div className="col g6">
        <Pill tone="ok">{Icon.check()} {t('Signed in', 'साइन इन है')}</Pill>
        <b className="mono" style={{ fontSize: '1.5rem', letterSpacing: '.02em' }}>
          {prettyPhone(phone)}
        </b>
        <span className="sub">
          {t('Your application, Saarthi and the tracker all read this number.',
            'आपका आवेदन, सारथी और ट्रैकर — तीनों यही नंबर पढ़ते हैं।')}
        </span>
      </div>

      {/* The state lives here rather than only inside the form, because it
          scopes what the fee tables, the office list and the slot board show
          long before the form is opened. Changeable from the same place it is
          read, so somebody who moved is not made to restart an application to
          say so. */}
      <div className="row between g12 wrapf" style={{ alignItems: 'center' }}>
        <div className="col g4">
          <span className="label">{t('Applying in', 'आवेदन कहाँ')}</span>
          <span className="row g8" style={{ alignItems: 'center' }}>
            <b>{currentState
              ? t(currentState, STATE_HI[currentState])
              : t('Not chosen yet', 'अभी नहीं चुना')}</b>
            {currentState && !MODELLED.has(currentState) && (
              <Pill>{t('Sample offices', 'नमूना कार्यालय')}</Pill>
            )}
          </span>
        </div>
        <button className="btn btn-g btn-sm" onClick={onChangeState}>
          {currentState ? t('Change', 'बदलें') : t('Choose a state', 'राज्य चुनें')}
        </button>
      </div>
      <div>
        <button className="btn btn-s" onClick={() => { signOut(); onClose(); }}>
          {t('Sign out', 'साइन आउट')}
        </button>
      </div>
      {/* Signing out leaves the half-filled form alone on purpose: it belongs to
          this browser, and discarding it because somebody swapped numbers would
          lose work nobody asked to lose. "Reset the demo" is that button. */}
      <span className="tiny">
        {t('The application saved on this device is kept.',
          'इस डिवाइस पर सहेजा गया आवेदन रहेगा।')}
      </span>
    </div>
  );
}

function SignInForm({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [issued, setIssued] = useState<api.SignInCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (err: unknown, fallback: string) =>
    setError(err instanceof api.ApiError && err.status ? err.message : fallback);

  const ask = async (number = phone) => {
    setBusy(true); setError(null);
    try {
      const sent = await api.requestSignInCode(number);
      setIssued(sent);
      setCode('');
      return sent;
    } catch (err) {
      fail(err, t('The licence service is not responding.', 'लाइसेंस सेवा जवाब नहीं दे रही।'));
      return null;
    } finally { setBusy(false); }
  };

  const confirm = async (sent = issued, entered = code) => {
    if (!sent) return;
    setBusy(true); setError(null);
    try {
      const who = await api.verifySignInCode(sent.phone, entered);
      signIn(who.citizen_ref);
      onDone();
    } catch (err) {
      fail(err, t('That code did not work.', 'वह कोड काम नहीं आया।'));
    } finally { setBusy(false); }
  };

  /** Both halves in one press. The demo has three minutes; this costs none of them. */
  const useDemoNumber = async () => {
    setPhone(DEMO_PHONE);
    const sent = await ask(DEMO_PHONE);
    if (sent) await confirm(sent, sent.code);
  };

  const digits = phone.replace(/\D/g, '').length;

  return (
    <div className="col g16">
      <span className="sub">
        {t('One number ties your application, this site and Saarthi together. Nothing else is asked for.',
          'एक नंबर आपके आवेदन, इस साइट और सारथी को जोड़ता है। और कुछ नहीं पूछा जाता।')}
      </span>

      <div className="row g10 wrapf">
        <input
          className="input mono grow" inputMode="numeric" autoComplete="tel"
          style={{ minWidth: 150 }} placeholder="98200 11021"
          value={phone} disabled={busy || Boolean(issued)}
          onChange={e => setPhone(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !issued && digits >= 10) void ask(); }}
          aria-label={t('Mobile number', 'मोबाइल नंबर')}
        />
        {!issued
          ? (
            <button className="btn btn-p" disabled={busy || digits < 10} onClick={() => void ask()}>
              {busy ? t('Sending…', 'भेजा जा रहा है…') : t('Send code', 'कोड भेजें')}
            </button>
          )
          : (
            <button className="btn btn-g" disabled={busy} onClick={() => { setIssued(null); setError(null); }}>
              {t('Change', 'बदलें')}
            </button>
          )}
      </div>

      {issued && (
        <div className="col g10 fade">
          {/* The code and the reason it is on screen, in one block. Split apart,
              somebody reads the first without the second — which is how a
              stand-in gets mistaken for the real thing. */}
          <Note tone="brand">
            <b>{t('Code', 'कोड')} <span className="mono" style={{ fontSize: '1.2rem', letterSpacing: '.2em' }}>{issued.code}</span></b>
            <br />
            {t('No SMS was sent and nothing was verified — this stands in for the portal\'s Aadhaar sign-in.',
              'कोई SMS नहीं भेजा गया और कुछ सत्यापित नहीं हुआ — यह पोर्टल के आधार साइन-इन की जगह है।')}
          </Note>
          <div className="row g10 wrapf">
            <input
              className="input mono" inputMode="numeric" maxLength={4}
              style={{ width: 104, letterSpacing: '.2em' }} placeholder="0000"
              value={code} disabled={busy} onChange={e => setCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void confirm(); }}
              aria-label={t('Code', 'कोड')}
            />
            <button className="btn btn-p" disabled={busy || code.replace(/\D/g, '').length < 4}
              onClick={() => void confirm()}>
              {busy ? t('Checking…', 'जाँच हो रही है…') : t('Continue', 'आगे बढ़ें')} {Icon.right()}
            </button>
          </div>
        </div>
      )}

      {error && <Note tone="warn">{error}</Note>}

      {!issued && (
        <div className="col g6">
          <hr className="hr" />
          <div className="row between g12 wrapf" style={{ marginTop: 10 }}>
            <span className="tiny">{t('Presenting this?', 'यह दिखा रहे हैं?')}</span>
            <button className="btn btn-g btn-sm" disabled={busy} onClick={() => void useDemoNumber()}>
              {busy ? t('Signing in…', 'साइन इन हो रहा है…') : t('Sign in with the demo number', 'डेमो नंबर से साइन इन करें')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
