import { useState } from 'react';
import * as api from '../api';
import { usePolling } from '../lib/useApi';
import { useOffices } from '../lib/useOffices';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Pill } from '../ui/SharedUI';
import { useT } from '../lib/language';

/**
 * The inspector's side of the counter, and the waiting-hall board.
 *
 * The citizen's live queue is the central claim of this build, and until now
 * nothing could make it move: a token sat at "nobody ahead, 0 min" forever
 * because only the engine could advance a lane. Opening this beside the
 * tracker makes the claim watchable — call the next token here, and the wait
 * on the citizen's screen changes.
 */
export function Desk({ go, state }: PageProps) {
  const t = useT();
  const { offices } = useOffices(state.form?.state);
  const [rtoId, setRtoId] = useState(state.form?.rto || 'mh01');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Two seconds: this screen and the citizen's tracker are meant to be watched
  // side by side, so the board must not lag visibly behind the phone.
  const { data: board, refresh } = usePolling(
    signal => api.rtoBoard(rtoId, signal), { intervalMs: 2000, deps: [rtoId] });

  const callNext = async (testerId: string) => {
    setBusy(testerId); setError(null);
    try {
      await api.callNext(testerId);
      refresh();   // don't wait out the poll interval for the click to show
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not call the next token.');
    } finally { setBusy(null); }
  };

  const lanes = board?.lanes ?? [];
  const waitingTotal = lanes.reduce((sum, lane) => sum + lane.waiting, 0);
  const office = offices.find(o => o.id === rtoId);

  return (
    /* wrap, not narrow: narrow is a reading measure for prose, and this is a
       board. Held at 860 the lanes could never sit side by side however wide
       the monitor was. */
    <div className="wrap fade" style={{ padding: '48px 24px 64px' }}>
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }} onClick={() => go('home')}>{Icon.left()} {t('Home', 'होम', 'होम')}</button>
      {/* The heading and the sentence under it are still prose, so they keep a
          reading width of their own inside the wider board. */}
      <div className="col g14" style={{ alignItems: 'flex-start', marginBottom: 26, maxWidth: 720 }}>
        <Pill tone="brand">{Icon.dot()} {t('Staff view', 'कर्मचारी दृश्य')}</Pill>
        <h1>{t('Inspector desk', 'निरीक्षक डेस्क')}</h1>
        <p className="lede">
          {t('The same queue the applicant is watching on their phone. Call the next token here and their wait recalculates — one shared truth instead of a name shouted across a hall.',
            'वही कतार जो आवेदक अपने फ़ोन पर देख रहा है। यहाँ अगला टोकन बुलाइए और उनका इंतज़ार फिर से गणना हो जाएगा — हॉल में नाम पुकारने के बजाय एक साझा सच्चाई।')}
        </p>
      </div>

      <div className="card card-p col g14">
        <div className="row between g12 wrapf">
          <label className="col g4" style={{ flex: '1 1 240px' }}>
            <span className="tiny" style={{ fontWeight: 600 }}>{t('Office', 'कार्यालय')}</span>
            <select className="input" value={rtoId} onChange={e => setRtoId(e.target.value)}>
              {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <div className="col g4" style={{ textAlign: 'right' }}>
            <span className="tiny" style={{ fontWeight: 600 }}>{t('Waiting now', 'अभी प्रतीक्षा में')}</span>
            <b className="mono" style={{ fontSize: '1.6rem' }}>{waitingTotal}</b>
          </div>
        </div>
        {office && <span className="tiny">{office.area || office.name}</span>}
      </div>

      {!board && <p className="sub" style={{ marginTop: 20 }}>{t('Reading the board…', 'बोर्ड पढ़ा जा रहा है…')}</p>}

      {/* Side by side once there is room, stacked when there is not.
          A desk screen showing one lane at a time is the hall it replaces: the
          claim this page makes is that every queue is visible at once, and on a
          1920 monitor three lanes were still filing down a 860-pixel column
          with the rest of the display empty. auto-fit rather than a fixed
          column count, so an office with two inspectors does not leave a hole
          and one with six wraps instead of shrinking to nothing. */}
      <div className="lanes" style={{ marginTop: 20 }}>
        {lanes.map(lane => (
          <div key={lane.tester_id} className="card card-p col g12">
            <div className="row between g12 wrapf">
              <div className="col g4">
                <b style={{ fontWeight: 600 }}>{lane.tester}</b>
                <span className="tiny">
                  {t(`Averages ${lane.avg_test_minutes} minutes a test`,
                    `औसतन ${lane.avg_test_minutes} मिनट प्रति टेस्ट`)}
                </span>
              </div>
              <div className="col g4" style={{ textAlign: 'right' }}>
                <span className="tiny" style={{ fontWeight: 600 }}>{t('Now serving', 'अभी चल रहा है')}</span>
                <b className="mono" style={{ fontSize: '1.6rem' }}>
                  {lane.now_serving ?? '—'}
                </b>
              </div>
            </div>
            <hr className="hr" />
            <div className="row between g12 wrapf">
              <div className="col g4">
                <span className="tiny" style={{ fontWeight: 600 }}>{t('Next up', 'अगले')}</span>
                <span className="sub mono">
                  {lane.next_numbers.length ? lane.next_numbers.join(' · ') : t('Nobody waiting', 'कोई प्रतीक्षा में नहीं')}
                </span>
              </div>
              <button className="btn btn-p btn-sm" disabled={busy === lane.tester_id || !lane.waiting}
                onClick={() => void callNext(lane.tester_id)}>
                {busy === lane.tester_id
                  ? t('Calling…', 'बुलाया जा रहा है…')
                  : t('Call next', 'अगला बुलाएँ')} {Icon.right()}
              </button>
            </div>
            {/* The button is the honest place to say why it is disabled: an
                inspector with an empty lane has nobody to call. */}
            {!lane.waiting && (
              <span className="tiny">
                {t('This lane is clear. Check somebody in to see the queue move.',
                  'यह कतार खाली है। कतार चलती देखने के लिए किसी का चेक-इन करें।')}
              </span>
            )}
          </div>
        ))}
      </div>

      {error && <div style={{ marginTop: 16 }}><Note tone="warn">{error}</Note></div>}

      <div style={{ marginTop: 20 }}>
        <Note tone="brand" icon={Icon.bang()}>
          <b>{t('Why this screen exists.', 'यह स्क्रीन क्यों है।')}</b>{' '}
          {t('An applicant can only be told a real wait if somebody is recording what actually happens at the counter. Every "Call next" here is what makes the estimate on their phone true rather than decorative.',
            'आवेदक को वास्तविक इंतज़ार तभी बताया जा सकता है जब काउंटर पर जो हो रहा है वह दर्ज हो। यहाँ हर "अगला बुलाएँ" ही उनके फ़ोन का अनुमान सच बनाता है।')}
        </Note>
      </div>
    </div>
  );
}
