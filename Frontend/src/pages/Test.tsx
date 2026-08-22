import { useState } from 'react';
import { QUESTIONS } from '../data/theoryTest';
import { useT } from '../lib/language';
import { scrollToTop } from '../lib/scrollToTop';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Progress } from '../ui/SharedUI';

/** The 10-question learner's theory test — six correct passes, every answer explained on reveal. */
export function Test({ go, state, update }: PageProps) {
  const t = useT();
  const isAadhaar = state.form?.route === 'aadhaar';
  const [index, setIndex] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const question = QUESTIONS[index];
  const isLast = index === QUESTIONS.length - 1;
  if (index >= QUESTIONS.length) return null;

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <div className="col g16" style={{ marginBottom: 22 }}>
        <Progress cur={index} total={QUESTIONS.length} label={t("Learner's test · stage 8 of 8", 'लर्नर टेस्ट · चरण 8 में से 8', 'लर्नर टेस्ट · टप्पा 8 पैकी 8')} />
        <Note>{isAadhaar ? t('Ten questions in the real test, six correct to pass, taken from home with a password sent by SMS.', 'असली टेस्ट में दस सवाल, पास होने के लिए छह सही, SMS से भेजे पासवर्ड के साथ घर से दी जाती है।', 'खऱ्या टेस्टमध्ये दहा प्रश्न, उत्तीर्ण होण्यासाठी सहा बरोबर, SMS ने पाठवलेल्या पासवर्डसह घरून दिली जाते.') : t('Ten questions in the real test, six correct to pass, taken at the office.', 'असली टेस्ट में दस सवाल, पास होने के लिए छह सही, कार्यालय में दी जाती है।', 'खऱ्या टेस्टमध्ये दहा प्रश्न, उत्तीर्ण होण्यासाठी सहा बरोबर, कार्यालयात दिली जाते.')} {t('A fail costs the ₹50 test fee again and a rebooking, so every answer here explains itself.', 'फेल होने पर फिर से ₹50 टेस्ट फीस और नई बुकिंग लगती है, इसलिए यहां हर जवाब खुद समझाया गया है।', 'नापास झाल्यास पुन्हा ₹50 टेस्ट फी आणि नवीन बुकिंग लागते, त्यामुळे इथे प्रत्येक उत्तर स्वतः स्पष्ट केले आहे.')}</Note>
      </div>
      <div className="card card-p col g20">
        <h2 style={{ fontSize: '1.3rem' }}>{question.q}</h2>
        <div className="col g10" role="radiogroup">
          {question.a.map((answer, n) => {
            const isCorrect = n === question.c;
            const chosen = pick === n;
            const style = revealed && isCorrect ? { borderColor: 'var(--ok)', background: 'var(--ok-soft)' } : revealed && chosen && !isCorrect ? { borderColor: 'var(--bad)', background: 'var(--bad-soft)' } : undefined;
            return (
              <button key={n} className="tile" role="radio" aria-checked={chosen} style={style} disabled={revealed} onClick={() => setPick(n)}>
                <span className="tick">{chosen ? Icon.check() : null}</span><span style={{ fontWeight: 500 }}>{answer}</span>
              </button>
            );
          })}
        </div>
        {revealed && (
          <div className="fade col g14">
            <Note tone={pick === question.c ? 'ok' : 'warn'} icon={pick === question.c ? Icon.check() : undefined}><b>{pick === question.c ? t('Correct.', 'सही।', 'बरोबर.') : t('Not quite.', 'बिल्कुल नहीं।', 'अगदी बरोबर नाही.')}</b> {question.ex}</Note>
            <button className="btn btn-p" onClick={() => {
              if (isLast) { update({ stage: 'issued', score }); go('issued'); }
              else { setIndex(index + 1); setPick(null); setRevealed(false); scrollToTop(); }
            }}>{isLast ? t('Finish and see the result', 'समाप्त करें और परिणाम देखें', 'पूर्ण करा आणि निकाल पहा') : t('Next question', 'अगला सवाल', 'पुढील प्रश्न')} {Icon.right()}</button>
          </div>
        )}
        {!revealed && <button className="btn btn-p" disabled={pick === null} onClick={() => { if (pick === question.c) setScore(score + 1); setRevealed(true); }}>{t('Check answer', 'जवाब जांचें', 'उत्तर तपासा')}</button>}
      </div>
      <div style={{ height: 56 }} />
    </div>
  );
}
