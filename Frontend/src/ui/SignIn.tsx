import { useState } from 'react';
import * as api from '../api';
import { prettyPhone, signIn, signOut } from '../lib/identity';
import { useT } from '../lib/language';
import { Icon } from './Icon';
import { Note, Pill, Sheet } from './SharedUI';

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

export function IdentitySheet({ phone, onClose }: { phone: string | null; onClose: () => void }) {
  const t = useT();
  return (
    <Sheet
      title={phone ? t('Your profile', 'आपकी प्रोफ़ाइल') : t('Sign in', 'साइन इन')}
      onClose={onClose}
    >
      {phone ? <Profile phone={phone} onClose={onClose} /> : <SignInForm onDone={onClose} />}
    </Sheet>
  );
}

function Profile({ phone, onClose }: { phone: string; onClose: () => void }) {
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
