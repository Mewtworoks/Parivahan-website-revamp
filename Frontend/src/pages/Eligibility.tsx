import { useLanguage, useT } from '../lib/language';
import { TODAY_ISO } from '../lib/validate';
import type { EligibilityAnswers, PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Pill, Tile } from '../ui/SharedUI';

const VEHICLE_OPTIONS: [value: 'scooter' | 'car' | 'gear', title: string, titleHi: string, titleMr: string, desc: string, descHi: string, descMr: string][] = [
  ['scooter', 'A gearless scooter or moped', 'गियर रहित स्कूटर या मोपेड', 'गिअरलेस स्कूटर किंवा मोपेड',
    'Up to 50cc — Activa, Jupiter and similar', '50cc तक — Activa, Jupiter और इसी तरह के वाहन', '50cc पर्यंत — Activa, Jupiter आणि तत्सम वाहने'],
  ['car', 'A car', 'एक कार', 'एक कार',
    'Private car or jeep, non-commercial', 'निजी कार या जीप, गैर-व्यावसायिक', 'खासगी कार किंवा जीप, बिगर-व्यावसायिक'],
  ['gear', 'A geared motorcycle, or both bike and car', 'गियर वाली मोटरसाइकिल, या दोनों — बाइक और कार', 'गिअर असलेली मोटरसायकल, किंवा दोन्ही — बाइक आणि कार',
    'Most people pick this', 'ज़्यादातर लोग यही चुनते हैं', 'बहुतेक लोक हेच निवडतात'],
];

const LICENCE_OPTIONS: [value: 'no' | 'll' | 'dl', title: string, titleHi: string, titleMr: string][] = [
  ['no', 'No, this is my first', 'नहीं, यह मेरा पहला है', 'नाही, हे माझे पहिलेच आहे'],
  ['ll', "Yes, a learner's licence", 'हां, एक लर्नर लाइसेंस', 'होय, एक लर्नर लायसन्स'],
  ['dl', 'Yes, a full driving licence', 'हां, एक पूर्ण ड्राइविंग लाइसेंस', 'होय, एक पूर्ण ड्रायव्हिंग लायसन्स'],
];

/** Works out the age difference between a date of birth and today's fixed prototype date. */
function ageFrom(dob: string): number | null {
  const year = parseInt(dob.slice(0, 4));
  if (!year || dob.length < 10) return null;
  const birth = new Date(dob);
  const today = new Date('2026-08-20');
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

type Lang = 'en' | 'hi' | 'mr';
type Verdict = { tone: 'bad' | 'warn' | 'ok'; title: string; body: string };

/** Builds the verdict copy directly in the active language — the sentences interpolate age/class, so it's built whole rather than fragment-by-fragment through t(). */
function buildVerdict(lang: Lang, age: number, minimumAge: number, want: EligibilityAnswers['want'], has: EligibilityAnswers['has']): Verdict {
  const oldEnough = age >= minimumAge;
  if (!oldEnough) {
    if (lang === 'hi') return { tone: 'bad', title: `इस श्रेणी के लिए आपकी उम्र ${minimumAge} वर्ष होनी चाहिए`,
      body: `आपकी उम्र ${age} है। ${minimumAge === 16 ? 'गियर रहित स्कूटर का लाइसेंस 16 वर्ष से शुरू होता है।' : 'गियर वाली बाइक या कार के लिए न्यूनतम उम्र 18 वर्ष है। 50cc तक के गियर रहित स्कूटर का लाइसेंस माता-पिता की सहमति से 16 वर्ष से लिया जा सकता है।'}` };
    if (lang === 'mr') return { tone: 'bad', title: `या श्रेणीसाठी तुमचे वय ${minimumAge} वर्षे असणे आवश्यक आहे`,
      body: `तुमचे वय ${age} आहे. ${minimumAge === 16 ? 'गिअरलेस स्कूटरचा लायसन्स 16 वर्षांपासून सुरू होतो.' : 'गिअर असलेली बाइक किंवा कारसाठी किमान वय 18 वर्षे आहे. 50cc पर्यंतच्या गिअरलेस स्कूटरचा लायसन्स पालकांच्या सहमतीने 16 वर्षांपासून घेता येतो.'}` };
    return { tone: 'bad', title: `You need to be ${minimumAge} to apply for this class`,
      body: `You are ${age}. ${minimumAge === 16 ? 'A gearless scooter licence starts at 16.' : "For a geared bike or a car the minimum age is 18. A licence for a gearless scooter up to 50cc can be taken from 16, with a parent's consent."}` };
  }
  if (has === 'll') {
    if (lang === 'hi') return { tone: 'warn', title: 'आपके पास पहले से ही एक लर्नर लाइसेंस है', body: 'आगे बढ़ें — आपको दूसरे लर्नर लाइसेंस के बजाय स्थायी ड्राइविंग लाइसेंस के लिए आवेदन करना चाहिए।' };
    if (lang === 'mr') return { tone: 'warn', title: 'तुमच्याकडे आधीच एक लर्नर लायसन्स आहे', body: 'पुढे जा — तुम्ही दुसऱ्या लर्नर लायसन्सऐवजी कायमस्वरूपी ड्रायव्हिंग लायसन्ससाठी अर्ज करावा.' };
    return { tone: 'warn', title: "You already hold a learner's licence", body: "Skip ahead — you should be applying for the permanent driving licence, not a second learner's licence." };
  }
  const classText = { en: want === 'gear' ? 'geared two-wheeler and car classes' : want === 'car' ? 'car (LMV) class' : 'gearless scooter class',
    hi: want === 'gear' ? 'गियर वाले दोपहिया और कार श्रेणी' : want === 'car' ? 'कार (LMV) श्रेणी' : 'गियर रहित स्कूटर श्रेणी',
    mr: want === 'gear' ? 'गिअर असलेली दुचाकी आणि कार श्रेणी' : want === 'car' ? 'कार (LMV) श्रेणी' : 'गिअरलेस स्कूटर श्रेणी' }[lang];
  if (lang === 'hi') return { tone: 'ok', title: 'आप आज लर्नर लाइसेंस के लिए आवेदन कर सकते हैं', body: `उम्र ${age}, ${classText} — आवेदन में कोई बाधा नहीं है। यहां परीक्षा इस साइट पर 10 सवालों की है, और सत्यापन के लिए आरटीओ की एक यात्रा।` };
  if (lang === 'mr') return { tone: 'ok', title: 'तुम्ही आज लर्नर लायसन्ससाठी अर्ज करू शकता', body: `वय ${age}, ${classText} — अर्जात कोणताही अडथळा नाही. या साइटवरील चाचणी 10 प्रश्नांची आहे, आणि पडताळणीसाठी आरटीओला एक भेट.` };
  return { tone: 'ok', title: "You can apply for a learner's licence today",
    body: `Age ${age}, ${classText} — nothing blocks the application. The test is 10 questions on this site, and one visit to the RTO for verification.` };
}

/** Step 0 — a quick eligibility check before anyone starts a real application. */
export function Eligibility({ go, state, update }: PageProps) {
  const t = useT();
  const { lang } = useLanguage();
  const answers = state.elig || {};
  const updateAnswers = (patch: Partial<EligibilityAnswers>) => update({ elig: { ...answers, ...patch } });

  const age = ageFrom(answers.dob || '');
  const answeredAll = age !== null && answers.want && answers.has;
  const minimumAge = answers.want === 'gear' ? 18 : 16;

  const verdict = answeredAll && age !== null ? buildVerdict(lang, age, minimumAge, answers.want, answers.has) : null;

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }} onClick={() => go('home')}>{Icon.left()} {t('Home', 'होम', 'होम')}</button>
      <div className="col g10" style={{ marginBottom: 28 }}>
        <span className="eyebrow">{t('Step 0 · 4 questions, nothing saved yet', 'चरण 0 · 4 प्रश्न, अभी कुछ भी सेव नहीं हुआ', 'टप्पा 0 · 4 प्रश्न, अजून काहीही सेव्ह झालेले नाही')}</span>
        <h1>{t('Do you qualify?', 'क्या आप पात्र हैं?', 'तुम्ही पात्र आहात का?')}</h1>
        <p className="lede">{t('Answering this now avoids paying a fee for an application that will be rejected. No documents needed.', 'अभी इसका उत्तर देने से उस आवेदन की फीस बचती है जो अस्वीकार हो जाएगा। किसी दस्तावेज़ की आवश्यकता नहीं है।', 'आताच याचे उत्तर दिल्याने नाकारल्या जाणाऱ्या अर्जाची फी वाचते. कोणत्याही कागदपत्रांची गरज नाही.')}</p>
      </div>
      <div className="col g20">
        <div className="card card-p col g20">
          <label className="field"><span className="label">{t('Date of birth', 'जन्म तिथि', 'जन्मतारीख')}</span><span className="hint">{t('As printed on your school certificate or birth certificate.', 'जैसा आपके स्कूल प्रमाणपत्र या जन्म प्रमाणपत्र पर छपा है।', 'तुमच्या शाळेच्या प्रमाणपत्रावर किंवा जन्म प्रमाणपत्रावर छापलेले आहे तसे.')}</span>
            <input className="input" type="date" max={TODAY_ISO} style={{ maxWidth: 260 }} value={answers.dob || ''} onChange={e => updateAnswers({ dob: e.target.value })} />
          </label>
          <hr className="hr" />
          <div className="col g10" role="radiogroup"><span className="label">{t('What do you want to drive?', 'आप क्या चलाना चाहते हैं?', 'तुम्ही काय चालवायचे आहे?')}</span>
            {VEHICLE_OPTIONS.map(([value, title, titleHi, titleMr, desc, descHi, descMr]) => (
              <Tile key={value} checked={answers.want === value} onClick={() => updateAnswers({ want: value })} title={t(title, titleHi, titleMr)} desc={t(desc, descHi, descMr)} />
            ))}
          </div>
          <hr className="hr" />
          <div className="col g10" role="radiogroup"><span className="label">{t('Do you already hold a licence?', 'क्या आपके पास पहले से लाइसेंस है?', 'तुमच्याकडे आधीच लायसन्स आहे का?')}</span>
            {LICENCE_OPTIONS.map(([value, title, titleHi, titleMr]) => (
              <Tile key={value} checked={answers.has === value} onClick={() => updateAnswers({ has: value })} title={t(title, titleHi, titleMr)} />
            ))}
          </div>
        </div>
        {verdict && (
          <div className="card card-p col g16 fade" style={{ borderColor: verdict.tone === 'ok' ? 'var(--brand-line)' : verdict.tone === 'warn' ? 'var(--warn-line)' : 'var(--bad-line)' }}>
            <div className="row g12"><Pill tone={verdict.tone}>{verdict.tone === 'ok' ? t('Eligible', 'पात्र', 'पात्र') : verdict.tone === 'warn' ? t('Wrong journey', 'गलत यात्रा', 'चुकीचा प्रवास') : t('Not yet eligible', 'अभी पात्र नहीं', 'अजून पात्र नाही')}</Pill></div>
            <div className="col g8"><h2>{verdict.title}</h2><p style={{ color: 'var(--ink2)' }}>{verdict.body}</p></div>
            {verdict.tone !== 'bad' && (
              <div className="row g12 wrapf">
                {answers.has === 'll'
                  ? <button className="btn btn-p" onClick={() => { update({ module: 'dl' }); go('dl'); }}>{t('Go to driving licence', 'ड्राइविंग लाइसेंस पर जाएं', 'ड्रायव्हिंग लायसन्सकडे जा')} {Icon.right()}</button>
                  : <button className="btn btn-p" onClick={() => go('checklist')}>{t('See what I need', 'देखें मुझे क्या चाहिए', 'मला काय आवश्यक आहे ते पहा')} {Icon.right()}</button>}
              </div>
            )}
          </div>
        )}
        {!verdict && <Note>{t('Answer all three and you will get a plain answer — eligible, or the exact reason you are not.', 'तीनों का उत्तर दें और आपको एक स्पष्ट उत्तर मिलेगा — पात्र, या न होने का सटीक कारण।', 'तिन्ही प्रश्नांची उत्तरे द्या आणि तुम्हाला स्पष्ट उत्तर मिळेल — पात्र, किंवा नसण्याचे नेमके कारण.')}</Note>}
      </div>
      <div style={{ height: 56 }} />
    </div>
  );
}
