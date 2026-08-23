import { useState } from 'react';
import { preFor } from '../../data/applicant';
import { CATEGORIES, STAGES, STATES } from '../../data/applicationFlow';
import { ADDR_UNIT, STATE_FEES } from '../../data/fees';
import { FORM1 } from '../../data/documents';
import { RTO_BY_STATE, RTOS, rtosFor } from '../../data/rtoOffices';
import { CLASSES } from '../../data/vehicleClasses';
import { useT } from '../../lib/language';
import { useOffices } from '../../lib/useOffices';
import { scrollToTop } from '../../lib/scrollToTop';
import { digitsOnly, isValidAadhaar, isValidEmail, isValidMobile, isValidOtp, isValidPin, isValidVid, TODAY_ISO } from '../../lib/validate';
import type { ApplicationForm } from '../../types';
import { Icon } from '../../ui/Icon';
import { Field, Input, Note, Pill, Purpose, Tile } from '../../ui/SharedUI';
import { Captcha } from './Captcha';

/** Props shared by every step of the learner's-licence wizard — the same object is spread onto whichever step is active. */
export interface StepProps {
  form: ApplicationForm;
  updateForm: (patch: Partial<ApplicationForm>) => void;
  classIds: string[];
  isAadhaar: boolean;
  needsMedicalCert: boolean;
  totalFee: number;
  form1Answers: Record<string, string>;
  goToStep: (i: number) => void;
}

/** Age in whole years as of the prototype's fixed "today" (21 Aug 2026). */
function ageFrom(dob: string): number {
  const birth = new Date(dob);
  const today = new Date('2026-08-21');
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/** Step 1 — State and RTO. */
export function StateAndRto({ form, updateForm }: StepProps) {
  const t = useT();
  const stateName = form.state || 'Maharashtra';
  // Load and wait come from the offices' live queues where the service is up.
  const { offices, live } = useOffices(stateName);
  const selectedRtoId = offices.find(o => o.id === form.rto) ? form.rto : offices[0].id;
  return (
    <div className="col g20">
      <Purpose
        what={t("You're telling us where you live and which RTO office will handle your paperwork.", 'आप बता रहे हैं कि आप कहां रहते हैं और कौन सा आरटीओ कार्यालय आपका काम संभालेगा।', 'तुम्ही सांगत आहात की तुम्ही कुठे राहता आणि कोणते आरटीओ कार्यालय तुमचे काम हाताळेल.')}
        because={t('Every fee, form and office list on the next screens is picked specifically for your state — nothing generic.', 'अगली स्क्रीनों पर हर फीस, फॉर्म और कार्यालय सूची खास आपके राज्य के लिए चुनी जाती है — कुछ भी सामान्य नहीं।', 'पुढील स्क्रीनवरील प्रत्येक फी, फॉर्म आणि कार्यालय यादी खास तुमच्या राज्यासाठी निवडली जाते — काहीही सामान्य नाही.')}
        why={t('You see the real, local price and office before you start, instead of finding out at the counter.', 'आप शुरू करने से पहले असली, स्थानीय कीमत और कार्यालय देख लेते हैं, काउंटर पर पता चलने के बजाय।', 'तुम्ही सुरू करण्यापूर्वीच खरी, स्थानिक किंमत आणि कार्यालय पाहता, काउंटरवर कळण्याऐवजी.')} />
      <div className="card card-p col g20">
        <Field label={t('State or union territory', 'राज्य या केंद्र शासित प्रदेश', 'राज्य किंवा केंद्रशासित प्रदेश')} hint={t('Where you live, not where you were born.', 'जहां आप रहते हैं, जहां आप पैदा हुए वहां नहीं।', 'तुम्ही जिथे राहता तिथे, जिथे जन्मलात तिथे नाही.')}>
          <select className="input" style={{ maxWidth: 300 }} value={stateName} onChange={e => updateForm({ state: e.target.value, rto: (RTO_BY_STATE[e.target.value] || RTOS)[0].id })}>
            {STATES.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <hr className="hr" />
        <div className="col g12"><span className="label">{t('RTO office', 'आरटीओ कार्यालय', 'आरटीओ कार्यालय')}</span>
          <span className="hint">{t('Your PIN code decides the default. You may pick another office in the same state — the portal allows it and nobody tells you.', 'आपका पिन कोड डिफ़ॉल्ट तय करता है। आप उसी राज्य में कोई अन्य कार्यालय चुन सकते हैं — पोर्टल इसकी अनुमति देता है और कोई नहीं बताता।', 'तुमचा पिन कोड डिफॉल्ट ठरवतो. तुम्ही त्याच राज्यातील दुसरे कार्यालय निवडू शकता — पोर्टल याची परवानगी देते आणि कोणी सांगत नाही.')}</span>
          {offices.map(office => (
            <Tile key={office.id} checked={selectedRtoId === office.id} onClick={() => updateForm({ rto: office.id })} title={office.name} desc={`${office.area} · ${office.km} km away`}
              right={<Pill tone={office.load === 'light' ? 'ok' : 'warn'}>{office.load === 'light' ? t('Light', 'हल्का', 'कमी') : t('Busy', 'व्यस्त', 'व्यग्र')}</Pill>} />
          ))}
          <span className="tiny">{live
            ? t('Load and waiting time above are read from each office live, not averaged from a leaflet.', 'ऊपर दिया लोड और प्रतीक्षा समय हर कार्यालय से लाइव पढ़ा जाता है, किसी पर्चे से औसत निकाला नहीं गया।')
            : t('Showing indicative load — the licence service is not reachable right now.', 'संकेतात्मक लोड दिखाया जा रहा है — लाइसेंस सेवा अभी उपलब्ध नहीं है।')}</span>
        </div>
      </div>
      <div className="card card-p col g14">
        <h3>{t('The eight stages, before you start', 'शुरू करने से पहले, आठ चरण', 'सुरू करण्यापूर्वी, आठ टप्पे')}</h3>
        <p className="sub">{t('The official portal lists these on an instructions page and then scatters them across separate menus. Here they stay visible as a tracker, and the ones you do not need are marked exempt.', 'आधिकारिक पोर्टल इन्हें एक निर्देश पृष्ठ पर सूचीबद्ध करता है और फिर उन्हें अलग-अलग मेनू में बिखेर देता है। यहां वे एक ट्रैकर के रूप में दिखते रहते हैं, और जो आपको नहीं चाहिए उन्हें छूट के रूप में चिह्नित किया जाता है।', 'अधिकृत पोर्टल हे सूचना पानावर सूचीबद्ध करते आणि नंतर वेगवेगळ्या मेनूंमध्ये विखुरते. इथे ते ट्रॅकर म्हणून दिसत राहतात, आणि तुम्हाला जे नको ते सूट म्हणून चिन्हांकित केले जाते.')}</p>
        <div className="col g8">
          {STAGES.map((stage, i) => (
            <div key={stage.k} className="row g12" style={{ alignItems: 'center' }}>
              <span className="rail-n" style={{ flex: 'none' }}>{i + 1}</span><span className="sub" style={{ color: 'var(--ink)' }}>{t(stage.n, stage.nHi, stage.nMr)}</span>
            </div>
          ))}
        </div>
        <Note>{stateName === 'Maharashtra' || stateName === 'Bihar'
          ? <span>{stateName === 'Bihar' ? <span><b>Bihar is modelled here as the contrast case.</b> Same eight stages, but the state adds three charges of its own — you will see each one named. </span> : null}Applying with Aadhaar exempts you from three of these stages, and you will see which and why before you submit.</span>
          : <span><b>{stateName} is not modelled in this prototype.</b> The stages are identical nationally, but fees, RTO lists and document requirements vary by state. Maharashtra and Bihar are the two with real data behind them here.</span>}</Note>
      </div>
    </div>
  );
}

/** Step 2 — Who is applying: category, and the Aadhaar-vs-manual fork. */
export function WhoIsApplying({ form, updateForm }: StepProps) {
  const t = useT();
  return (
    <div className="col g20">
      <Purpose
        what={t("You're picking whether to prove your identity with Aadhaar, or without it.", 'आप चुन रहे हैं कि अपनी पहचान आधार से साबित करें, या उसके बिना।', 'तुम्ही निवडत आहात की तुमची ओळख आधारने सिद्ध करायची, की त्याशिवाय.')}
        because={t('This one choice decides whether you need to visit the RTO at all, and it changes three later steps.', 'यह एक विकल्प तय करता है कि आपको आरटीओ जाना है या नहीं, और यह तीन बाद के चरणों को बदल देता है।', 'हा एकच पर्याय ठरवतो की तुम्हाला आरटीओला जायचे आहे की नाही, आणि तो पुढील तीन टप्पे बदलतो.')}
        why={t('You choose the trade-off knowingly — skip the visit with Aadhaar, or keep full control without it — instead of finding out halfway through.', 'आप यह समझौता जानते हुए चुनते हैं — आधार से यात्रा छोड़ें, या उसके बिना पूरा नियंत्रण रखें — बीच में पता चलने के बजाय।', 'तुम्ही हा तडजोड जाणून-बुजून निवडता — आधारसह भेट टाळा, किंवा त्याशिवाय पूर्ण नियंत्रण ठेवा — मध्येच कळण्याऐवजी.')} />
      <div className="card card-p col g16">
        <div className="col g10"><span className="label">{t('Do you hold any licence today?', 'क्या आपके पास आज कोई लाइसेंस है?', 'तुमच्याकडे आज कोणतेही लायसन्स आहे का?')}</span>
          {CATEGORIES.map(cat => <Tile key={cat.id} checked={form.cat === cat.id} onClick={() => updateForm({ cat: cat.id as ApplicationForm['cat'] })} title={t(cat.t, cat.tHi, cat.tMr)} desc={t(cat.d, cat.dHi, cat.dMr)} />)}
        </div>
        {form.cat === 'hold' && (
          <div className="grid2 fade">
            <Field label={t('Existing licence number', 'मौजूदा लाइसेंस नंबर', 'सध्याचा लायसन्स नंबर')}><Input className="input mono" placeholder="MH02 20240/00123" value={form.oldNo || ''} onChange={e => updateForm({ oldNo: e.target.value })} /></Field>
            <Field label={t('Date of birth on it', 'उस पर जन्म तिथि', 'त्यावरील जन्मतारीख')}><Input type="date" max={TODAY_ISO} value={form.oldDob || ''} onChange={e => updateForm({ oldDob: e.target.value })} /></Field>
          </div>
        )}
        {form.cat === 'defence' && <div className="fade"><Note tone="warn">A defence licence conversion needs your discharge book or service certificate at the counter. The online stages are otherwise the same.</Note></div>}
      </div>
      <div className="card card-p col g16">
        <div className="col g10"><span className="label">{t('How do you want to prove who you are?', 'आप अपनी पहचान कैसे साबित करना चाहते हैं?', 'तुम्ही तुमची ओळख कशी सिद्ध करायची आहे?')}</span>
          <span className="hint">{t('This is the single choice that decides whether you visit the RTO at all.', 'यह वह एक विकल्प है जो तय करता है कि आपको आरटीओ जाना है या नहीं।', 'हा एकच निवडीचा पर्याय ठरवतो की तुम्हाला आरटीओला जायचे आहे की नाही.')}</span>
          <Tile checked={form.route === 'aadhaar'} onClick={() => updateForm({ route: 'aadhaar' })} title={t('Submit via Aadhaar authentication', 'आधार प्रमाणीकरण के माध्यम से जमा करें', 'आधार प्रमाणीकरणाद्वारे सादर करा')}
            desc={t('Faceless and contactless. Your details and photograph are filled for you, three stages are exempted, and you take the test from home.', 'फेसलेस और संपर्क रहित। आपका विवरण और फोटो आपके लिए भरे जाते हैं, तीन चरणों में छूट मिलती है, और आप घर से परीक्षा देते हैं।', 'फेसलेस आणि संपर्करहित. तुमचे तपशील आणि फोटो तुमच्यासाठी भरले जातात, तीन टप्प्यांत सूट मिळते, आणि तुम्ही घरूनच परीक्षा देता.')}
            right={<Pill tone="ok">{t('No RTO visit', 'कोई आरटीओ यात्रा नहीं', 'आरटीओ भेट नाही')}</Pill>} />
          <Tile checked={form.route === 'manual'} onClick={() => updateForm({ route: 'manual' })} title={t('Submit without Aadhaar authentication', 'आधार प्रमाणीकरण के बिना जमा करें', 'आधार प्रमाणीकरणाशिवाय सादर करा')}
            desc={t('You type everything, upload your own photo and signature, book a slot and take the test in person at the office.', 'आप सब कुछ खुद टाइप करते हैं, अपनी फोटो और हस्ताक्षर अपलोड करते हैं, एक स्लॉट बुक करते हैं और कार्यालय में व्यक्तिगत रूप से परीक्षा देते हैं।', 'तुम्ही सर्व काही स्वतः टाइप करता, तुमचा फोटो आणि स्वाक्षरी अपलोड करता, स्लॉट बुक करता आणि कार्यालयात प्रत्यक्ष परीक्षा देता.')} />
        </div>
        {form.route === 'manual' && <div className="fade"><Note tone="warn"><b>That means a visit to the RTO.</b> It is a legitimate choice and we will not push you off it — but you should know the cost before you pick, not after. You can switch on this screen at any time.</Note></div>}
        {form.route === 'aadhaar' && <div className="fade"><Note tone="brand"><b>Exempted for you:</b> upload documents, upload photo, and slot booking. The test password comes to your Aadhaar-registered mobile by SMS and you take the test wherever you are.</Note></div>}
      </div>
    </div>
  );
}

/** Step 3 — Identity check: mobile-only for the manual route, or an Aadhaar/OTP e-KYC flow. */
export function IdentityCheck({ form, updateForm, isAadhaar }: StepProps) {
  const t = useT();
  const [otp, setOtp] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (key: string) => setTouched(v => ({ ...v, [key]: true }));
  const consent = form.cons || {};
  const toggleConsent = (key: 'a' | 'b' | 'c') => updateForm({ cons: { ...consent, [key]: !consent[key] } });
  const mobileError = touched.phone && form.phone && !isValidMobile(form.phone)
    ? t('Enter a valid 10-digit mobile number starting with 6-9.', '6-9 से शुरू होने वाला सही 10 अंकों का मोबाइल नंबर डालें।', '6-9 ने सुरू होणारा योग्य 10 आकडी मोबाइल नंबर टाका.')
    : undefined;

  if (!isAadhaar) {
    return (
      <div className="col g20">
        <Purpose
          what={t("You're giving a mobile number so your half-finished application can be saved.", 'आप एक मोबाइल नंबर दे रहे हैं ताकि आपका आधा भरा आवेदन सेव हो सके।', 'तुम्ही एक मोबाइल नंबर देत आहात जेणेकरून तुमचा अर्धवट भरलेला अर्ज सेव्ह होऊ शकेल.')}
          because={t('This number becomes the key to come back to this exact form later.', 'यह नंबर बाद में इस फॉर्म पर वापस आने की कुंजी बन जाता है।', 'हा नंबर नंतर याच फॉर्मवर परत येण्याची किल्ली बनतो.')}
          why={t("You can stop here and return tomorrow without losing anything you've typed.", 'आप यहां रुक सकते हैं और कल वापस आ सकते हैं, जो टाइप किया है उसे खोए बिना।', 'तुम्ही इथे थांबू शकता आणि उद्या परत येऊ शकता, जे टाइप केले आहे ते न गमावता.')} />
        <div className="card card-p col g20">
          <Field label={t('Mobile number', 'मोबाइल नंबर', 'मोबाइल नंबर')} hint={t('Your application number is tied to this. It is how you come back to a half-finished form.', 'आपका आवेदन नंबर इससे जुड़ा है। इसी से आप आधे भरे फॉर्म पर वापस आ सकते हैं।', 'तुमचा अर्ज क्रमांक याच्याशी जोडलेला आहे. यामुळेच तुम्ही अर्धवट भरलेल्या फॉर्मवर परत येऊ शकता.')} error={mobileError}>
            <div className="row g10"><span className="input" style={{ width: 64, display: 'grid', placeItems: 'center', background: 'var(--surface2)' }}>+91</span>
              <input className="input mono" inputMode="numeric" maxLength={10} placeholder="98765 43210" value={form.phone || ''} onBlur={() => touch('phone')} onChange={e => updateForm({ phone: digitsOnly(e.target.value, 10) })} /></div>
          </Field>
          <div className="row g10 wrapf"><button className="btn btn-s" disabled={!isValidMobile(form.phone || '')} onClick={() => updateForm({ manualOk: true })}>{t('Send OTP and continue', 'OTP भेजें और जारी रखें', 'OTP पाठवा आणि सुरू ठेवा')}</button>
            {form.manualOk && <Pill tone="ok">{Icon.check()} {t('Number verified', 'नंबर सत्यापित', 'नंबर सत्यापित')}</Pill>}</div>
        </div>
        <Note>{t('Mock prototype — no OTP is sent and any number is accepted.', 'नकली प्रोटोटाइप — कोई OTP नहीं भेजा जाता और कोई भी नंबर स्वीकार किया जाता है।', 'नकली प्रोटोटाइप — कोणताही OTP पाठवला जात नाही आणि कोणताही नंबर स्वीकारला जातो.')}</Note>
      </div>
    );
  }

  const allConsentsGiven = consent.a && consent.b && consent.c;
  const idIsVid = (form.idType || 'uid') === 'vid';
  const idValid = idIsVid ? isValidVid(form.uid || '') : isValidAadhaar(form.uid || '');
  const idError = touched.uid && form.uid && !idValid
    ? (idIsVid ? t('A Virtual ID is 16 digits.', 'वर्चुअल आईडी 16 अंकों की होती है।', 'व्हर्च्युअल आयडी 16 आकड्यांची असते.') : t('An Aadhaar number is exactly 12 digits.', 'आधार नंबर ठीक 12 अंकों का होता है।', 'आधार क्रमांक अगदी 12 आकड्यांचा असतो.'))
    : undefined;
  return (
    <div className="col g20">
      <Purpose
        what={t("You're proving it's really you, using an OTP sent to your Aadhaar-linked number.", 'आप साबित कर रहे हैं कि यह वास्तव में आप हैं, अपने आधार से जुड़े नंबर पर आए OTP से।', 'तुम्ही सिद्ध करत आहात की हे खरोखर तुम्हीच आहात, तुमच्या आधारशी जोडलेल्या नंबरवर आलेल्या OTP द्वारे.')}
        because={t('Once verified, your name, address and photo are fetched automatically — you will not type them again.', 'सत्यापित होने के बाद, आपका नाम, पता और फोटो अपने आप फ़ेच हो जाते हैं — आप उन्हें फिर से टाइप नहीं करेंगे।', 'पडताळणी झाल्यावर, तुमचे नाव, पत्ता आणि फोटो स्वयंचलितपणे आणले जातात — तुम्हाला ते पुन्हा टाइप करावे लागणार नाहीत.')}
        why={t('One OTP now saves you from retyping details that a government record already has, and from the mismatch errors that cause most rejections.', 'एक OTP अभी आपको उन विवरणों को फिर से टाइप करने से बचाता है जो सरकारी रिकॉर्ड में पहले से हैं, और उन बेमेल त्रुटियों से जो ज़्यादातर आवेदन खारिज करती हैं।', 'एक OTP आता तुम्हाला आधीच सरकारी नोंदीत असलेले तपशील पुन्हा टाइप करण्यापासून वाचवतो, आणि बहुतेक अर्ज नाकारणाऱ्या जुळत-नसण्याच्या चुकांपासूनही.')} />
      <div className="card card-p col g20">
        <div className="col g10"><span className="label">{t('Authenticate using', 'इससे प्रमाणित करें', 'याद्वारे प्रमाणित करा')}</span>
          <div className="row g10 wrapf">
            {(['uid', 'vid'] as const).map(idType => (
              <button key={idType} className="btn btn-s btn-sm" aria-pressed={(form.idType || 'uid') === idType} style={(form.idType || 'uid') === idType ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand)' } : undefined} onClick={() => updateForm({ idType })}>{idType === 'uid' ? t('Aadhaar number', 'आधार नंबर', 'आधार क्रमांक') : t('Virtual ID', 'वर्चुअल आईडी', 'व्हर्च्युअल आयडी')}</button>
            ))}
          </div>
          <span className="hint">{t('A Virtual ID is a temporary number you generate on the UIDAI site. It works exactly the same here and does not reveal your Aadhaar number.', 'वर्चुअल आईडी एक अस्थायी नंबर है जो आप UIDAI साइट पर जनरेट करते हैं। यह यहां भी वैसे ही काम करता है और आपका आधार नंबर उजागर नहीं करता।', 'व्हर्च्युअल आयडी हा एक तात्पुरता क्रमांक आहे जो तुम्ही UIDAI साइटवर तयार करता. तो इथेही तसाच चालतो आणि तुमचा आधार क्रमांक उघड करत नाही.')}</span>
        </div>
        <Field label={idIsVid ? t('Virtual ID', 'वर्चुअल आईडी', 'व्हर्च्युअल आयडी') : t('Aadhaar number', 'आधार नंबर', 'आधार क्रमांक')} hint={t('Mock prototype — do not enter a real number. Any digits work.', 'नकली प्रोटोटाइप — कोई असली नंबर न डालें। कोई भी अंक काम करेंगे।', 'नकली प्रोटोटाइप — खरा क्रमांक टाकू नका. कोणतेही आकडे चालतील.')} error={idError}>
          <input className="input mono" inputMode="numeric" maxLength={idIsVid ? 16 : 12} placeholder={idIsVid ? 'XXXX XXXX XXXX XXXX' : 'XXXX XXXX XXXX'} value={form.uid || ''} onBlur={() => touch('uid')} onChange={e => updateForm({ uid: digitsOnly(e.target.value, idIsVid ? 16 : 12) })} />
        </Field>
        <Field label={t('Mobile number', 'मोबाइल नंबर', 'मोबाइल नंबर')} hint={t('Must be the number registered against your Aadhaar. The OTP and, later, your test password come to it.', 'यह वही नंबर होना चाहिए जो आपके आधार से जुड़ा है। OTP और बाद में आपका टेस्ट पासवर्ड इसी पर आएगा।', 'हाच नंबर तुमच्या आधारशी जोडलेला असावा. OTP आणि नंतर तुमचा टेस्ट पासवर्ड यावरच येईल.')} error={mobileError}>
          <div className="row g10"><span className="input" style={{ width: 64, display: 'grid', placeItems: 'center', background: 'var(--surface2)' }}>+91</span>
            <input className="input mono" inputMode="numeric" maxLength={10} placeholder="98765 43210" value={form.phone || ''} onBlur={() => touch('phone')} onChange={e => updateForm({ phone: digitsOnly(e.target.value, 10) })} /></div>
        </Field>
        <hr className="hr" />
        <div className="col g12">
          <span className="label">{t('Consent', 'सहमति', 'सहमती')}</span>
          <span className="hint">{t('Three separate consents are required by law. The official form states them in one dense paragraph each — same meaning, fewer words.', 'कानून के तहत तीन अलग-अलग सहमतियां आवश्यक हैं। आधिकारिक फॉर्म इन्हें एक-एक घने पैराग्राफ में बताता है — वही मतलब, कम शब्दों में।', 'कायद्याने तीन वेगळ्या सहमती आवश्यक आहेत. अधिकृत फॉर्म त्या प्रत्येक एका दाट परिच्छेदात सांगतो — तोच अर्थ, कमी शब्दांत.')}</span>
          {([
            ['a', ['I consent to authenticating myself with the Aadhaar authentication system, and to providing my Aadhaar number and OTP for this licence application.', 'मैं आधार प्रमाणीकरण प्रणाली से स्वयं को प्रमाणित करने, और इस लाइसेंस आवेदन के लिए अपना आधार नंबर और OTP देने के लिए सहमति देता/देती हूं।', 'मी आधार प्रमाणीकरण प्रणालीद्वारे स्वतःला प्रमाणित करण्यास, आणि या लायसन्स अर्जासाठी माझा आधार क्रमांक व OTP देण्यास सहमती देतो/देते.']],
            ['b', ['I understand the OTP is used only to authenticate my identity for this one transaction, and for nothing else.', 'मैं समझता/समझती हूं कि OTP का उपयोग केवल इस एक ट्रांजेक्शन के लिए मेरी पहचान प्रमाणित करने हेतु किया जाता है, और किसी अन्य उद्देश्य के लिए नहीं।', 'मला समजते की OTP फक्त या एका व्यवहारासाठी माझी ओळख प्रमाणित करण्यासाठी वापरला जातो, आणि इतर कोणत्याही कारणासाठी नाही.']],
            ['c', ['I understand the Transport Department must keep my identity data secure and confidential.', 'मैं समझता/समझती हूं कि परिवहन विभाग को मेरे पहचान डेटा को सुरक्षित और गोपनीय रखना आवश्यक है।', 'मला समजते की परिवहन विभागाने माझा ओळख डेटा सुरक्षित आणि गोपनीय ठेवणे आवश्यक आहे.']],
          ] as [keyof typeof consent, [string, string, string]][]).map(([key, text]) => (
            <button key={key} className="tile" role="checkbox" aria-checked={!!consent[key]} onClick={() => toggleConsent(key)}>
              <span className="tick" style={{ borderRadius: 6 }}>{consent[key] ? Icon.check() : null}</span>
              <span className="sub" style={{ color: 'var(--ink)' }}>{t(...text)}</span>
            </button>
          ))}
        </div>
        <hr className="hr" />
        <Field label={t('One-time password', 'वन-टाइम पासवर्ड', 'वन-टाइम पासवर्ड')} hint={t('Any four digits.', 'कोई भी चार अंक।', 'कोणतेही चार आकडे.')}>
          <div className="row g10 wrapf"><input className="input mono" inputMode="numeric" style={{ width: 150, letterSpacing: '.3em' }} maxLength={4} placeholder="••••" value={otp} onChange={e => setOtp(digitsOnly(e.target.value, 4))} />
            <button className="btn btn-s" disabled={!isValidOtp(otp) || !allConsentsGiven || !idValid || !isValidMobile(form.phone || '')} onClick={() => updateForm({ kyc: true })}>{t('Authenticate', 'प्रमाणित करें', 'प्रमाणित करा')}</button>
            {form.kyc && <Pill tone="ok">{Icon.check()} {t('e-KYC complete', 'e-KYC पूर्ण', 'e-KYC पूर्ण')}</Pill>}</div>
          {!allConsentsGiven && <span className="hint">{t('All three consents are needed before you can authenticate.', 'प्रमाणित करने से पहले तीनों सहमतियां आवश्यक हैं।', 'प्रमाणित करण्यापूर्वी तिन्ही सहमती आवश्यक आहेत.')}</span>}
          {allConsentsGiven && (!idValid || !isValidMobile(form.phone || '')) && <span className="hint">{t('Enter a valid Aadhaar/VID and mobile number above before authenticating.', 'प्रमाणित करने से पहले ऊपर सही आधार/VID और मोबाइल नंबर डालें।', 'प्रमाणित करण्यापूर्वी वर योग्य आधार/VID आणि मोबाइल नंबर टाका.')}</span>}
        </Field>
      </div>
    </div>
  );
}

/** Step 4 — read-only confirmation of what the (mock) e-KYC fetch returned. */
export function ConfirmEkycDetails({ form, updateForm }: StepProps) {
  const t = useT();
  const prefill = preFor(form.state);
  const valueOf = <K extends keyof ApplicationForm & keyof typeof prefill>(key: K) => form[key] !== undefined ? form[key] : prefill[key];
  return (
    <div className="col g20">
      <Purpose
        what={t("You're checking that what the government already has on record about you is correct.", 'आप जांच रहे हैं कि सरकार के पास आपके बारे में जो रिकॉर्ड है वह सही है।', 'तुम्ही तपासत आहात की सरकारकडे तुमच्याबद्दल जी नोंद आहे ती बरोबर आहे का.')}
        because={t('If everything matches, you skip typing your name, address and photo entirely on the next two screens.', 'यदि सब कुछ मिलता है, तो आप अगली दो स्क्रीनों पर अपना नाम, पता और फोटो टाइप करना पूरी तरह छोड़ देते हैं।', 'जर सर्व काही जुळत असेल, तर तुम्ही पुढील दोन स्क्रीनवर तुमचे नाव, पत्ता आणि फोटो टाइप करणे पूर्णपणे टाळता.')}
        why={t('Confirming once here is faster than re-typing details that could be typed wrong — and a mismatch is the No.1 cause of application rejection.', 'यहां एक बार पुष्टि करना उन विवरणों को फिर से टाइप करने से तेज़ है जो गलत टाइप हो सकते हैं — और बेमेल होना आवेदन खारिज होने का नंबर एक कारण है।', 'इथे एकदा पुष्टी करणे चुकीचे टाइप होऊ शकणारे तपशील पुन्हा टाइप करण्यापेक्षा वेगवान आहे — आणि न जुळणे हे अर्ज नाकारण्याचे नंबर एक कारण आहे.')} />
      <div className="card card-p col g20">
        <div className="row between g12 wrapf"><h3>{t('Applicant details', 'आवेदक विवरण', 'अर्जदार तपशील')}</h3><Pill tone="ok">{Icon.check()} {t('Authenticated', 'प्रमाणित', 'प्रमाणित')}</Pill></div>
        <div className="row g20 wrapf" style={{ alignItems: 'flex-start' }}>
          <dl className="kv grow" style={{ minWidth: 240 }}>
            <dt>{t('Applicant name', 'आवेदक का नाम', 'अर्जदाराचे नाव')}</dt><dd>{[valueOf('first'), valueOf('mid'), valueOf('last')].filter(Boolean).join(' ')}</dd>
            <dt>{t('Relation name', 'संबंधी का नाम', 'नातेवाइकाचे नाव')}</dt><dd>{valueOf('relFirst')} {valueOf('relLast')}</dd>
            <dt>{t('Date of birth', 'जन्म तिथि', 'जन्मतारीख')}</dt><dd>{valueOf('dob')}</dd>
            <dt>{t('Gender', 'लिंग', 'लिंग')}</dt><dd>{valueOf('gender')}</dd>
          </dl>
          <div className="col g6" style={{ flex: 'none' }}>
            <div className="stripe" style={{ width: 104, height: 128, borderRadius: 8, border: '1px solid var(--line)' }} />
            <span className="tiny">{t('Photograph on record', 'रिकॉर्ड पर फोटोग्राफ', 'नोंदीवरील छायाचित्र')}</span>
          </div>
        </div>
        <hr className="hr" />
        <h3>{t('Address details', 'पता विवरण', 'पत्ता तपशील')}</h3>
        <dl className="kv">
          <dt>{t('House / door', 'घर / दरवाजा', 'घर / दार')}</dt><dd>{valueOf('line')}</dd><dt>{t('Street', 'गली', 'गल्ली')}</dt><dd>{valueOf('street')}</dd>
          <dt>{t('Locality', 'इलाका', 'परिसर')}</dt><dd>{valueOf('area')}</dd><dt>{t('Landmark', 'लैंडमार्क', 'लँडमार्क')}</dt><dd>{valueOf('landmark')}</dd>
          <dt>{t('Town / city', 'कस्बा / शहर', 'गाव / शहर')}</dt><dd>{valueOf('city')}</dd><dt>{t('District', 'जिला', 'जिल्हा')}</dt><dd>{valueOf('district')}</dd>
          <dt>{t('Postal code', 'पिन कोड', 'पिन कोड')}</dt><dd className="mono">{valueOf('pin')}</dd><dt>{t('State', 'राज्य', 'राज्य')}</dt><dd>{form.state || prefill.state}</dd>
        </dl>
        <button className="tile" role="checkbox" aria-checked={!!form.kycOk} onClick={() => updateForm({ kycOk: !form.kycOk })}>
          <span className="tick" style={{ borderRadius: 6 }}>{form.kycOk ? Icon.check() : null}</span>
          <span className="sub" style={{ color: 'var(--ink)' }}>{t('I certify that the photograph held against my Aadhaar is my latest photograph, and the details above are mine.', 'मैं प्रमाणित करता/करती हूं कि मेरे आधार पर रखा गया फोटोग्राफ मेरा नवीनतम फोटोग्राफ है, और ऊपर दिया गया विवरण मेरा है।', 'मी प्रमाणित करतो/करते की माझ्या आधारवर असलेले छायाचित्र माझे अलीकडचे छायाचित्र आहे, आणि वरील तपशील माझे आहेत.')}</span>
        </button>
      </div>
      <Note tone="brand">{t('Because this came from e-KYC, you will not be asked to upload an age proof, an address proof, or a passport photograph. Those three stages are exempt.', 'यह e-KYC से आया है, इसलिए आपसे आयु प्रमाण, पता प्रमाण या पासपोर्ट फोटो अपलोड करने को नहीं कहा जाएगा। ये तीन चरण छूट में हैं।', 'हे e-KYC मधून आले आहे, त्यामुळे तुम्हाला वय पुरावा, पत्ता पुरावा किंवा पासपोर्ट फोटो अपलोड करण्यास सांगितले जाणार नाही. हे तीन टप्पे सूट आहेत.')}</Note>
    </div>
  );
}

/** Step 5 — personal details (Form 2, general section). */
export function AboutYou({ form, updateForm, isAadhaar }: StepProps) {
  const t = useT();
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (key: string) => setTouched(v => ({ ...v, [key]: true }));
  const prefill = preFor(form.state);
  const valueOf = <K extends keyof ApplicationForm & keyof typeof prefill>(key: K) => form[key] !== undefined ? form[key] : prefill[key];
  const dob = valueOf('dob') as string;
  const age = (() => { const a = ageFrom(dob); return isNaN(a) ? '' : a; })();
  const email = valueOf('email') as string;
  const emailError = touched.email && email && !isValidEmail(email)
    ? t('Enter a valid email address, like name@example.com.', 'name@example.com जैसा एक सही ईमेल पता डालें।', 'name@example.com सारखा योग्य ईमेल पत्ता टाका.')
    : undefined;
  const phoneError = touched.phone && form.phone && !isValidMobile(form.phone)
    ? t('Enter a valid 10-digit mobile number starting with 6-9.', '6-9 से शुरू होने वाला सही 10 अंकों का मोबाइल नंबर डालें।', '6-9 ने सुरू होणारा योग्य 10 आकडी मोबाइल नंबर टाका.')
    : undefined;

  return (
    <div className="col g20">
      <Purpose
        what={t("You're filling in the personal details that go on the printed licence itself.", 'आप वे व्यक्तिगत विवरण भर रहे हैं जो प्रिंटेड लाइसेंस पर जाते हैं।', 'तुम्ही ते व्यक्तिगत तपशील भरत आहात जे छापलेल्या लायसन्सवर जातात.')}
        because={t('These exact words — including capitalisation — are what gets printed, so accuracy here matters more than on any other screen.', 'यही शब्द — बड़े-छोटे अक्षरों के साथ — प्रिंट होते हैं, इसलिए यहां सटीकता किसी भी अन्य स्क्रीन से ज़्यादा मायने रखती है।', 'हेच शब्द — मोठी-लहान अक्षरे धरून — छापले जातात, त्यामुळे इथे अचूकता इतर कोणत्याही स्क्रीनपेक्षा जास्त महत्त्वाची आहे.')}
        why={t('We show you your age automatically calculated and your final printed name, so you catch a typo before it is on a physical card.', 'हम आपकी उम्र खुद निकालकर और आपका अंतिम प्रिंटेड नाम दिखाते हैं, ताकि कोई टाइपो कार्ड पर आने से पहले पकड़ में आ जाए।', 'आम्ही तुमचे वय स्वतः काढून आणि तुमचे शेवटचे छापले जाणारे नाव दाखवतो, जेणेकरून कार्डवर येण्यापूर्वीच कोणतीही चूक लक्षात येईल.')} />
      <div className="card card-p col g16">
        {isAadhaar && <Pill tone="ok">{Icon.check()} {t('Eight fields filled from e-KYC', 'आठ फ़ील्ड e-KYC से भरे गए', 'आठ फील्ड e-KYC मधून भरले')}</Pill>}
        <div className="grid3" style={{ gap: 12 }}>
          <Field label={t('First name', 'पहला नाम', 'पहिले नाव')}><Input value={valueOf('first') as string} onChange={e => updateForm({ first: e.target.value })} /></Field>
          <Field label={t('Middle name', 'मध्य नाम', 'मधले नाव')}><Input value={valueOf('mid') as string} onChange={e => updateForm({ mid: e.target.value })} /></Field>
          <Field label={t('Last name', 'अंतिम नाम', 'आडनाव')}><Input value={valueOf('last') as string} onChange={e => updateForm({ last: e.target.value })} /></Field>
        </div>
        <Field label={t('Full name as it will be printed', 'पूरा नाम जैसा प्रिंट होगा', 'पूर्ण नाव जसे छापले जाईल')}><Input readOnly value={[valueOf('first'), valueOf('mid'), valueOf('last')].filter(Boolean).join(' ').toUpperCase()} /></Field>
        <div className="grid3" style={{ gap: 12 }}>
          <Field label={t('Relation', 'संबंध', 'नाते')}><select className="input" value={valueOf('relType') as string} onChange={e => updateForm({ relType: e.target.value })}>{['Son of', 'Daughter of', 'Wife of', 'Ward of'].map(x => <option key={x}>{x}</option>)}</select></Field>
          <Field label={t('Their first name', 'उनका पहला नाम', 'त्यांचे पहिले नाव')}><Input value={valueOf('relFirst') as string} onChange={e => updateForm({ relFirst: e.target.value })} /></Field>
          <Field label={t('Their last name', 'उनका अंतिम नाम', 'त्यांचे आडनाव')}><Input value={valueOf('relLast') as string} onChange={e => updateForm({ relLast: e.target.value })} /></Field>
        </div>
        <div className="grid3" style={{ gap: 12 }}>
          <Field label={t('Date of birth', 'जन्म तिथि', 'जन्मतारीख')}><Input type="date" max={TODAY_ISO} value={dob} onChange={e => updateForm({ dob: e.target.value })} /></Field>
          <Field label={t('Age', 'आयु', 'वय')} hint={t('Worked out for you.', 'आपके लिए निकाल दी गई।', 'तुमच्यासाठी काढलेले.')}><Input readOnly value={age === '' ? '' : age + ' ' + t('years', 'वर्ष', 'वर्षे')} /></Field>
          <Field label={t('Gender', 'लिंग', 'लिंग')}><select className="input" value={valueOf('gender') as string} onChange={e => updateForm({ gender: e.target.value })}>{['Male', 'Female', 'Transgender'].map(x => <option key={x}>{x}</option>)}</select></Field>
        </div>
        <div className="grid3" style={{ gap: 12 }}>
          <Field label={t('Place of birth', 'जन्म स्थान', 'जन्मस्थान')}><Input value={valueOf('pob') as string} onChange={e => updateForm({ pob: e.target.value })} /></Field>
          <Field label={t('Country of birth', 'जन्म का देश', 'जन्माचा देश')}><select className="input" value={valueOf('cob') as string} onChange={e => updateForm({ cob: e.target.value })}>{['India', 'Nepal', 'Bhutan', 'Other'].map(x => <option key={x}>{x}</option>)}</select></Field>
          <Field label={t('Blood group', 'ब्लड ग्रुप', 'रक्तगट')} hint={t('Printed on the licence.', 'लाइसेंस पर प्रिंट होता है।', 'लायसन्सवर छापले जाते.')}><select className="input" value={valueOf('blood') as string} onChange={e => updateForm({ blood: e.target.value })}>{['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown'].map(b => <option key={b}>{b}</option>)}</select></Field>
        </div>
        <Field label={t('Educational qualification', 'शैक्षिक योग्यता', 'शैक्षणिक पात्रता')}><select className="input" value={valueOf('qual') as string} onChange={e => updateForm({ qual: e.target.value })}>{['Below Class 8', 'Class 8 to 10', 'Class 12 or equivalent', 'Graduate or above'].map(x => <option key={x}>{x}</option>)}</select></Field>
        <hr className="hr" />
        <div className="grid2">
          <Field label={t('Email address', 'ईमेल पता', 'ईमेल पत्ता')} hint={t('Mandatory on the official form. Your reference slip and receipt go here.', 'आधिकारिक फॉर्म पर अनिवार्य है। आपकी संदर्भ पर्ची और रसीद यहीं आएगी।', 'अधिकृत फॉर्मवर सक्तीचे आहे. तुमची संदर्भ चिठ्ठी आणि पावती इथेच येईल.')} error={emailError}>
            <Input type="email" value={email} onBlur={() => touch('email')} onChange={e => updateForm({ email: e.target.value })} /></Field>
          <Field label={isAadhaar ? t('Mobile registered with Aadhaar', 'आधार से जुड़ा मोबाइल', 'आधारशी जोडलेला मोबाइल') : t('Mobile number', 'मोबाइल नंबर', 'मोबाइल नंबर')} hint={t('Where the test password will be sent.', 'यहीं टेस्ट पासवर्ड भेजा जाएगा।', 'इथेच टेस्ट पासवर्ड पाठवला जाईल.')} error={phoneError}>
            <div className="row g10"><span className="input" style={{ width: 58, display: 'grid', placeItems: 'center', background: 'var(--surface2)' }}>+91</span>
              <Input className="input mono" inputMode="numeric" maxLength={10} value={form.phone || ''} onBlur={() => touch('phone')} onChange={e => updateForm({ phone: digitsOnly(e.target.value, 10) })} /></div></Field>
        </div>
        <div className="grid2">
          <Field label={t('Emergency mobile number', 'आपातकालीन मोबाइल नंबर', 'आपत्कालीन मोबाइल नंबर')} hint={t('Optional. Someone to call if you are in an accident.', 'वैकल्पिक। दुर्घटना होने पर किसी को फोन करने के लिए।', 'पर्यायी. अपघात झाल्यास कोणाला फोन करायचा त्यासाठी.')}>
            <Input className="input mono" value={valueOf('emPhone') as string} onChange={e => updateForm({ emPhone: e.target.value })} /></Field>
          <Field label={t('Landline', 'लैंडलाइन', 'लँडलाइन')} hint={t('Optional.', 'वैकल्पिक।', 'पर्यायी.')}><Input className="input mono" placeholder="022 2444 5566" value={form.landline || ''} onChange={e => updateForm({ landline: e.target.value })} /></Field>
        </div>
        <hr className="hr" />
        <div className="col g10">
          <span className="label">{t('Two identification marks', 'दो पहचान चिह्न', 'दोन ओळख चिन्हे')}</span>
          <span className="hint">{t('Form 2 requires these and they are printed on the licence. A visible mole, scar or birthmark is what people write.', 'फॉर्म 2 में यह आवश्यक हैं और यह लाइसेंस पर प्रिंट होते हैं। दिखने वाला तिल, निशान या जन्मचिह्न लोग लिखते हैं।', 'फॉर्म 2 मध्ये हे आवश्यक आहेत आणि ते लायसन्सवर छापले जातात. दिसणारा तीळ, व्रण किंवा जन्मखूण लोक लिहितात.')}</span>
          <div className="grid2"><Input placeholder="Scar on head, mole on right hand, etc." value={valueOf('mark1') as string} onChange={e => updateForm({ mark1: e.target.value })} /><Input placeholder="Second mark" value={valueOf('mark2') as string} onChange={e => updateForm({ mark2: e.target.value })} /></div>
        </div>
        <Field label={t('Do you have a disability that affects driving?', 'क्या आपकी कोई विकलांगता है जो ड्राइविंग को प्रभावित करती है?', 'तुम्हाला असे कोणतेही अपंगत्व आहे का जे वाहन चालवण्यावर परिणाम करते?')} hint={t('Recorded so the licence can carry the right condition or vehicle adaptation. It is not a disqualification.', 'यह दर्ज किया जाता है ताकि लाइसेंस पर सही शर्त या वाहन अनुकूलन अंकित हो सके। यह अयोग्यता नहीं है।', 'हे नोंदवले जाते जेणेकरून लायसन्सवर योग्य अट किंवा वाहन बदल नोंदवता येईल. ही अपात्रता नाही.')}>
          <div className="row g10 wrapf">{(['No', 'Yes'] as const).map(o => <button key={o} className="btn btn-s btn-sm" aria-pressed={(form.disab || 'No') === o} style={(form.disab || 'No') === o ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand)' } : undefined} onClick={() => updateForm({ disab: o })}>{t(o, o === 'Yes' ? 'हां' : 'नहीं', o === 'Yes' ? 'होय' : 'नाही')}</button>)}</div>
        </Field>
        {form.disab === 'Yes' && <div className="fade"><Note tone="brand">{t('You will be asked for a Form 1A medical certificate, and the licence can be endorsed for an adapted vehicle. Nothing here stops the application.', 'आपसे फॉर्म 1A मेडिकल सर्टिफिकेट मांगा जाएगा, और लाइसेंस पर अनुकूलित वाहन के लिए पृष्ठांकन हो सकता है। यहां कुछ भी आवेदन को नहीं रोकता।', 'तुम्हाला फॉर्म 1A वैद्यकीय प्रमाणपत्र मागितले जाईल, आणि लायसन्सवर बदल केलेल्या वाहनासाठी नोंद होऊ शकते. इथे काहीही अर्ज थांबवत नाही.')}</Note></div>}
      </div>
    </div>
  );
}

/** Step 6 — present (and optionally permanent) address. */
export function AddressDetails({ form, updateForm, isAadhaar }: StepProps) {
  const t = useT();
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (key: string) => setTouched(v => ({ ...v, [key]: true }));
  const prefill = preFor(form.state);
  const valueOf = <K extends keyof ApplicationForm & keyof typeof prefill>(key: K) => form[key] !== undefined ? form[key] : prefill[key];
  const sameAsPermanent = form.same !== false;
  const addressEdited = form.line !== undefined || form.area !== undefined || form.pin !== undefined;
  const pin = valueOf('pin') as string;
  const pinError = touched.pin && pin && !isValidPin(pin)
    ? t('A PIN code is 6 digits and cannot start with 0.', 'पिन कोड 6 अंकों का होता है और 0 से शुरू नहीं हो सकता।', 'पिन कोड 6 आकड्यांचा असतो आणि 0 ने सुरू होऊ शकत नाही.')
    : undefined;
  const ppinError = touched.ppin && form.ppin && !isValidPin(form.ppin)
    ? t('A PIN code is 6 digits and cannot start with 0.', 'पिन कोड 6 अंकों का होता है और 0 से शुरू नहीं हो सकता।', 'पिन कोड 6 आकड्यांचा असतो आणि 0 ने सुरू होऊ शकत नाही.')
    : undefined;

  return (
    <div className="col g20">
      <Purpose
        what={t("You're giving the address your licence gets posted to.", 'आप वह पता दे रहे हैं जिस पर आपका लाइसेंस भेजा जाएगा।', 'तुम्ही तो पत्ता देत आहात ज्यावर तुमचे लायसन्स पाठवले जाईल.')}
        because={t('The RTO office you were assigned earlier is based on your PIN code — if it does not match what you picked, we tell you instead of silently changing your office.', 'आपको पहले जो आरटीओ कार्यालय दिया गया वह आपके पिन कोड पर आधारित है — यदि यह मेल नहीं खाता तो हम आपको बताते हैं, चुपचाप कार्यालय बदलने के बजाय।', 'तुम्हाला आधी दिलेले आरटीओ कार्यालय तुमच्या पिन कोडवर आधारित आहे — जर ते जुळत नसेल तर आम्ही तुम्हाला सांगतो, गुपचूप कार्यालय बदलण्याऐवजी.')}
        why={t('One address, asked once — not the six-dropdown present-and-permanent-address ritual the official form puts you through.', 'एक पता, एक बार पूछा गया — आधिकारिक फॉर्म वाले छह-ड्रॉपडाउन वर्तमान-और-स्थायी-पते के झंझट के बजाय।', 'एक पत्ता, एकदाच विचारलेला — अधिकृत फॉर्मच्या सहा-ड्रॉपडाउन सध्याचा-आणि-कायमचा-पत्ता कर्मकांडाऐवजी.')} />
      <div className="card card-p col g16">
        <div className="grid2">
          <Field label={t('House, door or flat number', 'घर, दरवाजा या फ्लैट नंबर', 'घर, दार किंवा फ्लॅट क्रमांक')}><Input value={valueOf('line') as string} onChange={e => updateForm({ line: e.target.value })} /></Field>
          <Field label={t('Street, locality or police station', 'गली, इलाका या पुलिस स्टेशन', 'गल्ली, परिसर किंवा पोलीस ठाणे')}><Input value={valueOf('street') as string} onChange={e => updateForm({ street: e.target.value })} /></Field>
        </div>
        <div className="grid2">
          <Field label={t('Location or landmark', 'स्थान या लैंडमार्क', 'ठिकाण किंवा लँडमार्क')}><Input value={valueOf('landmark') as string} onChange={e => updateForm({ landmark: e.target.value })} /></Field>
          <Field label={t('Area', 'इलाका', 'परिसर')}><Input value={valueOf('area') as string} onChange={e => updateForm({ area: e.target.value })} /></Field>
        </div>
        <div className="grid3" style={{ gap: 12 }}>
          <Field label={t('District', 'जिला', 'जिल्हा')}><Input value={valueOf('district') as string} onChange={e => updateForm({ district: e.target.value })} /></Field>
          <Field label={ADDR_UNIT[form.state || 'Maharashtra'] || t('Sub-district', 'उप-जिला', 'उप-जिल्हा')} hint={t('Named differently in every state.', 'हर राज्य में इसका नाम अलग होता है।', 'प्रत्येक राज्यात याचे नाव वेगळे असते.')}>
            <Input value={valueOf('block') as string} onChange={e => updateForm({ block: e.target.value })} /></Field>
          <Field label={t('PIN code', 'पिन कोड', 'पिन कोड')} error={pinError}><Input className="input mono" inputMode="numeric" maxLength={6} value={pin} onBlur={() => touch('pin')} onChange={e => updateForm({ pin: digitsOnly(e.target.value, 6) })} /></Field>
        </div>
        <Field label={t('Is this a village or a town?', 'क्या यह गांव है या कस्बा?', 'हे गाव आहे की शहर?')}>
          <div className="row g10 wrapf" style={{ alignItems: 'center' }}>
            {(['Village', 'Town'] as const).map(o => <button key={o} className="btn btn-s btn-sm" aria-pressed={(form.vt || valueOf('vt')) === o} style={(form.vt || valueOf('vt')) === o ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand)' } : undefined} onClick={() => updateForm({ vt: o })}>{t(o, o === 'Village' ? 'गांव' : 'कस्बा', o === 'Village' ? 'गाव' : 'शहर')}</button>)}
            <Input style={{ maxWidth: 240 }} value={valueOf('city') as string} onChange={e => updateForm({ city: e.target.value })} placeholder="Name" />
          </div>
        </Field>
        <Field label={t('How long have you lived here?', 'आप यहां कितने समय से रह रहे हैं?', 'तुम्ही इथे किती काळ राहत आहात?')} hint={t('Form 2 asks for this. An estimate is fine.', 'फॉर्म 2 में यह पूछा जाता है। अनुमान लगाना ठीक है।', 'फॉर्म 2 मध्ये हे विचारले जाते. अंदाज चालेल.')}>
          <div className="row g10 center wrapf">
            <Input className="input mono" inputMode="numeric" maxLength={2} style={{ width: 88 }} value={valueOf('stayY') as string} onChange={e => updateForm({ stayY: digitsOnly(e.target.value, 2) })} /><span className="sub">{t('years', 'वर्ष', 'वर्षे')}</span>
            <Input className="input mono" inputMode="numeric" maxLength={2} style={{ width: 88 }} value={valueOf('stayM') as string} onChange={e => { const v = digitsOnly(e.target.value, 2); updateForm({ stayM: Number(v) > 11 ? '11' : v }); }} /><span className="sub">{t('months', 'महीने', 'महिने')}</span>
          </div>
        </Field>
        <hr className="hr" />
        <button className="tile" role="checkbox" aria-checked={sameAsPermanent} onClick={() => updateForm({ same: !sameAsPermanent })}>
          <span className="tick" style={{ borderRadius: 6 }}>{sameAsPermanent ? Icon.check() : null}</span>
          <span className="col g4"><span style={{ fontWeight: 600 }}>{t('My permanent address is the same', 'मेरा स्थायी पता वही है', 'माझा कायमचा पत्ता तोच आहे')}</span><span className="sub">{t('Untick if your family home is elsewhere. The licence is posted to the present address either way.', 'यदि आपका पारिवारिक घर कहीं और है तो अनटिक करें। लाइसेंस दोनों ही स्थिति में वर्तमान पते पर भेजा जाता है।', 'तुमचे कौटुंबिक घर इतरत्र असल्यास अनटिक करा. लायसन्स दोन्ही परिस्थितीत सध्याच्या पत्त्यावर पाठवले जाते.')}</span></span>
        </button>
        {!sameAsPermanent && (
          <div className="col g16 fade">
            <div className="grid2">
              <Field label={t('Permanent address', 'स्थायी पता', 'कायमचा पत्ता')}><Input placeholder="House, street, locality" value={form.pline || ''} onChange={e => updateForm({ pline: e.target.value })} /></Field>
              <Field label={t('Landmark', 'लैंडमार्क', 'लँडमार्क')}><Input value={form.plandmark || ''} onChange={e => updateForm({ plandmark: e.target.value })} /></Field>
            </div>
            <div className="grid3" style={{ gap: 12 }}>
              <Field label={t('Town', 'कस्बा', 'गाव')}><Input value={form.pcity || ''} onChange={e => updateForm({ pcity: e.target.value })} /></Field>
              <Field label={t('District', 'जिला', 'जिल्हा')}><Input value={form.pdistrict || ''} onChange={e => updateForm({ pdistrict: e.target.value })} /></Field>
              <Field label={t('PIN code', 'पिन कोड', 'पिन कोड')} error={ppinError}><Input className="input mono" inputMode="numeric" maxLength={6} value={form.ppin || ''} onBlur={() => touch('ppin')} onChange={e => updateForm({ ppin: digitsOnly(e.target.value, 6) })} /></Field>
            </div>
          </div>
        )}
        {isAadhaar && addressEdited && <div className="fade"><Note tone="warn"><b>{t('You changed the address that came from e-KYC.', 'आपने e-KYC से आए पते को बदल दिया है।', 'तुम्ही e-KYC मधून आलेला पत्ता बदलला आहे.')}</b> {t('That means an address proof has to be uploaded after all — it will appear on the documents step instead of being exempt. Changing it back removes the requirement.', 'इसका मतलब है कि आखिरकार एक पता प्रमाण अपलोड करना होगा — यह छूट के बजाय दस्तावेज़ चरण पर दिखेगा। इसे वापस बदलने से यह आवश्यकता हट जाती है।', 'याचा अर्थ शेवटी पत्ता पुरावा अपलोड करावा लागेल — तो सूट ऐवजी कागदपत्रे टप्प्यात दिसेल. तो परत बदलल्यास ही आवश्यकता निघून जाते.')}</Note></div>}
        <Note tone="brand" icon={Icon.pin()}><b>{t(`PIN ${valueOf('pin')} falls under ${(rtosFor(form.state || 'Maharashtra').find(o => o.id === form.rto) || rtosFor(form.state || 'Maharashtra')[0]).name}`, `पिन ${valueOf('pin')} इसके अंतर्गत आता है: ${(rtosFor(form.state || 'Maharashtra').find(o => o.id === form.rto) || rtosFor(form.state || 'Maharashtra')[0]).name}`, `पिन ${valueOf('pin')} याअंतर्गत येतो: ${(rtosFor(form.state || 'Maharashtra').find(o => o.id === form.rto) || rtosFor(form.state || 'Maharashtra')[0]).name}`)}</b>{t(', which is what you picked on step one. If you change the PIN we will tell you rather than silently move your office.', ', जो आपने पहले चरण में चुना था। अगर आप पिन बदलते हैं तो हम आपको बताएंगे, चुपचाप आपका कार्यालय नहीं बदलेंगे।', ', जे तुम्ही पहिल्या टप्प्यात निवडले होते. जर तुम्ही पिन बदललात तर आम्ही तुम्हाला सांगू, गुपचूप तुमचे कार्यालय बदलणार नाही.')}</Note>
      </div>
    </div>
  );
}

/** Step 7 — vehicle classes, with the itemised fee attached to each one. */
export function VehicleClasses({ form, updateForm, classIds, totalFee }: StepProps) {
  const t = useT();
  const stateName = form.state || 'Maharashtra';
  const extraFees = STATE_FEES[stateName] || [];
  const age = ageFrom(form.dob || '2005-04-12');
  const toggleClass = (id: string) => {
    const cls = CLASSES.find(c => c.id === id)!;
    if (age < cls.min) return;
    updateForm({ classes: classIds.includes(id) ? classIds.filter(x => x !== id) : [...classIds, id] });
  };

  return (
    <div className="col g20">
      <Purpose
        what={t("You're picking every type of vehicle you want this licence to legally cover.", 'आप हर उस तरह का वाहन चुन रहे हैं जिसे यह लाइसेंस कानूनी रूप से कवर करे।', 'तुम्ही प्रत्येक प्रकारचे वाहन निवडत आहात जे या लायसन्सने कायदेशीररित्या कव्हर करावे.')}
        because={t('Each class adds its own fee, but the test, appointment and ₹50 test fee stay the same no matter how many you pick.', 'हर श्रेणी अपनी फीस जोड़ती है, लेकिन टेस्ट, अपॉइंटमेंट और ₹50 टेस्ट फीस वही रहती है, आप कितनी भी चुनें।', 'प्रत्येक वर्ग स्वतःची फी जोडतो, पण टेस्ट, भेटीची वेळ आणि ₹50 टेस्ट फी तीच राहते, तुम्ही कितीही निवडा.')}
        why={t('Adding a second class now costs far less than applying for it separately later — and you see the total before you commit.', 'अभी दूसरी श्रेणी जोड़ना बाद में अलग से आवेदन करने से कहीं सस्ता है — और आप प्रतिबद्ध होने से पहले कुल राशि देख लेते हैं।', 'आता दुसरा वर्ग जोडणे नंतर वेगळा अर्ज करण्यापेक्षा खूप स्वस्त आहे — आणि तुम्ही निर्णय घेण्यापूर्वीच एकूण रक्कम पाहता.')} />
      <div className="col g10">
        {CLASSES.map(cls => {
          const locked = age < cls.min;
          const selected = classIds.includes(cls.id);
          return (
            <button key={cls.id} className="tile" aria-checked={selected} role="checkbox" disabled={locked} onClick={() => toggleClass(cls.id)} style={locked ? { opacity: 0.55 } : undefined}>
              <span className="tick" style={{ borderRadius: 6 }}>{selected ? Icon.check() : null}</span>
              <span className="col g4 grow">
                <span className="row g8 wrapf"><b style={{ fontWeight: 600 }}>{cls.name}</b><span className="pill mono" style={{ fontSize: '.68rem' }}>{cls.code}</span>{cls.medical && <Pill tone="warn">Form 1A</Pill>}</span>
                <span className="sub">{locked ? t(`You are ${age}. This class opens at ${cls.min}.`, `आपकी आयु ${age} है। यह श्रेणी ${cls.min} पर खुलती है।`, `तुमचे वय ${age} आहे. हा वर्ग ${cls.min} व्या वर्षी उघडतो.`) : cls.note}</span>
              </span>
              <span className="col g4" style={{ alignItems: 'flex-end', flex: 'none' }}><b style={{ fontWeight: 600 }}>₹{cls.fee}</b><span className="tiny">{t('grant fee', 'अनुदान शुल्क', 'अनुदान फी')}</span></span>
            </button>
          );
        })}
      </div>
      <div className="card card-p col g14">
        <div className="row between g12 wrapf">
          <span className="col g4"><span className="sub">{t(`${classIds.length} class${classIds.length === 1 ? '' : 'es'} selected`, `${classIds.length} श्रेणी चुनी गई`, `${classIds.length} वर्ग निवडले`)}</span>
            <b style={{ fontSize: '1.4rem', fontFamily: 'var(--disp)' }}>₹{totalFee}</b></span>
          <span className="tiny" style={{ maxWidth: 330, textAlign: 'right' }}>{t(`₹150 for each class, plus a single ₹50 test fee however many classes you add${extraFees.length ? `, plus ${stateName}'s own charges` : ''}. Itemised in full before you pay.`, `हर श्रेणी के लिए ₹150, साथ में कितनी भी श्रेणियां जोड़ें, एक बार ₹50 टेस्ट फीस${extraFees.length ? `, साथ ही ${stateName} के अपने शुल्क` : ''}। भुगतान से पहले पूरा विवरण दिखाया जाता है।`, `प्रत्येक वर्गासाठी ₹150, आणि किती वर्ग जोडले तरी एकदाच ₹50 टेस्ट फी${extraFees.length ? `, तसेच ${stateName}चे स्वतःचे शुल्क` : ''}. पैसे भरण्यापूर्वी संपूर्ण तपशील दाखवला जातो.`)}</span>
        </div>
        {extraFees.length > 0 && <Note tone="warn"><b>{t(`${stateName} adds ${extraFees.length} charges of its own`, `${stateName} अपने ${extraFees.length} शुल्क जोड़ता है`, `${stateName} स्वतःचे ${extraFees.length} शुल्क जोडते`)}</b> — {extraFees.map(x => x.k.toLowerCase()).join(', ')}. {t(`They are legitimate state levies, but on the official portal they appear for the first time on the payment page, which is why the same licence costs ₹350 in Maharashtra and ₹740 here. Every line is named on the next screen.`, `यह वैध राज्य शुल्क हैं, लेकिन आधिकारिक पोर्टल पर यह पहली बार भुगतान पेज पर दिखते हैं, इसीलिए वही लाइसेंस महाराष्ट्र में ₹350 और यहां ₹740 का पड़ता है। अगली स्क्रीन पर हर लाइन का नाम है।`, `हे वैध राज्य शुल्क आहेत, पण अधिकृत पोर्टलवर ती पहिल्यांदा पेमेंट पानावर दिसतात, म्हणूनच तेच लायसन्स महाराष्ट्रात ₹350 आणि इथे ₹740 चे पडते. पुढील स्क्रीनवर प्रत्येक ओळीचे नाव दिलेले आहे.`)}</Note>}
        {classIds.length > 1 && <Note tone="ok" icon={Icon.check()}>{t('Two classes on one application means one test, one appointment and one ₹50 test fee. Applying separately would mean paying it twice.', 'एक आवेदन में दो श्रेणियां मतलब एक टेस्ट, एक अपॉइंटमेंट और एक ₹50 टेस्ट फीस। अलग-अलग आवेदन करने पर यह दो बार देना पड़ता।', 'एका अर्जात दोन वर्ग म्हणजे एक टेस्ट, एक भेट आणि एक ₹50 टेस्ट फी. वेगळे अर्ज केल्यास ती दोनदा भरावी लागेल.')}</Note>}
        <hr className="hr" />
        <Field label={t('Have you been trained at a driving school?', 'क्या आपने ड्राइविंग स्कूल में प्रशिक्षण लिया है?', 'तुम्ही ड्रायव्हिंग स्कूलमध्ये प्रशिक्षण घेतले आहे का?')} hint={t('Form 2 asks. A certificate from an accredited school can exempt you from part of the driving test later, so it is worth saying yes.', 'फॉर्म 2 में पूछा जाता है। मान्यता प्राप्त स्कूल का प्रमाणपत्र बाद में ड्राइविंग टेस्ट के एक हिस्से से छूट दे सकता है, इसलिए हां कहना फायदेमंद है।', 'फॉर्म 2 मध्ये विचारले जाते. मान्यताप्राप्त शाळेचे प्रमाणपत्र नंतर ड्रायव्हिंग टेस्टच्या एका भागातून सूट देऊ शकते, त्यामुळे होय म्हणणे फायदेशीर आहे.')}>
          <div className="row g10 wrapf">{(['No', 'Yes'] as const).map(o => <button key={o} className="btn btn-s btn-sm" aria-pressed={(form.school || 'No') === o} style={(form.school || 'No') === o ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand)' } : undefined} onClick={() => updateForm({ school: o })}>{t(o, o === 'Yes' ? 'हां' : 'नहीं', o === 'Yes' ? 'होय' : 'नाही')}</button>)}</div>
        </Field>
        {form.school === 'Yes' && <div className="fade"><Field label={t('School name and accreditation number', 'स्कूल का नाम और मान्यता नंबर', 'शाळेचे नाव आणि मान्यता क्रमांक')}><Input placeholder="e.g. Dadar Motor Training School · MH02/DS/0184" value={form.schoolNo || ''} onChange={e => updateForm({ schoolNo: e.target.value })} /></Field></div>}
      </div>
    </div>
  );
}

/** Step 8 — Form 1 physical-fitness declaration, plus the organ-donation and prior-conviction questions. */
export function Form1Declaration({ form, updateForm, needsMedicalCert, form1Answers }: StepProps) {
  const t = useT();
  const setAnswer = (key: string, value: string) => updateForm({ f1: { ...form1Answers, [key]: value } });
  const flagged = FORM1.filter(([key, , safeAnswer]) => form1Answers[key] && form1Answers[key] !== safeAnswer);
  const yn = (o: 'Yes' | 'No') => t(o, o === 'Yes' ? 'हां' : 'नहीं', o === 'Yes' ? 'होय' : 'नाही');

  return (
    <div className="col g20">
      <Purpose
        what={t("You're declaring you're medically fit to drive, under Rule 5(2).", 'आप नियम 5(2) के तहत घोषित कर रहे हैं कि आप चलाने के लिए चिकित्सकीय रूप से फिट हैं।', 'तुम्ही नियम 5(2) अंतर्गत घोषित करत आहात की तुम्ही वाहन चालवण्यासाठी वैद्यकीयदृष्ट्या तंदुरुस्त आहात.')}
        because={t('An answer outside the expected one does not block your application — it just adds a doctor\'s certificate (Form 1A) as one extra step.', 'अनुमानित जवाब से अलग जवाब आपके आवेदन को नहीं रोकता — यह केवल एक अतिरिक्त चरण के रूप में डॉक्टर का प्रमाणपत्र (फॉर्म 1A) जोड़ता है।', 'अपेक्षित उत्तराव्यतिरिक्त उत्तर तुमचा अर्ज थांबवत नाही — ते फक्त एक जास्तीचा टप्पा म्हणून डॉक्टरचे प्रमाणपत्र (फॉर्म 1A) जोडते.')}
        why={t('Knowing the consequence before you answer means an honest answer never feels risky.', 'जवाब देने से पहले परिणाम जानना मतलब है कि एक सच्चा जवाब कभी जोखिम भरा नहीं लगता।', 'उत्तर देण्यापूर्वी परिणाम माहीत असणे म्हणजे एक खरे उत्तर कधीही धोकादायक वाटत नाही.')} />
      <div className="card card-p col g16">
        <div className="row between g12 wrapf"><h3>{t('Form 1 — declaration as to physical fitness', 'फॉर्म 1 — शारीरिक फिटनेस घोषणा', 'फॉर्म 1 — शारीरिक तंदुरुस्ती घोषणा')}</h3><span className="tiny mono">See Rule 5(2)</span></div>
        {FORM1.map(([key, question, safeAnswer]) => (
          <div key={key} className="col g8">
            <div className="row g10" style={{ alignItems: 'flex-start' }}>
              <span className="mono tiny" style={{ marginTop: 4, color: 'var(--muted)', flex: 'none' }}>({key})</span>
              <span style={{ fontSize: '.95rem', lineHeight: 1.5 }}>{question}</span>
            </div>
            <div className="row g10 wrapf" style={{ paddingLeft: 26 }}>
              {(['Yes', 'No'] as const).map(o => (
                <button key={o} className="btn btn-s btn-sm" aria-pressed={form1Answers[key] === o}
                  style={form1Answers[key] === o ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand)' } : undefined} onClick={() => setAnswer(key, o)}>{yn(o)}</button>
              ))}
            </div>
            {form1Answers[key] && form1Answers[key] !== safeAnswer && (
              <div style={{ paddingLeft: 26 }} className="fade"><Note tone="warn">{t('This answer does not stop your application. It means a registered doctor has to certify you on Form 1A, and the licence may carry a condition — glasses, an adapted vehicle, or a restricted class.', 'यह जवाब आपके आवेदन को नहीं रोकता। इसका मतलब है कि एक रजिस्टर्ड डॉक्टर को फॉर्म 1A पर आपको प्रमाणित करना होगा, और लाइसेंस पर एक शर्त लग सकती है — चश्मा, अनुकूलित वाहन, या प्रतिबंधित श्रेणी।', 'हे उत्तर तुमचा अर्ज थांबवत नाही. याचा अर्थ एका नोंदणीकृत डॉक्टरला फॉर्म 1A वर तुम्हाला प्रमाणित करावे लागेल, आणि लायसन्सवर एक अट येऊ शकते — चष्मा, बदल केलेले वाहन, किंवा मर्यादित वर्ग.')}</Note></div>
            )}
            <hr className="hr" />
          </div>
        ))}
        <button className="tile" role="checkbox" aria-checked={!!form.f1sign} onClick={() => updateForm({ f1sign: !form.f1sign })}>
          <span className="tick" style={{ borderRadius: 6 }}>{form.f1sign ? Icon.check() : null}</span>
          <span className="sub" style={{ color: 'var(--ink)' }}>{t('I declare that to the best of my knowledge and belief the particulars given above, and this declaration, are true.', 'मैं घोषित करता/करती हूं कि मेरी जानकारी और विश्वास के अनुसार ऊपर दिए गए विवरण, और यह घोषणा, सत्य हैं।', 'मी घोषित करतो/करते की माझ्या माहिती आणि विश्वासानुसार वरील तपशील, आणि ही घोषणा, सत्य आहेत.')}</span>
        </button>
      </div>
      {(needsMedicalCert || flagged.length > 0) && (
        <div className="card card-p col g14 fade">
          <div className="row between g12"><h3>{t('Form 1A — medical certificate', 'फॉर्म 1A — मेडिकल सर्टिफिकेट', 'फॉर्म 1A — वैद्यकीय प्रमाणपत्र')}</h3><Pill tone="warn">{t('Required', 'आवश्यक', 'आवश्यक')}</Pill></div>
          <p className="sub">{needsMedicalCert
            ? t('You added a transport class, so a registered medical practitioner must certify you.', 'आपने एक ट्रांसपोर्ट श्रेणी जोड़ी है, इसलिए एक रजिस्टर्ड चिकित्सक को आपको प्रमाणित करना होगा।', 'तुम्ही एक वाहतूक वर्ग जोडला आहे, त्यामुळे एका नोंदणीकृत डॉक्टरला तुम्हाला प्रमाणित करावे लागेल.')
            : t(`Your answer to (${flagged.map(x => x[0]).join(', ')}) means a doctor has to certify you.`, `(${flagged.map(x => x[0]).join(', ')}) के आपके जवाब का मतलब है कि एक डॉक्टर को आपको प्रमाणित करना होगा।`, `(${flagged.map(x => x[0]).join(', ')}) या तुमच्या उत्तरामुळे एका डॉक्टरला तुम्हाला प्रमाणित करावे लागेल.`)} {t('Vision, hearing and colour perception are what they check.', 'वे दृष्टि, श्रवण और रंग पहचान की जांच करते हैं।', 'ते दृष्टी, श्रवण आणि रंग ओळख तपासतात.')}</p>
          <div className="doc" data-s={form.form1a ? 'ok' : undefined}>
            <span className="doc-th">{form.form1a ? <span style={{ color: 'var(--ok)' }}>{Icon.check({ width: 18, height: 18 })}</span> : Icon.doc()}</span>
            <span className="col g4 grow"><b style={{ fontWeight: 600 }}>{t('Signed Form 1A', 'हस्ताक्षरित फॉर्म 1A', 'स्वाक्षरी केलेला फॉर्म 1A')}</b><span className="sub">{t("PDF or photo, both pages, doctor's registration number visible", 'PDF या फोटो, दोनों पेज, डॉक्टर का रजिस्ट्रेशन नंबर दिखना चाहिए', 'PDF किंवा फोटो, दोन्ही पाने, डॉक्टरचा नोंदणी क्रमांक दिसणे आवश्यक')}</span></span>
            <button className="btn btn-s btn-sm" onClick={() => updateForm({ form1a: !form.form1a })}>{form.form1a ? t('Replace', 'बदलें', 'बदला') : t('Upload', 'अपलोड करें', 'अपलोड करा')}</button>
          </div>
          <Note>{t('No panel doctor needed. Any registered practitioner can sign it, and the certificate is valid for one year.', 'किसी पैनल डॉक्टर की आवश्यकता नहीं। कोई भी रजिस्टर्ड चिकित्सक इस पर हस्ताक्षर कर सकता है, और प्रमाणपत्र एक वर्ष के लिए वैध है।', 'कोणत्याही पॅनेल डॉक्टरची गरज नाही. कोणताही नोंदणीकृत डॉक्टर यावर स्वाक्षरी करू शकतो, आणि प्रमाणपत्र एक वर्षासाठी वैध आहे.')}</Note>
        </div>
      )}
      <div className="card card-p col g14">
        <h3>{t('Two more declarations', 'दो और घोषणाएं', 'आणखी दोन घोषणा')}</h3>
        <div className="col g10">
          <span className="label" style={{ fontSize: '.9rem' }}>{t('Are you willing to donate your organs in the event of accidental death?', 'क्या आप दुर्घटना में मृत्यु होने पर अपने अंग दान करना चाहेंगे?', 'अपघाती मृत्यू झाल्यास तुम्ही तुमचे अवयव दान करण्यास इच्छुक आहात का?')}</span>
          <span className="hint">{t('Asked on the licence application because the licence is the document found on you. Either answer is fine and it is recorded, not published.', 'लाइसेंस आवेदन पर यह पूछा जाता है क्योंकि लाइसेंस वह दस्तावेज़ है जो आप पर पाया जाता है। कोई भी जवाब ठीक है और यह दर्ज होता है, प्रकाशित नहीं।', 'लायसन्स अर्जावर हे विचारले जाते कारण लायसन्स हे तुमच्याजवळ सापडणारे कागदपत्र आहे. कोणतेही उत्तर ठीक आहे आणि ते नोंदवले जाते, प्रकाशित होत नाही.')}</span>
          <div className="row g10 wrapf">{(['Yes', 'No'] as const).map(o => <button key={o} className="btn btn-s btn-sm" aria-pressed={form.organ === o} style={form.organ === o ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand)' } : undefined} onClick={() => updateForm({ organ: o })}>{yn(o)}</button>)}</div>
        </div>
        <hr className="hr" />
        <div className="col g10">
          <span className="label" style={{ fontSize: '.9rem' }}>{t('Have you ever been convicted, disqualified, or had a licence cancelled, suspended or revoked?', 'क्या आपको कभी दोषी ठहराया गया है, अयोग्य घोषित किया गया है, या आपका लाइसेंस रद्द, निलंबित या वापस लिया गया है?', 'तुम्हाला कधी दोषी ठरवण्यात आले आहे, अपात्र घोषित करण्यात आले आहे, किंवा तुमचे लायसन्स रद्द, स्थगित किंवा मागे घेण्यात आले आहे का?')}</span>
          <div className="row g10 wrapf">{(['No', 'Yes'] as const).map(o => <button key={o} className="btn btn-s btn-sm" aria-pressed={form.conv === o} style={form.conv === o ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand)' } : undefined} onClick={() => updateForm({ conv: o })}>{yn(o)}</button>)}</div>
        </div>
        {form.conv === 'Yes' && <div className="fade"><Note tone="warn">{t('You will be asked for the court order or RTO endorsement number. A past disqualification that has run its term does not block a new licence — hiding it does.', 'आपसे कोर्ट ऑर्डर या RTO पृष्ठांकन नंबर मांगा जाएगा। पूरी हो चुकी पूर्व अयोग्यता नए लाइसेंस को नहीं रोकती — इसे छिपाना रोकता है।', 'तुम्हाला न्यायालयाचा आदेश किंवा RTO नोंद क्रमांक मागितला जाईल. पूर्ण झालेली मागील अपात्रता नवीन लायसन्सला अडवत नाही — ती लपवणे अडवते.')}</Note></div>}
        <hr className="hr" />
        <div className="col g10">
          <span className="label" style={{ fontSize: '.9rem' }}>{t('Do you hold a licence issued outside India?', 'क्या आपके पास भारत के बाहर जारी कोई लाइसेंस है?', 'तुमच्याकडे भारताबाहेर जारी केलेले कोणतेही लायसन्स आहे का?')}</span>
          <div className="row g10 wrapf">{(['No', 'Yes'] as const).map(o => <button key={o} className="btn btn-s btn-sm" aria-pressed={(form.foreign || 'No') === o} style={(form.foreign || 'No') === o ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand)' } : undefined} onClick={() => updateForm({ foreign: o })}>{yn(o)}</button>)}</div>
        </div>
      </div>
    </div>
  );
}

/** Step 9 — upload documents, photo and signature (or see what's exempt, on the Aadhaar route). */
export function DocumentsPhotoSignature({ form, updateForm, isAadhaar }: StepProps) {
  const t = useT();
  const cyclePhotoStatus = (key: 'photo' | 'sign') => updateForm({ [key]: form[key] === 'warn' ? 'ok' : form[key] ? 'ok' : 'warn' });
  const addressEditedAfterKyc = isAadhaar && (form.line !== undefined || form.area !== undefined || form.pin !== undefined);

  return (
    <div className="col g20">
      <Purpose
        what={isAadhaar
          ? t("You're just confirming your signature — everything else came from your Aadhaar record.", 'आप केवल अपने हस्ताक्षर की पुष्टि कर रहे हैं — बाकी सब आपके आधार रिकॉर्ड से आया।', 'तुम्ही फक्त तुमच्या स्वाक्षरीची पुष्टी करत आहात — बाकी सर्व तुमच्या आधार नोंदीतून आले.')
          : t("You're uploading proof of your age and address, plus a photo and signature.", 'आप अपनी उम्र और पते का प्रमाण, साथ ही एक फोटो और हस्ताक्षर अपलोड कर रहे हैं।', 'तुम्ही तुमच्या वयाचा आणि पत्त्याचा पुरावा, तसेच एक फोटो आणि स्वाक्षरी अपलोड करत आहात.')}
        because={isAadhaar
          ? t('Your age proof, address proof and photograph are already exempt; only a signature needs a fresh photo.', 'आपका आयु प्रमाण, पता प्रमाण और फोटोग्राफ पहले से छूट में हैं; केवल हस्ताक्षर के लिए नई फोटो चाहिए।', 'तुमचा वय पुरावा, पत्ता पुरावा आणि छायाचित्र आधीच सूट आहेत; फक्त स्वाक्षरीसाठी नवीन फोटो हवा आहे.')
          : t('Each one is checked instantly for common mistakes — the kind of thing that otherwise only gets caught at the counter.', 'हर एक की सामान्य गलतियों के लिए तुरंत जांच होती है — जो अन्यथा केवल काउंटर पर पकड़ी जाती।', 'प्रत्येकाची सामान्य चुकांसाठी त्वरित तपासणी होते — जे अन्यथा फक्त काउंटरवरच लक्षात येते.')}
        why={isAadhaar
          ? t('What is normally three separate uploads is, for you, one.', 'जो सामान्यतः तीन अलग अपलोड होते हैं, वह आपके लिए एक है।', 'जे साधारणपणे तीन वेगळे अपलोड असतात, ते तुमच्यासाठी एक आहे.')
          : t('A rejected photo costs you a wasted trip if it is caught at the office. Catching it here costs you nothing.', 'यदि कार्यालय में एक अस्वीकृत फोटो पकड़ी जाती है तो आपकी यात्रा बेकार जाती है। इसे यहां पकड़ना आपको कुछ नहीं देता।', 'कार्यालयात नाकारलेला फोटो पकडला गेला तर तुमची फेरी वाया जाते. इथे तो पकडणे तुम्हाला काहीही खर्च करत नाही.')} />
      {isAadhaar ? (
        <div className="card card-p col g14">
          <div className="row between g12 wrapf"><h3>{t('Documents', 'दस्तावेज़', 'कागदपत्रे')}</h3><Pill tone="ok">{t('Exempted', 'छूट', 'सूट')}</Pill></div>
          <p className="sub">{t('Your age proof, address proof and photograph came from the e-KYC record, so there is nothing to upload. On the official portal this stage shows as', 'आपका आयु प्रमाण, पता प्रमाण और फोटोग्राफ e-KYC रिकॉर्ड से आए हैं, इसलिए अपलोड करने के लिए कुछ नहीं है। आधिकारिक पोर्टल पर यह चरण', 'तुमचा वय पुरावा, पत्ता पुरावा आणि छायाचित्र e-KYC नोंदीतून आले आहेत, त्यामुळे अपलोड करण्यासारखे काही नाही. अधिकृत पोर्टलवर हा टप्पा')} <span className="mono">{t('Exempted', 'छूट', 'सूट')}</span> {t('and people still go looking for it.', 'दिखता है और लोग फिर भी उसे ढूंढते रहते हैं।', 'दिसतो आणि लोक अजूनही तो शोधत राहतात.')}</p>
          {([['Age proof', 'From Aadhaar record', 'आयु प्रमाण', 'आधार रिकॉर्ड से', 'वय पुरावा', 'आधार नोंदीतून'], ['Address proof', 'From Aadhaar record', 'पता प्रमाण', 'आधार रिकॉर्ड से', 'पत्ता पुरावा', 'आधार नोंदीतून'], ['Photograph', 'From Aadhaar record', 'फोटोग्राफ', 'आधार रिकॉर्ड से', 'छायाचित्र', 'आधार नोंदीतून']] as const).map(([name, desc, nameHi, descHi, nameMr, descMr]) => (
            <div key={name} className="doc" data-s="ok">
              <span className="doc-th" style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}>{Icon.check({ width: 18, height: 18 })}</span>
              <span className="col g4 grow"><b style={{ fontWeight: 600 }}>{t(name, nameHi, nameMr)}</b><span className="sub">{t(desc, descHi, descMr)}</span></span>
              <span className="pill pill-ok" style={{ flex: 'none' }}>{t('Exempt', 'छूट', 'सूट')}</span>
            </div>
          ))}
          {addressEditedAfterKyc && (
            <Note tone="warn"><b>{t('Except the address proof.', 'पता प्रमाण को छोड़कर।', 'पत्ता पुरावा वगळता.')}</b> {t('You edited the address that came from e-KYC, so a proof is needed after all.', 'आपने e-KYC से आए पते को संपादित किया है, इसलिए अंततः एक प्रमाण की आवश्यकता है।', 'तुम्ही e-KYC मधून आलेला पत्ता संपादित केला आहे, त्यामुळे शेवटी पुरावा आवश्यक आहे.')}
              <div className="doc" style={{ marginTop: 10 }} data-s={form.addrDoc ? 'ok' : undefined}>
                <span className="doc-th">{form.addrDoc ? <span style={{ color: 'var(--ok)' }}>{Icon.check({ width: 18, height: 18 })}</span> : Icon.doc()}</span>
                <span className="col g4 grow"><b style={{ fontWeight: 600 }}>{t('Address proof', 'पता प्रमाण', 'पत्ता पुरावा')}</b><span className="sub">{t('Electricity bill, rent agreement or passport', 'बिजली बिल, रेंट एग्रीमेंट या पासपोर्ट', 'वीज बिल, भाडे करार किंवा पासपोर्ट')}</span></span>
                <button className="btn btn-s btn-sm" onClick={() => updateForm({ addrDoc: !form.addrDoc })}>{form.addrDoc ? t('Replace', 'बदलें', 'बदला') : t('Choose file', 'फ़ाइल चुनें', 'फाइल निवडा')}</button>
              </div>
            </Note>
          )}
          <button className="tile" role="checkbox" aria-checked={!!form.docsOk} onClick={() => updateForm({ docsOk: !form.docsOk })}>
            <span className="tick" style={{ borderRadius: 6 }}>{form.docsOk ? Icon.check() : null}</span>
            <span className="sub" style={{ color: 'var(--ink)' }}>{t('I confirm these are the documents I want on the application.', 'मैं पुष्टि करता/करती हूं कि यही दस्तावेज़ मैं आवेदन पर चाहता/चाहती हूं।', 'मी पुष्टी करतो/करते की हीच कागदपत्रे मला अर्जावर हवी आहेत.')}</span>
          </button>
        </div>
      ) : (
        <div className="card card-p col g14">
          <div className="row between g12 wrapf"><h3>{t('Upload your proofs', 'अपने प्रमाण अपलोड करें', 'तुमचे पुरावे अपलोड करा')}</h3><Pill tone="warn">{t('Manual route', 'मैनुअल रास्ता', 'मॅन्युअल मार्ग')}</Pill></div>
          {([['Age proof', 'Birth certificate, school leaving certificate, passport or PAN card', 'आयु प्रमाण', 'जन्म प्रमाणपत्र, स्कूल छोड़ने का प्रमाणपत्र, पासपोर्ट या पैन कार्ड', 'वय पुरावा', 'जन्म प्रमाणपत्र, शाळा सोडल्याचा दाखला, पासपोर्ट किंवा पॅन कार्ड'], ['Address proof', 'Passport, electricity bill, rent agreement or ration card', 'पता प्रमाण', 'पासपोर्ट, बिजली बिल, रेंट एग्रीमेंट या राशन कार्ड', 'पत्ता पुरावा', 'पासपोर्ट, वीज बिल, भाडे करार किंवा रेशन कार्ड']] as const).map(([name, desc, nameHi, descHi, nameMr, descMr]) => (
            <div key={name} className="doc"><span className="doc-th">{Icon.doc()}</span>
              <span className="col g4 grow"><b style={{ fontWeight: 600 }}>{t(name, nameHi, nameMr)}</b><span className="sub">{t(desc, descHi, descMr)}</span></span>
              <button className="btn btn-s btn-sm" onClick={() => updateForm({ docsOk: true })}>{t('Choose file', 'फ़ाइल चुनें', 'फाइल निवडा')}</button></div>
          ))}
          {form.docsOk && <Note tone="ok" icon={Icon.check()}>{t('Both readable, under the 20 KB limit, and the name on them matches what you typed. Checked here rather than at the counter.', 'दोनों पढ़ने योग्य हैं, 20 KB सीमा के अंदर हैं, और उन पर नाम वही है जो आपने टाइप किया। यहीं जांच हो जाती है, काउंटर पर नहीं।', 'दोन्ही वाचता येण्याजोगी आहेत, 20 KB मर्यादेत आहेत, आणि त्यावरील नाव तुम्ही टाइप केलेल्याशी जुळते. इथेच तपासले जाते, काउंटरवर नाही.')}</Note>}
        </div>
      )}
      <div className="card card-p col g14">
        <div className="row between g12 wrapf"><h3>{t('Photo and signature', 'फोटो और हस्ताक्षर', 'फोटो आणि स्वाक्षरी')}</h3>{isAadhaar && <Pill tone="brand">{t('Signature only', 'केवल हस्ताक्षर', 'फक्त स्वाक्षरी')}</Pill>}</div>
        <p className="sub">{t('The official spec is a 35 × 45 mm JPEG between 10 and 20 KB for the photo, and 256 × 64 pixels for the signature. You should not have to know that, so we resize what your camera gives us.', 'आधिकारिक स्पेक फोटो के लिए 10 से 20 KB के बीच का 35 × 45 mm JPEG है, और हस्ताक्षर के लिए 256 × 64 पिक्सेल। आपको यह जानने की ज़रूरत नहीं, इसलिए हम आपके कैमरे से मिली चीज़ को खुद रीसाइज़ कर देते हैं।', 'अधिकृत तपशील फोटोसाठी 10 ते 20 KB मधील 35 × 45 mm JPEG आहे, आणि स्वाक्षरीसाठी 256 × 64 पिक्सेल. तुम्हाला हे जाणून घ्यायची गरज नाही, त्यामुळे तुमच्या कॅमेऱ्याने दिलेले आम्ही स्वतः पुनःआकारित करतो.')}</p>
        {isAadhaar && <Note tone="brand">{t('Your photograph comes from Aadhaar, so only the signature is needed. The official portal says this in red text halfway down the page.', 'आपका फोटोग्राफ आधार से आता है, इसलिए केवल हस्ताक्षर की ज़रूरत है। आधिकारिक पोर्टल यह पेज के बीच में लाल टेक्स्ट में बताता है।', 'तुमचे छायाचित्र आधारमधून येते, त्यामुळे फक्त स्वाक्षरीची गरज आहे. अधिकृत पोर्टल हे पानाच्या मध्यावर लाल मजकुरात सांगते.')}</Note>}
        {([['photo', 'Passport photograph', 'Plain wall, daylight, whole head in frame'], ['sign', 'Signature', 'Sign in the middle of a white sheet, black pen']] as const)
          .filter(([id]) => !(isAadhaar && id === 'photo')).map(([id, name, desc]) => {
            const status = form[id];
            const nameT = id === 'photo' ? t(name, 'पासपोर्ट फोटो', 'पासपोर्ट फोटो') : t(name, 'हस्ताक्षर', 'स्वाक्षरी');
            const descT = id === 'photo' ? t(desc, 'सादा दीवार, दिन का उजाला, पूरा सिर फ्रेम में', 'साधी भिंत, दिवसाचा उजेड, संपूर्ण डोके चौकटीत') : t(desc, 'सफेद कागज़ के बीच में हस्ताक्षर करें, काली स्याही', 'पांढऱ्या कागदाच्या मध्ये स्वाक्षरी करा, काळी शाई');
            return (
              <div key={id} className="col g8">
                <div className="doc" data-s={status === 'ok' ? 'ok' : status === 'warn' ? 'warn' : undefined}>
                  <span className="doc-th">{status === 'ok' ? <span style={{ color: 'var(--ok)' }}>{Icon.check({ width: 18, height: 18 })}</span> : Icon.doc()}</span>
                  <span className="col g4 grow"><b style={{ fontWeight: 600 }}>{nameT}</b><span className="sub">{descT}</span></span>
                  <button className="btn btn-s btn-sm" onClick={() => cyclePhotoStatus(id)}>{status === 'ok' ? t('Retake', 'फिर से लें', 'पुन्हा घ्या') : status === 'warn' ? t('Try again', 'फिर कोशिश करें', 'पुन्हा प्रयत्न करा') : t('Take photo', 'फोटो लें', 'फोटो घ्या')}</button>
                </div>
                {status === 'warn' && (
                  <Note tone="warn">{id === 'photo'
                    ? <span><b>{t('Checked instantly: the top of your head is cut off.', 'तुरंत जांचा गया: आपके सिर का ऊपरी हिस्सा कट गया है।', 'त्वरित तपासले: तुमच्या डोक्याचा वरचा भाग कापला गेला आहे.')}</b> {t('Hold the camera further away. The counter would have sent you back for this.', 'कैमरे को और दूर रखें। काउंटर पर इसके लिए आपको वापस भेज दिया जाता।', 'कॅमेरा आणखी दूर ठेवा. काउंटरवर यासाठी तुम्हाला परत पाठवले असते.')}</span>
                    : <span><b>{t('Checked instantly: the signature runs off the edge of the paper.', 'तुरंत जांचा गया: हस्ताक्षर कागज़ के किनारे से बाहर जा रहा है।', 'त्वरित तपासले: स्वाक्षरी कागदाच्या कडेबाहेर जाते आहे.')}</b> {t('Sign in the middle and shoot straight down.', 'बीच में हस्ताक्षर करें और सीधा ऊपर से फोटो लें।', 'मध्ये स्वाक्षरी करा आणि सरळ वरून फोटो घ्या.')}</span>}</Note>
                )}
                {status === 'ok' && <span className="tiny row g6" style={{ color: 'var(--ok)', paddingLeft: 2 }}>{Icon.check()} {id === 'photo' ? t('Cropped to 35 × 45 mm, saved at 16 KB, face matches your identity document', '35 × 45 mm में क्रॉप किया, 16 KB में सेव किया, चेहरा आपके पहचान दस्तावेज़ से मेल खाता है', '35 × 45 mm मध्ये क्रॉप केले, 16 KB मध्ये सेव्ह केले, चेहरा तुमच्या ओळख कागदपत्राशी जुळतो') : t('Cropped to 256 × 64 px, saved at 12 KB', '256 × 64 px में क्रॉप किया, 12 KB में सेव किया', '256 × 64 px मध्ये क्रॉप केले, 12 KB मध्ये सेव्ह केले')}</span>}
              </div>
            );
          })}
      </div>
    </div>
  );
}

/** Row labels translated by lookup, since the English string doubles as the row's React key. */
const REVIEW_ROW_LABEL: Record<string, [string, string]> = {
  'Applying in': ['जहां आवेदन कर रहे हैं', 'जिथे अर्ज करत आहात'],
  Route: ['रास्ता', 'मार्ग'],
  Name: ['नाम', 'नाव'],
  'Date of birth': ['जन्म तिथि', 'जन्मतारीख'],
  Email: ['ईमेल', 'ईमेल'],
  'Present address': ['वर्तमान पता', 'सध्याचा पत्ता'],
  'Classes applied for': ['आवेदित श्रेणियां', 'अर्ज केलेले वर्ग'],
  'Form 1': ['फॉर्म 1', 'फॉर्म 1'],
  'Organ donation': ['अंग दान', 'अवयवदान'],
  Documents: ['दस्तावेज़', 'कागदपत्रे'],
};

/** Step 10 — read-only review of every answer, e-sign, and the abuse-check captcha. */
export function ReviewAndSubmit({ form, updateForm, classIds, totalFee, goToStep, isAadhaar, form1Answers }: StepProps) {
  const t = useT();
  const prefill = preFor(form.state);
  const valueOf = <K extends keyof ApplicationForm & keyof typeof prefill>(key: K) => form[key] !== undefined ? form[key] : prefill[key];
  const office = rtosFor(form.state || 'Maharashtra').find(r => r.id === form.rto) || rtosFor(form.state || 'Maharashtra')[0];

  const rows: [label: string, value: string, editStep: number][] = [
    ['Applying in', `${form.state || 'Maharashtra'} · ${office.name}`, 0],
    ['Route', isAadhaar ? t('Aadhaar e-KYC · faceless, no RTO visit', 'आधार e-KYC · फेसलेस, आरटीओ यात्रा नहीं', 'आधार e-KYC · फेसलेस, आरटीओ भेट नाही') : t('Without Aadhaar · in-person verification', 'आधार के बिना · व्यक्तिगत सत्यापन', 'आधारशिवाय · प्रत्यक्ष पडताळणी'), 1],
    ['Name', [valueOf('first'), valueOf('mid'), valueOf('last')].filter(Boolean).join(' '), 4],
    ['Date of birth', valueOf('dob') as string, 4],
    ['Email', valueOf('email') as string, 4],
    ['Present address', `${valueOf('line')}, ${valueOf('street')}, ${valueOf('city')} ${valueOf('pin')}`, 5],
    ['Classes applied for', classIds.map(id => CLASSES.find(c => c.id === id)!.code).join(', ') || t('none', 'कोई नहीं', 'काहीही नाही'), 6],
    ['Form 1', FORM1.every(([key, , safeAnswer]) => form1Answers[key] === safeAnswer) ? t('All six answered, no condition declared', 'सभी छह के उत्तर दिए, कोई शर्त घोषित नहीं', 'सर्व सहा उत्तरे दिली, कोणतीही अट घोषित नाही') : t('Answered, one or more conditions declared', 'उत्तर दिए, एक या अधिक शर्तें घोषित', 'उत्तरे दिली, एक किंवा अधिक अटी घोषित'), 7],
    ['Organ donation', form.organ || '—', 7],
    ['Documents', isAadhaar ? t('Exempt — from e-KYC. Signature captured.', 'छूट — e-KYC से। हस्ताक्षर लिया गया।', 'सूट — e-KYC मधून. स्वाक्षरी घेतली.') : t('2 uploaded, photo and signature captured', '2 अपलोड किए गए, फोटो और हस्ताक्षर लिए गए', '2 अपलोड केले, फोटो आणि स्वाक्षरी घेतली'), 8],
  ];

  return (
    <div className="col g20">
      <Purpose
        what={t("You're reading back everything you entered, one last time, before it becomes official.", 'आप जो कुछ भरा है उसे एक आखिरी बार पढ़ रहे हैं, इसके आधिकारिक बनने से पहले।', 'तुम्ही जे काही भरले आहे ते एकदा शेवटचे वाचत आहात, ते अधिकृत होण्यापूर्वी.')}
        because={t('Your name and date of birth lock the moment you submit — changing either after this needs a brand new application and a new fee.', 'जमा करते ही आपका नाम और जन्म तिथि लॉक हो जाते हैं — इसके बाद किसी को बदलने के लिए बिल्कुल नया आवेदन और नई फीस चाहिए।', 'सादर केल्याक्षणी तुमचे नाव आणि जन्मतारीख लॉक होतात — यानंतर कोणतेही बदलण्यासाठी अगदी नवीन अर्ज आणि नवीन फी आवश्यक आहे.')}
        why={t('Every line here has an Edit button straight back to where you can fix it — so this is your last free chance, not a formality.', 'यहां हर लाइन में एक Edit बटन है जो सीधे उस जगह ले जाता है जहां आप उसे ठीक कर सकते हैं — तो यह आपका आखिरी मुफ्त मौका है, कोई औपचारिकता नहीं।', 'इथे प्रत्येक ओळीत एक Edit बटण आहे जे थेट तिथे घेऊन जाते जिथे तुम्ही ती दुरुस्त करू शकता — त्यामुळे ही तुमची शेवटची मोफत संधी आहे, औपचारिकता नाही.')} />
      <div className="card card-p col g14">
        {rows.map(([label, value, editStep]) => (
          <div key={label}>
            <div className="row between g16" style={{ alignItems: 'flex-start' }}>
              <span className="col g4" style={{ minWidth: 0 }}><span className="sub">{REVIEW_ROW_LABEL[label] ? t(label, ...REVIEW_ROW_LABEL[label]) : label}</span><b style={{ fontWeight: 600, wordBreak: 'break-word' }}>{value}</b></span>
              <button className="btn btn-g btn-sm" onClick={() => { goToStep(editStep); scrollToTop(); }}>{t('Edit', 'संपादित करें', 'संपादित करा')}</button>
            </div>
            <hr className="hr" style={{ marginTop: 12 }} />
          </div>
        ))}
        <div className="row between g12 wrapf">
          <span className="col g4"><span className="sub">{t('Fee payable next', 'अगली फीस देय', 'पुढील देय फी')}</span><b style={{ fontSize: '1.5rem', fontFamily: 'var(--disp)' }}>₹{totalFee}</b></span>
          <span className="tiny" style={{ maxWidth: 290, textAlign: 'right' }}>{t('Government fee only. No agent charge, no service charge, nothing collected at the office.', 'केवल सरकारी फीस। कोई एजेंट चार्ज नहीं, कोई सेवा शुल्क नहीं, कार्यालय में कुछ भी नहीं लिया जाता।', 'फक्त सरकारी फी. एजंट शुल्क नाही, सेवा शुल्क नाही, कार्यालयात काहीही घेतले जात नाही.')}</span>
        </div>
      </div>
      <div className="card card-p col g14">
        <div className="row between g12 wrapf"><h3>{t('E-sign the application', 'आवेदन पर ई-हस्ताक्षर करें', 'अर्जावर ई-स्वाक्षरी करा')}</h3><span className="tiny mono">Stage 4 of 8</span></div>
        <p className="sub">{t('A separate stage on the official portal, easily missed, and the application cannot move without it. It is an Aadhaar OTP against the completed form — the digital equivalent of signing the printout.', 'आधिकारिक पोर्टल पर एक अलग चरण, जो आसानी से छूट जाता है, और इसके बिना आवेदन आगे नहीं बढ़ता। यह पूरे फॉर्म पर एक आधार OTP है — प्रिंटआउट पर हस्ताक्षर करने का डिजिटल रूप।', 'अधिकृत पोर्टलवर एक वेगळा टप्पा, जो सहज चुकतो, आणि त्याशिवाय अर्ज पुढे जात नाही. हा पूर्ण फॉर्मवर एक आधार OTP आहे — प्रिंटआउटवर स्वाक्षरी करण्याचे डिजिटल रूप.')}</p>
        <button className="tile" role="checkbox" aria-checked={!!form.esign} onClick={() => updateForm({ esign: !form.esign })}>
          <span className="tick" style={{ borderRadius: 6 }}>{form.esign ? Icon.check() : null}</span>
          <span className="sub" style={{ color: 'var(--ink)' }}>{t(`E-sign this application with an OTP to ${form.phone || '98•••• ••21'}. I accept that the e-signed form is the legal application.`, `${form.phone || '98•••• ••21'} पर OTP से इस आवेदन पर ई-हस्ताक्षर करें। मैं स्वीकार करता/करती हूं कि ई-हस्ताक्षरित फॉर्म ही कानूनी आवेदन है।`, `${form.phone || '98•••• ••21'} वर OTP द्वारे या अर्जावर ई-स्वाक्षरी करा. मी मान्य करतो/करते की ई-स्वाक्षरी केलेला फॉर्म हाच कायदेशीर अर्ज आहे.`)}</span>
        </button>
        {form.esign && <div className="fade"><Note tone="ok" icon={Icon.check()}>{t('Signed. A copy of the e-signed Form 2 will be attached to your reference slip.', 'हस्ताक्षरित। ई-हस्ताक्षरित फॉर्म 2 की एक प्रति आपकी संदर्भ पर्ची से जोड़ी जाएगी।', 'स्वाक्षरी केली. ई-स्वाक्षरी केलेल्या फॉर्म 2 ची एक प्रत तुमच्या संदर्भ चिठ्ठीला जोडली जाईल.')}</Note></div>}
      </div>
      <Captcha ok={!!form.captchaOk} onOk={v => updateForm({ captchaOk: v })} />
    </div>
  );
}
