import { useState } from 'react';
import { SEED_STATUS } from '../data/applicant';
import { rtosFor } from '../data/rtoOffices';
import { CLASSES } from '../data/vehicleClasses';
import { useT } from '../lib/language';
import { TODAY_ISO } from '../lib/validate';
import type { PageProps } from '../types';
import { DocLinks } from '../ui/DocLinks';
import { Icon } from '../ui/Icon';
import { Field, Input, Note, Pill } from '../ui/SharedUI';
import { StageTable } from '../ui/StageTable';

/** Application tracker — look up an application number + DOB, see every stage and what's next. */
export function Status({ go, state }: PageProps) {
  const t = useT();
  const form = state.form || {};
  const hasLiveApplication = !!state.app || !!state.stage;
  const [applicationNo, setApplicationNo] = useState(hasLiveApplication ? 'SS-2026-004182' : '');
  const [dob, setDob] = useState(hasLiveApplication ? (form.dob || '2005-04-12') : '');
  const [found, setFound] = useState(hasLiveApplication);
  const isAadhaar = form.route === 'aadhaar';
  const applicantName = [form.first, form.last].filter(Boolean).join(' ') || SEED_STATUS.name;
  const classCodes = (form.classes || []).map(id => CLASSES.find(c => c.id === id)?.code).filter(Boolean).join(', ') || SEED_STATUS.cls;
  const rtoName = (rtosFor(form.state || 'Maharashtra').find(r => r.id === form.rto) || rtosFor(form.state || 'Maharashtra')[0]).name;

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }} onClick={() => go('home')}>{Icon.left()} Home</button>
      <div className="col g10" style={{ marginBottom: 26 }}>
        <span className="eyebrow">{t('Track an application', 'एक आवेदन ट्रैक करें', 'एक अर्ज ट्रॅक करा')}</span>
        <h1>{t('Where your application is', 'आपका आवेदन कहां है', 'तुमचा अर्ज कुठे आहे')}</h1>
        <p className="lede">{t('The official portal asks for your application number, your date of birth and a captcha, then shows a table of stage names. Same two inputs, no captcha, and each stage says what it means for you.', 'आधिकारिक पोर्टल आपका आवेदन नंबर, जन्म तिथि और एक कैप्चा मांगता है, फिर चरण नामों की एक तालिका दिखाता है। वही दो इनपुट, कोई कैप्चा नहीं, और हर चरण बताता है कि आपके लिए इसका क्या मतलब है।', 'अधिकृत पोर्टल तुमचा अर्ज क्रमांक, जन्मतारीख आणि एक कॅप्चा मागते, नंतर टप्प्यांच्या नावांचा तक्ता दाखवते. तेच दोन इनपुट, कॅप्चा नाही, आणि प्रत्येक टप्पा सांगतो की तुमच्यासाठी त्याचा अर्थ काय आहे.')}</p>
      </div>
      <div className="card card-p col g16">
        <div className="grid2">
          <Field label={t('Application number', 'आवेदन नंबर', 'अर्ज क्रमांक')}><Input className="input mono" placeholder="SS-2026-004182" value={applicationNo} onChange={e => setApplicationNo(e.target.value)} /></Field>
          <Field label={t('Date of birth', 'जन्म तिथि', 'जन्मतारीख')}><Input type="date" max={TODAY_ISO} value={dob} onChange={e => setDob(e.target.value)} /></Field>
        </div>
        <div className="row g10 wrapf">
          <button className="btn btn-s" disabled={!applicationNo || !dob} onClick={() => setFound(true)}>{Icon.search()} {t('Find my application', 'मेरा आवेदन खोजें', 'माझा अर्ज शोधा')}</button>
          {!hasLiveApplication && <span className="tiny" style={{ alignSelf: 'center' }}>{t('Try SS-2026-004182 with any date.', 'किसी भी तारीख के साथ SS-2026-004182 आज़माएं।', 'कोणत्याही तारखेसह SS-2026-004182 वापरून पहा.')}</span>}
        </div>
      </div>
      {found && (
        <div className="col g16 fade" style={{ marginTop: 16 }}>
          <div className="card card-p col g16">
            <div className="row between g16 wrapf" style={{ alignItems: 'flex-start' }}>
              <dl className="kv grow" style={{ minWidth: 230 }}>
                <dt>{t('Application', 'आवेदन', 'अर्ज')}</dt><dd className="mono">SS-2026-004182</dd>
                <dt>{t('Applied on', 'आवेदन तिथि', 'अर्ज तारीख')}</dt><dd>21 Aug 2026</dd>
                <dt>{t('Applicant', 'आवेदक', 'अर्जदार')}</dt><dd>{applicantName}</dd><dt>{t('Service', 'सेवा', 'सेवा')}</dt><dd>{t("Issue of learner's licence", 'लर्नर लाइसेंस जारी करना', 'लर्नर लायसन्स जारी करणे')}</dd>
                <dt>{t('Classes', 'श्रेणियां', 'वर्ग')}</dt><dd>{classCodes}</dd><dt>{t('RTO', 'आरटीओ', 'आरटीओ')}</dt><dd>{rtoName}</dd>
                <dt>{t('Route', 'रास्ता', 'मार्ग')}</dt><dd>{isAadhaar ? t('Aadhaar e-KYC · faceless', 'आधार e-KYC · फेसलेस', 'आधार e-KYC · फेसलेस') : t('Without Aadhaar', 'आधार के बिना', 'आधारशिवाय')}</dd>
              </dl>
              <div className="col g8" style={{ flex: 'none', alignItems: 'center' }}>
                <div className="stripe" style={{ width: 88, height: 106, borderRadius: 8, border: '1px solid var(--line)' }} />
                <Pill tone={state.stage === 'issued' ? 'ok' : 'brand'}>{state.stage === 'issued' ? t('Licence issued', 'लाइसेंस जारी', 'लायसन्स जारी') : t('In progress', 'प्रगति में', 'प्रगतीत')}</Pill>
              </div>
            </div>
            {isAadhaar && <Note tone="ok" icon={Icon.check()}><b>{t('Submitted for contactless service.', 'संपर्क रहित सेवा के लिए जमा किया गया।', 'संपर्करहित सेवेसाठी सादर केले.')}</b> {t('No visit to the RTO office is needed for this application.', 'इस आवेदन के लिए आरटीओ कार्यालय जाने की ज़रूरत नहीं है।', 'या अर्जासाठी आरटीओ कार्यालयात जाण्याची गरज नाही.')}</Note>}
            <hr className="hr" />
            <DocLinks />
          </div>
          <StageTable state={state} go={go} />
          {state.stage === 'issued' && <Note tone="ok" icon={Icon.check()}>{t('Learner\'s licence MH02 20260/0041 issued and valid to 20 Feb 2027. The driving licence window opens 20 Sep 2026 — we will remind you.', 'लर्नर लाइसेंस MH02 20260/0041 जारी हुआ और 20 फरवरी 2027 तक वैध है। ड्राइविंग लाइसेंस विंडो 20 सितंबर 2026 को खुलती है — हम आपको याद दिलाएंगे।', 'लर्नर लायसन्स MH02 20260/0041 जारी झाले आणि 20 फेब्रुवारी 2027 पर्यंत वैध आहे. ड्रायव्हिंग लायसन्स विंडो 20 सप्टेंबर 2026 रोजी उघडते — आम्ही तुम्हाला आठवण करून देऊ.')}</Note>}
          <div className="card card-p col g12">
            <h3>{t('Test result and allotment', 'टेस्ट परिणाम और आवंटन', 'टेस्ट निकाल आणि वाटप')}</h3>
            {state.stage === 'issued'
              ? <div className="row between g12 wrapf"><span className="sub">{t('Recording LL test results', 'LL टेस्ट परिणाम दर्ज करना', 'LL टेस्ट निकाल नोंदवणे')}</span><Pill tone="ok">{t('Passed · licence generated', 'पास · लाइसेंस बना', 'उत्तीर्ण · लायसन्स तयार')}</Pill></div>
              : <div className="row between g12 wrapf"><span className="sub">{t('Recording LL test results', 'LL टेस्ट परिणाम दर्ज करना', 'LL टेस्ट निकाल नोंदवणे')}</span><Pill>{t('Not yet — test pending', 'अभी नहीं — टेस्ट लंबित', 'अजून नाही — टेस्ट प्रलंबित')}</Pill></div>}
            <span className="tiny">{t('The official portal shows this as a Counter column reading "Allotment Information Unavailable", which tells you nothing. Here it says what is actually pending and what unblocks it.', 'आधिकारिक पोर्टल इसे एक Counter कॉलम में "Allotment Information Unavailable" के रूप में दिखाता है, जो कुछ नहीं बताता। यहां बताया जाता है कि वास्तव में क्या लंबित है और उसे क्या खोलता है।', 'अधिकृत पोर्टल हे एका Counter स्तंभात "Allotment Information Unavailable" असे दाखवते, जे काहीही सांगत नाही. इथे सांगितले जाते की प्रत्यक्षात काय प्रलंबित आहे आणि ते काय उघडते.')}</span>
          </div>
          <Note>{t('If a stage is ever Reverted on the real portal it means a document was rejected, and the reason is a code. Here it would say which document, what was wrong with it, and give you the one button that fixes it.', 'यदि असली पोर्टल पर कोई चरण कभी Reverted होता है तो इसका मतलब है कि एक दस्तावेज़ रद्द हुआ, और कारण एक कोड है। यहां बताया जाता कि कौन सा दस्तावेज़, उसमें क्या गलत था, और इसे ठीक करने वाला एक बटन दिया जाता।', 'खऱ्या पोर्टलवर एखादा टप्पा कधी Reverted झाला तर याचा अर्थ एक कागदपत्र नाकारले गेले, आणि कारण एक कोड आहे. इथे कोणते कागदपत्र, त्यात काय चुकीचे होते, आणि ते दुरुस्त करणारे एक बटण दिले जाईल.')}</Note>
        </div>
      )}
      <div style={{ height: 56 }} />
    </div>
  );
}
