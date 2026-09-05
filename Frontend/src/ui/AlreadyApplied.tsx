import * as api from '../api';
import { NEXT_STAGE_ROUTE, nextStage } from '../data/applicationFlow';
import { useT } from '../lib/language';
import { useApi } from '../lib/useApi';
import type { AppState, Route } from '../types';
import { Icon } from './Icon';

/**
 * The application already filed under the signed-in number, or null.
 *
 * Read from the service rather than from `state.applicationId`, and the reason
 * is a trap rather than a preference: the tracker writes that field when a
 * citizen looks *somebody else's* application up by number and date of birth.
 * A gate reading local state would then tell a person who has never applied
 * that they already had, and show them their relative's number.
 *
 * `enabled` is a parameter rather than an early return because this is a hook.
 * A 404 is the ordinary answer for most people and is not an error worth
 * showing — it simply means the wizard should open.
 */
export function useExistingApplication(phone: string | null, enabled: boolean) {
  const { data } = useApi(
    signal => api.citizenApplication(phone!, signal),
    [phone],
    Boolean(phone) && enabled,
  );
  return data ?? null;
}

/**
 * Shown instead of the wizard when there is already an application.
 *
 * The wizard was reachable from six places written as "start an application",
 * and one press of browser Back from the slip landed on step one of a form the
 * citizen had just submitted, with a live Submit at the end of it. That is not
 * only confusing: the idempotency key is minted per mount, and the service
 * deduplicates on that key alone, so pressing through really did file a second
 * application.
 *
 * Gating here rather than inside the wizard is what fixes the key as well as
 * the confusion — the component never mounts, so it never mints a new one.
 */
export function AlreadyApplied({ application, state, go, onStartAnother }: {
  application: api.ApplicationView;
  state: AppState;
  go: (route: Route) => void;
  onStartAnother: () => void;
}) {
  const t = useT();

  // "Issued" comes from the record; everything before it can only come from the
  // browser, because the fee is not a call to the service and the test attempt
  // does not carry an application id. So a device with no local journey gets the
  // honest answer — here is your application — rather than a guess at how far
  // through it you are.
  const issued = application.status === 'issued';
  const next = state.stage ? nextStage(state) : undefined;
  const target = (next && NEXT_STAGE_ROUTE[next.k]) || 'status';

  const headline = issued
    ? t('You have already cleared your learner’s licence test.', 'आप अपना लर्नर लाइसेंस टेस्ट पहले ही पास कर चुके हैं।', 'तुम्ही तुमची लर्नर लायसन्स टेस्ट आधीच पास केली आहे.')
    : t('You have already applied.', 'आप पहले ही आवेदन कर चुके हैं।', 'तुम्ही आधीच अर्ज केला आहे.');

  const explain = issued
    ? t('There is nothing left to fill in. The next thing on this journey is the driving test, booked against this same licence.', 'भरने को कुछ नहीं बचा। इस सफर में अगली चीज़ है ड्राइविंग टेस्ट, जो इसी लाइसेंस पर बुक होता है।', 'भरण्यासारखे काही उरले नाही. या प्रवासातील पुढील गोष्ट म्हणजे ड्रायव्हिंग टेस्ट, जी याच लायसन्सवर बुक होते.')
    : next?.k === 'test'
      ? t('The form is filed and the fee is paid. What is left is the test itself, which is taken online.', 'फॉर्म दर्ज है और फीस भरी जा चुकी है। बाकी है सिर्फ़ टेस्ट, जो ऑनलाइन होता है।', 'फॉर्म दाखल आहे आणि फी भरली आहे. उरले आहे फक्त टेस्ट, जी ऑनलाइन होते.')
      : next
        ? t('The form is filed. The fee is what is outstanding.', 'फॉर्म दर्ज हो चुका है। फीस बाकी है।', 'फॉर्म दाखल झाला आहे. फी बाकी आहे.')
        : t('The form is filed. Open the tracker to see which stage it is at.', 'फॉर्म दर्ज हो चुका है। यह किस चरण पर है, ट्रैकर पर देखें।', 'फॉर्म दाखल झाला आहे. तो कोणत्या टप्प्यावर आहे ते ट्रॅकरवर पहा.');

  const primary = issued
    ? { label: t('Book the driving test', 'ड्राइविंग टेस्ट बुक करें', 'ड्रायव्हिंग टेस्ट बुक करा'), route: 'dl' as Route }
    : next?.k === 'test'
      ? { label: t('Take the test', 'टेस्ट दें', 'टेस्ट द्या'), route: target }
      : next
        ? { label: t('Pay the fee', 'फीस भरें', 'फी भरा'), route: target }
        : { label: t('Track this application', 'यह आवेदन ट्रैक करें', 'हा अर्ज ट्रॅक करा'), route: 'status' as Route };

  return (
    <div className="narrow fade" style={{ padding: '64px 24px' }}>
      <div className="card card-p col g16" style={{ maxWidth: 520 }}>
        <div className="col g6">
          <span className="eyebrow">{t('Application', 'आवेदन', 'अर्ज')} {application.application_no}</span>
          <h2>{headline}</h2>
          <p className="sub">{explain}</p>
        </div>
        <div className="row g10 wrapf">
          <button className="btn btn-p" onClick={() => go(primary.route)}>
            {primary.label} {Icon.right()}
          </button>
          {primary.route !== 'status' && (
            <button className="btn btn-s" onClick={() => go('status')}>
              {t('Track this application', 'यह आवेदन ट्रैक करें', 'हा अर्ज ट्रॅक करा')}
            </button>
          )}
        </div>
        {/* Quiet, and deliberately last. There is no other way out of this gate
            — nothing on the site clears a journey — so without it somebody
            filling the form in for a relative on their own phone would be
            locked out of the wizard for good. It is not the thing most people
            arriving here want, which is why it does not look like a button. */}
        <div>
          <button className="btn btn-g btn-sm" onClick={onStartAnother}>
            {t('Start a different application', 'एक अलग आवेदन शुरू करें', 'वेगळा अर्ज सुरू करा')}
          </button>
        </div>
      </div>
    </div>
  );
}
