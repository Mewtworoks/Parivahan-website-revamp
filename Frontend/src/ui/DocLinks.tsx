import { useT } from '../lib/language';
import { Icon } from './Icon';

const DOCUMENT_LABELS: [en: string, hi: string, mr: string][] = [
  ['Application reference slip', 'आवेदन संदर्भ पर्ची', 'अर्ज संदर्भ पावती'],
  ['Application form, pre-filled', 'आवेदन फॉर्म, पहले से भरा', 'अर्ज फॉर्म, आधीच भरलेला'],
  ['Self declaration (Form 1)', 'स्व-घोषणा (फॉर्म 1)', 'स्व-घोषणा (फॉर्म 1)'],
  ['Print acknowledgement', 'पावती प्रिंट करें', 'पावती प्रिंट करा'],
];

export function DocLinks() {
  const t = useT();
  return (
    <div className="col g10">
      <span className="tiny" style={{ fontWeight: 600 }}>{t('Your documents, all in one place', 'आपके सभी दस्तावेज़, एक ही जगह', 'तुमची सर्व कागदपत्रे, एकाच ठिकाणी')}</span>
      <div className="row g10 wrapf">
        {DOCUMENT_LABELS.map(([en, hi, mr]) => <button key={en} className="btn btn-s btn-sm">{Icon.doc()} {t(en, hi, mr)}</button>)}
      </div>
      <span className="tiny">{t(
        'The official portal scatters these as blue links in the corner of the status page. They are the same four files.',
        'आधिकारिक पोर्टल इन्हें स्टेटस पेज के कोने में नीली लिंक के रूप में बिखेर देता है। ये वही चार फ़ाइलें हैं।',
        'अधिकृत पोर्टल यांना स्टेटस पेजच्या कोपऱ्यात निळ्या लिंक म्हणून विखुरते. या त्याच चार फाइल्स आहेत.',
      )}</span>
    </div>
  );
}
