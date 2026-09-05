/**
 * PARKED. The five steps of the Form 4 driving-licence wizard.
 *
 * Nothing imports this file. The driving test needed one screen rather than a
 * wizard — the citizen is signed in, so the service looks their learner's
 * licence up instead of asking them to confirm details it already holds, and
 * books the appointment against that same application. See pages/DrivingLicence.tsx.
 *
 * Kept because the steps themselves are a fair reading of the real Form 4
 * process, and because `BookTest` below is the before-and-after: it draws a
 * date grid from a frozen array, which is exactly what the live screen replaced.
 */
import { FORM1 } from '../../data/documents';
import { FEE_DL } from '../../data/fees';
import { DAYS, rtosFor, TIMES } from '../../data/rtoOffices';
import { CLASSES } from '../../data/vehicleClasses';
import { useT } from '../../lib/language';
import { Icon } from '../../ui/Icon';
import { Note, Pill, Purpose, Tile } from '../../ui/SharedUI';

export interface DlFormState {
  classIds: string[];
  confirmed: boolean;
  f1: Record<string, string>;
  f1sign: boolean;
  form1a: boolean;
  paid: boolean;
  officeId: string;
  day: string | null;
  time: string | null;
}

export interface DlStepProps {
  dl: DlFormState;
  updateDl: (patch: Partial<DlFormState>) => void;
  baseClassIds: string[];
  holderName: string;
  holderDob: string;
  addressLine1: string;
  addressLine2: string;
  llNo: string;
  stateName: string;
}

/** Step 1 — confirm the details carried over from the learner's licence, and pick which classes to endorse. */
export function ConfirmForm4({ dl, updateDl, baseClassIds, holderName, holderDob, addressLine1, addressLine2, llNo }: DlStepProps) {
  const t = useT();
  const toggleClass = (id: string) => updateDl({ classIds: dl.classIds.includes(id) ? dl.classIds.filter(x => x !== id) : [...dl.classIds, id] });
  return (
    <div className="col g20">
      <Purpose
        what={t("You're confirming the details carried over from your learner's licence, and picking which vehicle classes to make permanent.", 'आप अपने लर्नर लाइसेंस से आए विवरण की पुष्टि कर रहे हैं, और तय कर रहे हैं कि कौन सी वाहन श्रेणियां स्थायी बनानी हैं।', 'तुम्ही तुमच्या लर्नर लायसन्सवरून आलेल्या तपशीलांची पुष्टी करत आहात, आणि कोणते वाहन वर्ग कायमस्वरूपी करायचे ते ठरवत आहात.')}
        because={t("You don't have to take every class you learned on — you can endorse just the ones you actually plan to drive.", 'आपको वे सभी श्रेणियां लेनी ज़रूरी नहीं जिन पर आपने सीखा — आप केवल उन्हीं को शामिल कर सकते हैं जिन्हें आप वास्तव में चलाना चाहते हैं।', 'तुम्ही शिकलेले सर्व वर्ग घेणे आवश्यक नाही — तुम्ही फक्त तेच वर्ग समाविष्ट करू शकता जे तुम्ही खरोखर चालवण्याचा विचार करत आहात.')}
        why={t("Skipping a class you don't need now means skipping its share of the fee too.", 'जो श्रेणी अभी नहीं चाहिए उसे छोड़ना मतलब उसकी फीस भी बचाना।', 'आता जो वर्ग नको आहे तो वगळणे म्हणजे त्याचा फीचा वाटाही वगळणे.')} />
      <div className="card card-p col g16">
        <h3>Carried over from {llNo}</h3>
        <dl className="kv">
          <dt>Name</dt><dd>{holderName}</dd>
          <dt>Date of birth</dt><dd>{holderDob}</dd>
          <dt>Address</dt><dd>{addressLine1}, {addressLine2}</dd>
        </dl>
      </div>
      <div className="card card-p col g16">
        <span className="label">Classes to endorse</span>
        {baseClassIds.map(id => {
          const cls = CLASSES.find(c => c.id === id)!;
          return <Tile key={id} checked={dl.classIds.includes(id)} onClick={() => toggleClass(id)} title={cls.name} desc={cls.code} />;
        })}
      </div>
      <button className="tile" role="checkbox" aria-checked={dl.confirmed} onClick={() => updateDl({ confirmed: !dl.confirmed })}>
        <span className="tick" style={{ borderRadius: 6 }}>{dl.confirmed ? Icon.check() : null}</span>
        <span className="sub" style={{ color: 'var(--ink)' }}>I confirm these details are correct.</span>
      </button>
    </div>
  );
}

/** Step 2 — Form 1 re-declared against the endorsed classes, with Form 1A if any of them is a transport class. */
export function Form1Again({ dl, updateDl }: DlStepProps) {
  const t = useT();
  const needsMedical = dl.classIds.some(id => CLASSES.find(c => c.id === id)?.medical);
  const setAnswer = (key: string, value: string) => updateDl({ f1: { ...dl.f1, [key]: value } });
  return (
    <div className="col g20">
      <Purpose
        what={t("You're re-declaring your medical fitness, this time against the classes you're actually endorsing.", 'आप अपनी चिकित्सकीय फिटनेस फिर से घोषित कर रहे हैं, इस बार उन श्रेणियों के विरुद्ध जो आप वास्तव में शामिल कर रहे हैं।', 'तुम्ही तुमची वैद्यकीय तंदुरुस्ती पुन्हा घोषित करत आहात, यावेळी तुम्ही खरोखर समाविष्ट करत असलेल्या वर्गांविरुद्ध.')}
        because={t("If you're adding a transport class, this is what triggers the requirement for a doctor's certificate.", 'यदि आप एक ट्रांसपोर्ट श्रेणी जोड़ रहे हैं, तो यही डॉक्टर के प्रमाणपत्र की आवश्यकता को ट्रिगर करता है।', 'तुम्ही वाहतूक वर्ग जोडत असाल, तर हेच डॉक्टरच्या प्रमाणपत्राची गरज सुरू करते.')}
        why={t('You find out you need Form 1A now, not on test day, giving you time to actually get it signed.', 'आपको अभी पता चल जाता है कि आपको फॉर्म 1A चाहिए, टेस्ट के दिन नहीं, जिससे इसे साइन कराने का समय मिल जाता है।', 'तुम्हाला आताच कळते की तुम्हाला फॉर्म 1A हवा आहे, टेस्टच्या दिवशी नाही, ज्यामुळे तो स्वाक्षरी करून घ्यायला वेळ मिळतो.')} />
      <div className="card card-p col g16">
        <div className="row between g12 wrapf"><h3>Form 1 — declaration as to physical fitness</h3><span className="tiny mono">See Rule 5(2)</span></div>
        {FORM1.map(([key, question, , questionHi]) => (
          <div key={key} className="col g8">
            <div className="row g10" style={{ alignItems: 'flex-start' }}>
              <span className="mono tiny" style={{ marginTop: 4, color: 'var(--muted)', flex: 'none' }}>({key})</span>
              <span style={{ fontSize: '.95rem', lineHeight: 1.5 }}>{t(question, questionHi)}</span>
            </div>
            <div className="row g10 wrapf" style={{ paddingLeft: 26 }}>
              {(['Yes', 'No'] as const).map(o => (
                <button key={o} className="btn btn-s btn-sm" aria-pressed={dl.f1[key] === o} style={dl.f1[key] === o ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand)' } : undefined} onClick={() => setAnswer(key, o)}>{o}</button>
              ))}
            </div>
          </div>
        ))}
        <button className="tile" role="checkbox" aria-checked={dl.f1sign} onClick={() => updateDl({ f1sign: !dl.f1sign })}>
          <span className="tick" style={{ borderRadius: 6 }}>{dl.f1sign ? Icon.check() : null}</span>
          <span className="sub" style={{ color: 'var(--ink)' }}>I declare that to the best of my knowledge and belief the particulars given above are true.</span>
        </button>
      </div>
      {needsMedical && (
        <div className="card card-p col g14 fade">
          <div className="row between g12"><h3>Form 1A — medical certificate</h3><Pill tone="warn">Required</Pill></div>
          <p className="sub">A transport class needs a fresh certificate from a registered medical practitioner.</p>
          <div className="doc" data-s={dl.form1a ? 'ok' : undefined}>
            <span className="doc-th">{dl.form1a ? <span style={{ color: 'var(--ok)' }}>{Icon.check({ width: 18, height: 18 })}</span> : Icon.doc()}</span>
            <span className="col g4 grow"><b style={{ fontWeight: 600 }}>Signed Form 1A</b><span className="sub">PDF or photo, doctor's registration number visible</span></span>
            <button className="btn btn-s btn-sm" onClick={() => updateDl({ form1a: !dl.form1a })}>{dl.form1a ? 'Replace' : 'Upload'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Step 3 — the driving-licence fee, itemised the same way as the learner's-licence one. */
export function PayDlFee({ dl, updateDl }: DlStepProps) {
  const t = useT();
  const total = FEE_DL.reduce((sum, fee) => sum + fee.v, 0);
  return (
    <div className="col g20">
      <Purpose
        what={t("You're paying the two flat government charges for the licence itself.", 'आप लाइसेंस के लिए दो निश्चित सरकारी शुल्क चुका रहे हैं।', 'तुम्ही लायसन्ससाठी दोन निश्चित सरकारी शुल्क भरत आहात.')}
        because={t('The smart card is already included in the ₹200 — there is no separate charge for it later.', 'स्मार्ट कार्ड ₹200 में पहले से शामिल है — इसके लिए बाद में कोई अलग शुल्क नहीं है।', 'स्मार्ट कार्ड ₹200 मध्ये आधीच समाविष्ट आहे — त्यासाठी नंतर वेगळे शुल्क नाही.')}
        why={t('One clear number, before you pay — the same amount whether one class or several, so there is nothing to be surprised by at the counter.', 'भुगतान से पहले एक स्पष्ट राशि — एक श्रेणी हो या कई, वही राशि, इसलिए काउंटर पर कोई हैरानी नहीं।', 'पैसे भरण्यापूर्वी एक स्पष्ट रक्कम — एक वर्ग असो किंवा अनेक, तीच रक्कम, त्यामुळे काउंटरवर कोणतेही आश्चर्य नाही.')} />
      <div className="card card-p col g14">
        {FEE_DL.map((fee, i) => (
          <div key={i} className="col g4">
            <div className="row between g16"><span style={{ color: 'var(--ink2)' }}>{fee.k}</span><b className="mono" style={{ fontWeight: 600 }}>₹{fee.v}</b></div>
            <span className="tiny mono">{fee.rule}</span>
          </div>
        ))}
        <hr className="hr" />
        <div className="row between g16"><b style={{ fontSize: '1.1rem' }}>Total</b><b style={{ fontSize: '1.35rem', fontFamily: 'var(--disp)' }}>₹{total}</b></div>
      </div>
      {dl.paid
        ? <Note tone="ok" icon={Icon.check()}>Paid and verified. The test fee is charged again only on a retest.</Note>
        : <button className="btn btn-p btn-full" onClick={() => updateDl({ paid: true })}>Pay ₹{total}</button>}
      <Note>Mock payment. Nothing is charged and no real payment details are collected.</Note>
    </div>
  );
}

/** Step 4 — book the practical test at an office with a test track. */
export function BookTest({ dl, updateDl, stateName }: DlStepProps) {
  const t = useT();
  const offices = rtosFor(stateName);
  const officeId = offices.find(o => o.id === dl.officeId) ? dl.officeId : offices[0].id;
  const office = offices.find(o => o.id === officeId)!;
  return (
    <div className="col g20">
      <Purpose
        what={t("You're booking the one thing this whole journey has been leading to — your actual driving test.", 'आप वह बुक कर रहे हैं जिसकी ओर यह पूरी यात्रा जा रही थी — आपका असली ड्राइविंग टेस्ट।', 'तुम्ही तेच बुक करत आहात ज्याकडे हा संपूर्ण प्रवास जात होता — तुमची खरी ड्रायव्हिंग टेस्ट.')}
        because={t('Only offices with a real test track are shown, and you are told upfront that you must bring your own tested vehicle.', 'केवल असली टेस्ट ट्रैक वाले कार्यालय दिखाए जाते हैं, और आपको पहले ही बताया जाता है कि आपको अपना परखा हुआ वाहन लाना होगा।', 'फक्त खऱ्या टेस्ट ट्रॅकसह कार्यालये दाखवली जातात, आणि तुम्हाला आधीच सांगितले जाते की तुम्ही तुमचे स्वतःचे तपासलेले वाहन आणावे लागेल.')}
        why={t('Finding out about the vehicle requirement now — not on test day — is the difference between passing and a wasted trip.', 'वाहन की आवश्यकता के बारे में अभी पता चलना — टेस्ट के दिन नहीं — पास होने और बेकार यात्रा के बीच का अंतर है।', 'वाहनाच्या गरजेबद्दल आताच कळणे — टेस्टच्या दिवशी नाही — उत्तीर्ण होणे आणि वाया गेलेली फेरी यातील फरक आहे.')} />
      <div className="col g12"><span className="label">Choose a test track</span>
        {offices.map(o => (
          <Tile key={o.id} checked={officeId === o.id} onClick={() => updateDl({ officeId: o.id, day: null, time: null })} title={o.name} desc={t(`${o.area} · ${o.km} km away`, `${o.area} · ${o.km} किमी दूर`, `${o.area} · ${o.km} किमी दूर`)}
            right={<Pill tone={o.load === 'light' ? 'ok' : 'warn'}>{o.load === 'light' ? 'Light day' : 'Busy'}</Pill>} />
        ))}
      </div>
      <div className="card card-p col g16">
        <h3>Pick a date</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(104px,1fr))', gap: 10 }}>
          {DAYS.map(d => (
            <button key={d.d} className="slot" aria-pressed={dl.day === d.d} disabled={!d.left} onClick={() => updateDl({ day: d.d, time: null })}>
              <span className="col g4"><b style={{ fontWeight: 600, fontSize: '.92rem' }}>{d.d}</b><span className="tiny">{d.left ? d.left + ' left' : 'Full'}</span></span>
            </button>
          ))}
        </div>
        {dl.day && (
          <div className="col g12 fade"><hr className="hr" /><h3>Pick a time</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(104px,1fr))', gap: 10 }}>
              {TIMES.map(x => (
                <button key={x.t} className="slot" aria-pressed={dl.time === x.t} disabled={!x.left} onClick={() => updateDl({ time: x.t })}>
                  <span className="col g4"><b style={{ fontWeight: 600, fontSize: '.92rem' }}>{x.t}</b><span className="tiny">{x.left ? x.left + ' left' : 'Full'}</span></span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {dl.time && <Note tone="brand">Don't own a vehicle of this class? Driving schools at {office.name} rent one with an instructor for the test slot.</Note>}
    </div>
  );
}

/** Step 5 — the practical test itself is a road test, not something a web form can administer; this just confirms attendance. */
export function TakeTest(_props: DlStepProps) {
  const t = useT();
  return (
    <div className="col g20">
      <Purpose
        what={t("You're confirming you're ready for the practical road test.", 'आप पुष्टि कर रहे हैं कि आप व्यावहारिक रोड टेस्ट के लिए तैयार हैं।', 'तुम्ही पुष्टी करत आहात की तुम्ही प्रात्यक्षिक रोड टेस्टसाठी तयार आहात.')}
        because={t('This is a real-world test — reversing, gradient starts, lane discipline — nothing a screen can administer for you.', 'यह एक असली दुनिया का टेस्ट है — रिवर्स करना, चढ़ाई पर शुरुआत, लेन अनुशासन — कोई स्क्रीन आपके लिए यह नहीं करा सकती।', 'ही एक खऱ्या जगातील टेस्ट आहे — रिव्हर्स करणे, चढावर सुरुवात, लेन शिस्त — कोणतीही स्क्रीन तुमच्यासाठी हे घेऊ शकत नाही.')}
        why={t('Knowing exactly what is tested means you walk in prepared, not guessing.', 'यह जानना कि वास्तव में क्या परखा जाता है, मतलब आप तैयार होकर जाते हैं, अंदाज़ा लगाते हुए नहीं।', 'नेमके काय तपासले जाते हे माहीत असणे म्हणजे तुम्ही अंदाज न लावता तयार होऊन जाता.')} />
      <Note tone="brand">Mock prototype: submitting below marks the test as passed and issues the licence immediately, skipping the actual test-day wait.</Note>
    </div>
  );
}
