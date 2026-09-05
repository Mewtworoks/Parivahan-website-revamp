import { useState } from 'react';
import { useT } from '../lib/language';
import type { AppState } from '../types';
import { Icon } from './Icon';
import { Field, Input, Note, Pill, Sheet } from './SharedUI';

/** A short, deterministic reference number so repeated demo submissions don't look identical. */
function grievanceRef(appNo: string, description: string): string {
  let hash = 0;
  for (const ch of appNo + description) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `GRV-${(hash % 900000 + 100000)}`;
}

/** The "Report a problem" flow — file a grievance against an application, get a reference and a response window. */
export function GrievanceSheet({ state, onClose }: { state: AppState; onClose: () => void }) {
  // Opened from a footer link that is translated. Arriving at an entirely
  // English sheet from a Hindi page is the site changing language on somebody
  // for pressing a button — and this is the screen for reporting that
  // something went wrong, which is the worst one to be unable to read.
  const t = useT();
  const [appNo, setAppNo] = useState(state.app?.no || '');
  const [description, setDescription] = useState('');
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const canSubmit = appNo.trim().length > 0 && description.trim().length > 0;

  return (
    <Sheet title={t('Report a problem', 'समस्या दर्ज करें', 'समस्या नोंदवा')} onClose={onClose}>
      <div className="col g20">
        {submittedRef ? (
          <div className="col g16 fade">
            <div className="row g12"><Pill tone="ok">{Icon.check()} {t('Grievance logged', 'शिकायत दर्ज हुई', 'तक्रार नोंदवली')}</Pill></div>
            <div className="flat col g10" style={{ padding: '16px 18px' }}>
              <div className="row between g12 wrapf"><span className="sub">{t('Reference number', 'संदर्भ संख्या', 'संदर्भ क्रमांक')}</span><b className="mono" style={{ fontSize: '1.05rem' }}>{submittedRef}</b></div>
              <hr className="hr" />
              <div className="row between g16 wrapf"><span className="sub">{t('Application', 'आवेदन', 'अर्ज')}</span><b className="mono">{appNo}</b></div>
            </div>
            <Note tone="ok" icon={Icon.check()}>{t('The office handling this application has 7 days to respond, with the stage it failed at already attached — no re-explaining. Quote the reference number above for any follow-up.', 'इस आवेदन को देख रहे कार्यालय को 7 दिन में जवाब देना है, और वह चरण पहले से जुड़ा है जहां यह अटका — दोबारा समझाने की ज़रूरत नहीं। किसी भी आगे की बात के लिए ऊपर दी संदर्भ संख्या बताएं।', 'हा अर्ज हाताळणाऱ्या कार्यालयाला 7 दिवसांत उत्तर द्यायचे आहे, आणि तो टप्पा आधीच जोडलेला आहे जिथे तो अडकला — पुन्हा समजावण्याची गरज नाही. पुढील कोणत्याही पाठपुराव्यासाठी वरील संदर्भ क्रमांक सांगा.')}</Note>
            <Note>{t('Mock prototype. Nothing was actually filed or sent anywhere.', 'नकली प्रोटोटाइप। असल में कुछ भी दर्ज या कहीं नहीं भेजा गया।', 'नकली प्रोटोटाइप. प्रत्यक्षात काहीही नोंदवले किंवा कुठेही पाठवले गेले नाही.')}</Note>
          </div>
        ) : (
          <>
            <p className="sub" style={{ lineHeight: 1.6 }}>{t("File a grievance against your application number, with the stage it's stuck at, so the office handling it doesn't need the story re-explained.", 'अपने आवेदन नंबर पर शिकायत दर्ज करें, उस चरण के साथ जहां यह अटका है, ताकि इसे देख रहे कार्यालय को पूरी कहानी दोबारा न समझानी पड़े।', 'तुमच्या अर्ज क्रमांकावर तक्रार नोंदवा, तो अडकलेल्या टप्प्यासह, जेणेकरून तो हाताळणाऱ्या कार्यालयाला संपूर्ण कहाणी पुन्हा समजावून सांगावी लागणार नाही.')}</p>
            <Field label={t('Application number', 'आवेदन नंबर', 'अर्ज क्रमांक')} hint={t('Find this on your reference slip or the tracker page.', 'यह आपकी संदर्भ पर्ची या ट्रैकर पेज पर मिलेगा।', 'हे तुमच्या संदर्भ पावतीवर किंवा ट्रॅकर पानावर मिळेल.')}>
              <Input className="input mono" placeholder="SS-2026-004182" value={appNo} onChange={e => setAppNo(e.target.value)} />
            </Field>
            <Field label={t('What went wrong', 'क्या गलत हुआ', 'काय चूक झाली')}>
              <textarea className="input" rows={4} placeholder={t('e.g. My payment was deducted but the application still shows unpaid.', 'जैसे, मेरा भुगतान कट गया लेकिन आवेदन अब भी अवैतनिक दिखा रहा है।', 'उदा. माझे पैसे कापले गेले पण अर्ज अजूनही न भरलेला दाखवतो.')} value={description} onChange={e => setDescription(e.target.value)} />
            </Field>
            <button className="btn btn-p" disabled={!canSubmit} onClick={() => setSubmittedRef(grievanceRef(appNo, description))}>{t('File grievance', 'शिकायत दर्ज करें', 'तक्रार नोंदवा')} {Icon.right()}</button>
            <Note>{t("A grievance that isn't answered inside the stated window escalates on its own — you don't have to follow up. Mock prototype: nothing is actually sent.", 'तय समय में जिस शिकायत का जवाब न आए वह अपने आप ऊपर चली जाती है — आपको पीछे पड़ने की ज़रूरत नहीं। नकली प्रोटोटाइप: असल में कुछ नहीं भेजा जाता।', 'ठरलेल्या वेळेत ज्या तक्रारीचे उत्तर येत नाही ती आपोआप वर जाते — तुम्हाला पाठपुरावा करावा लागत नाही. नकली प्रोटोटाइप: प्रत्यक्षात काहीही पाठवले जात नाही.')}</Note>
          </>
        )}
      </div>
    </Sheet>
  );
}
