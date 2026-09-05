import { useEffect, useRef } from 'react';
import { PRE_BASE, preFor } from '../data/applicant';
import { rtosFor } from '../data/rtoOffices';
import { CLASSES } from '../data/vehicleClasses';
import { AUTO_READ_DELAY, autoScrollToBottom, autoWait } from '../lib/autoDemo';
import { formatDay } from '../lib/format';
import { useT } from '../lib/language';
import type { PageProps } from '../types';
import { DocLinks } from '../ui/DocLinks';
import { Icon } from '../ui/Icon';
import { Note, Pill } from '../ui/SharedUI';
import { StageTable } from '../ui/StageTable';

/** Submission confirmation — the Application Reference Slip, the one number you need for everything after this. */
export function Slip({ go, state, update }: PageProps) {
  const t = useT();
  const form = state.form || {};
  const classIds = form.classes || [];
  const isAadhaar = form.route === 'aadhaar';
  const applicantName = [form.first ?? PRE_BASE.first, form.mid ?? PRE_BASE.mid, form.last ?? PRE_BASE.last].filter(Boolean).join(' ');
  const prefill = preFor(form.state);
  const office = rtosFor(form.state || 'Maharashtra').find(r => r.id === form.rto) || rtosFor(form.state || 'Maharashtra')[0];
  const classCodes = classIds.map(id => CLASSES.find(c => c.id === id)!.code).join(', ') || '—';

  const ran = useRef(false);
  useEffect(() => {
    if (state.autoDemo !== 'll' || ran.current) return;
    ran.current = true;
    void (async () => { await autoWait(); await autoScrollToBottom(); await autoWait(AUTO_READ_DELAY); update({ stage: 'esign' }); go('pay'); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.autoDemo]);

  return (
    <div className="narrow fade" style={{ padding: '48px 24px 0' }}>
      <div className="col g14" style={{ alignItems: 'flex-start', marginBottom: 24 }}>
        <span style={{ width: 52, height: 52, borderRadius: 999, background: 'var(--ok-soft)', color: 'var(--ok)', display: 'grid', placeItems: 'center', border: '1px solid var(--brand-line)' }}>{Icon.check({ width: 22, height: 22 })}</span>
        <h1>{t('Submitted. Quote this number for everything that follows.', 'जमा हो गया। अब से हर जगह यही नंबर बताएं।', 'सादर झाले. यापुढे सर्वत्र हाच क्रमांक सांगा.')}</h1>
        <p className="lede">{t('The official portal calls this the Application Reference Slip. It is the only thing you need to come back to any stage — with your date of birth.', 'आधिकारिक पोर्टल इसे एप्लीकेशन रेफरेंस स्लिप कहता है। किसी भी चरण पर वापस आने के लिए आपको केवल यही चाहिए — अपनी जन्म तिथि के साथ।', 'अधिकृत पोर्टल याला अ‍ॅप्लिकेशन रेफरन्स स्लिप म्हणते. कोणत्याही टप्प्यावर परत येण्यासाठी तुम्हाला फक्त हेच हवे — तुमच्या जन्मतारखेसह.')}</p>
      </div>
      <div className="card card-p col g16">
        <div className="row between g12 wrapf"><h3>{t('Application reference slip', 'आवेदन संदर्भ पर्ची', 'अर्ज संदर्भ चिठ्ठी')}</h3><Pill tone="ok">{t('Submitted', 'जमा किया गया', 'सादर केले')}</Pill></div>
        <div className="flat col g10" style={{ padding: '16px 18px' }}>
          <div className="row between g12 wrapf"><span className="sub">{t('Application number', 'आवेदन नंबर', 'अर्ज क्रमांक')}</span><b className="mono" style={{ fontSize: '1.15rem' }}>{state.app?.no || '—'}</b></div>
          <hr className="hr" />
          <dl className="kv">
            <dt>{t('Name', 'नाम', 'नाव')}</dt><dd>{applicantName}</dd>
            <dt>{t('Date of birth', 'जन्म तिथि', 'जन्मतारीख')}</dt><dd>{form.dob || PRE_BASE.dob}</dd>
            <dt>{t('Application date', 'आवेदन तिथि', 'अर्ज तारीख')}</dt><dd>{formatDay(state.app?.submittedAt)}</dd>
            <dt>{t('Service requested', 'मांगी गई सेवा', 'विनंती केलेली सेवा')}</dt><dd>{t("Issue of new learner's licence", 'नई लर्नर लाइसेंस जारी करना', 'नवीन लर्नर लायसन्स जारी करणे')}</dd>
            <dt>{t('Classes', 'श्रेणियां', 'वर्ग')}</dt><dd>{classCodes}</dd>
            <dt>{t('RTO', 'आरटीओ', 'आरटीओ')}</dt><dd>{office.name}</dd>
          </dl>
        </div>
        <div className="flat col g10" style={{ padding: '14px 16px' }}>
          <div className="row between g12" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
            <span className="tiny" style={{ fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>{t('Service requested', 'मांगी गई सेवा', 'विनंती केलेली सेवा')}</span>
            <span className="tiny" style={{ fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>{t('Documentary proof required', 'आवश्यक दस्तावेज़ी प्रमाण', 'आवश्यक कागदोपत्री पुरावा')}</span>
          </div>
          <div className="row between g16" style={{ alignItems: 'flex-start' }}>
            <span style={{ fontWeight: 600, fontSize: '.92rem' }}>{t(`Issue of new LL (${classCodes})`, `नई LL जारी करना (${classCodes})`, `नवीन LL जारी करणे (${classCodes})`)}</span>
            <span className="sub" style={{ textAlign: 'right', maxWidth: 210 }}>{isAadhaar ? t('None — all proofs taken from e-KYC', 'कोई नहीं — सभी प्रमाण e-KYC से लिए गए', 'काहीही नाही — सर्व पुरावे e-KYC मधून घेतले') : t('Age proof and address proof, originals at the counter', 'आयु प्रमाण और पता प्रमाण, काउंटर पर मूल प्रति', 'वय पुरावा आणि पत्ता पुरावा, काउंटरवर मूळ प्रत')}</span>
          </div>
        </div>
        <div className="grid2" style={{ gap: 16 }}>
          <div className="col g6"><span className="tiny" style={{ fontWeight: 600 }}>{t('Applicant address', 'आवेदक का पता', 'अर्जदाराचा पत्ता')}</span>
            <span className="sub">{form.line ?? prefill.line}, {form.street ?? prefill.street}<br />{form.city ?? prefill.city} {form.pin ?? prefill.pin}<br />{form.state || 'Maharashtra'}</span></div>
          <div className="col g6"><span className="tiny" style={{ fontWeight: 600 }}>{t('RTO location', 'आरटीओ स्थान', 'आरटीओ ठिकाण')}</span>
            <span className="sub">{office.name}<br />{office.area}</span></div>
        </div>
        <div className="col g8">
          <span className="tiny row g8"><span style={{ color: 'var(--ok)' }}>{Icon.check()}</span> {t(`An SMS has been sent to ${form.phone || '98•••• ••21'}.`, `${form.phone || '98•••• ••21'} पर एक SMS भेजा गया है।`, `${form.phone || '98•••• ••21'} वर एक SMS पाठवला आहे.`)}</span>
          <span className="tiny row g8"><span style={{ color: 'var(--ok)' }}>{Icon.check()}</span> {t(`A copy has gone to ${form.email || PRE_BASE.email}, with the e-signed Form 2 attached.`, `${form.email || PRE_BASE.email} पर एक प्रति भेजी गई है, साथ में ई-हस्ताक्षरित फॉर्म 2।`, `${form.email || PRE_BASE.email} वर एक प्रत पाठवली आहे, सोबत ई-स्वाक्षरी केलेला फॉर्म 2.`)}</span>
          <span className="tiny row g8"><span style={{ color: 'var(--ok)' }}>{Icon.check()}</span> {isAadhaar ? t('Submitted through e-KYC — faceless and contactless.', 'e-KYC के ज़रिए जमा किया गया — फेसलेस और संपर्क रहित।', 'e-KYC द्वारे सादर केले — फेसलेस आणि संपर्करहित.') : t('Submitted without Aadhaar — one verification visit required.', 'आधार के बिना जमा किया गया — एक सत्यापन यात्रा आवश्यक।', 'आधारशिवाय सादर केले — एक पडताळणी भेट आवश्यक.')}</span>
        </div>
        <Note>{isAadhaar
          ? t('Because this is a faceless application you are not required to visit the RTO. Acceptance is still subject to scrutiny of the details you submitted — if anything is reverted you will be told what to correct, on this screen, in words.', 'यह फेसलेस आवेदन होने के कारण आपको आरटीओ जाने की ज़रूरत नहीं। स्वीकृति फिर भी आपके दिए विवरण की जांच पर निर्भर है — यदि कुछ वापस भेजा जाता है तो आपको बताया जाएगा कि क्या ठीक करना है, इसी स्क्रीन पर, शब्दों में।', 'हा फेसलेस अर्ज असल्याने तुम्हाला आरटीओला जायची गरज नाही. मान्यता तरीही तुम्ही दिलेल्या तपशीलांच्या तपासणीवर अवलंबून आहे — काही परत पाठवले गेले तर तुम्हाला काय दुरुस्त करायचे ते याच स्क्रीनवर, शब्दांत सांगितले जाईल.')
          : t('You will be asked to appear at the office with your originals. The slot booking stage below is where you choose when.', 'आपको मूल दस्तावेज़ों के साथ कार्यालय आने को कहा जाएगा। नीचे स्लॉट बुकिंग चरण पर आप समय चुनते हैं।', 'तुम्हाला मूळ कागदपत्रांसह कार्यालयात येण्यास सांगितले जाईल. खाली स्लॉट बुकिंग टप्प्यावर तुम्ही वेळ निवडता.')}</Note>
        <hr className="hr" />
        <DocLinks />
      </div>
      <div style={{ marginTop: 16 }}><StageTable state={state} go={go} /></div>
      <div className="sticky-cta"><button className="btn btn-p" style={{ maxWidth: 340 }} onClick={() => { update({ stage: 'esign' }); go('pay'); }}>{t('Pay the fee', 'फीस भरें', 'फी भरा')} {Icon.right()}</button></div>
    </div>
  );
}
