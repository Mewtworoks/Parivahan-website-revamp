import { PRE_BASE, preFor } from '../data/applicant';
import { rtosFor } from '../data/rtoOffices';
import { CLASSES } from '../data/vehicleClasses';
import { useT } from '../lib/language';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { LicenceCard } from '../ui/LicenceCard';
import { Pill, Timeline } from '../ui/SharedUI';

/** Formats an ISO "YYYY-MM-DD" date as "DD/MM/YYYY", the way it's printed on the physical card. */
function asCardDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** DD/MM/YYYY for a Date, plus the six-month validity the LL carries. */
function cardDates(submittedAt?: string): { issue: string; validTill: string } {
  const issued = submittedAt ? new Date(submittedAt) : new Date();
  const expiry = new Date(issued);
  expiry.setMonth(expiry.getMonth() + 6);
  expiry.setDate(expiry.getDate() - 1);
  const fmt = (d: Date) => [String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'), d.getFullYear()].join('/');
  return { issue: fmt(issued), validTill: fmt(expiry) };
}

/**
 * The licence number, derived from the application the service issued so the
 * card matches the record behind it. The real format is RTO code, year, then
 * the serial — SS-2026-004182 at MH-01 becomes "MH01 2026/004182".
 */
function licenceNumber(rtoCode: string, applicationNo?: string): string {
  const serial = applicationNo?.split('-').pop();
  const year = applicationNo?.split('-')[1] || String(new Date().getFullYear());
  return serial ? `${rtoCode.replace(/-/g, '')} ${year}/${serial}` : `${rtoCode.replace(/-/g, '')} —`;
}

/** The issued Form 3 licence, plus a preview of what happens over the next six months. */
export function Issued({ go, state }: PageProps) {
  const t = useT();
  const form = state.form || {};
  const classIds = form.classes || ['MCWG'];
  const stateName = form.state || 'Maharashtra';
  const prefill = preFor(stateName);
  const applicantName = [form.first ?? PRE_BASE.first, form.last ?? PRE_BASE.last].join(' ');
  const relation = `${form.relType ?? PRE_BASE.relType} ${form.relFirst ?? PRE_BASE.relFirst} ${form.relLast ?? PRE_BASE.relLast}`;
  const office = rtosFor(stateName).find(r => r.id === form.rto) || rtosFor(stateName)[0];
  const rtoCode = office.name.match(/\(([^)]+)\)/)?.[1] || office.name;
  // The score and its total both come from the service that marked the test —
  // the UI must not divide by a question count of its own.
  const { issue, validTill } = cardDates(state.app?.submittedAt);

  return (
    <div className="narrow fade" style={{ padding: '48px 24px 0' }}>
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }} onClick={() => go('home')}>{Icon.left()} {t('Home', 'होम', 'होम')}</button>
      <div className="col g14" style={{ alignItems: 'flex-start', marginBottom: 26 }}>
        <Pill tone="ok">{Icon.check()} {t(`Passed · ${state.score ?? 0} of ${state.scoreTotal ?? 10}`, `उत्तीर्ण · ${state.scoreTotal ?? 10} में से ${state.score ?? 0}`, `उत्तीर्ण · ${state.scoreTotal ?? 10} पैकी ${state.score ?? 0}`)}</Pill>
        <h1>{t("Your learner's licence is issued.", 'आपका लर्नर लाइसेंस जारी हो गया है।', 'तुमचे लर्नर लायसन्स जारी झाले आहे.')}</h1>
        <p className="lede">{t(
          'Form 3, valid for six months. Practise with an L plate on the vehicle and a licensed holder of the same class beside you — that is a legal condition, not advice.',
          'फॉर्म 3, छह महीने के लिए मान्य। वाहन पर L प्लेट लगाकर और अपने साथ उसी श्रेणी का लाइसेंस रखने वाले को बिठाकर अभ्यास करें — यह कानूनी शर्त है, सलाह नहीं।',
          'फॉर्म 3, सहा महिन्यांसाठी वैध. वाहनावर L प्लेट लावून आणि सोबत त्याच श्रेणीचे लायसन्स असलेल्या व्यक्तीला बसवून सराव करा — ही कायदेशीर अट आहे, सल्ला नाही.',
        )}</p>
      </div>
      <LicenceCard documentTitle={t("Learner's Licence", 'लर्नर लाइसेंस', 'लर्नर लायसन्स')} stateName={stateName} licenceNo={licenceNumber(rtoCode, state.app?.no)}
        name={applicantName} relation={relation} dob={asCardDate(form.dob || PRE_BASE.dob)} blood={form.blood || PRE_BASE.blood}
        addressLine1={`${form.line ?? prefill.line}, ${form.street ?? prefill.street}`} addressLine2={`${form.city ?? prefill.city} ${form.pin ?? prefill.pin}`}
        classCodes={classIds.map(id => CLASSES.find(c => c.id === id)!.code).join(', ')}
        issueDate={issue} validTill={validTill} rtoCode={rtoCode} />
      <div className="row g10 wrapf" style={{ marginTop: 16 }}>
        <button className="btn btn-s btn-sm">{Icon.doc()} {t('Download Form 3', 'फॉर्म 3 डाउनलोड करें', 'फॉर्म 3 डाउनलोड करा')}</button>
        <button className="btn btn-s btn-sm">{Icon.card({ width: 16, height: 16 })} {t('Add to phone wallet', 'फोन वॉलेट में जोड़ें', 'फोन वॉलेटमध्ये जोडा')}</button>
      </div>
      <div className="card card-p col g14" style={{ marginTop: 24 }}>
        <h3>{t('What happens next', 'आगे क्या होगा', 'पुढे काय होईल')}</h3>
        <Timeline items={[
          {
            state: 'now', tone: 'brand',
            title: t('Practise for 30 days', '30 दिन अभ्यास करें', '30 दिवस सराव करा'),
            tag: t('Until 20 Sep', '20 सितंबर तक', '20 सप्टेंबरपर्यंत'),
            body: t(
              'The law sets a minimum of 30 days as a learner and a maximum of 180. We will remind you the day the window opens and again before it closes.',
              'कानून लर्नर के तौर पर कम से कम 30 दिन और ज़्यादा से ज़्यादा 180 दिन तय करता है। जिस दिन यह अवधि खुलेगी हम आपको याद दिलाएँगे, और बंद होने से पहले दोबारा।',
              'कायदा लर्नर म्हणून किमान 30 दिवस आणि जास्तीत जास्त 180 दिवस ठरवतो. ही मुदत सुरू होईल त्या दिवशी आम्ही तुम्हाला आठवण करून देऊ, आणि ती संपण्यापूर्वी पुन्हा.',
            ),
          },
          // The hand-off is real now: the driving test books against this same
          // application, so nothing has to be typed in again on the far side.
          {
            state: 'todo',
            title: t('Book the driving test', 'ड्राइविंग टेस्ट बुक करें', 'ड्रायव्हिंग टेस्ट बुक करा'),
            body: t(
              'Nothing to type. You are signed in, so the driving-test screen finds this licence and books the appointment against it.',
              'कुछ टाइप नहीं करना। आप साइन इन हैं, इसलिए ड्राइविंग टेस्ट स्क्रीन यही लाइसेंस ढूंढ लेती है और उसी पर अपॉइंटमेंट बुक करती है।',
              'काहीही टाइप करायचे नाही. तुम्ही साइन इन आहात, त्यामुळे ड्रायव्हिंग टेस्ट स्क्रीन हेच लायसन्स शोधते आणि त्यावरच भेटीची वेळ बुक करते.',
            ),
          },
        ]} />
      </div>
      <div className="sticky-cta"><div className="row g12 wrapf">
        <button className="btn btn-p" onClick={() => go('dl')}>{t('Book the driving test', 'ड्राइविंग टेस्ट बुक करें', 'ड्रायव्हिंग टेस्ट बुक करा')} {Icon.right()}</button>
        <button className="btn btn-s" onClick={() => go('status')}>{t('Go to my applications', 'मेरे आवेदनों पर जाएँ', 'माझ्या अर्जांवर जा')}</button>
      </div></div>
    </div>
  );
}
