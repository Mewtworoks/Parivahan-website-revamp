import { useState } from 'react';
import { DOCS } from '../data/documents';
import { useLanguage, useT } from '../lib/language';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Pill } from '../ui/SharedUI';

const DOC_NAME: Record<string, { hi: string; mr: string }> = {
  id: { hi: 'पहचान प्रमाण', mr: 'ओळख पुरावा' },
  addr: { hi: 'पता प्रमाण', mr: 'पत्ता पुरावा' },
  dob: { hi: 'जन्म तिथि प्रमाण', mr: 'जन्मतारीख पुरावा' },
  photo: { hi: 'पासपोर्ट फोटो', mr: 'पासपोर्ट फोटो' },
  sign: { hi: 'हस्ताक्षर', mr: 'स्वाक्षरी' },
  form1: { hi: 'फॉर्म 1 — स्वयं फिटनेस घोषणा', mr: 'फॉर्म 1 — स्वयं तंदुरुस्ती घोषणा' },
};

const DOC_NOTE: Record<string, { en: string; hi: string; mr: string }> = {
  photo: {
    en: 'You can take this on the phone during the application. A plain wall and daylight is enough.',
    hi: 'आप इसे आवेदन के दौरान फोन पर ले सकते हैं। एक सादी दीवार और दिन की रोशनी काफी है।',
    mr: 'तुम्ही हे अर्जादरम्यान फोनवर घेऊ शकता. एक साधी भिंत आणि दिवसाचा प्रकाश पुरेसा आहे.',
  },
  sign: {
    en: 'You can take this on the phone during the application. A plain wall and daylight is enough.',
    hi: 'आप इसे आवेदन के दौरान फोन पर ले सकते हैं। एक सादी दीवार और दिन की रोशनी काफी है।',
    mr: 'तुम्ही हे अर्जादरम्यान फोनवर घेऊ शकता. एक साधी भिंत आणि दिवसाचा प्रकाश पुरेसा आहे.',
  },
  form1: {
    en: 'Form 1 is a declaration you tick yourself for a bike or car. Nothing to arrange.',
    hi: 'फॉर्म 1 एक घोषणा है जिसे आप बाइक या कार के लिए स्वयं टिक करते हैं। कुछ भी व्यवस्थित नहीं करना है।',
    mr: 'फॉर्म 1 ही एक घोषणा आहे जी तुम्ही बाइक किंवा कारसाठी स्वतः टिक करता. काहीही व्यवस्था करायची गरज नाही.',
  },
  default: {
    en: 'If it is not in DigiLocker you can upload a photo of the original. A passport, PAN card, ration card, electricity bill or rent agreement is accepted in place of Aadhaar.',
    hi: 'यदि यह डिजीलॉकर में नहीं है तो आप मूल की एक फोटो अपलोड कर सकते हैं। आधार के स्थान पर पासपोर्ट, पैन कार्ड, राशन कार्ड, बिजली बिल या किराया अनुबंध स्वीकार किया जाता है।',
    mr: 'हे डिजीलॉकरमध्ये नसेल तर तुम्ही मूळ कागदपत्राचा फोटो अपलोड करू शकता. आधारच्या ऐवजी पासपोर्ट, पॅन कार्ड, रेशन कार्ड, वीज बिल किंवा भाडे करार स्वीकारला जातो.',
  },
};

/** Before-you-start checklist: what six things the application needs, and what to do if you don't have one. */
export function Checklist({ go }: PageProps) {
  const t = useT();
  const { lang } = useLanguage();
  const [have, setHave] = useState<Record<string, 'yes' | 'no'>>({});
  const missingCount = DOCS.filter(d => have[d.id] === 'no').length;

  const missingMessage = missingCount > 0
    ? lang === 'hi' ? `${missingCount} वस्तु${missingCount > 1 ? 'एं' : ''} गुम के रूप में चिह्नित। आप अभी भी शुरू कर सकते हैं — आवेदन आगे बढ़ने के साथ सेव होता रहता है।`
      : lang === 'mr' ? `${missingCount} वस्तू गहाळ म्हणून चिन्हांकित. तुम्ही अजूनही सुरू करू शकता — अर्ज पुढे जाताना सेव्ह होत राहतो.`
        : `${missingCount} item${missingCount > 1 ? 's' : ''} marked missing. You can still start — the application saves as you go.`
    : null;

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }} onClick={() => go('elig')}>{Icon.left()} {t('Back', 'पीछे', 'मागे')}</button>
      <div className="col g10" style={{ marginBottom: 26 }}>
        <span className="eyebrow">{t('Before you start', 'शुरू करने से पहले', 'सुरू करण्यापूर्वी')}</span>
        <h1>{t('Six things, and three of them we fetch', 'छह चीज़ें, और उनमें से तीन हम खुद ला देते हैं', 'सहा गोष्टी, आणि त्यापैकी तीन आम्ही आणून देतो')}</h1>
        <p className="lede">{t('Tell us what you have. If something is missing you will see the accepted substitute now, instead of at the RTO counter.', 'हमें बताएं आपके पास क्या है। यदि कुछ गुम है तो आपको आरटीओ काउंटर के बजाय अभी स्वीकृत विकल्प दिखेगा।', 'तुमच्याकडे काय आहे ते आम्हाला सांगा. काही गहाळ असल्यास तुम्हाला आरटीओ काउंटरऐवजी आताच मान्य पर्याय दिसेल.')}</p>
      </div>
      <div className="col g12">
        {DOCS.map(doc => {
          const note = DOC_NOTE[doc.id] || DOC_NOTE.default;
          return (
            <div key={doc.id} className="flat" style={{ padding: '16px 18px' }}>
              <div className="row between g16 wrapf">
                <div className="col g4 grow" style={{ minWidth: 220 }}>
                  <div className="row g10 wrapf"><b style={{ fontWeight: 600 }}>{t(doc.name, DOC_NAME[doc.id]?.hi, DOC_NAME[doc.id]?.mr)}</b>{doc.auto && <Pill tone="brand">{t('Auto', 'ऑटो', 'ऑटो')}</Pill>}</div>
                  <span className="sub">{doc.need}</span>
                </div>
                <div className="seg" role="group" aria-label={doc.name}>
                  <button aria-pressed={have[doc.id] === 'yes'} onClick={() => setHave({ ...have, [doc.id]: 'yes' })}>{t('I have it', 'मेरे पास है', 'माझ्याकडे आहे')}</button>
                  <button aria-pressed={have[doc.id] === 'no'} onClick={() => setHave({ ...have, [doc.id]: 'no' })}>{t("I don't", 'नहीं है', 'नाही')}</button>
                </div>
              </div>
              {have[doc.id] === 'no' && (
                <div style={{ marginTop: 12 }}>
                  <Note tone="warn">{t(note.en, note.hi, note.mr)}</Note>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="sticky-cta">
        <div className="col g12">
          {missingMessage && <span className="sub">{missingMessage}</span>}
          <button className="btn btn-p" style={{ maxWidth: 340 }} onClick={() => go('apply')}>{t('Start the application', 'आवेदन शुरू करें', 'अर्ज सुरू करा')} {Icon.right()}</button>
        </div>
      </div>
    </div>
  );
}
