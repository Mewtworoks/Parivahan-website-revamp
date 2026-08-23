import { useEffect, useState } from 'react';
import { PRE_BASE } from '../data/applicant';
import { feeRows, feeTotal, inWords } from '../data/fees';
import { rtosFor } from '../data/rtoOffices';
import { useT } from '../lib/language';
import type { PageProps } from '../types';
import { Field, Input, Note, Tile, Timeline } from '../ui/SharedUI';
import { Icon } from '../ui/Icon';

type PaymentPhase = 'pick' | 'paying' | 'verify';

const PAYMENT_METHODS: [value: 'upi' | 'card' | 'net', title: [string, string, string], desc: [string, string, string]][] = [
  ['upi', ['UPI', 'UPI', 'UPI'], ['Any app — GPay, PhonePe, Paytm, BHIM', 'कोई भी ऐप — GPay, PhonePe, Paytm, BHIM', 'कोणतेही अ‍ॅप — GPay, PhonePe, Paytm, BHIM']],
  ['card', ['Debit or credit card', 'डेबिट या क्रेडिट कार्ड', 'डेबिट किंवा क्रेडिट कार्ड'], ['', '', '']],
  ['net', ['Net banking', 'नेट बैंकिंग', 'नेट बँकिंग'], ["Through the state treasury gateway — CFMS, SBI ePay or the state's own", 'राज्य कोषागार गेटवे के ज़रिए — CFMS, SBI ePay या राज्य का अपना', 'राज्य कोषागार गेटवेद्वारे — CFMS, SBI ePay किंवा राज्याचे स्वतःचे']],
];

/** Fee payment — itemised total, a mock payment method picker, then a simulated bank confirmation. */
export function Pay({ go, state, update }: PageProps) {
  const t = useT();
  const form = state.form || {};
  const classIds = form.classes || ['MCWG'];
  const stateName = form.state || 'Maharashtra';
  const rows = feeRows(classIds, stateName);
  const total = feeTotal(classIds, stateName);
  const office = rtosFor(stateName).find(r => r.id === form.rto) || rtosFor(stateName)[0];

  const [phase, setPhase] = useState<PaymentPhase>('pick');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft(v => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  const started = phase !== 'pick';
  useEffect(() => {
    if (!started) return;
    const toVerify = setTimeout(() => setPhase('verify'), 1100);
    const toReceipt = setTimeout(() => { update({ stage: 'paid' }); go('receipt'); }, 2600);
    return () => { clearTimeout(toVerify); clearTimeout(toReceipt); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <div className="col g10" style={{ marginBottom: 26 }}>
        <span className="eyebrow">Application SS-2026-004182 · stages 5 and 6</span><h1>{t('Pay the fee', 'फीस भरें', 'फी भरा')}</h1>
        <p className="lede">{t('Every line is a statutory charge with a rule behind it. The official portal calculates, collects, verifies and prints a receipt as four separate menu items — here it is one uninterrupted step.', 'हर लाइन एक वैधानिक शुल्क है जिसके पीछे एक नियम है। आधिकारिक पोर्टल गणना, संग्रह, सत्यापन और रसीद प्रिंट को चार अलग मेनू आइटम के रूप में करता है — यहां यह एक निरंतर चरण है।', 'प्रत्येक ओळ ही एक वैधानिक शुल्क आहे ज्यामागे एक नियम आहे. अधिकृत पोर्टल गणना, संकलन, पडताळणी आणि पावती छपाई चार वेगळ्या मेनू आयटम म्हणून करते — इथे हा एक सतत टप्पा आहे.')}</p>
      </div>
      <div className="card card-p col g14">
        <div className="row between g12 wrapf">
          <dl className="kv"><dt>{t('Application', 'आवेदन', 'अर्ज')}</dt><dd className="mono">SS-2026-004182</dd><dt>{t('Applicant', 'आवेदक', 'अर्जदार')}</dt><dd>{[form.first ?? PRE_BASE.first, form.last ?? PRE_BASE.last].join(' ')}</dd>
            <dt>{t('RTO', 'आरटीओ', 'आरटीओ')}</dt><dd>{office.name}</dd></dl>
          <span className="pill" style={{ alignSelf: 'flex-start' }}>{Icon.clock()} {t(`Session ${minutes}:${seconds}`, `सेशन ${minutes}:${seconds}`, `सेशन ${minutes}:${seconds}`)}</span>
        </div>
        <hr className="hr" />
        {rows.map((row, i) => (
          <div key={i} className="col g4">
            <div className="row between g16"><span style={{ color: 'var(--ink2)' }}>{row.k}{row.state && <span className="pill" style={{ marginLeft: 8, fontSize: '.66rem' }}>{stateName}</span>}</span><b className="mono" style={{ fontWeight: 600 }}>₹{row.v}</b></div>
            <span className="tiny mono">{row.rule}</span>
          </div>
        ))}
        <hr className="hr" />
        <div className="row between g16"><b style={{ fontSize: '1.1rem' }}>{t('Grand total', 'कुल योग', 'एकूण रक्कम')}</b><b style={{ fontSize: '1.35rem', fontFamily: 'var(--disp)' }}>₹{total}</b></div>
        <span className="tiny">{inWords(total)}</span>
        {rows.some(r => r.state) && <Note tone="warn"><b>{t(`${stateName}'s own charges are in this total.`, `${stateName} के अपने शुल्क इस योग में हैं।`, `${stateName}चे स्वतःचे शुल्क या एकूण रकमेत आहेत.`)}</b> {t('You saw them on the classes screen too, not for the first time here. That is the only difference between this page and the official one.', 'आपने इन्हें श्रेणियों वाली स्क्रीन पर भी देखा था, यहां पहली बार नहीं। यही इस पेज और आधिकारिक पेज के बीच का इकलौता अंतर है।', 'तुम्ही हे वर्गांच्या स्क्रीनवरही पाहिले होते, इथे पहिल्यांदा नाही. हाच या पानाचा आणि अधिकृत पानाचा एकमेव फरक आहे.')}</Note>}
      </div>
      <div className="card card-p col g16" style={{ marginTop: 16 }}>
        {phase === 'pick' ? (
          <>
            <h3>{t('How would you like to pay?', 'आप भुगतान कैसे करना चाहेंगे?', 'तुम्ही पैसे कसे भरायचे इच्छिता?')}</h3>
            <div className="col g10" role="radiogroup">
              {PAYMENT_METHODS.map(([value, title, desc]) => (
                <Tile key={value} checked={(state.paym || 'upi') === value} onClick={() => update({ paym: value })} title={t(...title)} desc={t(...desc)} />
              ))}
            </div>
            <Field label={t('Email for the receipt', 'रसीद के लिए ईमेल', 'पावतीसाठी ईमेल')} hint={t('The official gateway asks for this again at the last moment. Yours is already on the application.', 'आधिकारिक गेटवे इसे आखिरी पल में फिर से मांगता है। आपका यह पहले से आवेदन पर है।', 'अधिकृत गेटवे हे शेवटच्या क्षणी पुन्हा मागतो. तुमचे हे आधीच अर्जावर आहे.')}>
              <Input type="email" defaultValue={form.email ?? PRE_BASE.email} />
            </Field>
            <button className="tile" role="checkbox" aria-checked={termsAccepted} onClick={() => setTermsAccepted(!termsAccepted)}>
              <span className="tick" style={{ borderRadius: 6 }}>{termsAccepted ? Icon.check() : null}</span>
              <span className="sub" style={{ color: 'var(--ink)' }}>{t('I understand that a completed payment is not refunded automatically. For a double payment or an unused service, a refund is claimed from the RTO.', 'मैं समझता/समझती हूं कि पूर्ण भुगतान स्वचालित रूप से वापस नहीं होता। दोहरे भुगतान या अनुपयोगी सेवा के लिए रिफंड आरटीओ से मांगा जाता है।', 'मला समजते की पूर्ण झालेले पेमेंट स्वयंचलितपणे परत होत नाही. दुहेरी पेमेंट किंवा न वापरलेल्या सेवेसाठी परतावा आरटीओकडून मागितला जातो.')}</span>
            </button>
            <Note>{t('Mock payment. Nothing is charged and no real payment details are collected.', 'नकली भुगतान। कुछ भी नहीं लिया जाता और कोई असली भुगतान विवरण एकत्र नहीं किया जाता।', 'नकली पेमेंट. काहीही आकारले जात नाही आणि खरे पेमेंट तपशील गोळा केले जात नाहीत.')}</Note>
            <button className="btn btn-p btn-full" disabled={!termsAccepted} onClick={() => setPhase('paying')}>{t('Pay', 'भुगतान करें', 'पैसे भरा')} ₹{total}</button>
          </>
        ) : (
          <div className="col g16">
            <Timeline items={[
              { state: 'done', title: t('Payment sent to the gateway', 'भुगतान गेटवे को भेजा गया', 'पेमेंट गेटवेला पाठवले'), tag: t('just now', 'अभी', 'आत्ताच') },
              { state: phase === 'verify' ? 'done' : 'now', title: t('Bank confirmation', 'बैंक पुष्टि', 'बँक पुष्टी'), tag: phase === 'verify' ? t('received', 'प्राप्त', 'मिळाले') : t('waiting', 'प्रतीक्षा', 'प्रतीक्षा'), body: phase === 'verify' ? null : t('This is where the official flow ends and asks you to come back later and click Verify Payment Status yourself.', 'यहीं आधिकारिक प्रक्रिया रुक जाती है और आपसे कहती है कि बाद में आकर खुद Verify Payment Status पर क्लिक करें।', 'इथेच अधिकृत प्रक्रिया थांबते आणि तुम्हाला नंतर येऊन स्वतः Verify Payment Status वर क्लिक करण्यास सांगते.') },
              { state: phase === 'verify' ? 'now' : 'todo', title: t('Receipt generated', 'रसीद तैयार हुई', 'पावती तयार झाली'), body: t('We poll for you and move you on. A pending payment never becomes your problem to chase.', 'हम आपके लिए जांचते रहते हैं और आगे बढ़ाते हैं। लंबित भुगतान कभी भी आपकी पीछे भागने की समस्या नहीं बनता।', 'आम्ही तुमच्यासाठी तपासत राहतो आणि पुढे नेतो. प्रलंबित पेमेंट कधीही तुमची पाठलाग करण्याची समस्या बनत नाही.') },
            ]} />
            <button className="btn btn-s" onClick={() => { update({ stage: 'paid' }); go('receipt'); }}>{t('Continue to receipt', 'रसीद पर जाएं', 'पावतीकडे जा')} {Icon.right()}</button>
          </div>
        )}
      </div>
      <div style={{ height: 56 }} />
    </div>
  );
}
